'use client';

import { useQuery } from '@tanstack/react-query';
import { getAllPools, getPoolDetail } from '@/lib/pool';
import { hasPoolCreatedTimestamp } from '@/lib/pool-dates';
import type { PoolDetail } from '@/lib/types';
import { formatUSDC, toBigInt } from '@/lib/utils';
import { useStellarWallet } from './useStellarWallet';

export type ActivityType =
  | 'contribution'
  | 'payout'
  | 'member_joined'
  | 'cycle_completed'
  | 'pool_created'
  | 'pool_started'
  | 'pool_completed'
  | 'collateral_liquidated';

export type AllActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  circle: string;
  member?: string;
  amount?: string;
  timestamp: Date;
};

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function toValidDate(timestamp: bigint | string | number | null | undefined): Date | null {
  if (timestamp == null) return null;
  const secs = Number(toBigInt(timestamp));
  if (!Number.isFinite(secs) || secs <= 0) return null;
  const date = new Date(secs * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildActivitiesFromPool(detail: PoolDetail): AllActivityItem[] {
  const activities: AllActivityItem[] = [];
  const { pool, members, cycles, cycleContributions } = detail;
  const circle = pool.name;

  if (hasPoolCreatedTimestamp(pool.createdAtTimestamp)) {
    const date = toValidDate(pool.createdAtTimestamp);
    if (date) {
      activities.push({
        id: `pool-created-${pool.id}`,
        type: 'pool_created',
        title: 'Pool Created',
        description: `Pool "${pool.name}" was created`,
        circle,
        timestamp: date,
      });
    }
  }

  if (pool.state === 'Active' || pool.state === 'Completed') {
    const date = toValidDate(pool.cycleStartTime);
    if (date) {
      activities.push({
        id: `pool-started-${pool.id}`,
        type: 'pool_started',
        title: 'Pool Started',
        description: 'Pool is now active and cycles have begun',
        circle,
        timestamp: date,
      });
    }
  }

  if (pool.state === 'Completed') {
    const lastCycle = cycles[cycles.length - 1];
    const date = toValidDate(lastCycle?.createdAtTimestamp);
    if (date) {
      activities.push({
        id: `pool-completed-${pool.id}`,
        type: 'pool_completed',
        title: 'Pool Completed',
        description: 'All cycles have been completed',
        circle,
        timestamp: date,
      });
    }
  }

  members.forEach((member) => {
    const date = toValidDate(member.joinedAtTimestamp);
    if (!date) return;
    activities.push({
      id: `member-${pool.id}-${member.address}`,
      type: 'member_joined',
      title: 'Member Joined',
      description: `${formatAddress(member.address)} joined the pool`,
      circle,
      member: member.address,
      timestamp: date,
    });
  });

  cycleContributions.forEach((contrib) => {
    const date = toValidDate(contrib.createdAtTimestamp);
    if (!date) return;

    if (contrib.isLiquidated) {
      activities.push({
        id: `liquidated-${contrib.id}`,
        type: 'collateral_liquidated',
        title: 'Collateral Liquidated',
        description: `${formatAddress(contrib.memberAddress)}'s collateral was liquidated for cycle ${contrib.cycleIndex + 1}`,
        amount: `$${formatUSDC(contrib.amount)}`,
        circle,
        member: contrib.memberAddress,
        timestamp: date,
      });
    } else {
      activities.push({
        id: `contributed-${contrib.id}`,
        type: 'contribution',
        title: 'Contribution Made',
        description: `${formatAddress(contrib.memberAddress)} contributed to cycle ${contrib.cycleIndex + 1}`,
        amount: `$${formatUSDC(contrib.amount)}`,
        circle,
        member: contrib.memberAddress,
        timestamp: date,
      });
    }
  });

  cycles.forEach((cycle) => {
    if (!cycle.winner) return;
    const date = toValidDate(cycle.createdAtTimestamp);
    if (!date) return;
    activities.push({
      id: `cycle-${pool.id}-${cycle.index}`,
      type: 'payout',
      title: 'Payout Completed',
      description: `${formatAddress(cycle.winner)} won cycle ${cycle.index + 1}`,
      amount: `$${formatUSDC(cycle.prize)}`,
      circle,
      member: cycle.winner,
      timestamp: date,
    });
  });

  return activities;
}

export function useAllActivities() {
  const { address } = useStellarWallet();

  return useQuery({
    queryKey: ['all-activities', address],
    queryFn: async (): Promise<AllActivityItem[]> => {
      if (!address) return [];

      const pools = await getAllPools();
      const activities: AllActivityItem[] = [];

      for (const pool of pools) {
        const detail = await getPoolDetail(pool.id);
        const isMember = detail.members.some(
          (m) => m.address.toLowerCase() === address.toLowerCase(),
        );
        if (!isMember) continue;
        activities.push(...buildActivitiesFromPool(detail));
      }

      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return activities;
    },
    enabled: !!address,
    refetchInterval: 20_000,
  });
}
