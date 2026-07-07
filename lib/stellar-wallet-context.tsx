'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/extended-chains';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { sponsorStellarAccount } from '@/lib/stellar';
import { ensureUsdcTrustlines } from '@/lib/usdc-trustline';
import { isWalletReadyOnChain, WALLET_PREPARING_LABEL } from '@/lib/wallet-setup';
import { WalletSetupDialog } from '@/components/wallet/wallet-setup-dialog';

export type WalletSetupPhase = 'idle' | 'creating' | 'sponsoring' | 'trustline' | 'ready' | 'error';

type StellarWalletContextValue = {
  address: string | null;
  creating: boolean;
  sponsoring: boolean;
  sponsorError: string | null;
  trustlineSetup: boolean;
  trustlineError: string | null;
  preparing: boolean;
  setupError: string | null;
  walletReady: boolean;
  phase: WalletSetupPhase;
  retryWalletSetup: () => void;
};

const StellarWalletContext = createContext<StellarWalletContextValue | null>(null);

export function StellarWalletProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { signRawHash } = useSignRawHash();

  const [creating, setCreating] = useState(false);
  const [sponsoring, setSponsoring] = useState(false);
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  const [trustlineSetup, setTrustlineSetup] = useState(false);
  const [trustlineError, setTrustlineError] = useState<string | null>(null);
  const [sponsorDone, setSponsorDone] = useState(false);
  const [onChainReady, setOnChainReady] = useState<boolean | null>(null);
  const setupRunRef = useRef<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const retryWalletSetup = useCallback(() => {
    setupRunRef.current = null;
    setSponsorError(null);
    setTrustlineError(null);
    setOnChainReady(null);
    setRetryNonce((n) => n + 1);
  }, []);

  const stellarAccount = user?.linkedAccounts.find(
    (a) => a.type === 'wallet' && (a as { chainType?: string }).chainType === 'stellar',
  );
  const address = (stellarAccount as { address?: string })?.address ?? null;

  // Privy: create embedded Stellar wallet once per login.
  useEffect(() => {
    if (!ready || !authenticated || address || creating) return;
    setCreating(true);
    createWallet({ chainType: 'stellar' })
      .catch((err) => console.error('[createWallet]', err))
      .finally(() => setCreating(false));
  }, [ready, authenticated, address, creating, createWallet]);

  // Skip setup when account + trustlines already exist (e.g. after refresh).
  useEffect(() => {
    if (!authenticated || !address) {
      setOnChainReady(null);
      return;
    }

    let cancelled = false;
    void isWalletReadyOnChain(address)
      .then((ready) => {
        if (cancelled) return;
        setOnChainReady(ready);
        if (ready) {
          setupRunRef.current = address;
          setSponsorDone(true);
          setSponsorError(null);
          setTrustlineError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setOnChainReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authenticated, address, retryNonce]);

  const runWalletSetup = useCallback(
    async (targetAddress: string) => {
      setSponsorError(null);
      setTrustlineError(null);
      setSponsorDone(false);
      setSponsoring(true);

      try {
        const sponsorResult = await sponsorStellarAccount(targetAddress);
        if (sponsorResult.created) {
          console.info('[sponsor] Created account', targetAddress, sponsorResult.hash);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSponsorError(message);
        throw err;
      } finally {
        setSponsoring(false);
        setSponsorDone(true);
      }

      setTrustlineSetup(true);
      try {
        const trustResult = await ensureUsdcTrustlines({
          address: targetAddress,
          signRawHash,
        });
        if (trustResult.created) {
          console.info('[trustline] Added issuers', trustResult.issuers, trustResult.hash);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setTrustlineError(message);
        throw err;
      } finally {
        setTrustlineSetup(false);
      }
    },
    [signRawHash],
  );

  // Single setup pipeline per address (not per hook instance).
  useEffect(() => {
    if (!authenticated || !address) {
      setupRunRef.current = null;
      setSponsorDone(false);
      return;
    }
    if (onChainReady !== false) return;
    if (setupRunRef.current === address) return;
    setupRunRef.current = address;

    void runWalletSetup(address)
      .then(async () => {
        const ready = await isWalletReadyOnChain(address);
        setOnChainReady(ready);
      })
      .catch(async () => {
        const ready = await isWalletReadyOnChain(address);
        if (ready) {
          setOnChainReady(true);
          setSponsorError(null);
          setTrustlineError(null);
          setSponsorDone(true);
        }
      });
  }, [authenticated, address, onChainReady, runWalletSetup, retryNonce]);

  const preparing = creating || sponsoring || trustlineSetup;
  const setupError = sponsorError || trustlineError;
  const walletReady =
    !!address &&
    !creating &&
    !sponsoring &&
    !trustlineSetup &&
    !setupError &&
    (sponsorDone || onChainReady === true);

  let phase: WalletSetupPhase = 'idle';
  if (setupError && onChainReady !== true) phase = 'error';
  else if (walletReady) phase = 'ready';
  else if (trustlineSetup) phase = 'trustline';
  else if (sponsoring) phase = 'sponsoring';
  else if (creating) phase = 'creating';

  const showSetupDialog =
    authenticated &&
    !!address &&
    onChainReady !== true &&
    (preparing || !!setupError);

  const value: StellarWalletContextValue = {
    address,
    creating,
    sponsoring,
    sponsorError,
    trustlineSetup,
    trustlineError,
    preparing,
    setupError,
    walletReady,
    phase,
    retryWalletSetup,
  };

  return (
    <StellarWalletContext.Provider value={value}>
      {children}
      <WalletSetupDialog
        open={showSetupDialog}
        phase={phase}
        error={setupError}
        label={WALLET_PREPARING_LABEL}
        onRetry={retryWalletSetup}
      />
    </StellarWalletContext.Provider>
  );
}

export function useStellarWallet(): StellarWalletContextValue {
  const ctx = useContext(StellarWalletContext);
  if (!ctx) {
    throw new Error('useStellarWallet must be used within StellarWalletProvider');
  }
  return ctx;
}
