import { nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import { config } from './config.js';
import { fetchLatestDrand } from './drand.js';
import {
  getAllPoolAddresses,
  getKeypair,
  getRpc,
  invokeContract,
  simulateContractCall,
} from './stellar.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function processPool(
  sorobanRpc: ReturnType<typeof getRpc>,
  poolAddress: string,
): Promise<void> {
  const label = shortAddress(poolAddress);

  const poolInfo = scValToNative(
    await simulateContractCall(sorobanRpc, poolAddress, 'get_pool_info'),
  ) as [number, number, number, number, bigint, bigint];

  const state = poolInfo[0];
  const currentCycle = poolInfo[1];

  if (state !== 1) {
    log(`[${label}] Pool not active (state=${state}), skipping`);
    return;
  }

  const lastRound = Number(
    scValToNative(
      await simulateContractCall(sorobanRpc, poolAddress, 'get_last_drand_round'),
    ),
  );
  const cycleEnd = Number(
    scValToNative(
      await simulateContractCall(sorobanRpc, poolAddress, 'get_cycle_end_time'),
    ),
  );
  const now = Math.floor(Date.now() / 1000);

  log(
    `[${label}] cycle=${currentCycle} lastRound=${lastRound} cycleEnd=${cycleEnd} now=${now}`,
  );

  if (now < cycleEnd) {
    log(`[${label}] Cycle period has not ended yet`);
    return;
  }

  const beacon = await fetchLatestDrand(config.drandChainHash);
  log(`[${label}] Fetched drand round ${beacon.round}`);

  if (beacon.round <= lastRound) {
    log(`[${label}] Drand round is not newer than last settled round`);
    return;
  }

  log(`[${label}] Settling cycle ${currentCycle} with drand round ${beacon.round}...`);
  const txHash = await invokeContract(sorobanRpc, poolAddress, 'settle_cycle', [
    nativeToScVal(beacon.round, { type: 'u64' }),
    xdr.ScVal.scvBytes(Buffer.from(beacon.signature, 'hex')),
    xdr.ScVal.scvBytes(Buffer.from(beacon.signatureCompressed, 'hex')),
  ]);
  log(`[${label}] Cycle settled. Tx hash: ${txHash}`);
}

export async function runKeeperLoop(): Promise<void> {
  const sorobanRpc = getRpc();
  const keypair = getKeypair();
  const keeperPublicKey = keypair.publicKey();

  log('Sanca keeper started');
  log(`Keeper address: ${keeperPublicKey}`);
  log(`Factory: ${config.factoryAddress}`);
  log(`Network: ${config.network}`);

  while (true) {
    try {
      const factoryKeeper = scValToNative(
        await simulateContractCall(sorobanRpc, config.factoryAddress, 'get_keeper'),
      ) as string;

      if (factoryKeeper !== keeperPublicKey) {
        log(
          `Factory keeper is ${shortAddress(factoryKeeper)}, not us (${shortAddress(keeperPublicKey)}) — sleeping`,
        );
        await sleep(config.pollIntervalMs);
        continue;
      }

      const pools = await getAllPoolAddresses(sorobanRpc);
      log(`Discovered ${pools.length} pool(s) from factory`);

      for (const poolAddress of pools) {
        try {
          await processPool(sorobanRpc, poolAddress);
        } catch (err) {
          log(`[${shortAddress(poolAddress)}] ERROR: ${err}`);
        }
      }
    } catch (err) {
      log(`ERROR: ${err}`);
    }

    await sleep(config.pollIntervalMs);
  }
}
