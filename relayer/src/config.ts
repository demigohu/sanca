import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const network = (process.env.NETWORK || 'testnet') as 'testnet' | 'public';
if (network !== 'testnet' && network !== 'public') {
  throw new Error(`Invalid NETWORK: ${network}`);
}

export const config = {
  relayerSecret: requireEnv('RELAYER_SECRET'),
  factoryAddress: requireEnv('FACTORY_ADDRESS'),
  network,
  rpcUrl: process.env.RPC_URL || 'https://soroban-testnet.stellar.org',
  port: Number(process.env.PORT || '3001'),
  maxFee: Number(process.env.MAX_FEE || '100000'), // stroops
  // How often to refresh the pool registry from factory (ms).
  poolCacheRefreshMs: Number(process.env.POOL_CACHE_REFRESH_MS || '60000'),
};

// Methods that users are allowed to relay.
export const WHITELISTED_METHODS = new Set([
  'create_pool',
  'join',
  'contribute',
  'withdraw',
]);
