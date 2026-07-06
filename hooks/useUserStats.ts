'use client';

import { useMemo } from 'react';
import { useUserPools } from './usePools';
import { formatUSDC } from '@/lib/utils';

export function useUserStats() {
  const { data: userPools, isLoading } = useUserPools();

  const data = useMemo(() => {
    if (!userPools?.length) {
      return {
        activePools: 0,
        totalPools: 0,
        totalContributed: 0,
        totalReceived: 0,
        pendingPayouts: 0,
      };
    }
    return {
      activePools: userPools.filter((p) => p.state === 'Active').length,
      totalPools: userPools.length,
      totalContributed: userPools.reduce(
        (sum, pool) => sum + Number(formatUSDC(pool.userContribution)),
        0,
      ),
      totalReceived: 0,
      pendingPayouts: 0,
    };
  }, [userPools]);

  return { data, isLoading };
}
