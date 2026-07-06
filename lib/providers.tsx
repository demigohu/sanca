'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function Providers({ children }: { children: React.ReactNode }) {
  const inner = <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

  if (!privyAppId) return inner;

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: { theme: 'light', accentColor: '#16a34a' },
        loginMethods: ['email', 'google'],
      }}
    >
      {inner}
    </PrivyProvider>
  );
}
