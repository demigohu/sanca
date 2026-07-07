import { getMissingTrustlineIssuers } from '@/lib/usdc-trustline';
import { HORIZON_URL } from '@/lib/stellar';

/** Shown while Privy wallet + sponsor + USDC trustline run in the background. */
export const WALLET_PREPARING_LABEL = 'Preparing your wallet…';

export async function accountExistsOnChain(address: string): Promise<boolean> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (res.status === 404) return false;
  if (!res.ok) {
    throw new Error(`Horizon account lookup failed (${res.status})`);
  }
  return true;
}

/** True when account is funded and both USDC trustlines exist. */
export async function isWalletReadyOnChain(address: string): Promise<boolean> {
  if (!(await accountExistsOnChain(address))) return false;
  const missing = await getMissingTrustlineIssuers(address);
  return missing.length === 0;
}
