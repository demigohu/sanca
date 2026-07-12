# Sanca Smart Contracts — Testnet Deployment

## Current deployment

| Contract | Testnet address |
|----------|-----------------|
| **SancaFactory** | `CBOYFEB3KN4WOZVSIC5QPEM6KJTQRDH4IW6WUT6QK4QZPPWHPUABBGR7` |
| Blend USDC SAC | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |
| DeFindex USDC vault | `CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN` |
| Blend USDC issuer | `GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56` |

After redeploy, update:

- Root `.env.local` → `NEXT_PUBLIC_FACTORY_ADDRESS`
- `scripts/full_lifecycle_test.sh` → `FACTORY=...`
- `keeper/.env` and `relayer/.env` → `FACTORY_ADDRESS`

## Prerequisites

| Identity | Purpose |
|----------|---------|
| `sanca-deployer` | Factory admin, set keeper, optional pool creator |
| `sanca-member`, `sanca-member2` | Join demo pool (2 members) |

Each account needs:

- **XLM** for Soroban fees (≥ 5 XLM; more if not using relayer)
- **Blend USDC** for collateral + contributions

USDC on Stellar testnet uses **7 decimals** (`NEXT_PUBLIC_USDC_DECIMALS=7`):

| Human | Stroops (i128) |
|-------|----------------|
| 5 USDC | `50000000` |
| 10 USDC | `100000000` |

## Redeploy factory + pool WASM

```bash
cd contracts
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Post-deploy (one-time per factory):

```bash
cd ../keeper
npm run set-keeper    # factory admin sets KEEPER_SECRET address
npm start             # keeper must run for settle_cycle
```

## Set platform keeper

Factory admin only. Keeper address must be funded with XLM.

```bash
stellar contract invoke \
  --id CBOYFEB3KN4WOZVSIC5QPEM6KJTQRDH4IW6WUT6QK4QZPPWHPUABBGR7 \
  --source sanca-deployer \
  --network testnet \
  -- set_keeper \
  --keeper "$(stellar keys address <keeper-identity>)"
```

Or use `keeper/npm run set-keeper` with `ADMIN_SECRET` + `KEEPER_SECRET` in `keeper/.env`.

---

## Demo pool (2 members, 5 minutes, 5 USDC)

Quick pool for live demos and hackathon rehearsal.

| Parameter | Value |
|-----------|-------|
| `max_members` | `2` |
| `contribution_per_period` | `50000000` (5 USDC, 7 decimals) |
| `period_duration` | `300` (5 minutes in seconds) |
| Collateral per member | 5 × 2 = **10 USDC** (`100000000` stroops) |
| Pot per cycle | 2 × 5 = **10 USDC** |
| Total cycles | 2 (one payout per member) |

### 1. Create the pool

```bash
FACTORY="CBOYFEB3KN4WOZVSIC5QPEM6KJTQRDH4IW6WUT6QK4QZPPWHPUABBGR7"

stellar contract invoke \
  --id "$FACTORY" \
  --source sanca-deployer \
  --network testnet \
  -- create_pool \
  --creator "$(stellar keys address sanca-deployer)" \
  --max_members 2 \
  --contribution_per_period 50000000 \
  --period_duration 300 \
  --name "Demo Video" \
  --description "2 members, 5 USDC per cycle, 5-minute periods"
```

Copy the returned **pool contract address** from the CLI output.

> **Note:** `create_pool` fails with `NoKeeper` if `set_keeper` has not been called on the factory yet.

### 2. Join (2 members)

Each member approves USDC to the pool, then calls `join`. Collateral = `contribution × max_members` = 10 USDC.

```bash
POOL="<paste-pool-address>"
USDC="CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU"

for MEMBER in sanca-member sanca-member2; do
  stellar contract invoke --id "$USDC" \
    --source "$MEMBER" --network testnet --send=yes \
    -- approve \
    --from "$(stellar keys address "$MEMBER")" \
    --spender "$POOL" \
    --amount 150000000 \
    --expiration-ledger 6500000

  stellar contract invoke --id "$POOL" \
    --source "$MEMBER" --network testnet --send=yes \
    -- join
done
```

When the second member joins, the pool becomes **Active** and cycle 0 starts.

### 3. Contribute each cycle

Both members call `contribute` once per cycle before the 5-minute deadline:

```bash
stellar contract invoke --id "$POOL" \
  --source sanca-member --network testnet --send=yes \
  -- contribute
```

Repeat for `sanca-member2`.

### 4. Settle (keeper)

After `period_duration` (300s), the keeper submits `settle_cycle` with a fresh drand beacon. Ensure keeper is running (`cd keeper && npm start`).

Manual settle (if keeper uses deployer key):

```bash
# Fetch drand + decompress — see keeper/src/drand.ts or full_lifecycle_test.sh
stellar contract invoke --id "$POOL" \
  --source sanca-deployer --network testnet --send=yes \
  -- settle_cycle \
  --round <drand_round> \
  --sig_uncompressed <hex> \
  --sig_compressed <hex>
```

### 5. Complete & withdraw

After **2 cycles** (2 members), pool state = **Completed**. Each member calls `withdraw` once.

---

## Generic create pool

```bash
stellar contract invoke \
  --id <FACTORY_ADDRESS> \
  --source <creator-identity> \
  --network testnet \
  -- create_pool \
  --creator "$(stellar keys address <creator-identity>)" \
  --max_members <2-50> \
  --contribution_per_period <stroops> \
  --period_duration <seconds> \
  --name "<pool name>" \
  --description "<description>"
```

| `period_duration` examples | Seconds |
|----------------------------|---------|
| 5 minutes | `300` |
| 1 hour | `3600` |
| 1 day | `86400` |

Minimum contribution on-chain: `5000000` stroops (contract constant). For **5 USDC** with 7-decimal Blend USDC, use **`50000000`**.

## Deployer reference

```bash
stellar keys address sanca-deployer
# GBQPIIAPYZZIRVRJSBJBBYCB6HH2IE3PT4ZJG4G7K6FVRWXJ4L62LDLU
```

## Notes

- WASM target: `wasm32v1-none` (Rust 1.82+).
- Factory deploys pools via `deploy_v2` with a salted address per `create_pool`.
- `yield_split_bps` (default 9000) and `platform_fee_bps` (default 1000) are set at factory deploy — not per pool.
- Cycle timing: next cycle starts at **settle time**, not the original calendar deadline. See `docs/PRD.md` §7.7.
