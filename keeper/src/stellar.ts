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
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const status = await sorobanRpc.getTransaction(hash);
    if (status.status === 'SUCCESS') {
      return hash;
    }
    if (status.status === 'FAILED') {
      throw new Error(
        `Transaction failed for ${contractAddress}.${method}: ${JSON.stringify(status)}`,
      );
    }
  }

  throw new Error(
    `Timeout waiting for ${contractAddress}.${method} transaction ${hash}`,
  );
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
