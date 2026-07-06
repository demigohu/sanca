'use client';

import { useQuery } from '@tanstack/react-query';
import { getAllPools, fetchPoolDetail } from '@/lib/pool';
import type { Pool, PoolState, UserPool } from '@/lib/types';
import { useStellarWallet } from './useStellarWallet';
import { useMemo } from 'react';
import { getPoolDetail } from '@/lib/pool';

export function usePools(options?: { state?: PoolState; limit?: number }) {
  return useQuery({
    queryKey: ['pools', options?.state ?? 'all'],
    queryFn: async () => {
      let pools = await getAllPools();
      if (options?.state) pools = pools.filter((p) => p.state === options.state);
      pools.sort((a, b) => Number(b.createdAtTimestamp - a.createdAtTimestamp));
      if (options?.limit) pools = pools.slice(0, options.limit);
      return pools;
    },
    refetchInterval: 15_000,
  });
}

export function usePoolDetail(poolId: string | null) {
  return useQuery({
    queryKey: ['pool', poolId],
    queryFn: async () => {
      if (!poolId) return null;
      return fetchPoolDetail(poolId);
    },
    enabled: !!poolId,
    refetchInterval: 10_000,
  });
}

export function useUserPools() {
  const { address } = useStellarWallet();
  return useQuery({
    queryKey: ['user-pools', address],
    queryFn: async (): Promise<UserPool[]> => {
      if (!address) return [];
      const pools = await getAllPools();
      const userPools: UserPool[] = [];
      for (const pool of pools) {
        const detail = await getPoolDetail(pool.id);
        const member = detail.members.find(
          (m) => m.address.toLowerCase() === address.toLowerCase(),
        );
        if (!member) continue;
        userPools.push({
          ...detail.pool,
          userContribution: member.contribution,
          userJoinedAt: member.joinedAtTimestamp,
        });
      }
      return userPools;
    },
    enabled: !!address,
    refetchInterval: 20_000,
  });
}

export function useCreatedPools() {
  const { address } = useStellarWallet();
  const poolsQuery = usePools();
  const created = useMemo(() => {
    if (!address || !poolsQuery.data) return [] as Pool[];
    return poolsQuery.data.filter((p) => p.creator.toLowerCase() === address.toLowerCase());
  }, [address, poolsQuery.data]);
  return { ...poolsQuery, data: created };
}
