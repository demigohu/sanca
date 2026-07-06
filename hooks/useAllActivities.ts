'use client';

import { useUserTransactions } from './useUserTransactions';

export function useAllActivities() {
  const txQuery = useUserTransactions();
  return {
    data: txQuery.data ?? [],
    isLoading: txQuery.isLoading,
  };
}
