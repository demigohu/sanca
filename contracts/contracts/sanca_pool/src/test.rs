#![cfg(test)]

use crate::{PoolState, SancaPool, SancaPoolClient};
use sanca_factory::SancaFactoryClient;
use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{Address as _, Ledger},
    token::Client as TokenClient,
    Address, Bytes, BytesN, Env, IntoVal, Map, String, Symbol, Val, Vec,
};

/// Test drand public key (RFC G1/G2 swapped test vectors from drand-verify).
const TEST_DRAND_PK_COMPRESSED: [u8; 96] = hex_literal::hex!(
    "a1ee12542360bf75742bcade13d6134e7d5283d9eb782887c47d3d9725f05805d37b0106b7f744395bf82c175dd7434a169e998f188a657a030d588892c0cd2c01f996aaf331c4d8bc5b9734bbe261d09e7d2d39ef88b635077f262bd7bbb30f"
);

/// Decompress G1 to Soroban CAP-0059 format: x (48) || y (48).
fn decompress_g1_for_soroban(compressed: &[u8; 48]) -> [u8; 96] {
    bls12_381::G1Affine::from_compressed(compressed)
        .expect("valid G1")
        .to_uncompressed()
}

/// Decompress G2 to Soroban CAP-0059 format: x_c1 || x_c0 || y_c1 || y_c0.
fn decompress_g2_for_soroban(compressed: &[u8; 96]) -> [u8; 192] {
    bls12_381::G2Affine::from_compressed(compressed)
        .expect("valid G2")
        .to_uncompressed()
}

fn test_drand_public_key(env: &Env) -> BytesN<192> {
    BytesN::from_array(env, &decompress_g2_for_soroban(&TEST_DRAND_PK_COMPRESSED))
}

/// Build a valid drand RFC test beacon tuple for integration tests.
fn make_test_drand_beacon(env: &Env, round: u64) -> (u64, Bytes, Bytes) {
    let compressed: &[u8; 48] = match round {
        3 => &hex_literal::hex!(
            "b98dae74f6a9d2ec79d75ba273dcfda86a45d589412860eb4c0fd056b00654dbf667c1b6884987c9aee0d43f8ba9db52"
        ),
        4 => &hex_literal::hex!(
            "962c2b2969e8f3351cf5cc457b04ecbf0c65bd79f4c1ee3bd0205f581368aaaa0cdeb1531a0709d39ef06a8ba1e1bb93"
        ),
        6 => &hex_literal::hex!(
            "a054dafb27a4a4fb9e06b17b30da3e0c7b13b4ca8e1dec3c6775f81758587029aa358523f2e7e62204018347db7cbd1c"
        ),
        _ => panic!("missing test drand beacon for round {round}"),
    };

    let sig_arr = decompress_g1_for_soroban(compressed);

    (
        round,
        Bytes::from_array(env, &sig_arr),
        Bytes::from_array(env, compressed),
    )
}

/// Quicknet round 123 beacon for production-key verification tests.
fn make_quicknet_beacon_round_123(env: &Env) -> (u64, Bytes, Bytes) {
    let compressed: [u8; 48] = hex_literal::hex!(
        "b75c69d0b72a5d906e854e808ba7e2accb1542ac355ae486d591aa9d43765482e26cd02df835d3546d23c4b13e0dfc92"
    );
    let sig_arr = decompress_g1_for_soroban(&compressed);
    (
        123,
        Bytes::from_array(env, &sig_arr),
        Bytes::from_array(env, &compressed),
    )
}

fn drand_round_for_cycle(cycle: u64) -> u64 {
    match cycle {
        0 => 3,
        1 => 4,
        _ => 6,
    }
}

