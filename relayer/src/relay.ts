import {
  Asset,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
  rpc,
} from '@stellar/stellar-sdk';
import { config, WHITELISTED_METHODS, ALLOWED_TRUST_ISSUERS } from './config.js';

type HorizonTx = { successful?: boolean };
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

function isAllowedUsdcChangeTrust(op: Operation): op is Operation.ChangeTrust {
  if (op.type !== 'changeTrust') return false;
  const line = op.line;
  if (!(line instanceof Asset)) return false;
  return line.getCode() === config.usdcAssetCode && ALLOWED_TRUST_ISSUERS.has(line.getIssuer());
}

/** Off-ramp: user sends Circle USDC to MoneyGram (relayer pays the fee). */
function isAllowedUsdcPayment(op: Operation): boolean {
  if (op.type !== 'payment') return false;
  const asset = op.asset;
  if (!(asset instanceof Asset)) return false;
  if (
    asset.getCode() !== config.usdcAssetCode ||
    asset.getIssuer() !== config.moneygramUsdcIssuer
  ) {
    return false;
  }
  const amount = Number.parseFloat(op.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > config.maxUsdcPayment) {
    return false;
  }
  return true;
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

  if (tx.operations.length === 0 || tx.operations.length > 2) {
    throw new Error('Inner transaction must contain 1–2 operations');
  }

  const allChangeTrust = tx.operations.every((op) => op.type === 'changeTrust');
  if (allChangeTrust) {
    const issuers = new Set<string>();
    for (const op of tx.operations) {
      if (op.type !== 'changeTrust') continue;
      if (!isAllowedUsdcChangeTrust(op)) {
        throw new Error('Only Blend or MoneyGram USDC changeTrust is allowed');
      }
      const line = op.line;
      if (!(line instanceof Asset)) {
        throw new Error('Only classic asset trustlines are allowed');
      }
      const issuer = line.getIssuer();
      if (issuers.has(issuer)) {
        throw new Error('Duplicate trustline issuer in transaction');
      }
      issuers.add(issuer);
    }
    return tx;
  }

  if (tx.operations.length !== 1) {
    throw new Error('Mixed operation types are not allowed');
  }

  const op = tx.operations[0];

  if (op.type === 'changeTrust') {
    if (!isAllowedUsdcChangeTrust(op)) {
      throw new Error('Only Blend or MoneyGram USDC changeTrust is allowed');
    }
    return tx;
  }

  if (op.type === 'payment') {
    if (!isAllowedUsdcPayment(op)) {
      throw new Error('Only USDC payments within limit are allowed');
    }
    return tx;
  }

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

  if (!(await isAllowedContract(contractHex, sorobanRpc))) {
    throw new Error(`Contract not registered in factory: ${contractHex}`);
  }

  return tx;
}

function isClassicInnerTx(tx: Transaction): boolean {
  return tx.operations.every((op) => op.type !== 'invokeHostFunction');
}

/** Fee-bump base must be >= inner inclusion fee (SDK check); Soroban ops often need 500k+ stroops. */
function computeFeeBumpBaseFee(innerTx: Transaction): string {
  const innerFee = Number.parseInt(innerTx.fee, 10);
  if (!Number.isFinite(innerFee)) {
    throw new Error(`Invalid inner transaction fee: ${innerTx.fee}`);
  }
  return String(Math.max(config.maxFee, innerFee));
}

/** Classic fee-bump txs: Soroban getTransaction XDR parsing can throw (Bad union switch). */
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
  useHorizon: boolean,
): Promise<void> {
  if (useHorizon) {
    await pollHorizonTransaction(hash);
    return;
  }

  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    try {
      const status = await sorobanRpc.getTransaction(hash);
      if (status.status === 'SUCCESS') return;
      if (status.status === 'FAILED') {
        throw new Error(`Transaction failed: ${JSON.stringify(status)}`);
      }
    } catch (err) {
      // Fallback when RPC returns tx data the SDK cannot parse.
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

  const changeTrustOnly = innerTx.operations.every((op) => op.type === 'changeTrust');
  // Soroban RPC simulateTransaction rejects classic multi-op txs ("more than one operation").
  // changeTrust is validated above; skip sim and submit via fee-bump directly.
  if (!changeTrustOnly) {
    const sim = await sorobanRpc.simulateTransaction(innerTx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      throw new Error(`Simulation failed: ${JSON.stringify(sim)}`);
    }
  }

  const relayer = getRelayerKeypair();
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    relayer,
    computeFeeBumpBaseFee(innerTx),
    innerTx,
    networkPassphrase,
  );
  feeBump.sign(relayer);

  const sendResult = await sorobanRpc.sendTransaction(feeBump);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Submit failed: ${JSON.stringify(sendResult)}`);
  }

  const hash = sendResult.hash;
  await pollSubmittedTransaction(hash, sorobanRpc, isClassicInnerTx(innerTx));
  return hash;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
