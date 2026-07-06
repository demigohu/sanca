'use client';

export function useIndexerSnapshot() {
  return { data: { pools: [], members: [], cycles: [] }, isLoading: false, error: null };
}
