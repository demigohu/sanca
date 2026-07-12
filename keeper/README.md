# Sanca Keeper

Off-chain keeper service for SancaPool. It reads all pools from the **Sanca factory** (`get_all_pools`), verifies it is the **factory keeper**, and submits `settle_cycle` on each active pool when a cycle ends.

## How it works

```
every POLL_INTERVAL_MS:
  1. factory.get_keeper()           → must match KEEPER_SECRET address
  2. factory.get_all_pools()        → list all pool contract IDs
  3. for each active pool:
     a. get_pool_info()             → check state, current_cycle
     b. if now < cycle_end_time     → skip
     c. fetch drand beacon          → api.drand.sh/{chainHash}/public/latest
     d. settle_cycle(round, sig...) → submit tx
```

Keeper is configured **once on the factory** (admin). All pools — existing and new — use that keeper at settle time.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `FACTORY_ADDRESS` | ✓ | — | Contract ID of the Sanca factory |
| `KEEPER_SECRET` | ✓ | — | Stellar secret seed (`S…`) for the keeper account |
| `ADMIN_SECRET` | only for `set-keeper` | — | Factory admin secret; one-time setup |
| `NETWORK` | — | `testnet` | `testnet` or `public` |
| `RPC_URL` | — | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `DRAND_CHAIN_HASH` | — | quicknet hash | drand chain hash |
| `POLL_INTERVAL_MS` | — | `15000` | Poll interval in milliseconds |

---

## Local development

```bash
cp env.example .env
# fill in FACTORY_ADDRESS and KEEPER_SECRET in .env
npm install
```

### Set factory keeper (one-time)

Factory admin calls `set_keeper` pointing to the keeper address derived from `KEEPER_SECRET`:

```bash
# .env must have ADMIN_SECRET set (factory admin) in addition to KEEPER_SECRET
npm run set-keeper
```

After this, every pool created via the factory can be settled by this keeper.

### Run locally

```bash
npm start
```

---

## Deploy on Ubuntu VPS

**Full guide (PM2 + nginx + env):** [`docs/VPS_DEPLOY.md`](../docs/VPS_DEPLOY.md)

Quick start from repo root:

```bash
cd keeper && npm ci && npm run build
cd ../relayer && npm ci && npm run build
cd .. && pm2 start ecosystem.config.cjs && pm2 save
```

See `sanca-keeper.service` for systemd alternative.

---

## Notes

- The keeper pays Soroban fees — fund its account with ≥ 5 XLM (testnet).
- `ADMIN_SECRET` is **only** needed for `npm run set-keeper`. Remove it from `.env` on the server after setup.
- New pools appear automatically on the next poll — no restart needed.
- Rotating keeper: admin calls `factory.set_keeper(new_address)` — all pools pick up the new keeper on the next settle.
