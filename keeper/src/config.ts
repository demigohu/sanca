import dotenv from 'dotenv';
import { KeeperConfig } from './types.js';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const network = (process.env.NETWORK || 'testnet') as KeeperConfig['network'];
if (network !== 'testnet' && network !== 'public') {
  throw new Error(`Invalid NETWORK: ${network}. Must be "testnet" or "public".`);
}

export const config: KeeperConfig = {
  factoryAddress: requireEnv('FACTORY_ADDRESS'),
  keeperSecret: requireEnv('KEEPER_SECRET'),
  adminSecret: process.env.ADMIN_SECRET,
  network,
  rpcUrl: process.env.RPC_URL || 'https://soroban-testnet.stellar.org',
  drandChainHash:
    process.env.DRAND_CHAIN_HASH ||
    '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || '15000'),
};
