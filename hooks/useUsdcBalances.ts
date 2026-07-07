'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchUsdcBalances } from '@/lib/usdc-balances';
import { useStellarWallet } from './useStellarWallet';

export function useUsdcBalances() {
  const { address, preparing } = useStellarWallet();

  return useQuery({
    queryKey: ['usdc-balances', address],
    queryFn: () => fetchUsdcBalances(address!),
    enabled: !!address && !preparing,
    refetchInterval: 20_000,
  });
}
