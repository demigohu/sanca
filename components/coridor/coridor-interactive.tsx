'use client';

import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RampStep } from '@/hooks/useCoridorRamp';

interface CoridorInteractiveProps {
  open: boolean;
  url: string | null;
  step: RampStep;
  onClose: () => void;
}

export function CoridorInteractive({ open, url, step, onClose }: CoridorInteractiveProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle>Coridor</DialogTitle>
          <DialogDescription>
            Pay in IDR (VA, QRIS, OVO) or enter bank details. Sandbox: use the Simulate button.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex-1 min-h-0 bg-muted/30">
          {url ? (
            <iframe
              src={url}
              title="Coridor SEP-24"
              className="absolute inset-0 w-full h-full border-0"
              allow="payment"
            />
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span>
                {step === 'polling' || step === 'sending'
                  ? 'Processing on Stellar…'
                  : 'Preparing Coridor…'}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
