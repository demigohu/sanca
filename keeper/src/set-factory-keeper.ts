import { Keypair, nativeToScVal } from '@stellar/stellar-sdk';
import { config } from './config.js';
import { getKeypair, getRpc, invokeContract } from './stellar.js';

async function main() {
  if (!config.adminSecret) {
    throw new Error(
      'ADMIN_SECRET is required to call factory.set_keeper (factory admin must authorize)',
    );
  }

  const sorobanRpc = getRpc();
  const adminKeypair = Keypair.fromSecret(config.adminSecret);
  const keeperKeypair = getKeypair();

  console.log(`Factory: ${config.factoryAddress}`);
  console.log(`Admin:   ${adminKeypair.publicKey()}`);
  console.log(`Keeper:  ${keeperKeypair.publicKey()}`);

  const txHash = await invokeContract(
    sorobanRpc,
    config.factoryAddress,
    'set_keeper',
    [nativeToScVal(keeperKeypair.publicKey(), { type: 'address' })],
    adminKeypair,
  );

  console.log(`Factory keeper set. Tx: ${txHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
