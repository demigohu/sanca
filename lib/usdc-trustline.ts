import {
  Asset,
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import {
  getSorobanRpc,
  HORIZON_URL,
  NETWORK_PASSPHRASE,
  POOL_USDC_ISSUER,
  submitViaRelayer,
  USDC_ASSET_CODE,
} from './stellar';

const MAX_TRUST_LIMIT = '922337203685.4775807';

/** Blend USDC — pools, DeFindex, and Coridor ramp share one issuer. */
export const TRUSTLINE_ISSUERS = [POOL_USDC_ISSUER] as const;

type HorizonBalance = {
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
};

export function assetForIssuer(issuer: string): Asset {
  return new Asset(USDC_ASSET_CODE, issuer);
}

export async function hasTrustlineForIssuer(
  address: string,
  issuer: string,
): Promise<boolean> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (res.status === 404) return false;
  if (!res.ok) {
    throw new Error(`Horizon account lookup failed (${res.status})`);
  }
  const data = (await res.json()) as { balances?: HorizonBalance[] };
  return (data.balances ?? []).some(
    (b) =>
      b.asset_type !== 'native' &&
      b.asset_code === USDC_ASSET_CODE &&
      b.asset_issuer === issuer,
  );
}

export async function getMissingTrustlineIssuers(address: string): Promise<string[]> {
  const missing: string[] = [];
  for (const issuer of TRUSTLINE_ISSUERS) {
    if (!(await hasTrustlineForIssuer(address, issuer))) {
      missing.push(issuer);
    }
  }
  return missing;
}

export async function buildTrustlineTransaction(address: string, issuers: string[]) {
  if (issuers.length === 0) {
    throw new Error('No trustlines to add');
  }
  const server = getSorobanRpc();
  const account = await server.getAccount(address);
  let builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  for (const issuer of issuers) {
    builder = builder.addOperation(
      Operation.changeTrust({
        asset: assetForIssuer(issuer),
        limit: MAX_TRUST_LIMIT,
      }),
    );
  }
  return builder.setTimeout(300).build();
}

export async function signStellarTransaction(params: {
  tx: ReturnType<TransactionBuilder['build']>;
  userAddress: string;
  signRawHash: (args: {
    address: string;
    chainType: 'stellar';
    hash: `0x${string}`;
  }) => Promise<{ signature: string }>;
}): Promise<string> {
  const { tx, userAddress, signRawHash } = params;
  const hexHash = ('0x' + Buffer.from(tx.hash()).toString('hex')) as `0x${string}`;
  const { signature: signatureHex } = await signRawHash({
    address: userAddress,
    chainType: 'stellar',
    hash: hexHash,
  });
  const sigBytes = Buffer.from(signatureHex.replace(/^0x/, ''), 'hex');
  const hint = Buffer.from(Keypair.fromPublicKey(userAddress).rawPublicKey()).slice(-4);
  tx.signatures.push(new xdr.DecoratedSignature({ hint, signature: sigBytes }));
  return tx.toXDR();
}

/** Add Blend USDC trustline when needed. */
export async function ensureUsdcTrustlines(params: {
  address: string;
  signRawHash: (args: {
    address: string;
    chainType: 'stellar';
    hash: `0x${string}`;
  }) => Promise<{ signature: string }>;
}): Promise<{ created: boolean; hash: string | null; issuers: string[] }> {
  const missing = await getMissingTrustlineIssuers(params.address);
  if (missing.length === 0) {
    return { created: false, hash: null, issuers: [] };
  }

  const tx = await buildTrustlineTransaction(params.address, missing);
  const signedXdr = await signStellarTransaction({
    tx,
    userAddress: params.address,
    signRawHash: params.signRawHash,
  });

  try {
    const hash = await submitViaRelayer(signedXdr);
    return { created: true, hash, issuers: missing };
  } catch (err) {
    const stillMissing = await getMissingTrustlineIssuers(params.address);
    if (stillMissing.length === 0) {
      return { created: true, hash: null, issuers: missing };
    }
    throw err;
  }
}
