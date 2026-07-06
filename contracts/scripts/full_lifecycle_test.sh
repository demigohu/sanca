#!/usr/bin/env bash
set -euo pipefail

# Full lifecycle test for SancaPool on Stellar testnet.
# Assumes sanca-deployer and sanca-member{,2,3} identities exist and are funded.

NETWORK="testnet"
DEPLOYER="sanca-deployer"
# Latest from ./scripts/deploy.sh (keeper + yield_split refactor)
FACTORY="CBOYFEB3KN4WOZVSIC5QPEM6KJTQRDH4IW6WUT6QK4QZPPWHPUABBGR7"
USDC="CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU"
DRAND_CHAIN="52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971"

# Stellar USDC SAC (testnet + mainnet MoneyGram) uses 7 decimals — match frontend NEXT_PUBLIC_USDC_DECIMALS
USDC_DECIMALS=7
USDC_SCALE=$((10 ** USDC_DECIMALS))

# Test parameters (amounts in human USDC, converted to stroops below)
MAX_MEMBERS=3
CONTRIBUTION_USDC=5
APPROVE_USDC=35          # covers collateral (15) + contributions (15) + buffer
CONTRIBUTION=$((CONTRIBUTION_USDC * USDC_SCALE))
# Default to 1 second for fast CI runs. Set PERIOD_DURATION=60 for a more realistic
# 1-minute cycle (the script will wait between settlements).
PERIOD_DURATION="${PERIOD_DURATION:-1}"
APPROVE_AMOUNT=$((APPROVE_USDC * USDC_SCALE))
EXPIRATION_LEDGER=6500000

MEMBERS=("sanca-member" "sanca-member2" "sanca-member3")

# Liquidation test: one member skips contribution in one cycle, then settles.
# Disable with TEST_LIQUIDATION=0
TEST_LIQUIDATION="${TEST_LIQUIDATION:-1}"
LIQUIDATION_MEMBER="${LIQUIDATION_MEMBER:-sanca-member3}"
LIQUIDATION_CYCLE="${LIQUIDATION_CYCLE:-0}"
# Collateral = CONTRIBUTION * MAX_MEMBERS; one missed contribution liquidates CONTRIBUTION USDC.
EXPECTED_COLLATERAL_AFTER_LIQ=$((CONTRIBUTION * MAX_MEMBERS - CONTRIBUTION))

pool_read_i128() {
  local fn=$1
  shift
  stellar contract invoke --id "$POOL_ADDR" \
    --source "$DEPLOYER" \
    --network "$NETWORK" \
    -- "$fn" "$@" 2>&1 | tail -1 | tr -d '"'
}

member_usdc_balance() {
  local addr=$1
  stellar contract invoke --id "$USDC" \
    --source "$DEPLOYER" \
    --network "$NETWORK" \
    -- balance --id "$addr" 2>&1 | tail -1 | tr -d '"'
}

format_usdc() {
  python3 -c "print(f'{int(\"$1\") / (10 ** ${USDC_DECIMALS}):.2f}')"
}

echo "💰 USDC: ${USDC_DECIMALS} decimals (contribution=${CONTRIBUTION_USDC} USDC → ${CONTRIBUTION} stroops)"

# Print per-member vault shares + collateral (demo / debug helper).
print_member_vault_shares() {
  local label=$1
  local vault_total
  vault_total=$(pool_read_i128 get_vault_shares)
  echo ""
  echo "📊 Member vault shares — ${label}"
  echo "  pool total VaultShares: $(format_usdc "$vault_total") USDC (${vault_total} stroops)"
  printf "  %-16s %16s %16s %16s\n" "member" "vault_shares" "collateral" "wallet_usdc"
  for MEMBER in "${MEMBERS[@]}"; do
    ADDR=$(stellar keys address "$MEMBER")
    SHARES=$(pool_read_i128 get_member_vault_shares --member "$ADDR")
    COLLATERAL=$(pool_read_i128 get_member_collateral --member "$ADDR")
    USDC_BAL=$(member_usdc_balance "$ADDR")
    printf "  %-16s %16s %16s %16s\n" \
      "$MEMBER" \
      "$(format_usdc "$SHARES")" \
      "$(format_usdc "$COLLATERAL")" \
      "$(format_usdc "$USDC_BAL")"
  done
  echo ""
}

echo "🔨 Building sanca_pool..."
cd "$(dirname "$0")/.."
cargo build --target wasm32v1-none --release

echo "📤 Installing sanca_pool WASM (may take ~15s)..."
POOL_WASM_HASH=$(stellar contract install \
  --wasm target/wasm32v1-none/release/sanca_pool.wasm \
  --source "$DEPLOYER" \
  --network "$NETWORK")
echo "Pool WASM hash: $POOL_WASM_HASH"

