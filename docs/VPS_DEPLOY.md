# Deploy Keeper & Relayer to VPS (PM2)

Run **keeper** (settle cycles) and **relayer** (fee-bump for users) on an always-on Ubuntu VPS using **PM2**.

| Service | Public? | Port | Purpose |
|---------|---------|------|---------|
| **keeper** | No | — | Polls factory, submits `settle_cycle` with drand |
| **relayer** | Yes (HTTPS) | 3002 | `POST /relay`, `POST /sponsor`, `GET /health` |

Recommended layout on VPS: `/opt/sanca` (repo clone), user `sanca` or your deploy user.

---

## 1. VPS prerequisites

```bash
# Ubuntu 22.04+ example
sudo apt update && sudo apt install -y git curl build-essential

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2

node -v   # v20.x
pm2 -v
```

Open firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
# Do NOT expose relayer port 3002 publicly if you use nginx reverse proxy
sudo ufw enable
```

---

## 2. Clone repo & install

```bash
sudo useradd -m -s /bin/bash sanca 2>/dev/null || true
sudo mkdir -p /opt/sanca
sudo chown sanca:sanca /opt/sanca

sudo -u sanca -i
cd /opt/sanca
git clone https://github.com/YOUR_ORG/sanca.git .
# or: rsync from local machine (see §7)

cd keeper && npm ci && npm run build
cd ../relayer && npm ci && npm run build
cd ..
```

---

## 3. Environment files

Create **two** `.env` files. Never commit secrets.

### `keeper/.env`

```bash
nano /opt/sanca/keeper/.env
chmod 600 /opt/sanca/keeper/.env
```

```env
FACTORY_ADDRESS=CBOYFEB3KN4WOZVSIC5QPEM6KJTQRDH4IW6WUT6QK4QZPPWHPUABBGR7
KEEPER_SECRET=S...your_keeper_secret...

NETWORK=testnet
RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
DRAND_CHAIN_HASH=52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971
POLL_INTERVAL_MS=15000
```

`ADMIN_SECRET` is only needed once for `npm run set-keeper` — remove from server after setup.

### `relayer/.env`

```bash
nano /opt/sanca/relayer/.env
chmod 600 /opt/sanca/relayer/.env
```

```env
RELAYER_SECRET=S...your_relayer_secret...
FACTORY_ADDRESS=CBOYFEB3KN4WOZVSIC5QPEM6KJTQRDH4IW6WUT6QK4QZPPWHPUABBGR7

NETWORK=testnet
RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org

PORT=3002
MAX_FEE=100000
CORS_ORIGIN=https://www.sanca.space

SPONSOR_ENABLED=true
SPONSOR_STARTING_BALANCE=2
BLEND_USDC_ISSUER=GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56
MAX_USDC_PAYMENT=3000
POOL_CACHE_REFRESH_MS=60000
```

**Production:** set `CORS_ORIGIN` to your real frontend origin (not `*`).

---

## 4. Fund on-chain accounts

| Account | Min balance | Why |
|---------|-------------|-----|
| Keeper (`KEEPER_SECRET`) | ≥ 5 XLM (testnet) | Pays `settle_cycle` Soroban fees |
| Relayer (`RELAYER_SECRET`) | ≥ 10 XLM (testnet) | Pays fee-bump for all user txs |

Testnet faucet:

```bash
# Derive public key from secret (if you have stellar CLI)
stellar keys address keeper
curl "https://friendbot.stellar.org?addr=G...KEEPER_ADDRESS..."
curl "https://friendbot.stellar.org?addr=G...RELAYER_ADDRESS..."
```

---

## 5. One-time: register keeper on factory

Run **once** from your laptop or VPS (needs `ADMIN_SECRET` = factory admin):

```bash
cd /opt/sanca/keeper
# temporarily add ADMIN_SECRET=S... to .env
npm run set-keeper
# remove ADMIN_SECRET from .env after success
```

Verify keeper address matches `KEEPER_SECRET` public key.

---

## 6. Start with PM2

From repo root `/opt/sanca`:

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs sanca-keeper --lines 50
pm2 logs sanca-relayer --lines 50
```

Persist across reboot:

