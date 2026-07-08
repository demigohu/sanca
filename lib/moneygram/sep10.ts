import { WebAuth } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from '@/lib/stellar';
import { fetchMoneyGramToml } from './anchor';

export async function getSep10Token(params: {
  moneyGramDomain: string;
  userPublicKey: string;
  appDomain: string;
  signTransactionXdr: (unsignedXdr: string, publicKey: string) => Promise<string>;
  cosignTransactionXdr?: (partialSignedXdr: string) => Promise<string>;
}): Promise<string> {
  const toml = await fetchMoneyGramToml(params.moneyGramDomain);
  if (!toml.WEB_AUTH_ENDPOINT || !toml.SIGNING_KEY) {
    throw new Error('MoneyGram anchor missing WEB_AUTH_ENDPOINT or SIGNING_KEY in stellar.toml');
  }

  const authEndpoint = toml.WEB_AUTH_ENDPOINT;
  const networkPassphrase = toml.NETWORK_PASSPHRASE || NETWORK_PASSPHRASE;
  const webAuthDomain = new URL(authEndpoint).hostname;
  const useClientDomain = Boolean(params.cosignTransactionXdr);

  const qs = new URLSearchParams({
    account: params.userPublicKey,
  });
  // Non-custodial Privy: MoneyGram allowlists client_domain (not home_domain).
  if (useClientDomain) {
    qs.set('client_domain', params.appDomain);
  } else {
    qs.set('home_domain', params.appDomain);
  }

  const challengeRes = await fetch(`${authEndpoint}?${qs.toString()}`);
  const challengeJson = (await challengeRes.json()) as {
    transaction?: string;
    network_passphrase?: string;
    error?: string;
  };

  if (!challengeRes.ok || !challengeJson.transaction) {
    throw new Error(challengeJson.error || 'Failed to fetch SEP-10 challenge from MoneyGram');
  }

  // With client_domain, MoneyGram sets the challenge home op to the anchor domain.
  const challengeHomeDomain = useClientDomain ? params.moneyGramDomain : params.appDomain;

  WebAuth.readChallengeTx(
    challengeJson.transaction,
    toml.SIGNING_KEY,
    challengeJson.network_passphrase || networkPassphrase,
    challengeHomeDomain,
    webAuthDomain,
  );

  let signedXdr = await params.signTransactionXdr(
    challengeJson.transaction,
    params.userPublicKey,
  );

  if (params.cosignTransactionXdr) {
    signedXdr = await params.cosignTransactionXdr(signedXdr);
  }

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
