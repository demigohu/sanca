'use client';

import { useState } from 'react';
import { nativeToScVal } from '@stellar/stellar-sdk';
import { FACTORY_ADDRESS } from '@/lib/stellar';
import { toUSDCStroops } from '@/lib/utils';
import { useContractInvoke } from './useContractInvoke';

interface CreatePoolParams {
  maxMembers: number;
  contributionPerPeriod: number;
  periodDuration: number;
  poolName: string;
  poolDescription: string;
}

export function useCreatePool() {
  const { invoke, userAddress } = useContractInvoke();
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  async function createPool(params: CreatePoolParams) {
    if (!userAddress) throw new Error('Wallet not ready');
    setIsPending(true);
    setError(null);
    try {
      const contributionStroops = toUSDCStroops(params.contributionPerPeriod);
      const periodSecs = params.periodDuration * 86_400;

      const txHash = await invoke(FACTORY_ADDRESS, 'create_pool', [
        nativeToScVal(userAddress, { type: 'address' }),
        nativeToScVal(params.maxMembers, { type: 'u32' }),
        nativeToScVal(contributionStroops, { type: 'i128' }),
        nativeToScVal(periodSecs, { type: 'u64' }),
        nativeToScVal(params.poolName, { type: 'string' }),
        nativeToScVal(params.poolDescription, { type: 'string' }),
      ]);
      setHash(txHash);
      setIsConfirming(false);
      return txHash;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsPending(false);
    }
  }

  return {
    createPool,
    isPending,
    isConfirming,
    isSuccess: !!hash,
    error,
    hash,
  };
}