// ---------------------------------------------------------------------------
// Mock USDC token (SEP-41 compatible for the methods used by SancaPool)
// ---------------------------------------------------------------------------

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn init(env: Env) {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "bal"), &Map::<Address, i128>::new(&env));
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "all"), &Map::<(Address, Address), i128>::new(&env));
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let mut balances: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "bal"))
            .unwrap();
        let current = balances.get(to.clone()).unwrap_or(0);
        balances.set(to, current + amount);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "bal"), &balances);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        let balances: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "bal"))
            .unwrap();
        balances.get(id).unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        let mut balances: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "bal"))
            .unwrap();
        let from_balance = balances.get(from.clone()).unwrap_or(0);
        assert!(from_balance >= amount, "insufficient balance");
        let to_balance = balances.get(to.clone()).unwrap_or(0);
        balances.set(from, from_balance - amount);
        balances.set(to, to_balance + amount);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "bal"), &balances);
    }

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, _expiration_ledger: u32) {
        from.require_auth();
        let mut allowances: Map<(Address, Address), i128> = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "all"))
            .unwrap();
        allowances.set((from, spender), amount);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "all"), &allowances);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let mut allowances: Map<(Address, Address), i128> = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "all"))
            .unwrap();
        let key = (from.clone(), spender.clone());
        let allowed = allowances.get(key.clone()).unwrap_or(0);
        assert!(allowed >= amount, "insufficient allowance");
        allowances.set(key, allowed - amount);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "all"), &allowances);

        let mut balances: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "bal"))
            .unwrap();
        let from_balance = balances.get(from.clone()).unwrap_or(0);
        assert!(from_balance >= amount, "insufficient balance");
        let to_balance = balances.get(to.clone()).unwrap_or(0);
        balances.set(from, from_balance - amount);
        balances.set(to, to_balance + amount);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "bal"), &balances);
    }
}

// ---------------------------------------------------------------------------
// Mock DeFindex vault
// ---------------------------------------------------------------------------

#[contract]
pub struct MockVault;

#[contracttype]
#[derive(Clone)]
pub enum MockVaultKey {
    PricePerShare,
    TotalShares,
    Token,
}

#[contractimpl]
impl MockVault {
    pub fn init(env: Env, token: Address) {
        env.storage().instance().set(&MockVaultKey::PricePerShare, &1i128);
        env.storage().instance().set(&MockVaultKey::TotalShares, &0i128);
        env.storage().instance().set(&MockVaultKey::Token, &token);
    }

    /// Admin helper to simulate yield accrual by increasing the share price.
    pub fn set_price(env: Env, new_price: i128) {
        env.storage().instance().set(&MockVaultKey::PricePerShare, &new_price);
    }

    pub fn deposit(
        env: Env,
        amounts_desired: Vec<i128>,
        _amounts_min: Vec<i128>,
        from: Address,
        _invest: bool,
    ) -> (Vec<i128>, i128, Option<Vec<Option<()>>>) {
        from.require_auth();
        let amount = amounts_desired.get(0).unwrap_or(0);
        let price: i128 = env.storage().instance().get(&MockVaultKey::PricePerShare).unwrap();
        let token: Address = env.storage().instance().get(&MockVaultKey::Token).unwrap();

        // Pull tokens from the depositor into the vault.
        TokenClient::new(&env, &token).transfer(&from, &env.current_contract_address(), &amount);

        let shares = amount / price;
        let mut total: i128 = env.storage().instance().get(&MockVaultKey::TotalShares).unwrap();
        total += shares;
        env.storage().instance().set(&MockVaultKey::TotalShares, &total);
        (Vec::from_array(&env, [amount]), shares, None)
    }

    pub fn withdraw(
        env: Env,
        shares: i128,
        _min_amounts_out: Vec<i128>,
        from: Address,
    ) -> Vec<i128> {
        let price: i128 = env.storage().instance().get(&MockVaultKey::PricePerShare).unwrap();
        let token: Address = env.storage().instance().get(&MockVaultKey::Token).unwrap();
        let amount = shares * price;

        let mut total: i128 = env.storage().instance().get(&MockVaultKey::TotalShares).unwrap();
        total -= shares;
        env.storage().instance().set(&MockVaultKey::TotalShares, &total);

        // Send tokens from the vault back to the caller.
        TokenClient::new(&env, &token).transfer(&env.current_contract_address(), &from, &amount);

        Vec::from_array(&env, [amount])
    }

