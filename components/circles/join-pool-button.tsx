'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useJoinPool } from '@/hooks/useJoinPool';
import { usePrivy } from '@privy-io/react-auth';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { toast } from 'sonner';
import { Loader2, Wallet } from 'lucide-react';
import { formatUSDC, formatAddress } from '@/lib/utils';
import {
  TransactionFlowDialog,
  type TransactionFlowStep,
} from '@/components/circles/transaction-flow-dialog';

interface JoinPoolButtonProps {
  poolAddress: string;
  poolState: 'Open' | 'Active' | 'Completed' | 'Liquidated';
  currentMembers: number;
  maxMembers: number;
  members?: Array<{ address: string }>;
}

export function JoinPoolButton({
  poolAddress,
  poolState,
  currentMembers,
  maxMembers,
  members = [],
}: JoinPoolButtonProps) {
  const { authenticated, login } = usePrivy();
  const { address } = useStellarWallet();
  const { join, fullCollateral, isPending } = useJoinPool(poolAddress);

  const isUserMember =
    address && members.some((m) => m.address.toLowerCase() === address.toLowerCase());

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<{
    status: 'queued' | 'pending' | 'success' | 'error';
    txHash?: string;
    errorMessage?: string;
  }>({ status: 'queued' });

  async function runJoin() {
    if (!authenticated) {
      login();
      return;
    }
    setOpen(true);
    setStep({ status: 'pending' });
    try {
      const hash = await join();
      setStep({ status: 'success', txHash: hash });
      toast.success('Successfully joined the pool!');
    } catch (e) {
      setStep({
        status: 'error',
        errorMessage: e instanceof Error ? e.message : 'Failed to join pool',
      });
    }
  }

  const steps: TransactionFlowStep[] = useMemo(
    () => [
      {
        id: 'join',
        contractInfo: formatAddress(poolAddress),
        description: fullCollateral
          ? `Deposit ${formatUSDC(fullCollateral)} USDC collateral and join this pool`
          : 'Join the selected pool',
        status: step.status,
        txHash: step.txHash,
        errorMessage: step.errorMessage,
        onRetry: runJoin,
      },
    ],
    [fullCollateral, poolAddress, step],
  );

  if (poolState !== 'Open' || currentMembers >= maxMembers) return null;

  if (isUserMember) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">You are already a member of this pool</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <Button disabled className="w-full">
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet to Join
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {fullCollateral !== undefined && (
        <p className="text-sm text-muted-foreground text-center">
          Required: {formatUSDC(fullCollateral)} USDC
        </p>
      )}
      <Button
        onClick={runJoin}
        disabled={isPending || fullCollateral === undefined}
        className="w-full"
        size="lg"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          'Join Pool'
        )}
      </Button>
      <TransactionFlowDialog
        open={open}
        onOpenChange={setOpen}
        title="Joining pool..."
        description="Single Stellar transaction via fee relayer (no XLM needed)."
        steps={steps}
        isRunning={isPending}
      />
    </div>
  );
}
