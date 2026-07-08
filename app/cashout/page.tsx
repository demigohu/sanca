'use client';

import { useState } from 'react';
import { ArrowUpFromLine, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMoneyGramRamp } from '@/hooks/useMoneyGramRamp';
import { WALLET_PREPARING_LABEL } from '@/lib/wallet-setup';
import { MoneyGramInteractive } from '@/components/moneygram/moneygram-interactive';
import ConnectWalletButton from '@/components/wallet/connect-wallet-button';

export default function CashOutPage() {
  const [amount, setAmount] = useState('10');
  const ramp = useMoneyGramRamp('withdraw');

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
            Withdraw USDC to cash at a MoneyGram location via Stellar SEP-24.
          </p>
        </div>

        {ramp.isMock && (
          <Alert>
            <AlertTitle>Demo mode</AlertTitle>
            <AlertDescription>
              Mock flow enabled — no real withdrawal. Disable `NEXT_PUBLIC_MONEYGRAM_MOCK` for
              staging.
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
              You will send MoneyGram USDC from your Privy wallet when prompted.
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
            </div>

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
                onClick={() => void ramp.startRamp(amount)}
              >
                {(ramp.walletPreparing ||
                  ramp.step === 'authenticating' ||
                  ramp.step === 'starting' ||
                  ramp.step === 'sending') && <Loader2 className="mr-2 size-4 animate-spin" />}
                {ramp.walletPreparing ? WALLET_PREPARING_LABEL : 'Continue with MoneyGram'}
              </Button>
            </div>

            {ramp.step === 'sending' && (
              <Alert>
                <AlertTitle>Sending USDC to MoneyGram</AlertTitle>
                <AlertDescription>
                  Signing your withdrawal — network fee covered by Sanca.
                </AlertDescription>
              </Alert>
            )}

            {ramp.step === 'completed' && ramp.transaction && (
              <Alert className="border-emerald-500/30 bg-emerald-500/10">
                <AlertTitle>Withdrawal ready for pickup</AlertTitle>
                <AlertDescription className="space-y-1">
                  <p>
                    Reference number:{' '}
                    <strong>
                      {ramp.transaction.external_transaction_id || ramp.transaction.id}
                    </strong>
                  </p>
                  {ramp.transaction.more_info_url && (
                    <p>
                      <a
                        href={ramp.transaction.more_info_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        View pickup details
                      </a>
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