```bash
pm2 save
pm2 startup
# run the command PM2 prints (sudo env PATH=...)
```

### Useful PM2 commands

```bash
pm2 restart sanca-keeper
pm2 restart sanca-relayer
pm2 restart all
pm2 stop sanca-relayer
pm2 delete sanca-keeper
pm2 monit
```

### After code updates

```bash
cd /opt/sanca
git pull
cd keeper && npm ci && npm run build
cd ../relayer && npm ci && npm run build
cd ..
pm2 restart all
```

---

## 7. Deploy from local machine (rsync)

Skip `git pull` on VPS; push files from dev machine:

```bash
# From your laptop (repo root)
rsync -avz --exclude node_modules --exclude dist --exclude .env \
  ./keeper/ user@YOUR_VPS_IP:/opt/sanca/keeper/

rsync -avz --exclude node_modules --exclude dist --exclude .env \
  ./relayer/ user@YOUR_VPS_IP:/opt/sanca/relayer/

rsync -avz ecosystem.config.cjs user@YOUR_VPS_IP:/opt/sanca/

ssh user@YOUR_VPS_IP 'cd /opt/sanca/keeper && npm ci && npm run build && cd ../relayer && npm ci && npm run build && pm2 restart all'
```

---

## 8. Expose relayer with HTTPS (nginx)

Keeper does **not** need a public URL. Relayer must be reachable by the frontend.

### DNS

Point `relayer.sanca.space` (or subdomain you choose) → VPS IP.

### nginx + Let's Encrypt

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/sites-available/sanca-relayer <<'EOF'
server {
    listen 80;
    server_name relayer.sanca.space;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/sanca-relayer /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d relayer.sanca.space
```

### Verify

```bash
curl https://relayer.sanca.space/health
# {"status":"ok","network":"testnet"}
```

---

## 9. Point frontend to VPS relayer

In Vercel / `.env.production` for Next.js:

```env
NEXT_PUBLIC_RELAYER_URL=https://relayer.sanca.space
```

Redeploy frontend after changing this.

---

## 10. Health checks & logs

| Check | Command |
|-------|---------|
| Relayer up | `curl -s https://relayer.sanca.space/health` |
| Keeper polling | `pm2 logs sanca-keeper --lines 20` → `Discovered N pool(s)` |
| Relayer errors | `pm2 logs sanca-relayer --err` |
| PM2 status | `pm2 status` |

Expected keeper logs:

```
Discovered 4 pool(s) from factory
[CDE6ST…7T5C] cycle=1 lastRound=... Cycle period has not ended yet
```

After cycle end:

```
Settling cycle 1 with drand round ...
```

---

## 11. Alternative: systemd (no PM2)

If you prefer systemd over PM2, use the bundled unit files:

```bash
sudo cp /opt/sanca/keeper/sanca-keeper.service /etc/systemd/system/
sudo cp /opt/sanca/relayer/sanca-relayer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sanca-keeper sanca-relayer
sudo systemctl start sanca-keeper sanca-relayer
sudo journalctl -u sanca-keeper -f
```

PM2 is simpler when you want one command for both processes + `pm2 monit`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Missing required env var` | Check `.env` in `keeper/` or `relayer/`; PM2 `cwd` must match |
| Keeper: `not the factory keeper` | Run `npm run set-keeper` with admin key |
| Relayer: CORS error in browser | Set `CORS_ORIGIN=https://www.sanca.space` (exact origin) |
| Relayer: `insufficient balance` | Fund relayer account with more XLM |
| Keeper: settle fails | Fund keeper; ensure keeper process running |
| `Bad union switch` in keeper logs | Update to latest keeper code (Horizon poll fallback) |
| Port 3002 in use | Change `PORT` in relayer `.env` + nginx `proxy_pass` |

---

## Security checklist

- [ ] `.env` files mode `600`, owned by deploy user
- [ ] `ADMIN_SECRET` removed from VPS after `set-keeper`
- [ ] `CORS_ORIGIN` locked to production frontend (not `*`)
- [ ] Relayer behind HTTPS (nginx + TLS)
- [ ] SSH key-only login on VPS
- [ ] Separate Stellar keys for keeper vs relayer
