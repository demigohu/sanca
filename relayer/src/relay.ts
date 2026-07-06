import {
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
  rpc,
} from '@stellar/stellar-sdk';
import { config, WHITELISTED_METHODS } from './config.js';
import { isAllowedContract } from './pool-registry.js';

const networkPassphrase =
  config.network === 'public' ? Networks.PUBLIC : Networks.TESTNET;

export function getRpc(): rpc.Server {
  return new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith('http:'),
  });
}

export function getRelayerKeypair(): Keypair {
  return Keypair.fromSecret(config.relayerSecret);
}

/**
 * Parse and validate a signed inner transaction XDR.
 * Throws a descriptive error if anything is disallowed.
 */
async function parseAndValidate(
  signedInnerXdr: string,
  sorobanRpc: rpc.Server,
): Promise<Transaction> {
  let tx: Transaction;
  try {
    tx = new Transaction(signedInnerXdr, networkPassphrase);
  } catch {
    throw new Error('Invalid transaction XDR');
  }

  if (tx.signatures.length === 0) {
    throw new Error('Inner transaction must be signed by the user');
  }

  for (const op of tx.operations) {
    if (op.type !== 'invokeHostFunction') {
      throw new Error(`Disallowed operation type: ${op.type}`);
    }

    const contractInvoke = op.func.invokeContract?.();
    if (!contractInvoke) {
      throw new Error('Operation is not a contract invocation');
    }

    const contractIdBuf = contractInvoke.contractAddress().contractId();
    if (!contractIdBuf) throw new Error('Could not extract contract ID from operation');
    const contractHex = (contractIdBuf as Buffer).toString('hex');
    const method = contractInvoke.functionName().toString();

    if (!WHITELISTED_METHODS.has(method)) {
      throw new Error(`Method not whitelisted: ${method}`);
    }

    // Verify contract is factory or a pool registered in factory.
    // Pool registry is fetched from factory.get_all_pools() and cached.
    if (!(await isAllowedContract(contractHex, sorobanRpc))) {
      throw new Error(`Contract not registered in factory: ${contractHex}`);
    }
  }

  return tx;
}

/**
 * Relay a signed inner transaction via fee-bump.
 * 1. Validate: method whitelist + factory-registered contract.
 * 2. Simulate — reject early if it would fail on-chain.
 * 3. Wrap in FeeBumpTransaction signed by relayer.
 * 4. Submit and poll until SUCCESS/FAILED.
 * Returns the tx hash on success.
 */
export async function relay(signedInnerXdr: string): Promise<string> {
  const sorobanRpc = getRpc();
  const innerTx = await parseAndValidate(signedInnerXdr, sorobanRpc);

  const sim = await sorobanRpc.simulateTransaction(innerTx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`Simulation failed: ${JSON.stringify(sim)}`);
  }

  const relayer = getRelayerKeypair();
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    relayer,
    String(config.maxFee),
    innerTx,
    networkPassphrase,
  );
  feeBump.sign(relayer);

  const sendResult = await sorobanRpc.sendTransaction(feeBump);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Submit failed: ${JSON.stringify(sendResult)}`);
  }

  const hash = sendResult.hash;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const status = await sorobanRpc.getTransaction(hash);
    if (status.status === 'SUCCESS') return hash;
    if (status.status === 'FAILED') {
      throw new Error(`Transaction failed: ${JSON.stringify(status)}`);
    }
  }

  throw new Error(`Timeout waiting for tx ${hash}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
