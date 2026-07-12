'use client';

import { useCoridorRamp } from '@/hooks/useCoridorRamp';
import { WALLET_PREPARING_LABEL } from '@/lib/wallet-setup';
import { CoridorInteractive } from '@/components/coridor/coridor-interactive';
import ConnectWalletButton from '@/components/wallet/connect-wallet-button';
import { ArrowUpFromLine, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TxExplorerLink } from '@/components/stellar/tx-explorer-link';

export default function CashOutPage() {
  const ramp = useCoridorRamp('withdraw');

  const stellarTxHash =
    ramp.paymentTxHash ?? ramp.transaction?.stellar_transaction_id ?? null;

  const dialogOpen =
    ramp.step === 'interactive' ||
    ramp.step === 'polling' ||
    ramp.step === 'starting' ||
    ramp.step === 'authenticating' ||
    ramp.step === 'sending';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cash Out USDC</h1>
          <p className="text-muted-foreground mt-2">
            Withdraw Blend USDC to IDR via Coridor SEP-24 — transfer to your bank account.
          </p>
        </div>

        {ramp.isMock && (
          <Alert>
            <AlertTitle>Demo mode</AlertTitle>
            <AlertDescription>
              Mock flow enabled — no real withdrawal. Disable `NEXT_PUBLIC_CORIDOR_MOCK` for live
              sandbox.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpFromLine className="size-5" />
              Withdraw
            </CardTitle>
            <CardDescription>
              USDC amount and bank details in the Coridor widget · min ~0.5 USDC
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              After you finish in the widget, Sanca automatically sends USDC + memo to the anchor
              (relayer covers the network fee).
            </p>

            <div className="flex gap-3">
              <ConnectWalletButton />
              <Button
                className="flex-1"
                disabled={
                  ramp.walletPreparing ||
                  ramp.step === 'authenticating' ||
                  ramp.step === 'starting' ||
                  ramp.step === 'sending'
                }
                onClick={() => void ramp.startRamp()}
              >
                {(ramp.walletPreparing ||
                  ramp.step === 'authenticating' ||
                  ramp.step === 'starting' ||
                  ramp.step === 'sending') && <Loader2 className="mr-2 size-4 animate-spin" />}
                {ramp.walletPreparing
                  ? WALLET_PREPARING_LABEL
                  : ramp.step === 'sending'
                    ? 'Sending USDC…'
                    : 'Continue with Coridor'}
              </Button>
            </div>

            {ramp.step === 'sending' && (
              <Alert>
                <AlertTitle>Sending USDC to Coridor</AlertTitle>
                <AlertDescription>
                  Signing your withdrawal — network fee covered by Sanca relayer.
                </AlertDescription>
              </Alert>
            )}

            {ramp.step === 'completed' && ramp.transaction && (
              <Alert className="border-emerald-500/30 bg-emerald-500/10">
                <AlertTitle>Withdrawal submitted</AlertTitle>
                <AlertDescription className="space-y-1">
                  <p>
                    {ramp.isMock
                      ? 'Demo withdrawal complete (mock).'
                      : 'IDR payout is processing via Xendit.'}
                  </p>
                  {ramp.transaction.external_transaction_id && (
                    <p>
                      Reference: <strong>{ramp.transaction.external_transaction_id}</strong>
                    </p>
                  )}
                  {ramp.transaction.more_info_url && (
                    <p>
                      <a
                        href={ramp.transaction.more_info_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        View payout status
                      </a>
                    </p>
                  )}
                  {stellarTxHash && !ramp.isMock && (
                    <p>
                      <TxExplorerLink txHash={stellarTxHash} />
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