    pub fn get_asset_amounts_per_shares(env: Env, shares: i128) -> Vec<i128> {
        let price: i128 = env.storage().instance().get(&MockVaultKey::PricePerShare).unwrap();
        Vec::from_array(&env, [shares * price])
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup_factory(
    env: &Env,
    admin: &Address,
    keeper: Option<&Address>,
    token_id: &Address,
    vault_id: &Address,
    fee_receiver: &Address,
) -> Address {
    let pool_wasm: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/sanca_pool.wasm"));
    let pool_wasm_hash = env.deployer().upload_contract_wasm(pool_wasm);

    let factory_wasm: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/sanca_factory.wasm"));
    let factory_wasm_hash = env.deployer().upload_contract_wasm(factory_wasm);
    let salt = BytesN::<32>::from_array(env, &[1u8; 32]);

    let factory_id = env
        .deployer()
        .with_address(admin.clone(), salt)
        .deploy_v2(
            factory_wasm_hash,
            (
                admin.clone(),
                token_id.clone(),
                vault_id.clone(),
                fee_receiver.clone(),
                1000u32,
                9000u32,
                pool_wasm_hash,
                test_drand_public_key(env),
            ),
        );

    let client = SancaFactoryClient::new(env, &factory_id);
    if let Some(keeper) = keeper {
        client.set_keeper(keeper);
    }
    factory_id
}

fn setup_env() -> (
    Env,
    Address,
    Address,
    Address,
    Address,
    Address,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let fee_receiver = Address::generate(&env);
    let keeper = Address::generate(&env);

    let token_id = env.register_contract(None, MockToken);
    let vault_id = env.register_contract(None, MockVault);

    // Initialize mocks.
    MockTokenClient::new(&env, &token_id).init();
    MockVaultClient::new(&env, &vault_id).init(&token_id);

    // Mint initial USDC to members.
    let token_client = MockTokenClient::new(&env, &token_id);
    let member1 = creator.clone();
    let member2 = Address::generate(&env);
    let member3 = Address::generate(&env);
    token_client.mint(&member1, &1_000_000_000);
    token_client.mint(&member2, &1_000_000_000);
    token_client.mint(&member3, &1_000_000_000);

    let factory = setup_factory(
        &env,
        &creator,
        Some(&keeper),
        &token_id,
        &vault_id,
        &fee_receiver,
    );

    (
        env,
        factory,
        creator,
        fee_receiver,
        token_id,
        vault_id,
        member1,
        member2,
        member3,
        keeper,
    )
}

fn deploy_pool<'a>(
    env: &'a Env,
    factory: &'a Address,
    creator: &'a Address,
    fee_receiver: &'a Address,
    token_id: &'a Address,
    vault_id: &'a Address,
) -> SancaPoolClient<'a> {
    let wasm: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/sanca_pool.wasm"));
    let wasm_hash = env.deployer().upload_contract_wasm(wasm);
    let salt = BytesN::<32>::from_array(env, &[0u8; 32]);

    let mut ctor_args: Vec<Val> = Vec::new(env);
    ctor_args.push_back(factory.into_val(env));
    ctor_args.push_back(creator.into_val(env));
    ctor_args.push_back(token_id.into_val(env));
    ctor_args.push_back(vault_id.into_val(env));
    ctor_args.push_back(fee_receiver.into_val(env));
    ctor_args.push_back(1000u32.into_val(env));
    ctor_args.push_back(3u32.into_val(env));
    ctor_args.push_back(50_000_000i128.into_val(env));
    ctor_args.push_back(1u64.into_val(env));
    ctor_args.push_back(9000u32.into_val(env));
    ctor_args.push_back(String::from_str(env, "Test Pool").into_val(env));
    ctor_args.push_back(String::from_str(env, "Test").into_val(env));
    ctor_args.push_back(test_drand_public_key(env).into_val(env));

