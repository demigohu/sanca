import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert value to BigInt
 */
export function toBigInt(value: bigint | string | number): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string') return BigInt(value);
  return BigInt(value);
}

import { USDC_SCALE } from './stellar';

/**
 * Format on-chain USDC stroops to a dollar string.
 */
export function formatUSDC(amount: bigint | string | number): string {
  const bigIntAmount = toBigInt(amount);
  return (Number(bigIntAmount) / USDC_SCALE).toFixed(2);
}

/** Convert a human USDC amount to on-chain stroops. */
export function toUSDCStroops(amount: number): bigint {
  return BigInt(Math.round(amount * USDC_SCALE));
}

/**
 * Format address to short format
 */
export function formatAddress(address: string, startLength = 6, endLength = 4): string {
  if (!address) return '';
  if (address.length <= startLength + endLength) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}
