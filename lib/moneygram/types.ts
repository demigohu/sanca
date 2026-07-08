export interface MoneyGramToml {
  WEB_AUTH_ENDPOINT?: string;
  TRANSFER_SERVER_SEP0024?: string;
  SIGNING_KEY?: string;
  NETWORK_PASSPHRASE?: string;
}

export interface Sep24Info {
  deposit: Record<string, { enabled: boolean; min_amount?: number; max_amount?: number }>;
  withdraw: Record<string, { enabled: boolean; min_amount?: number; max_amount?: number }>;
  fee?: { enabled: boolean; percentage_fee?: number };
}

export interface Sep24InteractiveResponse {
  id: string;
  url: string;
  type: 'interactive_customer_info_needed';
}

export type Sep24TransactionStatus =
  | 'incomplete'
  | 'pending_stellar'
  | 'pending_external'
  | 'pending_user_transfer_start'
  | 'pending_user_transfer_complete'
  | 'pending_anchor'
  | 'pending_trust'
  | 'completed'
  | 'refunded'
  | 'expired'
  | 'error';

export interface Sep24Transaction {
  id: string;
  kind: 'deposit' | 'withdrawal';
  status: Sep24TransactionStatus;
  amount_in?: string;
  amount_out?: string;
  amount_fee?: string;
  started_at?: string;
  completed_at?: string;
  stellar_transaction_id?: string;
  /** Cash-out reference number at MoneyGram agent (withdraw). */
  external_transaction_id?: string;
  withdraw_anchor_account?: string;
  withdraw_memo?: string;
  withdraw_memo_type?: string;
  more_info_url?: string;
  message?: string;
}

export type { Sep9Fields } from './sep9';
