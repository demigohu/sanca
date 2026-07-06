#!/usr/bin/env bash
set -euo pipefail

NETWORK="testnet"
IDENTITY="sanca-deployer"

USDC="CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU"
DEFINDEX_VAULT="CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN"
PLATFORM_FEE_BPS=1000
YIELD_SPLIT_BPS=9000
QUICKNET_DRAND_PK_COMPRESSED="83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRAND_PUBLIC_KEY=$(node "$SCRIPT_DIR/decompress_drand.mjs" g2 "$QUICKNET_DRAND_PK_COMPRESSED")

echo "🔨 Building contracts..."
cd "$SCRIPT_DIR/.."
cargo build --target wasm32v1-none --release

echo "📤 Uploading sanca_pool.wasm (may take ~15s, no output until done)..."
POOL_WASM_HASH=$(stellar contract install \
  --wasm target/wasm32v1-none/release/sanca_pool.wasm \
  --source "$IDENTITY" \
  --network "$NETWORK")
echo "Pool WASM hash: $POOL_WASM_HASH"

echo "🚀 Deploying sanca_factory (upload + deploy, ~15–30s)..."
FACTORY_ADDRESS=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/sanca_factory.wasm \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- \
  --admin "$(stellar keys address "$IDENTITY")" \
  --usdc "$USDC" \
  --defindex_vault "$DEFINDEX_VAULT" \
  --platform_fee_receiver "$(stellar keys address "$IDENTITY")" \
  --platform_fee_bps "$PLATFORM_FEE_BPS" \
  --yield_split_bps "$YIELD_SPLIT_BPS" \
  --pool_wasm_hash "$POOL_WASM_HASH" \
  --drand_public_key "$DRAND_PUBLIC_KEY")

echo "✅ SancaFactory deployed at: $FACTORY_ADDRESS"
echo ""
echo "Set the platform keeper (one-time, admin signs):"
echo "  stellar contract invoke --id $FACTORY_ADDRESS \\"
echo "    --source $IDENTITY --network $NETWORK \\"
echo "    -- set_keeper --keeper \$(stellar keys address <keeper-identity>)"
echo ""
echo "Next: update FACTORY in scripts/full_lifecycle_test.sh, then run:"
echo "  ./scripts/full_lifecycle_test.sh"