    // Deploy from the creator address (works in test environment).
    let pool_id = env
        .deployer()
        .with_address(creator.clone(), salt)
        .deploy_v2(wasm_hash, ctor_args);

    let client = SancaPoolClient::new(env, &pool_id);

    client
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn test_constructor_initializes_state() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, ..) = setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    let info = client.get_pool_info();
    assert_eq!(info.0, PoolState::Open);
    assert_eq!(info.2, 3); // max_members
    assert_eq!(info.4, 50_000_000); // contribution
}

#[test]
fn test_full_lifecycle_no_yield() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();

    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    // Approve & join.
    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3), // 45 USDC max needed
            &(u32::MAX),
        );
        client.join(member);
    }

    let info = client.get_pool_info();
    assert_eq!(info.0, PoolState::Active);

    // Three cycles.
    for cycle in 0..3u64 {
        for member in [&member1, &member2, &member3] {
            client.contribute(member);
        }
        // Advance ledger timestamp so the cycle period has passed.
        let now = env.ledger().timestamp();
        env.ledger().set_timestamp(now + 10);

        // Use deterministic dummy randomness; drand verification is a placeholder.
        // Each cycle needs a unique (increasing) round number.
        let (round, sig_u, sig_c) = make_test_drand_beacon(&env, drand_round_for_cycle(cycle));
        client.settle_cycle(&round, &sig_u, &sig_c);
    }

    // Withdraw.
    for member in [&member1, &member2, &member3] {
        client.withdraw(member);
    }

    let info = client.get_pool_info();
    assert_eq!(info.0, PoolState::Completed);
}

#[test]
fn test_settle_cycle_with_yield_distribution() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();

    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    // Contribute for cycle 0.
    for member in [&member1, &member2, &member3] {
        client.contribute(member);
    }

    // At this point 45 USDC collateral (450M shares at price=1) sits in the vault.
    // Simulate yield accrual: vault share price rises to 5 and the vault actually
    // holds the extra 1.8B USDC generated by the strategy.
    // Vault value = 450M * 5 = 2.25B, available yield = 2.25B - 450M = 1.8B.
    MockVaultClient::new(&env, &vault_id).set_price(&5i128);
    MockTokenClient::new(&env, &token_id).mint(&vault_id, &1_800_000_000);

    // Advance ledger timestamp so the cycle period has passed.
    let now = env.ledger().timestamp();
    env.ledger().set_timestamp(now + 10);

    let (round, sig_u, sig_c) = make_test_drand_beacon(&env, 3);
    client.settle_cycle(&round, &sig_u, &sig_c);

    let winner = client.get_cycle_winner(&0u32);
    let token = TokenClient::new(&env, &token_id);

    // Winner spent 150M collateral + 50M contribution = 200M.
    // Winner received prize 150M + net yield bonus.
    //   yield_bonus  = 1.8B * 90% = 1.62B
    //   platform_fee = 1.62B * 10% = 162M
    //   net_yield    = 1.458B
    //   total payout = 150M + 1.458B = 1.608B
    // winner balance = 1B - 200M + 1.608B = 2.408B
    assert_eq!(token.balance(&winner), 2_408_000_000);
}


#[test]
fn test_double_join_rejected() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, ..) = setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    TokenClient::new(&env, &token_id).approve(
        &member1,
        &client.address,
        &(50_000_000i128 * 3 * 3),
        &(u32::MAX),
    );
    client.join(&member1);

    // Second join for the same member must fail.
    assert!(client.try_join(&member1).is_err());
}

