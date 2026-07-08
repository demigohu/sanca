export const MONEYGRAM_TESTNET_DOMAIN =
  process.env.NEXT_PUBLIC_MONEYGRAM_HOME_DOMAIN || 'extstellar.moneygram.com';

export const MONEYGRAM_MAINNET_DOMAIN = 'stellar.moneygram.com';

export const MONEYGRAM_MOCK =
  process.env.NEXT_PUBLIC_MONEYGRAM_MOCK === 'true';

/** Non-custodial wallets must co-sign SEP-10 with SIGNING_KEY from stellar.toml. */
export const MONEYGRAM_CLIENT_COSIGN =
  process.env.NEXT_PUBLIC_MONEYGRAM_CLIENT_COSIGN === 'true';

/** Domain registered with MoneyGram Instant Access (sandbox). */
export const MONEYGRAM_ALLOWLISTED_DOMAIN = 'www.sanca.space';

function normalizeAppDomain(domain: string): string {
  const trimmed = domain.trim();
  // Apex is not allowlisted — MoneyGram only accepts www.sanca.space.
  if (trimmed === 'sanca.space') return MONEYGRAM_ALLOWLISTED_DOMAIN;
  return trimmed;
}

/** Wallet app domain hosting /.well-known/stellar.toml (required for non-custodial SEP-10). */
export const APP_DOMAIN = normalizeAppDomain(
  process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost',
);

/** Resolve at runtime so stale builds / apex visits still send the allowlisted domain. */
export function getAppDomain(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'www.sanca.space' || host === 'sanca.space') {
      return MONEYGRAM_ALLOWLISTED_DOMAIN;
    }
  }
  return APP_DOMAIN;
}

export function getMoneyGramDomain(): string {
  return process.env.NEXT_PUBLIC_NETWORK === 'public'
    ? MONEYGRAM_MAINNET_DOMAIN
    : MONEYGRAM_TESTNET_DOMAIN;
}

/** Circle USDC for MoneyGram ramps — separate from Blend USDC in Sanca pools. */
export const MONEYGRAM_USDC_ISSUER =
  process.env.NEXT_PUBLIC_MONEYGRAM_USDC_ISSUER ||
  (process.env.NEXT_PUBLIC_NETWORK === 'public'
    ? 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    : 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_NETWORK === 'public'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
