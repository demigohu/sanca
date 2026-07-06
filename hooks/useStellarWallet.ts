'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/extended-chains';

export function useStellarWallet() {
  const { ready, authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [creating, setCreating] = useState(false);

  const stellarAccount = user?.linkedAccounts.find(
    (a) => a.type === 'wallet' && (a as { chainType?: string }).chainType === 'stellar',
  );
  const address = (stellarAccount as { address?: string })?.address ?? null;

  useEffect(() => {
    if (!ready || !authenticated || address || creating) return;
    setCreating(true);
    createWallet({ chainType: 'stellar' }).catch(console.error).finally(() => setCreating(false));
  }, [ready, authenticated, address, creating, createWallet]);

  return { address, creating };
}
