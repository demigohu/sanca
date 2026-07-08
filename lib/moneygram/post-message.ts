import type { Sep24Transaction } from './types';

/** New Ramps UI (ramps.moneygram.com) — see MoneyGram close-notification docs. */
export type MoneyGramRampMessageType = 'COMMIT_RESULT' | 'COMMIT_REQUEST' | 'legacy' | 'unknown';

export interface MoneyGramRampMessage {
  type: MoneyGramRampMessageType;
  transaction?: Sep24Transaction;
  /** Close iframe and continue polling in the host app. */
  shouldClose: boolean;
}

function asTransaction(value: unknown): Sep24Transaction | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const tx = value as Sep24Transaction;
  if (typeof tx.id !== 'string' || typeof tx.status !== 'string') return undefined;
  return tx;
}

/**
 * Parse iframe postMessage per MoneyGram docs:
 * - New UI: { type: "COMMIT_RESULT", payload: { transaction } }
 * - Legacy SEP-24: { transaction: { id, status, ... } }
 */
export function parseMoneyGramRampMessage(data: unknown): MoneyGramRampMessage | null {
  if (data == null) return null;

  let payload = data;
  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }

  if (typeof payload !== 'object' || payload === null) return null;
  const message = payload as Record<string, unknown>;

  if (message.type === 'COMMIT_RESULT') {
    const inner = message.payload as { transaction?: unknown } | undefined;
    const transaction = asTransaction(inner?.transaction);
    return { type: 'COMMIT_RESULT', transaction, shouldClose: true };
  }

  if (message.type === 'COMMIT_REQUEST') {
    const inner = message.payload as { transaction?: unknown } | undefined;
    const transaction = asTransaction(inner?.transaction);
    return { type: 'COMMIT_REQUEST', transaction, shouldClose: false };
  }

  const legacyTx = asTransaction(message.transaction);
  if (legacyTx) {
    const shouldClose = legacyTx.status === 'pending_user_transfer_start';
    return { type: 'legacy', transaction: legacyTx, shouldClose };
  }

  return null;
}
