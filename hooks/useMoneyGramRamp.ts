'use client';

import { useCallback, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useStellarWallet } from './useStellarWallet';
import { useSignStellarTx } from './useSignStellarTx';
import { getSep10Token } from '@/lib/moneygram/sep10';
import {
  getSep24Info,
  getSep24Transaction,
  initiateSep24Interactive,
  submitWithdrawPayment,
} from '@/lib/moneygram/sep24';
import {
  getAppDomain,
  getMoneyGramDomain,
  MONEYGRAM_CLIENT_COSIGN,
  MONEYGRAM_MOCK,
} from '@/lib/moneygram/config';
import type { MoneyGramRampMessage } from '@/lib/moneygram/post-message';
import { buildSep9FromPrivyUser } from '@/lib/moneygram/sep9';
import type { Sep24Transaction } from '@/lib/moneygram/types';
import { WALLET_PREPARING_LABEL } from '@/lib/wallet-setup';

export type RampKind = 'deposit' | 'withdraw';

export type RampStep =
  | 'idle'
  | 'authenticating'
  | 'starting'
  | 'interactive'
  | 'polling'
  | 'sending'
  | 'completed'
  | 'error';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWithdrawReady(tx: Sep24Transaction) {
  return tx.status === 'pending_user_transfer_complete' || tx.status === 'completed';
}

