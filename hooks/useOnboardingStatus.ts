'use client';

import { usePrivy } from '@privy-io/react-auth';

export function useOnboardingStatus() {
  const { authenticated } = usePrivy();
  return {
    hasCompletedOnboarding: authenticated,
    isLoading: false,
  };
}
