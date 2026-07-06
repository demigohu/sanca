'use client';

import { Keypair, Transaction, xdr } from '@stellar/stellar-sdk';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { NETWORK_PASSPHRASE } from '@/lib/stellar';

export function useSignStellarTx() {
  const { signRawHash } = useSignRawHash();

  async function signTransactionXdr(unsignedXdr: string, publicKey: string): Promise<string> {
    const tx = new Transaction(unsignedXdr, NETWORK_PASSPHRASE);
    const hash = tx.hash();
    const hexHash = ('0x' + Buffer.from(hash).toString('hex')) as `0x${string}`;

    const { signature: signatureHex } = await signRawHash({
      address: publicKey,
      chainType: 'stellar',
      hash: hexHash,
    });

    const sigBytes = Buffer.from(signatureHex.replace(/^0x/, ''), 'hex');
    const hint = Buffer.from(Keypair.fromPublicKey(publicKey).rawPublicKey()).slice(-4);
    tx.signatures.push(new xdr.DecoratedSignature({ hint, signature: sigBytes }));

    return tx.toXDR();
  }

  return { signTransactionXdr };
}
