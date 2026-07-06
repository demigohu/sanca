'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWithdraw } from '@/hooks/useWithdraw';
import { usePrivy } from '@privy-io/react-auth';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { formatUSDC, formatAddress } from '@/lib/utils';
import { usePoolDetail } from '@/hooks/usePools';
import {
  TransactionFlowDialog,
  type TransactionFlowStep,
} from '@/components/circles/transaction-flow-dialog';

interface WithdrawButtonProps {
  poolAddress: string;
  poolState: 'Open' | 'Active' | 'Completed' | 'Liquidated';
}

export function WithdrawButton({ poolAddress, poolState }: WithdrawButtonProps) {
  const { authenticated, login } = usePrivy();
  const { address } = useStellarWallet();
  const { withdraw, isPending } = useWithdraw(poolAddress);
  const { data, refetch } = usePoolDetail(poolAddress);

  const member = data?.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const remainingCollateral = member?.collateral ?? BigInt(0);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<{
    status: 'queued' | 'pending' | 'success' | 'error';
    txHash?: string;
    errorMessage?: string;
  }>({ status: 'queued' });

  async function runWithdraw() {
    if (!authenticated) {
      login();
      return;
    }
    setOpen(true);
    setStep({ status: 'pending' });
    try {
      const hash = await withdraw();
      setStep({ status: 'success', txHash: hash });
      await refetch();
      toast.success('Funds withdrawn successfully!');
    } catch (e) {
      setStep({
        status: 'error',
        errorMessage: e instanceof Error ? e.message : 'Failed to withdraw',
      });
    }
  }

  const steps: TransactionFlowStep[] = useMemo(
    () => [
      {
        id: 'withdraw',
        contractInfo: formatAddress(poolAddress),
        description: `Withdraw ${formatUSDC(remainingCollateral)} USDC remaining collateral`,
        status: step.status,
        txHash: step.txHash,
        errorMessage: step.errorMessage,
        onRetry: runWithdraw,
      },
    ],
    [poolAddress, remainingCollateral, step],
  );

  if (poolState !== 'Completed') return null;

  if (!authenticated) {
    return (
      <Button disabled className="w-full">
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet to Withdraw
      </Button>
    );
  }

  if (remainingCollateral <= BigInt(0)) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">No remaining collateral to withdraw</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground text-center">
        Remaining collateral: {formatUSDC(remainingCollateral)} USDC
      </p>
      <Button onClick={runWithdraw} disabled={isPending} className="w-full" size="lg">
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          `Withdraw ${formatUSDC(remainingCollateral)} USDC`
        )}
      </Button>
      <TransactionFlowDialog
        open={open}
        onOpenChange={setOpen}
        title="Withdrawing funds..."
        description="Single withdrawal via relayer."
        steps={steps}
        isRunning={isPending}
      />
    </div>
  );
}
