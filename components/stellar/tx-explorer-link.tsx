import { ExternalLink } from 'lucide-react';
import { getTxExplorerUrl, shortAddress } from '@/lib/stellar';

interface TxExplorerLinkProps {
  txHash: string;
  /** Show truncated hash as link text (default). Set false to use `label`. */
  showHash?: boolean;
  label?: string;
  className?: string;
}

export function TxExplorerLink({
  txHash,
  showHash = true,
  label = 'View on Stellar Expert',
  className = 'inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground',
}: TxExplorerLinkProps) {
  return (
    <a
      href={getTxExplorerUrl(txHash)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {showHash ? (
        <span className="font-mono text-xs">tx {shortAddress(txHash)}</span>
      ) : (
        <span>{label}</span>
      )}
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}
