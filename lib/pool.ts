import { nativeToScVal } from '@stellar/stellar-sdk';
import { simulateRead, FACTORY_ADDRESS } from './stellar';
import type { Cycle, Member, Pool, PoolDetail, PoolState } from './types';

export { FACTORY_ADDRESS };

/** Soroban returns PoolState as u32 (0=Open, 1=Active, 2=Completed). */
function parseState(value: unknown): PoolState {
  const byTag: Record<number, PoolState> = {
    0: 'Open',
    1: 'Active',
    2: 'Completed',
  };
  if (typeof value === 'number' && value in byTag) return byTag[value];
  const s = String(value);
  if (s === 'Open' || s === 'Active' || s === 'Completed' || s === 'Liquidated') {
    return s;
  }
  const n = Number(s);
  if (!Number.isNaN(n) && n in byTag) return byTag[n];
  return 'Open';
}

function toBig(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  return BigInt(String(value ?? 0));
}

async function readPoolBase(address: string): Promise<Pool> {
  const [info, name, description, periodDuration, yieldSplitBps, members, cycleEndTime, vaultShares] =
    await Promise.all([
      simulateRead(address, 'get_pool_info'),
      simulateRead(address, 'get_name'),
      simulateRead(address, 'get_description'),
      simulateRead(address, 'get_period_duration'),
      simulateRead(address, 'get_yield_split_bps'),
      simulateRead(address, 'get_members'),
      simulateRead(address, 'get_cycle_end_time'),
      simulateRead(address, 'get_vault_shares'),
    ]);

  const tuple = info as unknown[];
  const cycleStartTime = toBig(tuple[3]);
  const memberList = (members as string[]) ?? [];

  return {
    id: address,
    name: String(name ?? ''),
    description: String(description ?? ''),
    creator: '',
    state: parseState(tuple[0]),
    maxMembers: Number(tuple[2] ?? 0),
    memberCount: memberList.length,
    currentCycle: Number(tuple[1] ?? 0),
    totalCycles: Number(tuple[2] ?? 0),
    contributionPerPeriod: toBig(tuple[4]),
    periodDuration: Number(periodDuration ?? 0),
    cycleStartTime,
    cycleEndTime: Number(cycleEndTime ?? 0),
    totalContributed: toBig(tuple[5]),
    yieldSplitBps: Number(yieldSplitBps ?? 0),
    vaultShares: toBig(vaultShares),
    createdAtTimestamp: cycleStartTime > BigInt(0) ? cycleStartTime : BigInt(0),
  };
}

async function readMembers(pool: Pool): Promise<Member[]> {
  const addresses = (await simulateRead(pool.id, 'get_members')) as string[];
  if (!addresses?.length) return [];

  return Promise.all(
    addresses.map(async (address) => {
      const [collateral, vaultShares] = await Promise.all([
        simulateRead(pool.id, 'get_member_collateral', [nativeToScVal(address, { type: 'address' })]),
        simulateRead(pool.id, 'get_member_vault_shares', [nativeToScVal(address, { type: 'address' })]),
      ]);
      return {
        id: `${pool.id}-${address}`,
        address,
        poolId: pool.id,
        contribution: pool.contributionPerPeriod,
        collateral: toBig(collateral),
        vaultShares: toBig(vaultShares),
        joinedAtTimestamp: pool.cycleStartTime,
      };
    }),
  );
}

async function readCycles(pool: Pool): Promise<Cycle[]> {
  const winnerOrder = ((await simulateRead(pool.id, 'get_winner_order')) as string[]) ?? [];
  const pot = pool.contributionPerPeriod * BigInt(pool.maxMembers);
  const cycles: Cycle[] = [];

  for (let i = 0; i < pool.totalCycles; i++) {
    let winner: string | null = null;
    if (i < pool.currentCycle || (pool.state === 'Completed' && winnerOrder[i])) {
      try {
        winner = (await simulateRead(pool.id, 'get_cycle_winner', [
          nativeToScVal(i, { type: 'u32' }),
        ])) as string;
      } catch {
        winner = winnerOrder[i] ?? null;
      }
    }
    cycles.push({
      index: i,
      winner,
      prize: pot,
      yieldBonus: BigInt(0),
      createdAtTimestamp: winner ? pool.cycleStartTime : null,
    });
  }
  return cycles;
}

export async function getAllPools(): Promise<Pool[]> {
  const addresses = (await simulateRead(FACTORY_ADDRESS, 'get_all_pools')) as string[];
  if (!addresses?.length) return [];
  const pools = await Promise.allSettled(addresses.map(readPoolBase));
  return pools
    .filter((r): r is PromiseFulfilledResult<Pool> => r.status === 'fulfilled')
    .map((r) => r.value)
    .sort((a, b) => Number(b.createdAtTimestamp - a.createdAtTimestamp));
}

export async function getPoolInfo(address: string): Promise<Pool> {
  return readPoolBase(address);
}

export async function getPoolDetail(address: string): Promise<PoolDetail> {
  const pool = await readPoolBase(address);
  const [members, cycles] = await Promise.all([readMembers(pool), readCycles(pool)]);
  return { pool, members, cycles };
}

/** Client-side fetch wrapper (replaces indexer fetchPoolDetail) */
export async function fetchPoolDetail(poolId: string) {
  const detail = await getPoolDetail(poolId);
  return {
    pool: detail.pool,
    members: detail.members,
    cycles: detail.cycles,
    cycleContributions: [] as Array<{ memberAddress: string; cycleIndex: number }>,
  };
}
