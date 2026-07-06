import {
  Contract,
  Networks,
  StrKey,
  TransactionBuilder,
  BASE_FEE,
  rpc,
  xdr,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { config } from './config.js';

const networkPassphrase =
  config.network === 'public' ? Networks.PUBLIC : Networks.TESTNET;

// In-memory cache: set of contract ID hex strings registered in factory.
let cachedPoolHexes: Set<string> = new Set();
let lastFetch = 0;

function contractAddressToHex(address: string): string {
  return Buffer.from(StrKey.decodeContract(address)).toString('hex');
}

/**
 * Fetch get_all_pools from the factory contract via simulation (read-only, no fee).
 */
async function fetchPoolsFromFactory(sorobanRpc: rpc.Server): Promise<Set<string>> {
  const factory = new Contract(config.factoryAddress);

  // Use a throwaway keypair for simulation source account — any funded account works,
  // but we can also use the relayer's own account (already known).
  // For simulation we don't need a real account; use factory address as dummy source.
  // Actually simulation requires a valid account — use relayer keypair.
  const { getRelayerKeypair } = await import('./relay.js');
  const keypair = getRelayerKeypair();
  const account = await sorobanRpc.getAccount(keypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(factory.call('get_all_pools'))
    .setTimeout(30)
    .build();

  const sim = await sorobanRpc.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    console.error('[pool-registry] get_all_pools simulation failed:', JSON.stringify(sim));
    return cachedPoolHexes; // keep stale cache on failure
  }

  // Result is a Vec<Address> — each element is an ScVal address.
  const vec = sim.result.retval.vec();
  if (!vec) return new Set();

  const hexes = new Set<string>();
  for (const scVal of vec) {
    try {
      const addr = scVal.address();
      const id = addr.contractId();
      if (id) hexes.add((id as Buffer).toString('hex'));
    } catch {
      // skip malformed entries
    }
  }
  return hexes;
}

/**
 * Returns true if the given contract hex ID is the factory or a pool registered in factory.
 * Refreshes the cache if stale (> POOL_CACHE_REFRESH_MS old).
 */
export async function isAllowedContract(
  contractHex: string,
  sorobanRpc: rpc.Server,
): Promise<boolean> {
  // Factory itself is always allowed (create_pool).
  if (contractHex === contractAddressToHex(config.factoryAddress)) return true;

  const now = Date.now();
  if (now - lastFetch > config.poolCacheRefreshMs) {
    cachedPoolHexes = await fetchPoolsFromFactory(sorobanRpc);
    lastFetch = now;
    console.log(`[pool-registry] refreshed: ${cachedPoolHexes.size} pools`);
  }

  return cachedPoolHexes.has(contractHex);
}
