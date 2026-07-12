import {
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  scValToNative,
  TransactionBuilder,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { config } from './config.js';

export function getRpc(): rpc.Server {
  return new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith('http:'),
  });
}

export function getKeypair(): Keypair {
  return Keypair.fromSecret(config.keeperSecret);
}

export function getNetworkPassphrase(): string {
  return config.network === 'public' ? Networks.PUBLIC : Networks.TESTNET;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function simulateContractCall(
  sorobanRpc: rpc.Server,
  contractAddress: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<xdr.ScVal> {
  const contract = new Contract(contractAddress);
  const account = await sorobanRpc.getAccount(getKeypair().publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await sorobanRpc.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(
      `Simulation failed for ${contractAddress}.${method}: ${JSON.stringify(sim)}`,
    );
  }
  if (!sim.result) {
    throw new Error(`Simulation for ${contractAddress}.${method} returned no result`);
  }
  return sim.result.retval;
}

type HorizonTx = { successful?: boolean };

/** Soroban RPC getTransaction can throw "Bad union switch" on some ledger XDR shapes. */
async function pollHorizonTransaction(hash: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const res = await fetch(`${config.horizonUrl}/transactions/${hash}`);
    if (res.status === 404) continue;
    if (!res.ok) continue;
    const data = (await res.json()) as HorizonTx;
    if (data.successful === true) return;
    if (data.successful === false) {
      throw new Error(`Transaction failed on ledger: ${hash}`);
    }
  }
  throw new Error(`Timeout waiting for tx ${hash}`);
}

async function pollSubmittedTransaction(
  hash: string,
  sorobanRpc: rpc.Server,
): Promise<void> {
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    try {
      const status = await sorobanRpc.getTransaction(hash);
      if (status.status === 'SUCCESS') return;
      if (status.status === 'FAILED') {
        throw new Error(`Transaction failed: ${JSON.stringify(status)}`);
      }
    } catch (err) {
      try {
        await pollHorizonTransaction(hash);
        return;
      } catch {
        if (i === 29) throw err;
      }
    }
  }
  throw new Error(`Timeout waiting for tx ${hash}`);
}

export async function invokeContract(
  sorobanRpc: rpc.Server,
  contractAddress: string,
  method: string,
  args: xdr.ScVal[],
  signer?: Keypair,
): Promise<string> {
  const source = signer ?? getKeypair();
  const contract = new Contract(contractAddress);
  const account = await sorobanRpc.getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await sorobanRpc.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(
      `Simulation failed for ${contractAddress}.${method}: ${JSON.stringify(sim)}`,
    );
  }

  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(source);
  const sendResult = await sorobanRpc.sendTransaction(prepared);

  if (sendResult.status === 'ERROR') {
    throw new Error(
      `Send transaction failed for ${contractAddress}.${method}: ${JSON.stringify(sendResult)}`,
    );
  }

  const hash = sendResult.hash;
  await pollSubmittedTransaction(hash, sorobanRpc);
  return hash;
}

export async function getAllPoolAddresses(sorobanRpc: rpc.Server): Promise<string[]> {
  const retval = await simulateContractCall(
    sorobanRpc,
    config.factoryAddress,
    'get_all_pools',
  );
  const addresses = scValToNative(retval) as string[] | null;
  return addresses ?? [];
}
