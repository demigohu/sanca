'use client';

import { useMemo, useState } from 'react';
import { nativeToScVal } from '@stellar/stellar-sdk';
import { useContractInvoke } from './useContractInvoke';
import { usePoolDetail } from './usePools';

export function useJoinPool(poolAddress: string | undefined) {
  const { invoke, userAddress } = useContractInvoke();
  const { data } = usePoolDetail(poolAddress ?? null);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hash, setHash] = useState<string | undefined>();

  const fullCollateral = useMemo(() => {
    if (!data?.pool) return undefined;
    return data.pool.contributionPerPeriod * BigInt(data.pool.maxMembers);
  }, [data?.pool]);

  async function join() {
    if (!poolAddress) throw new Error('Pool address is required');
    if (!userAddress) throw new Error('Wallet not ready');
    setIsPending(true);
    setError(null);
    setIsSuccess(false);
    try {
      const txHash = await invoke(poolAddress, 'join', [
        nativeToScVal(userAddress, { type: 'address' }),
      ]);
      setHash(txHash);
      setIsSuccess(true);
      return txHash;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to join pool');
      setError(err);
      throw err;
    } finally {
      setIsPending(false);
      setIsConfirming(false);
    }
  }

  return { join, fullCollateral, hash, isPending, isConfirming, isSuccess, error, poolInfo: data?.pool };
}