#[test]
fn test_pool_full_rejected() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let member4 = Address::generate(&env);
    MockTokenClient::new(&env, &token_id).mint(&member4, &1_000_000_000);

    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    for member in [&member1, &member2, &member3, &member4] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
    }

    client.join(&member1);
    client.join(&member2);
    client.join(&member3);

    // Pool max_members = 3, so a 4th join must fail.
    assert!(client.try_join(&member4).is_err());
}

#[test]
fn test_contribute_non_member_rejected() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let non_member = Address::generate(&env);

    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    assert!(client.try_contribute(&non_member).is_err());
}

#[test]
fn test_withdraw_before_completion_rejected() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    // Pool is Active, not Completed. Withdraw must fail.
    assert!(client.try_withdraw(&member1).is_err());
}

#[test]
fn test_settle_cycle_too_early_rejected() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    for member in [&member1, &member2, &member3] {
        client.contribute(member);
    }

    // Do not advance timestamp; settle immediately. Must fail with CycleNotEnded.
    let (round, sig_u, sig_c) = make_test_drand_beacon(&env, 3);
    assert!(client.try_settle_cycle(&round, &sig_u, &sig_c).is_err());
}

#[test]
fn test_old_drand_round_rejected() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    for member in [&member1, &member2, &member3] {
        client.contribute(member);
    }

    env.ledger().set_timestamp(env.ledger().timestamp() + 10);
    let (round, sig_u, sig_c) = make_test_drand_beacon(&env, 6);
    client.settle_cycle(&round, &sig_u, &sig_c);

    // Re-using the same drand round must fail with DrandRoundTooOld.
    for member in [&member1, &member2, &member3] {
        client.contribute(member);
    }
    env.ledger().set_timestamp(env.ledger().timestamp() + 10);
    assert!(client.try_settle_cycle(&round, &sig_u, &sig_c).is_err());
}

#[test]
fn test_double_contribute_rejected() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    client.contribute(&member1);
    assert!(client.try_contribute(&member1).is_err());
}

#[test]
fn test_platform_fee_receives_yield_fee() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    for member in [&member1, &member2, &member3] {
        client.contribute(member);
    }

    // Generate yield and fund the vault accordingly.
    MockVaultClient::new(&env, &vault_id).set_price(&5i128);
    MockTokenClient::new(&env, &token_id).mint(&vault_id, &1_800_000_000);

    env.ledger().set_timestamp(env.ledger().timestamp() + 10);
    let (round, sig_u, sig_c) = make_test_drand_beacon(&env, 3);
    client.settle_cycle(&round, &sig_u, &sig_c);

    // Platform fee = 10% of 1.62B yield bonus = 162M.
    let fee_receiver_balance = TokenClient::new(&env, &token_id).balance(&fee_receiver);
    assert_eq!(fee_receiver_balance, 162_000_000);
}

#[test]
fn test_withdraw_after_completion_returns_collateral() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);
    let token = TokenClient::new(&env, &token_id);

    for member in [&member1, &member2, &member3] {
        token.approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    for cycle in 0..3u64 {
        for member in [&member1, &member2, &member3] {
            client.contribute(member);
        }
        env.ledger().set_timestamp(env.ledger().timestamp() + 10);
        let (round, sig_u, sig_c) = make_test_drand_beacon(&env, drand_round_for_cycle(cycle));
        client.settle_cycle(&round, &sig_u, &sig_c);
    }

    for member in [&member1, &member2, &member3] {
        client.withdraw(member);
        // Each member should end with their original 1B balance: net of
        // contributions, prizes, and returned collateral is zero.
        assert_eq!(token.balance(member), 1_000_000_000);
    }
}

#[test]
fn test_settle_after_completion_rejected() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    for cycle in 0..3u64 {
        for member in [&member1, &member2, &member3] {
            client.contribute(member);
        }
        env.ledger().set_timestamp(env.ledger().timestamp() + 10);
        let (round, sig_u, sig_c) = make_test_drand_beacon(&env, drand_round_for_cycle(cycle));
        client.settle_cycle(&round, &sig_u, &sig_c);
    }

    env.ledger().set_timestamp(env.ledger().timestamp() + 10);
    let (_round, sig_u, sig_c) = make_test_drand_beacon(&env, 6);
    assert!(client.try_settle_cycle(&3u64, &sig_u, &sig_c).is_err());
}

