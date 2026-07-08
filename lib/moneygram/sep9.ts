import type { User } from '@privy-io/react-auth';

/** Optional SEP-9 fields for MoneyGram interactive requests. */
export type Sep9Fields = Partial<{
  first_name: string;
  last_name: string;
  birth_date: string;
  mobile_number: string;
  email: string;
  address: string;
  city: string;
  postal_code: string;
  address_country_code: string;
  state_or_province: string;
}>;

/** Best-effort prefill from Privy profile (optional for non-custodial). */
export function buildSep9FromPrivyUser(user: User | null | undefined): Sep9Fields | undefined {
  if (!user) return undefined;

  const fields: Sep9Fields = {};
  const email = user.email?.address;
  if (email) fields.email = email;

  const displayName =
    user.google?.name ?? user.twitter?.name ?? user.discord?.username ?? user.github?.name;
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    fields.first_name = parts[0];
    if (parts.length > 1) fields.last_name = parts.slice(1).join(' ');
  }

  const phone = user.phone?.number;
  if (phone) fields.mobile_number = phone;

  return Object.keys(fields).length > 0 ? fields : undefined;
}
