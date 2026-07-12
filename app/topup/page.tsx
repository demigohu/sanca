'use client';

import { useCoridorRamp } from '@/hooks/useCoridorRamp';
import { WALLET_PREPARING_LABEL } from '@/lib/wallet-setup';
import { CoridorInteractive } from '@/components/coridor/coridor-interactive';
import ConnectWalletButton from '@/components/wallet/connect-wallet-button';
import { ArrowDownToLine, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TxExplorerLink } from '@/components/stellar/tx-explorer-link';

export default function TopUpPage() {
  const ramp = useCoridorRamp('deposit');

  const dialogOpen =
    ramp.step === 'interactive' ||
    ramp.step === 'polling' ||
    ramp.step === 'starting' ||
    ramp.step === 'authenticating';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Top Up USDC</h1>
          <p className="text-muted-foreground mt-2">
            Cash in via Coridor — IDR (VA, QRIS, OVO) to Blend USDC on Stellar.
          </p>
        </div>

        {ramp.isMock && (
          <Alert>
            <AlertTitle>Demo mode</AlertTitle>
            <AlertDescription>
              `NEXT_PUBLIC_CORIDOR_MOCK=true` — no real Coridor session. Set to false for live
              sandbox.
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertTitle>Same USDC as pools</AlertTitle>
          <AlertDescription>
            Coridor credits Blend USDC — the same asset used by Sanca circles. Top up and join
            directly, no swap needed.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownToLine className="size-5" />
              Deposit
            </CardTitle>
            <CardDescription>
              Anchor: {ramp.coridorDomain} · Min IDR 10,000 in widget · Sandbox: use Simulate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your IDR amount in the Coridor widget (VA, QRIS, or OVO).
            </p>

            <div className="flex gap-3">
              <ConnectWalletButton />
              <Button
                className="flex-1"
                disabled={
                  ramp.walletPreparing ||
                  ramp.step === 'authenticating' ||
                  ramp.step === 'starting'
                }
                onClick={() => void ramp.startRamp()}
              >
                {(ramp.walletPreparing ||
                  ramp.step === 'authenticating' ||
                  ramp.step === 'starting') && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {ramp.walletPreparing ? WALLET_PREPARING_LABEL : 'Continue with Coridor'}
              </Button>
            </div>

            {ramp.step === 'completed' && ramp.transaction && (
              <Alert className="border-emerald-500/30 bg-emerald-500/10">
                <AlertTitle>Deposit complete</AlertTitle>
                <AlertDescription className="space-y-1">
                  <p>
                    {ramp.isMock
                      ? 'Demo deposit credited (mock).'
                      : `${ramp.transaction.amount_out || ramp.transaction.amount_in || ''} USDC received`}
                  </p>
                  {ramp.transaction.stellar_transaction_id && !ramp.isMock && (
                    <p>
                      <TxExplorerLink txHash={ramp.transaction.stellar_transaction_id} />
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {ramp.step === 'error' && ramp.error && (
              <Alert variant="destructive">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{ramp.error}</AlertDescription>
              </Alert>
            )}

            {(ramp.step === 'completed' || ramp.step === 'error') && (
              <Button variant="outline" onClick={ramp.reset}>
                Start over
              </Button>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Powered by{' '}
          <a href="https://coridor.fun" className="underline" target="_blank" rel="noopener noreferrer">
            Coridor
          </a>{' '}
          · SEP-24 on Stellar testnet.
        </p>
      </div>

      <CoridorInteractive
        open={dialogOpen}
        url={ramp.interactiveUrl}
        step={ramp.step}
        onClose={ramp.dismissInteractive}
      />
    </div>
  );
}
