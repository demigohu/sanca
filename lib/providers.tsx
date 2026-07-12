'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { PrivyClientConfig } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StellarWalletProvider } from '@/lib/stellar-wallet-context';

const queryClient = new QueryClient();
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

const ALLOWED_LOGIN_METHODS = new Set<NonNullable<PrivyClientConfig['loginMethods']>[number]>([
  'email',
  'google',
  'sms',
  'wallet',
  'twitter',
  'discord',
  'github',
  'linkedin',
  'apple',
]);

function getLoginMethods(): NonNullable<PrivyClientConfig['loginMethods']> {
  const raw = process.env.NEXT_PUBLIC_PRIVY_LOGIN_METHODS ?? 'email';
  const parsed = raw
    .split(',')
    .map((m) => m.trim())
    .filter((m): m is NonNullable<PrivyClientConfig['loginMethods']>[number] =>
      ALLOWED_LOGIN_METHODS.has(m as NonNullable<PrivyClientConfig['loginMethods']>[number]),
    );
  return parsed.length > 0 ? parsed : ['email'];
}

export function Providers({ children }: { children: React.ReactNode }) {
  const inner = (
    <QueryClientProvider client={queryClient}>
      <StellarWalletProvider>{children}</StellarWalletProvider>
    </QueryClientProvider>
  );

  if (!privyAppId) return inner;

  const loginMethods = getLoginMethods();

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: { theme: 'light', accentColor: '#16a34a' },
        // Must match methods enabled in Privy Dashboard → Login methods (Social → Google).
        loginMethods,
      }}
    >
      {inner}
    </PrivyProvider>
  );
}
