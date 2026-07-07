import {
  BASE_FEE,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  rpc,
} from '@stellar/stellar-sdk';
import { config } from './config.js';
import { getRelayerKeypair, getRpc } from './relay.js';

const networkPassphrase =
  config.network === 'public' ? Networks.PUBLIC : Networks.TESTNET;

const sponsorInFlight = new Map<
  string,
  Promise<{ created: boolean; hash: string | null }>
>();

async function accountExists(publicKey: string, server: rpc.Server): Promise<boolean> {
  try {
    await server.getAccount(publicKey);
    return true;
  } catch {
    return false;
  }
}

async function fundViaFriendbot(
  publicKey: string,
  server: rpc.Server,
): Promise<string | null> {
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
  );
  const body = (await res.json()) as {
    hash?: string;
    detail?: string;
    extras?: { result_codes?: { operations?: string[] } };
  };

  if (res.ok && body.hash) {
    return body.hash;
  }

  // Parallel requests: first wins, others get createAccountAlreadyExist — OK if account exists.
  if (await accountExists(publicKey, server)) {
    return null;
  }

  const opCode = body.extras?.result_codes?.operations?.[0];
  if (opCode === 'createAccountAlreadyExist') {
    return null;
  }

  throw new Error(body.detail || `Friendbot failed (${res.status})`);
}

async function fundViaRelayer(publicKey: string, server: rpc.Server): Promise<string> {
  const relayer = getRelayerKeypair();
  const source = await server.getAccount(relayer.publicKey());

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.createAccount({
        destination: publicKey,
        startingBalance: config.sponsorStartingBalance,
      }),
    )
    .setTimeout(300)
    .build();

  tx.sign(relayer);

  const sendResult = await server.sendTransaction(tx);
  if (sendResult.status === 'ERROR') {
    if (await accountExists(publicKey, server)) {
      return sendResult.hash ?? '';
    }
    throw new Error(`Sponsor submit failed: ${JSON.stringify(sendResult)}`);
  }

  const hash = sendResult.hash;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const status = await server.getTransaction(hash);
    if (status.status === 'SUCCESS') return hash;
    if (status.status === 'FAILED') {
      if (await accountExists(publicKey, server)) return hash;
      throw new Error(`Sponsor transaction failed: ${JSON.stringify(status)}`);
    }
  }

  throw new Error(`Timeout waiting for sponsor tx ${hash}`);
}

async function sponsorAccountOnce(publicKey: string): Promise<{
  created: boolean;
  hash: string | null;
}> {
  if (!StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new Error('Invalid Stellar public key');
  }

  if (!config.sponsorEnabled) {
    throw new Error('Account sponsorship is disabled on this relayer');
  }

  const server = getRpc();
  if (await accountExists(publicKey, server)) {
    return { created: false, hash: null };
  }

  const hash =
    config.network === 'testnet'
      ? await fundViaFriendbot(publicKey, server)
      : await fundViaRelayer(publicKey, server);

  return { created: hash !== null, hash };
}

/**
 * Ensure a Stellar account exists on ledger (deduped per address).
 */
export async function sponsorAccount(publicKey: string): Promise<{
  created: boolean;
  hash: string | null;
}> {
  const inflight = sponsorInFlight.get(publicKey);
  if (inflight) return inflight;

  const job = sponsorAccountOnce(publicKey).finally(() => {
    sponsorInFlight.delete(publicKey);
  });
  sponsorInFlight.set(publicKey, job);
  return job;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
