import { WebAuth } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from '@/lib/stellar';
import { fetchCoridorToml } from './anchor';
import { getCoridorDomain } from './config';

export async function getSep10Token(params: {
  coridorDomain?: string;
  userPublicKey: string;
  signTransactionXdr: (unsignedXdr: string, publicKey: string) => Promise<string>;
}): Promise<string> {
  const domain = params.coridorDomain || getCoridorDomain();
  const toml = await fetchCoridorToml(domain);
  if (!toml.WEB_AUTH_ENDPOINT || !toml.SIGNING_KEY) {
    throw new Error('Coridor anchor missing WEB_AUTH_ENDPOINT or SIGNING_KEY in stellar.toml');
  }

  const authEndpoint = toml.WEB_AUTH_ENDPOINT;
  const networkPassphrase = toml.NETWORK_PASSPHRASE || NETWORK_PASSPHRASE;
  const webAuthDomain = new URL(authEndpoint).hostname;

  const qs = new URLSearchParams({ account: params.userPublicKey });
  const challengeRes = await fetch(`${authEndpoint}?${qs.toString()}`);
  const challengeJson = (await challengeRes.json()) as {
    transaction?: string;
    network_passphrase?: string;
    error?: string;
  };

  if (!challengeRes.ok || !challengeJson.transaction) {
    throw new Error(challengeJson.error || 'Failed to fetch SEP-10 challenge from Coridor');
  }

  WebAuth.readChallengeTx(
    challengeJson.transaction,
    toml.SIGNING_KEY,
    challengeJson.network_passphrase || networkPassphrase,
    domain,
    webAuthDomain,
  );

  const signedXdr = await params.signTransactionXdr(
    challengeJson.transaction,
    params.userPublicKey,
  );

  const tokenRes = await fetch(authEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signedXdr }),
  });

  const tokenJson = (await tokenRes.json()) as { token?: string; error?: string };
  if (!tokenRes.ok || !tokenJson.token) {
    throw new Error(tokenJson.error || 'SEP-10 token exchange failed');
  }

  return tokenJson.token;
}
