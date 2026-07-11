'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WalletSetupPhase } from '@/lib/stellar-wallet-context';

const STEPS: { key: WalletSetupPhase; label: string }[] = [
  { key: 'creating', label: 'Create your wallet' },
  { key: 'sponsoring', label: 'Activate on Stellar' },
  { key: 'trustline', label: 'Enable USDC (Blend)' },
];

function stepIndex(phase: WalletSetupPhase): number {
  if (phase === 'creating') return 0;
  if (phase === 'sponsoring') return 1;
  if (phase === 'trustline') return 2;
  if (phase === 'ready') return 3;
  if (phase === 'error') return -1;
  return 0;
}

export function WalletSetupDialog({
  open,
  phase,
  error,
  label,
  onRetry,
}: {
  open: boolean;
  phase: WalletSetupPhase;
  error: string | null;
  label: string;
  onRetry?: () => void;
}) {
  const active = stepIndex(phase);
  const canDismiss = !!error;

  return (
    <Dialog open={open} onOpenChange={canDismiss ? undefined : () => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => !canDismiss && e.preventDefault()}
        onEscapeKeyDown={(e) => !canDismiss && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            One-time setup — no XLM purchase needed. You may be asked to approve USDC access once.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <AlertCircle className="size-5 shrink-0 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Setup failed</p>
              <p className="text-muted-foreground mt-1">{error}</p>
              <p className="text-muted-foreground mt-2 text-xs">
                Click Try again to continue setup.
              </p>
              {onRetry && (
                <Button type="button" size="sm" className="mt-3" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          </div>
        ) : (
          <ul className="space-y-3 py-2">
            {STEPS.map((step, i) => {
              const done = active > i || phase === 'ready';
              const current = active === i && phase !== 'ready';
              return (
                <li key={step.key} className="flex items-center gap-3 text-sm">
                  {done ? (
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                  ) : current ? (
                    <Loader2 className="size-5 animate-spin text-primary shrink-0" />
                  ) : (
                    <span className="size-5 rounded-full border-2 border-muted shrink-0" />
                  )}
                  <span className={done ? 'text-foreground' : current ? 'font-medium' : 'text-muted-foreground'}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {phase === 'ready' && !error && (
          <p className="text-sm text-emerald-600 font-medium">Your wallet is ready.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