export function useMoneyGramRamp(kind: RampKind) {
  const { ready, authenticated, login, user } = usePrivy();
  const { address, walletReady, preparing, setupError } = useStellarWallet();
  const { signTransactionXdr } = useSignStellarTx();

  const [step, setStep] = useState<RampStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [interactiveUrl, setInteractiveUrl] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<Sep24Transaction | null>(null);

  const authTokenRef = useRef<string | null>(null);
  const txIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const withdrawSubmittedRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const cosignTransactionXdr = useCallback(async (partialSignedXdr: string) => {
    const res = await fetch('/api/moneygram/cosign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: partialSignedXdr }),
    });
    const json = (await res.json()) as { transaction?: string; error?: string };
    if (!res.ok || !json.transaction) {
      throw new Error(json.error || 'Client domain co-sign failed');
    }
    return json.transaction;
  }, []);

  const trySubmitWithdraw = useCallback(
    async (tx: Sep24Transaction, txId: string, token: string) => {
      if (kind !== 'withdraw' || tx.status !== 'pending_user_transfer_start') return;
      if (withdrawSubmittedRef.current === tx.id) return;
      if (!address) {
        setStep('error');
        setError('Wallet not ready');
        return;
      }

      withdrawSubmittedRef.current = tx.id;
      stopPolling();
      setStep('sending');
      setInteractiveUrl(null);

      try {
        await submitWithdrawPayment({
          userPublicKey: address,
          transaction: tx,
          signTransactionXdr,
        });
        setStep('polling');
        pollTimerRef.current = setInterval(() => {
          void pollTransaction(txId, token);
        }, 3000);
        void pollTransaction(txId, token);
      } catch (sendErr) {
        withdrawSubmittedRef.current = null;
        setStep('error');
        setError(sendErr instanceof Error ? sendErr.message : 'Withdraw payment failed');
      }
    },
    [address, kind, signTransactionXdr, stopPolling],
  );

  const pollTransaction = useCallback(
    async (txId: string, token: string) => {
      const domain = getMoneyGramDomain();
      const tx = await getSep24Transaction({
        moneyGramDomain: domain,
        authToken: token,
        transactionId: txId,
      });
      setTransaction(tx);

      if (tx.status === 'error' || tx.status === 'expired') {
        stopPolling();
        setStep('error');
        setError(tx.message || `Transaction ${tx.status}`);
        setInteractiveUrl(null);
        return;
      }

      if (kind === 'withdraw' && tx.status === 'pending_user_transfer_start') {
        await trySubmitWithdraw(tx, txId, token);
        return;
      }

      if (kind === 'withdraw' && isWithdrawReady(tx)) {
        stopPolling();
        setStep('completed');
        setInteractiveUrl(null);
        return;
      }

      if (kind === 'deposit' && tx.status === 'completed') {
        stopPolling();
        setStep('completed');
        setInteractiveUrl(null);
      }
    },
    [kind, stopPolling, trySubmitWithdraw],
  );

  const handleRampMessage = useCallback(
    (message: MoneyGramRampMessage) => {
      const token = authTokenRef.current;
      const txId = txIdRef.current;
      if (!token || !txId) return;

      if (message.transaction) {
        setTransaction(message.transaction);
        if (kind === 'withdraw' && message.transaction.status === 'pending_user_transfer_start') {
          void trySubmitWithdraw(message.transaction, txId, token);
        }
      }

      if (message.shouldClose) {
        setInteractiveUrl(null);
        if (step === 'interactive') setStep('polling');
      }
    },
    [kind, step, trySubmitWithdraw],
  );

  const startRamp = useCallback(
    async (amount?: string) => {
      setError(null);
      setTransaction(null);
      stopPolling();
      withdrawSubmittedRef.current = null;
      txIdRef.current = null;
      authTokenRef.current = null;

      if (!ready || !authenticated) {
        login();
        return;
      }
      if (!address || preparing) {
        setError(WALLET_PREPARING_LABEL);
        return;
      }
      if (setupError) {
        setError(`Wallet setup failed: ${setupError}`);
        return;
      }
      if (!walletReady) {
        setError(WALLET_PREPARING_LABEL);
        return;
      }

      if (MONEYGRAM_MOCK) {
        setStep('interactive');
        setInteractiveUrl(null);
        await sleep(1500);
        setStep('completed');
        setTransaction({
          id: 'mock-tx',
          kind: kind === 'deposit' ? 'deposit' : 'withdrawal',
          status: 'completed',
          amount_in: amount || '10.00',
          amount_out: amount || '10.00',
        });
        return;
      }

      try {
        setStep('authenticating');
        const domain = getMoneyGramDomain();
        await getSep24Info(domain);

        const token = await getSep10Token({
          moneyGramDomain: domain,
          userPublicKey: address,
          appDomain: getAppDomain(),
          signTransactionXdr,
          cosignTransactionXdr: MONEYGRAM_CLIENT_COSIGN ? cosignTransactionXdr : undefined,
        });
        authTokenRef.current = token;

        setStep('starting');
        const interactive = await initiateSep24Interactive({
          moneyGramDomain: domain,
          authToken: token,
          kind: kind === 'deposit' ? 'deposit' : 'withdraw',
          account: address,
          amount,
          sep9: buildSep9FromPrivyUser(user),
        });

        txIdRef.current = interactive.id;
        setInteractiveUrl(interactive.url);
        setStep('interactive');

        pollTimerRef.current = setInterval(() => {
          void pollTransaction(interactive.id, token);
        }, 4000);
        void pollTransaction(interactive.id, token);
      } catch (err) {
        setStep('error');
        const message = err instanceof Error ? err.message : 'MoneyGram ramp failed';
        if (message.includes('Client domain co-sign failed') || message.includes('503')) {
          setError(
            `${message} — set MONEYGRAM_CLIENT_SIGNING_SECRET on the server (Vercel env).`,
          );
        } else if (message.toLowerCase().includes('client_domain')) {
          setError(
            `${message} — ensure NEXT_PUBLIC_MONEYGRAM_CLIENT_COSIGN=true and domain matches MoneyGram allowlist.`,
          );
        } else {
          setError(message);
        }
        stopPolling();
      }
    },
    [
      address,
      authenticated,
      cosignTransactionXdr,
      kind,
      login,
      pollTransaction,
      preparing,
      ready,
      setupError,
      signTransactionXdr,
      stopPolling,
      user,
      walletReady,
    ],
  );

  const dismissInteractive = useCallback(() => {
    setInteractiveUrl(null);
    if (step === 'interactive') {
      setStep('polling');
    }
  }, [step]);

  const reset = useCallback(() => {
    stopPolling();
    setStep('idle');
    setError(null);
    setInteractiveUrl(null);
    setTransaction(null);
    authTokenRef.current = null;
    txIdRef.current = null;
    withdrawSubmittedRef.current = null;
  }, [stopPolling]);

  return {
    step,
    error,
    interactiveUrl,
    transaction,
    startRamp,
    reset,
    dismissInteractive,
    handleRampMessage,
    isMock: MONEYGRAM_MOCK,
    appDomain: getAppDomain(),
    moneyGramDomain: getMoneyGramDomain(),
    walletPreparing: preparing,
    walletReady,
  };
}
