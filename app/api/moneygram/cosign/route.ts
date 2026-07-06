import { Keypair, Transaction } from '@stellar/stellar-sdk';
import { NextResponse } from 'next/server';
import { NETWORK_PASSPHRASE } from '@/lib/stellar';

/** Co-sign SEP-10 challenge with the wallet app's SIGNING_KEY (client_domain verification). */
export async function POST(request: Request) {
  const secret = process.env.MONEYGRAM_CLIENT_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'MONEYGRAM_CLIENT_SIGNING_SECRET is not configured on the server' },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { transaction?: string };
  if (!body.transaction) {
    return NextResponse.json({ error: 'Missing transaction XDR' }, { status: 400 });
  }

  try {
    const tx = new Transaction(body.transaction, NETWORK_PASSPHRASE);
    const kp = Keypair.fromSecret(secret);
    tx.sign(kp);
    return NextResponse.json({ transaction: tx.toXDR() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Co-sign failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
