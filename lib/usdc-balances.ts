import {
  HORIZON_URL,
  POOL_USDC_ISSUER,
  USDC_ASSET_CODE,
  USDC_SCALE,
} from './stellar';
import { MONEYGRAM_USDC_ISSUER } from './moneygram/config';

type HorizonBalance = {
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  balance?: string;
};

export type UsdcBalanceLine = {
  id: 'blend' | 'circle';
  label: string;
  issuer: string;
  purpose: string;
  balanceStroops: bigint;
  hasTrustline: boolean;
};

const USDC_LINES: Omit<UsdcBalanceLine, 'balanceStroops' | 'hasTrustline'>[] = [
  {
    id: 'blend',
    label: 'Blend USDC',
    issuer: POOL_USDC_ISSUER,
    purpose: 'Sanca pools & DeFindex',
  },
  {
    id: 'circle',
    label: 'Circle USDC',
    issuer: MONEYGRAM_USDC_ISSUER,
    purpose: 'MoneyGram top up / cash out',
  },
];

function balanceToStroops(balance: string): bigint {
  const n = Number.parseFloat(balance);
  if (!Number.isFinite(n) || n <= 0) return BigInt(0);
  return BigInt(Math.round(n * USDC_SCALE));
}

function lineForIssuer(
  balances: HorizonBalance[],
  issuer: string,
): { balanceStroops: bigint; hasTrustline: boolean } {
  const line = balances.find(
    (b) =>
      b.asset_type !== 'native' &&
      b.asset_code === USDC_ASSET_CODE &&
      b.asset_issuer === issuer,
  );
  if (!line?.balance) {
    return { balanceStroops: BigInt(0), hasTrustline: false };
  }
  return {
    balanceStroops: balanceToStroops(line.balance),
    hasTrustline: true,
  };
}

export async function fetchUsdcBalances(address: string): Promise<UsdcBalanceLine[]> {
  const empty = USDC_LINES.map((meta) => ({
    ...meta,
    balanceStroops: BigInt(0),
    hasTrustline: false,
  }));

  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (res.status === 404) return empty;
  if (!res.ok) {
    throw new Error(`Horizon account lookup failed (${res.status})`);
  }

  const data = (await res.json()) as { balances?: HorizonBalance[] };
  const balances = data.balances ?? [];

  return USDC_LINES.map((meta) => {
    const { balanceStroops, hasTrustline } = lineForIssuer(balances, meta.issuer);
    return { ...meta, balanceStroops, hasTrustline };
  });
}
