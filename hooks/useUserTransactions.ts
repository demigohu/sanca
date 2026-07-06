'use client';

import { useMemo } from 'react';
import { useStellarWallet } from './useStellarWallet';
import { useUserPools } from './usePools';

export function useUserTransactions() {
  const { address } = useStellarWallet();
  const { data: userPools } = useUserPools();

  const data = useMemo(() => {
    if (!address || !userPools) return [];
    return userPools.map((pool) => ({
      id: pool.id,
      type: 'pool_membership',
      poolName: pool.name,
      amount: pool.userContribution,
      timestamp: pool.userJoinedAt,
    }));
  }, [address, userPools]);

  return { data, isLoading: false };
}
