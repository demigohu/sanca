import { format, formatDistanceToNow } from 'date-fns';
import { toBigInt } from '@/lib/utils';

/** Unix seconds when the pool contract was deployed (0 = unknown). */
export function poolCreatedUnixSeconds(timestamp: bigint | string | number): bigint {
  return toBigInt(timestamp);
}

export function hasPoolCreatedTimestamp(timestamp: bigint | string | number): boolean {
  return poolCreatedUnixSeconds(timestamp) > BigInt(0);
}

export function formatPoolCreatedDisplay(timestamp: bigint | string | number): {
  primary: string;
  secondary: string;
} {
  const secs = poolCreatedUnixSeconds(timestamp);
  if (secs <= BigInt(0)) {
    return {
      primary: 'Recently',
      secondary: 'Waiting for members to join',
    };
  }
  const date = new Date(Number(secs) * 1000);
  return {
    primary: format(date, 'MMM d, yyyy'),
    secondary: formatDistanceToNow(date, { addSuffix: true }),
  };
}