echo "⚙️  Updating factory pool WASM hash..."
stellar contract invoke --id "$FACTORY" \
  --source "$DEPLOYER" \
  --network "$NETWORK" \
  -- set_pool_wasm_hash --new_wasm_hash "$POOL_WASM_HASH" >/dev/null 2>&1

QUICKNET_DRAND_PK_COMPRESSED="83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a"
QUICKNET_DRAND_PK=$(node "$(dirname "$0")/decompress_drand.mjs" g2 "$QUICKNET_DRAND_PK_COMPRESSED")
echo "⚙️  Setting factory drand public key (quicknet)..."
stellar contract invoke --id "$FACTORY" \
  --source "$DEPLOYER" \
  --network "$NETWORK" \
  -- set_drand_public_key --new_key "$QUICKNET_DRAND_PK" >/dev/null 2>&1 || true

echo "🚀 Creating pool..."
CREATOR=$(stellar keys address "${MEMBERS[0]}")
DEPLOYER_ADDR=$(stellar keys address "$DEPLOYER")
echo "🔑 Setting factory keeper (deployer)..."
stellar contract invoke --id "$FACTORY" \
  --source "$DEPLOYER" \
  --network "$NETWORK" \
  -- set_keeper \
  --keeper "$DEPLOYER_ADDR" >/dev/null 2>&1
echo "   Factory keeper: $DEPLOYER_ADDR"

POOL_ADDR=$(stellar contract invoke --id "$FACTORY" \
  --source "${MEMBERS[0]}" \
  --network "$NETWORK" \
  -- create_pool \
  --creator "$CREATOR" \
  --max_members "$MAX_MEMBERS" \
  --contribution_per_period "$CONTRIBUTION" \
  --period_duration "$PERIOD_DURATION" \
  --name "Full Lifecycle Test" \
  --description "Automated full lifecycle run")
POOL_ADDR=$(echo "$POOL_ADDR" | tail -1 | tr -d '"')
echo "Pool: $POOL_ADDR"

echo "🔐 Approving & joining members..."
for MEMBER in "${MEMBERS[@]}"; do
  ADDR=$(stellar keys address "$MEMBER")
  echo "  → $MEMBER ($ADDR)"
  BALANCE=$(curl -fsS "https://horizon-testnet.stellar.org/accounts/${ADDR}" \
    | jq -r '.balances[] | select(.asset_type=="native") | .balance')
  XLM_STROOPS=$(python3 -c "print(int(float('${BALANCE}') * 1e7))")
  if [ "${XLM_STROOPS}" -lt 500000000 ]; then
    echo "❌ $MEMBER only has ${BALANCE} XLM — need ≥50 XLM for Soroban fees."
    echo "   Fund: curl -s \"https://friendbot.stellar.org?addr=${ADDR}\""
    exit 1
  fi
  if ! stellar contract invoke --id "$USDC" \
    --source "$MEMBER" \
    --network "$NETWORK" \
    --send=yes \
    -- approve \
    --from "$ADDR" \
    --spender "$POOL_ADDR" \
    --amount "$APPROVE_AMOUNT" \
    --expiration_ledger "$EXPIRATION_LEDGER"; then
    echo "❌ USDC approve failed for $MEMBER (often TxInsufficientBalance — fund more XLM)"
    exit 1
  fi
  if ! stellar contract invoke --id "$POOL_ADDR" \
    --source "$MEMBER" \
    --network "$NETWORK" \
    --send=yes \
    -- join \
    --member "$ADDR"; then
    echo "❌ join failed for $MEMBER"
    exit 1
  fi
done

print_member_vault_shares "after join (all members equal)"

if [ "$TEST_LIQUIDATION" = "1" ]; then
  echo "🧪 Liquidation test: $LIQUIDATION_MEMBER will skip contribute on cycle $LIQUIDATION_CYCLE"
fi

