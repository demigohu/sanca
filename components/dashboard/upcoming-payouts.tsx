'use client';

import Link from 'next/link';
import { Calendar, Loader2 } from 'lucide-react';
import { useUserPools } from '@/hooks/usePools';
import { format } from 'date-fns';
import { formatUSDC } from '@/lib/utils';

export default function UpcomingPayouts() {
  const { data: userPools, isLoading } = useUserPools();

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-accent" />
          Your Payouts
        </h3>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
      </div>
    );
  }

  const upcoming: Array<{ id: string; circleId: string; circleName: string; amount: string; date: string; daysAway: number }> = [];

  userPools
    ?.filter((p) => p.state === 'Active')
    .forEach((pool) => {
      const endTime = Number(pool.cycleStartTime) + pool.periodDuration;
      const daysAway = Math.ceil((endTime * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysAway <= 0) return;
      upcoming.push({
        id: `payout-${pool.id}`,
        circleId: pool.id,
        circleName: pool.name,
        amount: `$${Number(formatUSDC(pool.contributionPerPeriod * BigInt(pool.maxMembers))).toFixed(2)}`,
        date: format(new Date(endTime * 1000), 'MMM d, yyyy'),
        daysAway,
      });
    });

  upcoming.sort((a, b) => a.daysAway - b.daysAway);

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-accent" />
        Cycle End Dates
      </h3>
      {upcoming.length ? (
        <div className="space-y-4">
          {upcoming.slice(0, 3).map((p) => (
            <Link key={p.id} href={`/circles/${p.circleId}`}>
              <div className="pb-4 border-b border-border last:border-0 hover:opacity-80">
                <p className="text-sm font-semibold">{p.circleName}</p>
                <p className="text-lg font-bold text-accent font-mono">{p.amount}</p>
                <p className="text-xs text-muted-foreground">{p.date} · {p.daysAway}d</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">No active cycles yet.</p>
      )}
    </div>
  );
}
