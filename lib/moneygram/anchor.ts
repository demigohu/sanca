import { StellarToml } from '@stellar/stellar-sdk';
import type { MoneyGramToml } from './types';

export async function fetchMoneyGramToml(domain: string): Promise<MoneyGramToml> {
  const toml = await StellarToml.Resolver.resolve(domain);
  return {
    WEB_AUTH_ENDPOINT: toml.WEB_AUTH_ENDPOINT,
    TRANSFER_SERVER_SEP0024: toml.TRANSFER_SERVER_SEP0024,
    SIGNING_KEY: toml.SIGNING_KEY,
    NETWORK_PASSPHRASE: toml.NETWORK_PASSPHRASE,
  };
}