echo "🔄 Running $MAX_MEMBERS cycles..."
for ((CYCLE=0; CYCLE<MAX_MEMBERS; CYCLE++)); do
  echo "  Cycle $CYCLE: contributions"
  for MEMBER in "${MEMBERS[@]}"; do
    if [ "$TEST_LIQUIDATION" = "1" ] \
      && [ "$CYCLE" -eq "$LIQUIDATION_CYCLE" ] \
      && [ "$MEMBER" = "$LIQUIDATION_MEMBER" ]; then
      echo "    → $MEMBER SKIPPED (liquidation test)"
      continue
    fi
    ADDR=$(stellar keys address "$MEMBER")
    if ! stellar contract invoke --id "$POOL_ADDR" \
      --source "$MEMBER" \
      --network "$NETWORK" \
      --send=yes \
      -- contribute \
      --member "$ADDR"; then
      echo "❌ contribute failed for $MEMBER on cycle $CYCLE"
      exit 1
    fi
  done

  echo "  Cycle $CYCLE: waiting for period to end (${PERIOD_DURATION}s)..."
  sleep "$((PERIOD_DURATION + 2))"

  echo "  Cycle $CYCLE: fetching drand..."
  DRAND_JSON=$(curl -fsS "https://drand.cloudflare.com/$DRAND_CHAIN/public/latest")
  ROUND=$(echo "$DRAND_JSON" | jq -r '.round')
  SIG_COMPRESSED=$(echo "$DRAND_JSON" | jq -r '.signature')
  SIG_UNCOMP=$(node "$(dirname "$0")/decompress_drand.mjs" g1 "$SIG_COMPRESSED")

  echo "  Cycle $CYCLE: settling with drand round $ROUND (BLS on-chain)"
  if ! stellar contract invoke --id "$POOL_ADDR" \
    --source "$DEPLOYER" \
    --network "$NETWORK" \
    --send=yes \
    -- settle_cycle \
    --drand_round "$ROUND" \
    --drand_signature "$SIG_UNCOMP" \
    --drand_signature_compressed "$SIG_COMPRESSED"; then
    echo "❌ settle_cycle failed for cycle $CYCLE"
    exit 1
  fi

  if [ "$TEST_LIQUIDATION" = "1" ] && [ "$CYCLE" -eq "$LIQUIDATION_CYCLE" ]; then
    DEF_ADDR=$(stellar keys address "$LIQUIDATION_MEMBER")
    COLLATERAL=$(pool_read_i128 get_member_collateral --member "$DEF_ADDR")
    SHARES=$(pool_read_i128 get_member_vault_shares --member "$DEF_ADDR")
    echo "  Cycle $CYCLE: post-liquidation check for $LIQUIDATION_MEMBER"
    echo "    collateral=$(format_usdc "$COLLATERAL") USDC (expected $(format_usdc "$EXPECTED_COLLATERAL_AFTER_LIQ"))"
    echo "    vault_shares=$(format_usdc "$SHARES") USDC (expected < $(format_usdc "$((CONTRIBUTION * MAX_MEMBERS))"))"
    if [ "$COLLATERAL" != "$EXPECTED_COLLATERAL_AFTER_LIQ" ]; then
      echo "❌ liquidation collateral mismatch for $LIQUIDATION_MEMBER"
      exit 1
    fi
    if [ "$SHARES" -ge "$((CONTRIBUTION * MAX_MEMBERS))" ]; then
      echo "❌ vault shares were not reduced after liquidation"
      exit 1
    fi
    echo "  ✅ Liquidation verified (collateral + per-member vault shares reduced)"
    print_member_vault_shares "after liquidation (cycle ${CYCLE})"
  fi

  # Small pause to ensure the next drand round is different before the next cycle.
  sleep 5
done

print_member_vault_shares "before withdraw (after all cycles)"

echo "💸 Withdrawing for all members..."
declare -A WITHDRAWN_USDC
for MEMBER in "${MEMBERS[@]}"; do
  ADDR=$(stellar keys address "$MEMBER")
  BAL_BEFORE=$(member_usdc_balance "$ADDR")
  if ! stellar contract invoke --id "$POOL_ADDR" \
    --source "$MEMBER" \
    --network "$NETWORK" \
    --send=yes \
    -- withdraw \
    --member "$ADDR"; then
    echo "❌ withdraw failed for $MEMBER"
    exit 1
  fi
  BAL_AFTER=$(member_usdc_balance "$ADDR")
  WITHDRAWN=$((BAL_AFTER - BAL_BEFORE))
  WITHDRAWN_USDC[$MEMBER]=$WITHDRAWN
  echo "  → $MEMBER withdrew (+$(format_usdc "$WITHDRAWN") USDC)"
done

if [ "$TEST_LIQUIDATION" = "1" ]; then
  GOOD_MEMBER="sanca-member"
  DEF_WITHDRAWN=${WITHDRAWN_USDC[$LIQUIDATION_MEMBER]}
  GOOD_WITHDRAWN=${WITHDRAWN_USDC[$GOOD_MEMBER]}
  echo "🧪 Liquidation withdraw check: $GOOD_MEMBER=+$(format_usdc "$GOOD_WITHDRAWN") USDC, $LIQUIDATION_MEMBER=+$(format_usdc "$DEF_WITHDRAWN") USDC"
  if [ "$DEF_WITHDRAWN" -ge "$GOOD_WITHDRAWN" ]; then
    echo "❌ defaulter should withdraw less USDC than a member who paid every cycle"
    exit 1
  fi
  echo "  ✅ Defaulter received less on withdraw (per-member vault shares working)"
fi

print_member_vault_shares "after withdraw (shares should be 0)"

echo ""
echo "✅ Full lifecycle test completed successfully!"
echo "   Pool: $POOL_ADDR"
