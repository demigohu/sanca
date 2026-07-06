'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useContribute } from '@/hooks/useContribute';
import { usePrivy } from '@privy-io/react-auth';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatUSDC, formatAddress } from '@/lib/utils';
import {
  TransactionFlowDialog,
  type TransactionFlowStep,
} from '@/components/circles/transaction-flow-dialog';

interface ContributeButtonProps {
  poolAddress: string;
  poolState: 'Open' | 'Active' | 'Completed' | 'Liquidated';
  currentCycle: number;
  members: Array<{ address: string }>;
  cycleContributions?: Array<{ memberAddress: string; cycleIndex: number }>;
}

export function ContributeButton({
  poolAddress,
  poolState,
  currentCycle,
  members,
  cycleContributions = [],
}: ContributeButtonProps) {
  const { authenticated, login } = usePrivy();
  const { address } = useStellarWallet();
  const { contribute, contributionPerPeriod, isPending } = useContribute(poolAddress);

  const isUserMember = members.some((m) => m.address.toLowerCase() === address?.toLowerCase());
  const hasContributed = cycleContributions.some(
    (c) => c.memberAddress.toLowerCase() === address?.toLowerCase() && c.cycleIndex === currentCycle,
  );

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<{
    status: 'queued' | 'pending' | 'success' | 'error';
    txHash?: string;
    errorMessage?: string;
  }>({ status: 'queued' });

  async function runContribute() {
    if (!authenticated) {
      login();
      return;
    }
    setOpen(true);
    setStep({ status: 'pending' });
    try {
      const hash = await contribute();
      setStep({ status: 'success', txHash: hash });
      toast.success('Contribution successful!');
    } catch (e) {
      setStep({
        status: 'error',
        errorMessage: e instanceof Error ? e.message : 'Failed to contribute',
      });
    }
  }

  const steps: TransactionFlowStep[] = useMemo(
    () => [
      {
        id: 'contribute',
        contractInfo: formatAddress(poolAddress),
        description: `Deposit ${formatUSDC(contributionPerPeriod ?? BigInt(0))} USDC for cycle ${currentCycle + 1}`,
        status: step.status,
        txHash: step.txHash,
        errorMessage: step.errorMessage,
        onRetry: runContribute,
      },
    ],
    [contributionPerPeriod, currentCycle, poolAddress, step],
  );

  if (poolState !== 'Active' || !isUserMember) return null;

  if (hasContributed) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="w-4 h-4 text-accent" />
        <span>You have already contributed to this cycle</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={runContribute} disabled={isPending} className="w-full" size="lg">
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          `Contribute ${formatUSDC(contributionPerPeriod ?? BigInt(0))} USDC`
        )}
      </Button>
      <TransactionFlowDialog
        open={open}
        onOpenChange={setOpen}
        title="Submitting contribution..."
        description="Gas sponsored by Sanca relayer."
        steps={steps}
        isRunning={isPending}
      />
    </div>
  );
}
