'use client';

export function useKeeperPoolSummaries() {
  return { data: [], isLoading: false, error: null };
}

export function useKeeperDecisionHistory(_pool?: string | null) {
  return { data: [], isLoading: false, error: null };
}

export function useKeeperSummaryMap() {
  return {
    data: new Map<string, never>(),
    isLoading: false,
    error: null,
  };
}
