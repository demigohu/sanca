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

const defaultBlendIssuer =
  network === 'public'
    ? 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    : 'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56';

export const config = {
  relayerSecret: requireEnv('RELAYER_SECRET'),
  factoryAddress: requireEnv('FACTORY_ADDRESS'),
  network,
  rpcUrl: process.env.RPC_URL || 'https://soroban-testnet.stellar.org',
  port: Number(process.env.PORT || '3001'),
  maxFee: Number(process.env.MAX_FEE || '100000'), // stroops — floor; Soroban uses max(MAX_FEE, inner tx fee)
  poolCacheRefreshMs: Number(process.env.POOL_CACHE_REFRESH_MS || '60000'),
  sponsorEnabled: process.env.SPONSOR_ENABLED !== 'false',
  sponsorStartingBalance: process.env.SPONSOR_STARTING_BALANCE || '2',
  usdcAssetCode: process.env.USDC_ASSET_CODE || 'USDC',
  /** Blend USDC — Sanca pools, DeFindex, and Coridor ramp. */
  blendUsdcIssuer:
    process.env.BLEND_USDC_ISSUER || process.env.POOL_USDC_ISSUER || defaultBlendIssuer,
  maxUsdcPayment: Number(process.env.MAX_USDC_PAYMENT || '3000'),
  horizonUrl:
    process.env.HORIZON_URL ||
    (network === 'public' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'),
};

export const ALLOWED_TRUST_ISSUERS = new Set([config.blendUsdcIssuer]);

export const WHITELISTED_METHODS = new Set([
  'create_pool',
  'join',
  'contribute',
  'withdraw',
]);
