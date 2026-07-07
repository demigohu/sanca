'use client';

import { Loader2 } from 'lucide-react';
import { DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { useUsdcBalances } from '@/hooks/useUsdcBalances';
import { cn, formatUSDC } from '@/lib/utils';

export function UsdcBalancesCard({ className }: { className?: string }) {
  const { data, isLoading, error } = useUsdcBalances();

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Loader2 className="size-4 animate-spin" />
        Loading USDC balances…
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Could not load USDC balances.
      </p>
    );
  }

  const total = data.reduce((sum, line) => sum + line.balanceStroops, BigInt(0));

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Wallet USDC
          </p>
          <p className="text-3xl font-bold font-mono text-foreground">${formatUSDC(total)}</p>
        </div>
        <p className="text-xs text-muted-foreground text-right max-w-[12rem]">
          Blend = pools · Circle = MoneyGram
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.map((line) => (
          <div
            key={line.id}
            className="rounded-lg border border-border bg-background/50 px-4 py-3"
          >
            <p className="text-sm font-medium text-foreground">{line.label}</p>
            <p className="text-xl font-bold font-mono text-accent mt-1">
              ${formatUSDC(line.balanceStroops)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{line.purpose}</p>
            {!line.hasTrustline && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">No trustline yet</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function UsdcBalancesDropdownSummary() {
  const { data, isLoading } = useUsdcBalances();

  if (isLoading) {
    return (
      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal py-1">
        Loading balances…
      </DropdownMenuLabel>
    );
  }

  if (!data) return null;

  return (
    <>
      {data.map((line) => (
        <DropdownMenuLabel
          key={line.id}
          className="flex items-center justify-between gap-4 font-normal py-1"
        >
          <span className="text-muted-foreground">{line.label}</span>
          <span className="font-mono text-foreground">${formatUSDC(line.balanceStroops)}</span>
        </DropdownMenuLabel>
      ))}
    </>
  );
}
