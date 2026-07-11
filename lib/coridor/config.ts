import { POOL_USDC_ISSUER } from '@/lib/stellar';

export const CORIDOR_HOME_DOMAIN =
  process.env.NEXT_PUBLIC_CORIDOR_HOME_DOMAIN || 'sep.coridor.fun';

export const CORIDOR_MOCK = process.env.NEXT_PUBLIC_CORIDOR_MOCK === 'true';

/** Blend USDC — same issuer as Sanca pools and Coridor anchor. */
export const CORIDOR_USDC_ISSUER = POOL_USDC_ISSUER;

export function getCoridorDomain(): string {
  return CORIDOR_HOME_DOMAIN;
}

export function getCoridorApiOrigin(): string {
  if (CORIDOR_HOME_DOMAIN.startsWith('localhost')) {
    return 'http://localhost:8091';
  }
  return 'https://api.coridor.fun';
}
