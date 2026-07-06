#!/usr/bin/env node
/**
 * Decompress drand BLS12-381 points to Soroban CAP-0059 byte order.
 *
 * G1: x (48) || y (48)
 * G2: x_c1 || x_c0 || y_c1 || y_c0
 */
import { bls12_381 } from '@noble/curves/bls12-381.js';

function fieldElementToBytes(element) {
  const hex = element.toString(16).padStart(96, '0');
  const bytes = new Uint8Array(48);
  for (let i = 0; i < 48; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function decompressG1Point(compressedHex) {
  const point = bls12_381.G1.Point.fromHex(compressedHex);
  const { x, y } = point.toAffine();
  const out = new Uint8Array(96);
  out.set(fieldElementToBytes(x), 0);
  out.set(fieldElementToBytes(y), 48);
  return Buffer.from(out).toString('hex');
}

export function decompressG2Point(compressedHex) {
  const point = bls12_381.G2.Point.fromHex(compressedHex);
  const { x, y } = point.toAffine();
  const out = new Uint8Array(192);
  out.set(fieldElementToBytes(x.c1), 0);
  out.set(fieldElementToBytes(x.c0), 48);
  out.set(fieldElementToBytes(y.c1), 96);
  out.set(fieldElementToBytes(y.c0), 144);
  return Buffer.from(out).toString('hex');
}

const mode = process.argv[2];
const hexArg = process.argv[3];
if (!mode || !hexArg) {
  console.error('Usage: node decompress_drand.mjs g1|g2 <compressed_hex>');
  process.exit(1);
}

if (mode === 'g1') {
  process.stdout.write(decompressG1Point(hexArg));
} else if (mode === 'g2') {
  process.stdout.write(decompressG2Point(hexArg));
} else {
  console.error('Mode must be g1 or g2');
  process.exit(1);
}
