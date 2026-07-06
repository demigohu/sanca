# Sanca Relayer

Fee-bump service that lets users with **0 XLM** submit pool transactions (join, contribute, withdraw, create_pool). The user signs the inner transaction with their Privy wallet and sends the XDR to the relayer. The relayer wraps it in a `FeeBumpTransaction` and pays the fee.

## How it works

```
Frontend (Privy):                         Relayer:
  1. Build + simulate inner tx
  2. Sign inner tx (user key via Privy)
  3. POST /relay { signedInnerXdr }  ──► 4. Validate method whitelist
                                         5. Validate contract via factory registry
                                         6. Simulate inner tx (reject if fail)
                                         7. Build FeeBumpTx (relayer pays fee)
                                         8. Sign + submit
                                         9. Poll until SUCCESS/FAILED
  ◄──────────────────────────────────    10. Return { hash }
```

**Whitelisted methods:** `create_pool`, `join`, `contribute`, `withdraw`

**Security guarantees (Stellar protocol):**
- Relayer cannot modify the inner transaction — it is already signed by the user.
- Relayer cannot steal user funds — it only pays the fee.
- Method whitelist + factory registry check prevents abuse for arbitrary contracts.

## Contract whitelisting

The relayer does not use a manual pool list. On each request it checks whether the target contract is:

1. **Factory address** — always allowed (`create_pool`)
2. **A pool registered in the factory** — relayer calls `factory.get_all_pools()` via simulate (read-only, free), cached for `POOL_CACHE_REFRESH_MS` (default 60s)

New pools created via the factory are whitelisted automatically without config changes.

## Setup

```bash
cp env.example .env
# fill RELAYER_SECRET and FACTORY_ADDRESS
npm install
```

## Run

```bash
# dev
npm start

# production (after build)
npm run build
npm run start:prod
```

## API

### `GET /health`

```json
{ "status": "ok", "network": "testnet" }
```

### `POST /relay`

**Request:**
```json
{ "signedInnerXdr": "AAAAAQ..." }
```

**Response (success):**
```json
{ "hash": "abc123..." }
```

**Response (error):**
```json
{ "error": "Method not whitelisted: set_keeper" }
{ "error": "Contract not registered in factory: deadbeef..." }
{ "error": "Simulation failed: ..." }
```

## Frontend usage (TypeScript)

```typescript
// 1. Build and simulate the inner transaction
const tx = new TransactionBuilder(sourceAccount, { fee: BASE_FEE, networkPassphrase })
  .addOperation(poolContract.call('join', ...args))
  .setTimeout(300)
  .build();

const sim = await sorobanRpc.simulateTransaction(tx);
const prepared = rpc.assembleTransaction(tx, sim).build();

// 2. Sign with Privy (user's embedded wallet)
const signedXdr = await privySignTransaction(prepared.toXDR());

// 3. Submit via relayer — user pays no XLM
const res = await fetch('https://relayer.sanca.app/relay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ signedInnerXdr: signedXdr }),
});
const { hash } = await res.json();
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `RELAYER_SECRET` | ✓ | — | Stellar secret seed of the relayer account (must hold XLM) |
| `FACTORY_ADDRESS` | ✓ | — | `sanca_factory` contract address |
| `NETWORK` | — | `testnet` | `testnet` or `public` |
| `RPC_URL` | — | testnet RPC | Soroban RPC endpoint |
| `MAX_FEE` | — | `100000` | Max fee-bump fee in stroops (100000 = 0.01 XLM) |
| `PORT` | — | `3001` | HTTP listen port |
| `CORS_ORIGIN` | — | `*` | Frontend origin for CORS (set to your domain in production) |
| `POOL_CACHE_REFRESH_MS` | — | `60000` | How often to refresh pool list from factory (ms) |

## Deploy on Ubuntu VPS

Same pattern as the keeper. Uses the same `sanca` system user.

```bash
# 1. Copy files
rsync -av --exclude node_modules --exclude dist --exclude .env \
  ./relayer/ user@your-vps:/opt/sanca/relayer/

# 2. Install & build
ssh user@your-vps "cd /opt/sanca/relayer && npm ci --omit=dev && npm run build"

# 3. Create .env
sudo nano /opt/sanca/relayer/.env
sudo chown sanca:sanca /opt/sanca/relayer/.env
sudo chmod 600 /opt/sanca/relayer/.env

# 4. Systemd
sudo cp /opt/sanca/relayer/sanca-relayer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sanca-relayer
sudo systemctl start sanca-relayer

# 5. Logs
sudo journalctl -u sanca-relayer -f
```

**Fund the relayer account:** Deposit ≥ 10 XLM (testnet). Each fee-bump costs ≤ 0.01 XLM at `MAX_FEE=100000`.

## Notes

- The relayer account must be funded with XLM — it pays all Soroban transaction fees.
- Set `CORS_ORIGIN` to your frontend domain in production to prevent abuse.
- Pool registry is fetched from `factory.get_all_pools()` and cached — no manual `ALLOWED_POOLS` list needed.
- Rate limiting is a post-hackathon addition; add `express-rate-limit` when needed.
