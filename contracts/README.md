# Sanca Smart Contracts

Soroban contracts for composable community savings (ROSCA) on Stellar:

| Crate | Role |
|-------|------|
| `sanca_factory` | Deploy pools, platform config (keeper, yield split, drand key) |
| `sanca_pool` | Per-circle ROSCA: join, contribute, settle, withdraw |

## Prerequisites

- [Rust](https://rustup.rs/) (1.82+)
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) (`stellar`)
- Node.js 18+ (for `decompress_drand.mjs` in deploy scripts)
- Funded Stellar **testnet** identities

### Recommended CLI identities

```bash
stellar keys generate sanca-deployer
stellar keys generate sanca-member
stellar keys generate sanca-member2
# Fund XLM (Friendbot on testnet):
curl "https://friendbot.stellar.org?addr=$(stellar keys address sanca-deployer)"
```

Members also need **Blend USDC** on testnet for join/contribute. See [DEPLOYMENT.md](./DEPLOYMENT.md).

## Project structure

```text
contracts/
├── contracts/
│   ├── sanca_factory/   # Factory contract
│   └── sanca_pool/      # Pool contract + unit tests
├── scripts/
│   ├── deploy.sh              # Build + deploy factory
│   ├── full_lifecycle_test.sh # E2E testnet lifecycle
│   └── decompress_drand.mjs   # drand key helper
├── Cargo.toml
├── DEPLOYMENT.md              # Addresses + pool recipes
└── README.md
```

## Build

```bash
cd contracts
cargo build --target wasm32v1-none --release
```

WASM output:

- `target/wasm32v1-none/release/sanca_factory.wasm`
- `target/wasm32v1-none/release/sanca_pool.wasm`

## Run unit tests

```bash
cd contracts
cargo test -p sanca-pool
```

22 tests cover join, contribute, settle, drand/BLS, yield, liquidation, and withdraw.

## Deploy to testnet

```bash
cd contracts
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This uploads pool WASM, deploys `SancaFactory`, and prints the new factory address. Then:

1. Copy the factory address into root `.env.local` as `NEXT_PUBLIC_FACTORY_ADDRESS`
2. Set the platform keeper (one-time, factory admin):

```bash
cd ../keeper
cp env.example .env   # FACTORY_ADDRESS, KEEPER_SECRET, ADMIN_SECRET
npm install
npm run set-keeper
```

3. Start the keeper so cycles auto-settle:

```bash
npm start
```

## Quick demo pool (2 members · 5 min · 5 USDC)

See **[DEPLOYMENT.md — Demo pool](./DEPLOYMENT.md#demo-pool-2-members-5-minutes-5-usdc)** for the exact `create_pool` command and economics.

## Full lifecycle integration test

Automated script: create pool → join → contribute → settle (live drand) → withdraw.

```bash
cd contracts
# Update FACTORY in scripts/full_lifecycle_test.sh if you redeployed
./scripts/full_lifecycle_test.sh
```

Options:

```bash
PERIOD_DURATION=60 ./scripts/full_lifecycle_test.sh   # 1-minute cycles
TEST_LIQUIDATION=0 ./scripts/full_lifecycle_test.sh # skip default liquidation scenario
```

## Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) — testnet addresses, redeploy, create pool
- [../keeper/README.md](../keeper/README.md) — keeper service
- [../docs/PRD.md](../docs/PRD.md) — product spec
