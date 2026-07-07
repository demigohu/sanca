'use client';

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useStellarWallet } from './useStellarWallet';
import { useUserPools } from './usePools';
import { formatUSDC, toBigInt } from '@/lib/utils';

export type UserTransaction = {
  id: string;
  type: 'send' | 'receive';
  circle: string;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  amount: string;
};

export function useUserTransactions() {
  const { address } = useStellarWallet();
  const { data: userPools, isLoading } = useUserPools();

  const data = useMemo((): UserTransaction[] => {
    if (!address || !userPools?.length) return [];

    return userPools.map((pool) => {
      const collateral = pool.contributionPerPeriod * BigInt(pool.maxMembers);
      const joinedTs = Number(toBigInt(pool.userJoinedAt));
      const dateLabel =
        joinedTs > 0
          ? formatDistanceToNow(new Date(joinedTs * 1000), { addSuffix: true })
          : 'Recently';

      return {
        id: `join-${pool.id}`,
        type: 'send',
        circle: pool.name,
        description: `Joined pool · ${pool.maxMembers} members`,
        date: dateLabel,
        status: 'completed',
        amount: `$${formatUSDC(collateral)}`,
      };
    });
  }, [address, userPools]);

  return { data, isLoading, error: null };
}
