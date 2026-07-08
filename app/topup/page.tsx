'use client';

import { useState } from 'react';
import { ArrowDownToLine, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMoneyGramRamp } from '@/hooks/useMoneyGramRamp';
import { WALLET_PREPARING_LABEL } from '@/lib/wallet-setup';
import { MoneyGramInteractive } from '@/components/moneygram/moneygram-interactive';
import ConnectWalletButton from '@/components/wallet/connect-wallet-button';

export default function TopUpPage() {
  const [amount, setAmount] = useState('10');
  const ramp = useMoneyGramRamp('deposit');

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
            Cash in via MoneyGram Ramps — fiat to USDC on Stellar testnet.
          </p>
        </div>

        {ramp.isMock && (
          <Alert>
            <AlertTitle>Demo mode</AlertTitle>
            <AlertDescription>
              `NEXT_PUBLIC_MONEYGRAM_MOCK=true` — no real MoneyGram session. Set mock to false
              after your domain is allowlisted by MoneyGram.
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertTitle>MoneyGram USDC ≠ Pool USDC</AlertTitle>
          <AlertDescription>
            MoneyGram credits classic USDC (Circle test issuer). Sanca pools use Blend USDC SAC.
            You may need to swap before joining a circle.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownToLine className="size-5" />
              Deposit
            </CardTitle>
            <CardDescription>
              Anchor: {ramp.moneyGramDomain} · App domain: {ramp.appDomain}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USDC)</Label>
              <Input
                id="amount"
                type="number"
                min="5"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Testnet sandbox: search for EXT locations like &quot;CUB FOODS SILVER LAKE&quot; (US)
                in the MoneyGram UI. See{' '}
                <a
                  href="https://developer.moneygram.com/moneygram-developer/docs/on-ramp-cash-in-location-test-data"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  sandbox location test data
                </a>
                .
              </p>
            </div>

            <div className="flex gap-3">
              <ConnectWalletButton />
              <Button
                className="flex-1"
                disabled={
                  ramp.walletPreparing ||
                  ramp.step === 'authenticating' ||
                  ramp.step === 'starting'
                }
                onClick={() => void ramp.startRamp(amount)}
              >
                {(ramp.walletPreparing ||
                  ramp.step === 'authenticating' ||
                  ramp.step === 'starting') && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {ramp.walletPreparing ? WALLET_PREPARING_LABEL : 'Continue with MoneyGram'}
              </Button>
            </div>

            {ramp.step === 'completed' && ramp.transaction && (
              <Alert className="border-emerald-500/30 bg-emerald-500/10">
                <AlertTitle>Deposit complete</AlertTitle>
                <AlertDescription>
                  {ramp.transaction.amount_out || ramp.transaction.amount_in} USDC received
                  {ramp.transaction.stellar_transaction_id
                    ? ` · tx ${ramp.transaction.stellar_transaction_id.slice(0, 8)}…`
                    : ''}
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
          Requires SEP-10 auth + allowlisted domain with{' '}
          <code className="text-foreground">/.well-known/stellar.toml</code>. See{' '}
          <a
            href="https://developer.moneygram.com/moneygram-developer/docs/integrate-moneygram-ramps"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            MoneyGram Ramps docs
          </a>
          .
        </p>
      </div>

      <MoneyGramInteractive
        open={dialogOpen}
        url={ramp.interactiveUrl}
        step={ramp.step}
        onClose={ramp.dismissInteractive}
        onRampMessage={ramp.handleRampMessage}
      />
    </div>
  );
}
