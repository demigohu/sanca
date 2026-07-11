import {
  Contract,
  Networks,
  rpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
} from '@stellar/stellar-sdk';

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK === 'public'
    ? Networks.PUBLIC
    : Networks.TESTNET;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org';

export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS!;
export const USDC_CONTRACT = process.env.NEXT_PUBLIC_USDC_CONTRACT!;
/** Blend USDC classic issuer (Sanca pools + DeFindex vault on testnet). */
export const POOL_USDC_ISSUER =
  process.env.NEXT_PUBLIC_POOL_USDC_ISSUER ||
  process.env.NEXT_PUBLIC_BLEND_USDC_ISSUER ||
  (process.env.NEXT_PUBLIC_NETWORK === 'public'
    ? 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    : 'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56');
/** @deprecated use POOL_USDC_ISSUER */
export const USDC_ISSUER = POOL_USDC_ISSUER;
export const USDC_ASSET_CODE = 'USDC';
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ||
  (process.env.NEXT_PUBLIC_NETWORK === 'public'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org');
/** Stellar Blend USDC uses 7 decimals. */
export const USDC_DECIMALS = Number(process.env.NEXT_PUBLIC_USDC_DECIMALS ?? '7');
export const USDC_SCALE = 10 ** USDC_DECIMALS;
export const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3001';

/** Classic G-address used only as simulation tx source (contracts cannot be tx sources). */
export const SIMULATION_SOURCE =
  process.env.NEXT_PUBLIC_SIMULATION_SOURCE ||
  'GBQPIIAPYZZIRVRJSBJBBYCB6HH2IE3PT4ZJG4G7K6FVRWXJ4L62LDLU';

export function getSorobanRpc() {
  return new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http:') });
}

async function getSimulationSourceAccount(server: rpc.Server) {
  try {
    return await server.getAccount(SIMULATION_SOURCE);
  } catch {
    throw new Error(
      `Cannot load simulation source account ${SIMULATION_SOURCE}. Set NEXT_PUBLIC_SIMULATION_SOURCE to a funded testnet G-address.`,
    );
  }
}

export async function simulateRead(
  contractAddress: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<unknown> {
  const server = getSorobanRpc();
  const contract = new Contract(contractAddress);
  const sourceAccount = await getSimulationSourceAccount(server);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error(`Simulation failed for ${method}: ${JSON.stringify(sim)}`);
  }
  return scValToNative(sim.result.retval);
}

export async function submitViaRelayer(signedInnerXdr: string): Promise<string> {
  const res = await fetch(`${RELAYER_URL}/relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedInnerXdr }),
  });
  const data = (await res.json()) as { hash?: string; error?: string };
  if (!res.ok || data.error) throw new Error(data.error || 'Relay failed');
  return data.hash!;
}

/** Create/fund Stellar account for new embedded wallets (via relayer → Friendbot on testnet). */
export async function sponsorStellarAccount(address: string): Promise<{
  created: boolean;
  hash: string | null;
}> {
  const res = await fetch(`${RELAYER_URL}/sponsor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  const data = (await res.json()) as {
    created?: boolean;
    hash?: string | null;
    error?: string;
  };
  if (!res.ok || data.error) throw new Error(data.error || 'Account sponsorship failed');
  return { created: !!data.created, hash: data.hash ?? null };
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function getAccountExplorerUrl(address: string): string {
  const network = process.env.NEXT_PUBLIC_NETWORK === 'public' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${network}/account/${address}`;
}

export function getTxExplorerUrl(txHash: string): string {
  const network = process.env.NEXT_PUBLIC_NETWORK === 'public' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${network}/tx/${txHash}`;
}