#[test]
fn test_winner_order_unique_per_cycle() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    let mut winners: Vec<Address> = Vec::new(&env);
    for cycle in 0..3u64 {
        for member in [&member1, &member2, &member3] {
            client.contribute(member);
        }
        env.ledger().set_timestamp(env.ledger().timestamp() + 10);
        let (round, sig_u, sig_c) = make_test_drand_beacon(&env, drand_round_for_cycle(cycle));
        client.settle_cycle(&round, &sig_u, &sig_c);

        let winner = client.get_cycle_winner(&(cycle as u32));
        assert!(!winners.contains(&winner));
        winners.push_back(winner);
    }
}

#[test]
fn test_non_member_withdraw_rejected() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);
    let non_member = Address::generate(&env);

    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    for cycle in 0..3u64 {
        for member in [&member1, &member2, &member3] {
            client.contribute(member);
        }
        env.ledger().set_timestamp(env.ledger().timestamp() + 10);
        let (round, sig_u, sig_c) = make_test_drand_beacon(&env, drand_round_for_cycle(cycle));
        client.settle_cycle(&round, &sig_u, &sig_c);
    }

    assert!(client.try_withdraw(&non_member).is_err());
}

#[test]
fn test_double_withdraw_rejected() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);

    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    for cycle in 0..3u64 {
        for member in [&member1, &member2, &member3] {
            client.contribute(member);
        }
        env.ledger().set_timestamp(env.ledger().timestamp() + 10);
        let (round, sig_u, sig_c) = make_test_drand_beacon(&env, drand_round_for_cycle(cycle));
        client.settle_cycle(&round, &sig_u, &sig_c);
    }

    client.withdraw(&member1);
    assert!(client.try_withdraw(&member1).is_err());
}

#[test]
fn test_invalid_drand_randomness_rejected() {
    let (env, factory, creator, fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &fee_receiver, &token_id, &vault_id);
    for member in [&member1, &member2, &member3] {
        TokenClient::new(&env, &token_id).approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }
    for member in [&member1, &member2, &member3] {
        client.contribute(member);
    }
    env.ledger().set_timestamp(env.ledger().timestamp() + 10);
    let (round, sig_u, sig_c) = make_test_drand_beacon(&env, 3);
    let mut bad_compressed_bytes = [0u8; 48];
    sig_c.copy_into_slice(&mut bad_compressed_bytes);
    bad_compressed_bytes[0] ^= 0xff;
    let bad_compressed = Bytes::from_array(&env, &bad_compressed_bytes);
    assert!(client
        .try_settle_cycle(&round, &sig_u, &bad_compressed)
        .is_err());
}

#[test]
fn test_set_keeper_on_factory() {
    let (env, factory, creator, ..) = setup_env();
    let factory_client = SancaFactoryClient::new(&env, &factory);
    let new_keeper = Address::generate(&env);
    factory_client.set_keeper(&new_keeper);
    assert_eq!(factory_client.get_keeper(), new_keeper);

    // Non-admin cannot change the factory keeper.
    env.set_auths(&[]);
    let other_keeper = Address::generate(&env);
    assert!(factory_client.try_set_keeper(&other_keeper).is_err());
    env.mock_all_auths();
    assert_eq!(factory_client.get_keeper(), new_keeper);
}

