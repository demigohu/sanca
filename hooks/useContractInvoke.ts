'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  rpc,
  xdr,
  Keypair,
} from '@stellar/stellar-sdk';
import { getSorobanRpc, NETWORK_PASSPHRASE, submitViaRelayer } from '@/lib/stellar';
import { useStellarWallet } from './useStellarWallet';

export function useContractInvoke() {
  const { ready, authenticated, login } = usePrivy();
  const { address: userAddress } = useStellarWallet();
  const { signRawHash } = useSignRawHash();

  async function invoke(
    contractAddress: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<string> {
    if (!ready || !authenticated) {
      login();
      throw new Error('Not authenticated');
    }
    if (!userAddress) {
      throw new Error('Stellar wallet not ready. Please wait a moment and try again.');
    }

    const server = getSorobanRpc();
    const account = await server.getAccount(userAddress);
    const contract = new Contract(contractAddress);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      throw new Error(`Simulation failed: ${JSON.stringify(sim)}`);
    }
    const prepared = rpc.assembleTransaction(tx, sim).build();

    const txHashBytes = prepared.hash();
    const hexHash = ('0x' + Buffer.from(txHashBytes).toString('hex')) as `0x${string}`;

    const { signature: signatureHex } = await signRawHash({
      address: userAddress,
      chainType: 'stellar',
      hash: hexHash,
    });

    const sigBytes = Buffer.from(signatureHex.replace(/^0x/, ''), 'hex');
    const hint = Buffer.from(Keypair.fromPublicKey(userAddress).rawPublicKey()).slice(-4);
    prepared.signatures = [new xdr.DecoratedSignature({ hint, signature: sigBytes })];

    return submitViaRelayer(prepared.toXDR());
  }

  return { invoke, authenticated, ready, userAddress };
}
