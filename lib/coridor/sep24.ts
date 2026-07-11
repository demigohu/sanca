import {
  Asset,
  Memo,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { getSorobanRpc, NETWORK_PASSPHRASE, submitViaRelayer } from '@/lib/stellar';
import { fetchCoridorToml } from './anchor';
import { CORIDOR_USDC_ISSUER } from './config';
import type { Sep24Info, Sep24InteractiveResponse, Sep24Transaction } from './types';

async function getTransferServer(coridorDomain: string): Promise<string> {
  const toml = await fetchCoridorToml(coridorDomain);
  if (!toml.TRANSFER_SERVER_SEP0024) {
    throw new Error('Coridor anchor missing TRANSFER_SERVER_SEP0024');
  }
  return toml.TRANSFER_SERVER_SEP0024.replace(/\/$/, '');
}

export async function getSep24Info(coridorDomain: string): Promise<Sep24Info> {
  const server = await getTransferServer(coridorDomain);
  const res = await fetch(`${server}/info`);
  const json = (await res.json()) as Sep24Info & { error?: string };
  if (!res.ok) throw new Error(json.error || 'Failed to fetch SEP-24 info');
  return json;
}

export async function initiateSep24Interactive(params: {
  coridorDomain: string;
  authToken: string;
  kind: 'deposit' | 'withdraw';
  account: string;
  assetCode?: string;
  amount?: string;
  lang?: string;
}): Promise<Sep24InteractiveResponse> {
  const server = await getTransferServer(params.coridorDomain);
  const body: Record<string, string> = {
    account: params.account,
    asset_code: params.assetCode || 'USDC',
    lang: params.lang || 'en',
  };
  if (params.amount) body.amount = params.amount;

  const res = await fetch(`${server}/transactions/${params.kind}/interactive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.authToken}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as Sep24InteractiveResponse & { error?: string };
  if (!res.ok || !json.url) {
    throw new Error(json.error || `Failed to start SEP-24 ${params.kind}`);
  }

  return json;
}

export async function getSep24Transaction(params: {
  coridorDomain: string;
  authToken: string;
  transactionId: string;
}): Promise<Sep24Transaction> {
  const server = await getTransferServer(params.coridorDomain);
  const res = await fetch(`${server}/transaction?id=${encodeURIComponent(params.transactionId)}`, {
    headers: { Authorization: `Bearer ${params.authToken}` },
  });
  const json = (await res.json()) as { transaction?: Sep24Transaction; error?: string };
  if (!res.ok || !json.transaction) {
    throw new Error(json.error || 'Failed to fetch SEP-24 transaction');
  }
  return json.transaction;
}

export async function submitWithdrawPayment(params: {
  userPublicKey: string;
  transaction: Sep24Transaction;
  signTransactionXdr: (unsignedXdr: string, publicKey: string) => Promise<string>;
}): Promise<string> {
  const { transaction } = params;
  if (
    transaction.status !== 'pending_user_transfer_start' ||
    !transaction.withdraw_anchor_account ||
    !transaction.amount_in
  ) {
    throw new Error('Transaction is not ready for user transfer');
  }

  const server = getSorobanRpc();
  const account = await server.getAccount(params.userPublicKey);
  const asset = new Asset('USDC', CORIDOR_USDC_ISSUER);

  let builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({
      destination: transaction.withdraw_anchor_account,
      asset,
      amount: transaction.amount_in,
    }),
  );

  if (transaction.withdraw_memo && transaction.withdraw_memo_type === 'id') {
    builder = builder.addMemo(Memo.id(transaction.withdraw_memo));
  } else if (transaction.withdraw_memo && transaction.withdraw_memo_type === 'text') {
    builder = builder.addMemo(Memo.text(transaction.withdraw_memo));
  } else if (transaction.withdraw_memo) {
    const memo = transaction.withdraw_memo.trim();
    if (/^\d+$/.test(memo)) {
      builder = builder.addMemo(Memo.id(memo));
    } else {
      builder = builder.addMemo(Memo.text(memo.slice(0, 28)));
    }
  }

  const tx = builder.setTimeout(180).build();
  const signedXdr = await params.signTransactionXdr(tx.toXDR(), params.userPublicKey);

  return submitViaRelayer(signedXdr);
}
