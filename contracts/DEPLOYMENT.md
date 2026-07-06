# Sanca Smart Contracts — Testnet Deployment Notes

## Current Deployment

| Contract | Testnet Address |
|----------|-----------------|
| SancaFactory | `CCDV5FAS3J355IWVJG53MYR372U4JFCA5EJHLWTENGYJW4C4HX2NBZNW` |
| Example SancaPool | `CDJWYINOQSXSCE22FQSHOG23MICGMWZL6LFC2HE6O3GDSRI22CI4RZ7V` |

## External Dependencies (Testnet)

| Service | Address |
|---------|---------|
| DeFindex USDC Vault | `CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN` |
| MoneyGram USDC Issuer | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |

## Deployer Identity

```bash
stellar keys address sanca-deployer
# GBQPIIAPYZZIRVRJSBJBBYCB6HH2IE3PT4ZJG4G7K6FVRWXJ4L62LDLU
```

## Redeploy

```bash
cd /root/stellar/sanca/sanca/contracts
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## Create a Pool

```bash
stellar contract invoke \
  --id <FACTORY_ADDRESS> \
  --source sanca-deployer \
  --network testnet \
  -- create_pool \
  --creator $(stellar keys address sanca-deployer) \
  --max_members 3 \
  --contribution_per_period 5000000 \
  --period_duration 86400 \
  --name "Test Arisan" \
  --description "Test savings circle"
```

## Notes

- WASM target: `wasm32v1-none` (required for Rust 1.82+).
- SancaPool constructor no longer requires `factory.require_auth()` because the factory is the only deployer.
- Factory uses `deploy_v2` with a tuple constructor argument.
