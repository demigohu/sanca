'use client';

import { useState } from 'react';
import { nativeToScVal } from '@stellar/stellar-sdk';
import { useContractInvoke } from './useContractInvoke';

export function useWithdraw(poolAddress: string | undefined) {
  const { invoke, userAddress } = useContractInvoke();
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hash, setHash] = useState<string | undefined>();

  async function withdraw() {
    if (!poolAddress) throw new Error('Pool address is required');
    if (!userAddress) throw new Error('Wallet not ready');
    setIsPending(true);
    setError(null);
    try {
      const txHash = await invoke(poolAddress, 'withdraw', [
        nativeToScVal(userAddress, { type: 'address' }),
      ]);
      setHash(txHash);
      setIsSuccess(true);
      return txHash;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to withdraw');
      setError(err);
      throw err;
    } finally {
      setIsPending(false);
      setIsConfirming(false);
    }
  }

  return { withdraw, hash, isPending, isConfirming, isSuccess, error };
}