#[test]
fn test_create_pool_requires_factory_keeper() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = env.register(MockToken, ());
    let vault_id = env.register(MockVault, ());
    MockTokenClient::new(&env, &token_id).init();
    MockVaultClient::new(&env, &vault_id).init(&token_id);

    let factory = setup_factory(&env, &admin, None, &token_id, &vault_id, &admin);
    let factory_client = SancaFactoryClient::new(&env, &factory);

    let creator = Address::generate(&env);
    assert!(factory_client
        .try_create_pool(
            &creator,
            &3u32,
            &50_000_000i128,
            &1u64,
            &String::from_str(&env, "No Keeper Pool"),
            &String::from_str(&env, "Should fail"),
        )
        .is_err());
}

#[test]
fn test_liquidation_for_missed_contribution() {
    let (env, factory, creator, _fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &_fee_receiver, &token_id, &vault_id);
    let token = TokenClient::new(&env, &token_id);

    for member in [&member1, &member2, &member3] {
        token.approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    // member1 and member2 contribute; member3 misses the contribution.
    client.contribute(&member1);
    client.contribute(&member2);

    assert_eq!(token.balance(&client.address), 100_000_000);

    env.ledger().set_timestamp(env.ledger().timestamp() + 10);
    let (round, sig_u, sig_c) = make_test_drand_beacon(&env, 3);
    client.settle_cycle(&round, &sig_u, &sig_c);

    // Defaulter collateral should have been liquidated by the missing amount.
    assert_eq!(client.get_member_collateral(&member3), 100_000_000);

    // Pool advanced to cycle 1.
    let info = client.get_pool_info();
    assert_eq!(info.1, 1); // current_cycle

    // Winner received the full prize (150M) so their net balance after the
    // cycle should reflect prize minus their collateral and contribution.
    let winner = client.get_cycle_winner(&0u32);
    let collateral_and_contribution = 150_000_000i128 + 50_000_000i128;
    let expected_balance = 1_000_000_000 - collateral_and_contribution + 150_000_000;
    assert_eq!(token.balance(&winner), expected_balance);
}

/// Quicknet drand G2 public key (uncompressed Soroban CAP-0059, 192 bytes).
const QUICKNET_PUBLIC_KEY: [u8; 192] = hex_literal::hex!(
    "03cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a01a714f2edb74119a2f2b0d5a7c75ba902d163700a61bc224ededd8e63aef7be1aaf8e93d7a9718b047ccddb3eb5d68b0e5db2b6bfbb01c867749cadffca88b36c24f3012ba09fc4d3022c5c37dce0f977d3adb5d183c7477c442b1f04515273"
);

#[test]
fn test_verify_quicknet_bls_round_123() {
    let env = Env::default();
    let pk = BytesN::from_array(&env, &QUICKNET_PUBLIC_KEY);
    let (round, sig_u, sig_c) = make_quicknet_beacon_round_123(&env);
    let randomness = crate::drand::verify_quicknet_beacon(&env, &pk, round, &sig_u, &sig_c)
        .expect("quicknet BLS verification must succeed");
    assert_eq!(randomness.len(), 32);
}

#[test]
fn test_liquidation_reduces_member_vault_shares() {
    let (env, factory, creator, _fee_receiver, token_id, vault_id, member1, member2, member3, ..) =
        setup_env();
    let client = deploy_pool(&env, &factory, &creator, &_fee_receiver, &token_id, &vault_id);
    let token = MockTokenClient::new(&env, &token_id);

    for member in [&member1, &member2, &member3] {
        token.approve(
            member,
            &client.address,
            &(50_000_000i128 * 3 * 3),
            &(u32::MAX),
        );
        client.join(member);
    }

    let shares_before = client.get_member_vault_shares(&member3);
    assert!(shares_before > 0);

    client.contribute(&member1);
    client.contribute(&member2);

    env.ledger().set_timestamp(env.ledger().timestamp() + 10);
    let (round, sig_u, sig_c) = make_test_drand_beacon(&env, 3);
    client.settle_cycle(&round, &sig_u, &sig_c);

    let shares_after = client.get_member_vault_shares(&member3);
    assert!(shares_after < shares_before);
}
