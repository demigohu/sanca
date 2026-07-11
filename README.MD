# Sanca

Community savings circles (ROSCA / arisan) on Stellar — web2 UX, on-chain enforcement, DeFindex yield, and drand-verifiable winner selection.

**Pitch:** Privy embedded wallets + fee-bump relayer (no XLM for users) + DeFindex vault yield + Coridor IDR ramps + drand randomness on Soroban.

## What it does

- Users create or join **savings circles** with fixed contributions per cycle
- Collateral is deposited into a **DeFindex USDC vault** and earns yield
- Each cycle, members contribute; the **keeper** settles with a **drand** beacon; a winner receives the pot + yield bonus
- After all cycles, members **withdraw** remaining collateral + compounded yield
- **Relayer** wraps user-signed transactions so members never need XLM for fees

## Repo layout

| Path | Description |
|------|-------------|
| `app/`, `components/`, `hooks/`, `lib/` | Next.js frontend (Privy + Soroban RPC reads) |
| `contracts/` | Rust Soroban contracts (`sanca_factory`, `sanca_pool`) |
| `keeper/` | Off-chain service: `settle_cycle` on active pools |
| `relayer/` | Fee-bump service for join / contribute / withdraw / create_pool |
| `docs/PRD.md` | Product requirements |

## Tech stack

- **Frontend:** Next.js, TypeScript, Privy, stellar-sdk
- **Contracts:** Rust, soroban-sdk, drand BLS verification (CAP-0059)
- **Yield:** DeFindex USDC vault (testnet SAC)
- **Services:** Node.js keeper + relayer
- **Fiat (IDR ramp):** Coridor SEP-10 / SEP-24 (VA, QRIS, OVO)

## Testnet (current)

| Item | Value |
|------|-------|
| Factory | `CBOYFEB3KN4WOZVSIC5QPEM6KJTQRDH4IW6WUT6QK4QZPPWHPUABBGR7` |
| USDC SAC | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |
| DeFindex vault | `CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN` |
| USDC decimals | **7** (Blend USDC on Stellar via Coridor) |

See `contracts/DEPLOYMENT.md` and `contracts/scripts/deploy.sh` to redeploy.

## Quick start

### 1. Frontend

```bash
cp .env.local.example .env.local
# set NEXT_PUBLIC_PRIVY_APP_ID, NEXT_PUBLIC_FACTORY_ADDRESS, etc.
npm install
npm run dev
```

### 2. Relayer (local)

```bash
cd relayer
cp env.example .env
# RELAYER_SECRET, FACTORY_ADDRESS
npm install
npm start
```

### 3. Keeper (local)

```bash
cd keeper
cp env.example .env
# FACTORY_ADDRESS, KEEPER_SECRET
npm install
npm run set-keeper   # one-time: factory admin sets keeper address
npm start
```

### 4. Contracts — deploy & lifecycle test

```bash
cd contracts
./scripts/deploy.sh
# update FACTORY in scripts/full_lifecycle_test.sh if needed
./scripts/full_lifecycle_test.sh
```

Requires Stellar CLI identities (`sanca-deployer`, `sanca-member*`) funded with XLM + testnet USDC.

## Documentation

- [PRD](docs/PRD.md)
- [Contracts deployment](contracts/DEPLOYMENT.md)
- [Keeper](keeper/README.md)
- [Relayer](relayer/README.md)

## License

MIT — see [LICENSE](LICENSE).
