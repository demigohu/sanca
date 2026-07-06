import crypto from 'node:crypto';
import { bls12_381 } from '@noble/curves/bls12-381';
import { DrandBeacon } from './types.js';

function fieldElementToBytes(element: bigint): Uint8Array {
  const hex = element.toString(16).padStart(96, '0');
  const bytes = new Uint8Array(48);
  for (let i = 0; i < 48; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function decompressG1Point(compressed: Uint8Array): Uint8Array {
  const point = bls12_381.G1.Point.fromHex(Buffer.from(compressed).toString('hex'));
  const { x, y } = point.toAffine();
  const out = new Uint8Array(96);
  out.set(fieldElementToBytes(x), 0);
  out.set(fieldElementToBytes(y), 48);
  return out;
}

export async function fetchLatestDrand(chainHash: string): Promise<DrandBeacon> {
  const url = `https://api.drand.sh/${chainHash}/public/latest`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`drand fetch failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as {
    round: number;
    signature: string;
  };

  const signatureCompressed = Buffer.from(body.signature, 'hex');
  const signatureUncompressed = decompressG1Point(signatureCompressed);

  const randomness = crypto
    .createHash('sha256')
    .update(signatureCompressed)
    .digest('hex');

  return {
    round: body.round,
    signature: Buffer.from(signatureUncompressed).toString('hex'),
    signatureCompressed: signatureCompressed.toString('hex'),
    randomness,
  };
}
