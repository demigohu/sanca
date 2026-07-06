'use client';

import { useMemo } from 'react';
import { useUserPools } from './usePools';

interface UserAlert {
  id: string;
  type: 'reminder' | 'success' | 'warning';
  title: string;
  message: string;
  poolId?: string;
}

export function useUserAlerts() {
  const { data: userPools, isLoading } = useUserPools();

  const data = useMemo((): UserAlert[] => {
    if (!userPools?.length) return [];
    const now = Math.floor(Date.now() / 1000);
    const items: UserAlert[] = [];

    for (const pool of userPools) {
      if (pool.state !== 'Active') continue;
      const endTime = Number(pool.cycleStartTime) + pool.periodDuration;
      if (endTime <= now) {
        items.push({
          id: `${pool.id}-settle`,
          type: 'reminder',
          title: 'Cycle ready to settle',
          message: `${pool.name} is waiting for keeper settlement.`,
          poolId: pool.id,
        });
      } else if (endTime - now < 86_400) {
        items.push({
          id: `${pool.id}-soon`,
          type: 'warning',
          title: 'Cycle ending soon',
          message: `${pool.name} cycle ends in less than 24 hours.`,
          poolId: pool.id,
        });
      }
    }
    return items;
  }, [userPools]);

  return { data, isLoading };
}
