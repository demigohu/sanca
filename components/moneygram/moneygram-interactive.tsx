'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RampStep } from '@/hooks/useMoneyGramRamp';
import { parseMoneyGramRampMessage } from '@/lib/moneygram/post-message';
import type { MoneyGramRampMessage } from '@/lib/moneygram/post-message';

interface MoneyGramInteractiveProps {
  open: boolean;
  url: string | null;
  step: RampStep;
  onClose: () => void;
  onRampMessage?: (message: MoneyGramRampMessage) => void;
}

export function MoneyGramInteractive({
  open,
  url,
  step,
  onClose,
  onRampMessage,
}: MoneyGramInteractiveProps) {
  useEffect(() => {
    if (!open || !onRampMessage) return;

    const handler = (event: MessageEvent) => {
      if (url) {
        try {
          const expectedOrigin = new URL(url).origin;
          if (event.origin !== expectedOrigin) return;
        } catch {
          return;
        }
      }

      const message = parseMoneyGramRampMessage(event.data);
      if (message) onRampMessage(message);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [open, url, onRampMessage]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle>MoneyGram</DialogTitle>
          <DialogDescription>
            Complete KYC and payment in the MoneyGram window. Do not close until finished.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex-1 min-h-0 bg-muted/30">
          {url ? (
            <iframe
              src={url}
              title="MoneyGram Ramp"
              className="absolute inset-0 w-full h-full border-0"
              allow="camera; microphone; payment"
            />
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span>
                {step === 'polling' || step === 'sending'
                  ? 'Processing on Stellar…'
                  : 'Preparing MoneyGram…'}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
