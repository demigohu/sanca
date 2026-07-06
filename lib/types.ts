export type PoolState = 'Open' | 'Active' | 'Completed' | 'Liquidated';

export interface Pool {
  id: string;
  name: string;
  description: string;
  creator: string;
  state: PoolState;
  maxMembers: number;
  memberCount: number;
  currentCycle: number;
  totalCycles: number;
  contributionPerPeriod: bigint;
  periodDuration: number;
  cycleStartTime: bigint;
  cycleEndTime: number;
  totalContributed: bigint;
  yieldSplitBps: number;
  vaultShares: bigint;
  createdAtTimestamp: bigint;
}

export interface Member {
  id: string;
  address: string;
  poolId: string;
  contribution: bigint;
  collateral: bigint;
  vaultShares: bigint;
  joinedAtTimestamp: bigint;
}

export interface Cycle {
  index: number;
  winner: string | null;
  prize: bigint;
  yieldBonus: bigint;
  createdAtTimestamp: bigint | null;
}

export interface PoolDetail {
  pool: Pool;
  members: Member[];
  cycles: Cycle[];
}

export interface UserPool extends Pool {
  userContribution: bigint;
  userJoinedAt: bigint;
}

/** @deprecated use Pool — kept for gradual UI migration */
export type PoolLegacy = Pool & {
  contributionPerPeriod: bigint;
};
