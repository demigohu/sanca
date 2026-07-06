#![no_std]
mod drand;

use soroban_sdk::{
    auth::{InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractimpl, contracttype, symbol_short,
    Address, Bytes, BytesN, Env, IntoVal, Map, String, Symbol, Vec, Val,
};

/// How to deduct vault shares when redeeming USDC from DeFindex.
enum ShareDeduction {
    /// Deduct all redeemed shares from one member (liquidation).
    Member(Address),
    /// Deduct redeemed shares proportionally across all members (yield payout).
    Proportional,
}

/// Errors for the pool contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidParameter = 4,
    PoolNotOpen = 5,
    PoolNotActive = 6,
    PoolCompleted = 7,
    AlreadyMember = 8,
    NotMember = 9,
    PoolFull = 10,
    InsufficientContribution = 11,
    AlreadyContributed = 12,
    CycleNotEnded = 13,
    CycleAlreadySettled = 14,
    InvalidDrandSignature = 15,
    DrandRoundTooOld = 16,
    NoYieldToDistribute = 17,
    WithdrawNotAllowed = 18,
    ArithmeticError = 19,
    NotKeeper = 20,
}

/// Pool state.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PoolState {
    Open = 0,
    Active = 1,
    Completed = 2,
}

/// Storage keys.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Factory,
    Creator,
    Usdc,
    DefindexVault,
    PlatformFeeReceiver,
    PlatformFeeBps,
    MaxMembers,
    ContributionPerPeriod,
    PeriodDuration,
    YieldSplitBps,
    Name,
    Description,
    State,
    Members,
    MemberCollateral,
    WinnerOrder,
    CurrentCycle,
    CycleStartTime,
    Contributions,
    TotalContributed,
    VaultShares,
    MemberVaultShares,
    DrandPublicKey,
    LastDrandRound,
    YieldDistributed,
}

/// Event topics.
const JOINED: Symbol = symbol_short!("joined");
const POOL_STARTED: Symbol = symbol_short!("started");
const CONTRIBUTED: Symbol = symbol_short!("contrib");
const WINNER_SELECTED: Symbol = symbol_short!("winner");
const YIELD_DISTRIBUTED: Symbol = symbol_short!("yield");
const CYCLE_ENDED: Symbol = symbol_short!("cycle_end");
const POOL_COMPLETED: Symbol = symbol_short!("completed");
const WITHDRAWN: Symbol = symbol_short!("withdrawn");
const COLLATERAL_LIQUIDATED: Symbol = symbol_short!("liquid");

#[contract]
pub struct SancaPool;

#[contractimpl]
impl SancaPool {
    /// Constructor called once at deploy time by the factory.
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        env: Env,
        factory: Address,
        creator: Address,
        usdc: Address,
        defindex_vault: Address,
        platform_fee_receiver: Address,
        platform_fee_bps: u32,
        max_members: u32,
        contribution_per_period: i128,
        period_duration: u64,
        yield_split_bps: u32,
        name: String,
        description: String,
        drand_public_key: BytesN<192>,
    ) {
        // Note: only the factory can deploy this contract, so no explicit auth needed here.
        env.storage().instance().set(&DataKey::Factory, &factory);
        env.storage().instance().set(&DataKey::Creator, &creator);
        env.storage().instance().set(&DataKey::Usdc, &usdc);
        env.storage()
            .instance()
            .set(&DataKey::DefindexVault, &defindex_vault);
        env.storage()
            .instance()
            .set(&DataKey::PlatformFeeReceiver, &platform_fee_receiver);
        env.storage()
            .instance()
            .set(&DataKey::PlatformFeeBps, &platform_fee_bps);
        env.storage().instance().set(&DataKey::MaxMembers, &max_members);
        env.storage()
            .instance()
            .set(&DataKey::ContributionPerPeriod, &contribution_per_period);
        env.storage().instance().set(&DataKey::PeriodDuration, &period_duration);
        env.storage()
            .instance()
            .set(&DataKey::YieldSplitBps, &yield_split_bps);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Description, &description);

        env.storage().instance().set(&DataKey::State, &PoolState::Open);
        env.storage().instance().set(&DataKey::Members, &Vec::<Address>::new(&env));
        env.storage().instance().set(&DataKey::WinnerOrder, &Vec::<Address>::new(&env));
        env.storage().instance().set(&DataKey::CurrentCycle, &0u32);
        env.storage().instance().set(&DataKey::CycleStartTime, &0u64);
        env.storage().instance().set(&DataKey::TotalContributed, &0i128);
        env.storage().instance().set(&DataKey::VaultShares, &0i128);
        env.storage().instance().set(&DataKey::LastDrandRound, &0u64);
        env.storage().instance().set(&DataKey::YieldDistributed, &0i128);

        // Allowance map for contributions per cycle.
        env.storage()
            .instance()
            .set(&DataKey::Contributions, &Map::<(u32, Address), i128>::new(&env));

        env.storage().instance().set(&DataKey::MemberCollateral, &Map::<Address, i128>::new(&env));
        env.storage()
            .instance()
            .set(&DataKey::MemberVaultShares, &Map::<Address, i128>::new(&env));
        env.storage()
            .instance()
            .set(&DataKey::DrandPublicKey, &drand_public_key);

        env.storage().instance().extend_ttl(100, 518400);
    }

    /// Join the pool by locking full collateral.
    pub fn join(env: Env, member: Address) -> Result<(), Error> {
        member.require_auth();

        let state: PoolState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .unwrap_or(PoolState::Open);
        if state != PoolState::Open {
            return Err(Error::PoolNotOpen);
        }

        let mut members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .unwrap_or(Vec::new(&env));

        if members.contains(&member) {
            return Err(Error::AlreadyMember);
        }

        let max_members: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MaxMembers)
            .unwrap_or(0);
        if members.len() >= max_members {
            return Err(Error::PoolFull);
        }

        let contribution: i128 = env
            .storage()
            .instance()
            .get(&DataKey::ContributionPerPeriod)
            .unwrap_or(0);
        let collateral = contribution
            .checked_mul(max_members as i128)
            .ok_or(Error::ArithmeticError)?;

        // Transfer USDC from member to pool.
        let usdc: Address = env
            .storage()
            .instance()
            .get(&DataKey::Usdc)
            .ok_or(Error::NotInitialized)?;
        let pool = env.current_contract_address();
        soroban_sdk::token::Client::new(&env, &usdc).transfer(&member, &pool, &collateral);

        // Deposit collateral into DeFindex vault.
        let shares = Self::deposit_to_vault(&env, collateral)?;

        // Track member and collateral.
        members.push_back(member.clone());
        env.storage().instance().set(&DataKey::Members, &members);

        let mut collaterals: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MemberCollateral)
            .unwrap_or(Map::new(&env));
        collaterals.set(member.clone(), collateral);
        env.storage().instance().set(&DataKey::MemberCollateral, &collaterals);

        let mut member_vault_shares: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MemberVaultShares)
            .unwrap_or(Map::new(&env));
        member_vault_shares.set(member.clone(), shares);
        env.storage()
            .instance()
            .set(&DataKey::MemberVaultShares, &member_vault_shares);

        let total_shares: i128 = env
            .storage()
            .instance()
            .get(&DataKey::VaultShares)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::VaultShares, &(total_shares + shares));

        // If pool is now full, activate it.
        if members.len() == max_members {
            env.storage().instance().set(&DataKey::State, &PoolState::Active);
            let start_time = env.ledger().timestamp();
            env.storage()
                .instance()
                .set(&DataKey::CycleStartTime, &start_time);
            env.events().publish((POOL_STARTED,), (start_time, max_members));
        }

        env.events().publish((JOINED, member), (collateral, shares));
        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    /// Contribute for the current cycle.
    pub fn contribute(env: Env, member: Address) -> Result<(), Error> {
        member.require_auth();

        let state: PoolState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .unwrap_or(PoolState::Open);
        if state != PoolState::Active {
            return Err(Error::PoolNotActive);
        }

        let members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .unwrap_or(Vec::new(&env));
        if !members.contains(&member) {
            return Err(Error::NotMember);
        }

        let current_cycle: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CurrentCycle)
            .unwrap_or(0);

        let mut contributions: Map<(u32, Address), i128> = env
            .storage()
            .instance()
            .get(&DataKey::Contributions)
            .unwrap_or(Map::new(&env));
        if contributions.get((current_cycle, member.clone())).unwrap_or(0) > 0 {
            return Err(Error::AlreadyContributed);
        }

        let contribution: i128 = env
            .storage()
            .instance()
            .get(&DataKey::ContributionPerPeriod)
            .unwrap_or(0);

        // Transfer USDC from member to pool.
        let usdc: Address = env
            .storage()
            .instance()
            .get(&DataKey::Usdc)
            .ok_or(Error::NotInitialized)?;
        let pool = env.current_contract_address();
        soroban_sdk::token::Client::new(&env, &usdc).transfer(&member, &pool, &contribution);

        contributions.set((current_cycle, member.clone()), contribution);
        env.storage().instance().set(&DataKey::Contributions, &contributions);

        let total_contributed: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalContributed)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalContributed, &(total_contributed + contribution));

        env.events().publish((CONTRIBUTED, current_cycle, member), contribution);
        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    /// Settle the current cycle. Must be called by the keeper with a fresh drand beacon.
    ///
    /// `drand_signature` is the uncompressed G1 point (96 bytes).
    /// `drand_signature_compressed` is the drand API signature (48 bytes) used to derive randomness.
    pub fn settle_cycle(
        env: Env,
        drand_round: u64,
        drand_signature: Bytes,
        drand_signature_compressed: Bytes,
    ) -> Result<(), Error> {
        let factory: Address = env
            .storage()
            .instance()
            .get(&DataKey::Factory)
            .ok_or(Error::NotInitialized)?;
        let keeper = match env.try_invoke_contract::<Address, soroban_sdk::Error>(
            &factory,
            &Symbol::new(&env, "get_keeper"),
            Vec::<Val>::new(&env),
        ) {
            Ok(Ok(keeper)) => keeper,
            _ => return Err(Error::NotKeeper),
        };
        keeper.require_auth();

        let state: PoolState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .unwrap_or(PoolState::Open);
        if state != PoolState::Active {
            return Err(Error::PoolNotActive);
        }

        let cycle_start: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CycleStartTime)
            .unwrap_or(0);
        let period_duration: u64 = env
            .storage()
            .instance()
            .get(&DataKey::PeriodDuration)
            .unwrap_or(0);
        let now = env.ledger().timestamp();
        if now < cycle_start + period_duration {
            return Err(Error::CycleNotEnded);
        }

        // Drand round must be strictly increasing.
        let last_round: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LastDrandRound)
            .unwrap_or(0);
        if drand_round <= last_round {
            return Err(Error::DrandRoundTooOld);
        }

        let drand_public_key: BytesN<192> = env
            .storage()
            .instance()
            .get(&DataKey::DrandPublicKey)
            .ok_or(Error::NotInitialized)?;
        let drand_randomness = drand::verify_quicknet_beacon(
            &env,
            &drand_public_key,
            drand_round,
            &drand_signature,
            &drand_signature_compressed,
        )?;

        let members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .unwrap_or(Vec::new(&env));
        let max_members: u32 = members.len();
        let current_cycle: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CurrentCycle)
            .unwrap_or(0);

        // On first settle, shuffle winner order using drand randomness.
        let mut winner_order: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::WinnerOrder)
            .unwrap_or(Vec::new(&env));
        if winner_order.is_empty() {
            winner_order = Self::shuffle_members(&env, &members, &drand_randomness)?;
            env.storage().instance().set(&DataKey::WinnerOrder, &winner_order);
        }

        // Ensure all members contributed; liquidate collateral if not.
        let contribution: i128 = env
            .storage()
            .instance()
            .get(&DataKey::ContributionPerPeriod)
            .unwrap_or(0);
        let mut collaterals: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MemberCollateral)
            .unwrap_or(Map::new(&env));
        let mut contributions: Map<(u32, Address), i128> = env
            .storage()
            .instance()
            .get(&DataKey::Contributions)
            .unwrap_or(Map::new(&env));

        for member in members.iter() {
            let contributed = contributions.get((current_cycle, member.clone())).unwrap_or(0);
            if contributed < contribution {
                let missing = contribution - contributed;
                let collateral = collaterals.get(member.clone()).unwrap_or(0);
                let liquidate_amount = if missing > collateral { collateral } else { missing };
                if liquidate_amount > 0 {
                    // Redeem the liquidated collateral from the vault so the pool
                    // has enough USDC to pay the full prize this cycle.
                    Self::redeem_from_vault(
                        &env,
                        liquidate_amount,
                        ShareDeduction::Member(member.clone()),
                    )?;

                    let new_collateral = collateral - liquidate_amount;
                    collaterals.set(member.clone(), new_collateral);
                    contributions.set((current_cycle, member.clone()), contribution);
                    env.events().publish(
                        (COLLATERAL_LIQUIDATED, current_cycle, member.clone()),
                        liquidate_amount,
                    );
                }
            }
        }
        env.storage().instance().set(&DataKey::MemberCollateral, &collaterals);
        env.storage().instance().set(&DataKey::Contributions, &contributions);

        // Prize = contributions for this cycle (including liquidated collateral).
        let prize = contribution.checked_mul(max_members as i128).ok_or(Error::ArithmeticError)?;

        // Calculate yield bonus from vault growth.
        let yield_bonus = Self::calculate_yield_bonus(&env)?;

        // Select winner.
        let winner = winner_order
            .get(current_cycle as u32)
            .ok_or(Error::InvalidParameter)?;

        let usdc: Address = env
            .storage()
            .instance()
            .get(&DataKey::Usdc)
            .ok_or(Error::NotInitialized)?;
        let pool = env.current_contract_address();

        // Platform fee taken from yield bonus.
        let platform_fee_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PlatformFeeBps)
            .unwrap_or(0);
        let platform_fee = yield_bonus
            .checked_mul(platform_fee_bps as i128)
            .and_then(|v| v.checked_div(10_000))
            .ok_or(Error::ArithmeticError)?;

        // Redeem the yield bonus from the vault so the pool has cash to pay the winner
        // and the platform fee. Only the gross yield bonus is redeemed; the remaining
        // yield stays in the vault as compounded value for all members.
        if yield_bonus > 0 {
            Self::redeem_from_vault(&env, yield_bonus, ShareDeduction::Proportional)?;
        }

        // Transfer prize + net yield bonus to winner.
        let net_yield = yield_bonus - platform_fee;
        soroban_sdk::token::Client::new(&env, &usdc).transfer(&pool, &winner, &(prize + net_yield));

        if platform_fee > 0 {
            let receiver: Address = env
                .storage()
                .instance()
                .get(&DataKey::PlatformFeeReceiver)
                .ok_or(Error::NotInitialized)?;
            soroban_sdk::token::Client::new(&env, &usdc).transfer(&pool, &receiver, &platform_fee);
        }

        // Track distributed yield.
        let yield_distributed: i128 = env
            .storage()
            .instance()
            .get(&DataKey::YieldDistributed)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::YieldDistributed, &(yield_distributed + yield_bonus));

        env.events().publish(
            (WINNER_SELECTED, current_cycle, winner.clone()),
            (prize, yield_bonus),
        );
        env.events().publish(
            (YIELD_DISTRIBUTED, current_cycle),
            (yield_bonus, platform_fee),
        );

        // Advance cycle.
        let next_cycle = current_cycle + 1;
        env.storage().instance().set(&DataKey::CurrentCycle, &next_cycle);
        env.storage()
            .instance()
            .set(&DataKey::CycleStartTime, &now);
        env.storage().instance().set(&DataKey::LastDrandRound, &drand_round);

        env.events().publish((CYCLE_ENDED, current_cycle), (next_cycle, now));

        // Check completion.
        if next_cycle >= max_members {
            env.storage()
                .instance()
                .set(&DataKey::State, &PoolState::Completed);
            env.events().publish((POOL_COMPLETED,), ());
        }

        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    /// Withdraw remaining collateral after pool is completed.
    pub fn withdraw(env: Env, member: Address) -> Result<(), Error> {
        member.require_auth();

        let state: PoolState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .unwrap_or(PoolState::Open);
        if state != PoolState::Completed {
            return Err(Error::WithdrawNotAllowed);
        }

        let collaterals: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MemberCollateral)
            .unwrap_or(Map::new(&env));
        let remaining_collateral = collaterals.get(member.clone()).unwrap_or(0);
        if remaining_collateral <= 0 {
            return Err(Error::InvalidParameter);
        }

        // Withdraw this member's remaining vault shares.
        let member_vault_shares: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MemberVaultShares)
            .unwrap_or(Map::new(&env));
        let member_shares = member_vault_shares.get(member.clone()).unwrap_or(0);
        if member_shares <= 0 {
            return Err(Error::InvalidParameter);
        }

        let withdrawn_amount = Self::withdraw_from_vault(&env, member_shares)?;

        let total_shares: i128 = env
            .storage()
            .instance()
            .get(&DataKey::VaultShares)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::VaultShares, &(total_shares - member_shares));

        let mut member_vault_shares = member_vault_shares;
        member_vault_shares.set(member.clone(), 0);
        env.storage()
            .instance()
            .set(&DataKey::MemberVaultShares, &member_vault_shares);

        // Mark collateral as withdrawn.
        let mut collaterals = collaterals;
        collaterals.set(member.clone(), 0);
        env.storage().instance().set(&DataKey::MemberCollateral, &collaterals);

        // Transfer USDC to member.
        let usdc: Address = env
            .storage()
            .instance()
            .get(&DataKey::Usdc)
            .ok_or(Error::NotInitialized)?;
        let pool = env.current_contract_address();
        soroban_sdk::token::Client::new(&env, &usdc).transfer(&pool, &member, &withdrawn_amount);

        env.events().publish((WITHDRAWN, member), withdrawn_amount);
        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    // Internal: deposit USDC into DeFindex vault and return shares received.
    fn deposit_to_vault(env: &Env, amount: i128) -> Result<i128, Error> {
        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::DefindexVault)
            .ok_or(Error::NotInitialized)?;
        let pool = env.current_contract_address();

        // Approve USDC to vault so it can pull.
        let usdc: Address = env
            .storage()
            .instance()
            .get(&DataKey::Usdc)
            .ok_or(Error::NotInitialized)?;
        // Approve exact amount with a far-future expiration ledger.
        soroban_sdk::token::Client::new(env, &usdc).approve(
            &pool,
            &vault,
            &amount,
            &6_500_000,
        );

        // For single-asset USDC vault, deposit with amounts_desired = [amount].
        let amounts_desired = Vec::from_array(env, [amount]);
        let amounts_min = Vec::from_array(env, [0i128]);

        let deposit_args = Vec::from_array(
            env,
            [
                amounts_desired.into_val(env),
                amounts_min.into_val(env),
                pool.into_val(env),
                true.into_val(env), // invest = true
            ],
        );

        // Authorize the USDC transfer the vault will perform on our behalf.
        // The vault pulls USDC from the pool by calling token.transfer(pool, vault, amount).
        env.authorize_as_current_contract(Vec::from_array(
            env,
            [InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: soroban_sdk::auth::ContractContext {
                    contract: usdc.clone(),
                    fn_name: Symbol::new(env, "transfer"),
                    args: Vec::from_array(
                        env,
                        [
                            pool.into_val(env),
                            vault.clone().into_val(env),
                            amount.into_val(env),
                        ],
                    ),
                },
                sub_invocations: Vec::new(env),
            })],
        ));

        // Invoke deposit. Returns (deposited_amounts, shares_minted, investment_allocations).
        let result = env.invoke_contract::<(Vec<i128>, i128, Option<Vec<Option<()>>>)>(
            &vault,
            &Symbol::new(env, "deposit"),
            deposit_args,
        );

        Ok(result.1)
    }

    // Internal: withdraw vault shares and return USDC received.
    fn withdraw_from_vault(env: &Env, shares: i128) -> Result<i128, Error> {
        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::DefindexVault)
            .ok_or(Error::NotInitialized)?;
        let pool = env.current_contract_address();

        let min_amounts_out = Vec::from_array(env, [0i128]);
        let withdraw_args = Vec::from_array(
            env,
            [
                shares.into_val(env),
                min_amounts_out.into_val(env),
                pool.into_val(env),
            ],
        );

        // Authorize the vault withdrawal. The vault transfers USDC to us, which does not
        // require our authorization.
        env.authorize_as_current_contract(Vec::from_array(
            env,
            [InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: soroban_sdk::auth::ContractContext {
                    contract: vault.clone(),
                    fn_name: Symbol::new(env, "withdraw"),
                    args: withdraw_args.clone(),
                },
                sub_invocations: Vec::new(env),
            })],
        ));

        let result = env.invoke_contract::<Vec<i128>>(
            &vault,
            &Symbol::new(env, "withdraw"),
            withdraw_args,
        );

        // For single-asset vault, return first asset amount.
        result.get(0).ok_or(Error::InvalidParameter)
    }

    // Internal: calculate the yield bonus for the current cycle.
    //
    // Available yield = current_vault_value - total_principal - yield_already_distributed.
    // Yield bonus       = available_yield * yield_split_bps / 10_000.
    // The remainder is left in the vault as compounded yield for all members.
    fn calculate_yield_bonus(env: &Env) -> Result<i128, Error> {
        let total_shares: i128 = env
            .storage()
            .instance()
            .get(&DataKey::VaultShares)
            .unwrap_or(0);
        if total_shares == 0 {
            return Ok(0);
        }

        // Estimate current vault value for all shares.
        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::DefindexVault)
            .ok_or(Error::NotInitialized)?;
        let current_values = env.invoke_contract::<Vec<i128>>(
            &vault,
            &Symbol::new(env, "get_asset_amounts_per_shares"),
            Vec::from_array(env, [total_shares.into_val(env)]),
        );
        let current_value = current_values.get(0).unwrap_or(0);

        // Total principal deposited into the vault = collateral locked by all members
        // = max_members * (contribution_per_period * max_members).
        let max_members: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MaxMembers)
            .unwrap_or(0);
        let contribution: i128 = env
            .storage()
            .instance()
            .get(&DataKey::ContributionPerPeriod)
            .unwrap_or(0);
        let collateral_per_member = contribution
            .checked_mul(max_members as i128)
            .ok_or(Error::ArithmeticError)?;
        let total_principal = collateral_per_member
            .checked_mul(max_members as i128)
            .ok_or(Error::ArithmeticError)?;

        // Total yield = current_value - total_principal - yield_already_distributed.
        let yield_distributed: i128 = env
            .storage()
            .instance()
            .get(&DataKey::YieldDistributed)
            .unwrap_or(0);
        let available_yield = current_value - total_principal - yield_distributed;
        if available_yield <= 0 {
            return Ok(0);
        }

        let yield_split_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::YieldSplitBps)
            .unwrap_or(0);
        let yield_bonus = available_yield
            .checked_mul(yield_split_bps as i128)
            .and_then(|v| v.checked_div(10_000))
            .ok_or(Error::ArithmeticError)?;

        Ok(yield_bonus)
    }

    // Internal: redeem a USDC amount from the vault by burning the corresponding
    // vault shares. Updates VaultShares and MemberVaultShares storage.
    fn redeem_from_vault(
        env: &Env,
        amount: i128,
        deduction: ShareDeduction,
    ) -> Result<i128, Error> {
        if amount <= 0 {
            return Ok(0);
        }

        let total_shares: i128 = env
            .storage()
            .instance()
            .get(&DataKey::VaultShares)
            .unwrap_or(0);
        if total_shares <= 0 {
            return Ok(0);
        }

        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::DefindexVault)
            .ok_or(Error::NotInitialized)?;

        // Current vault value for all shares.
        let current_values = env.invoke_contract::<Vec<i128>>(
            &vault,
            &Symbol::new(env, "get_asset_amounts_per_shares"),
            Vec::from_array(env, [total_shares.into_val(env)]),
        );
        let current_value = current_values.get(0).unwrap_or(0);
        if current_value <= 0 {
            return Ok(0);
        }

        // Shares to redeem = amount * total_shares / current_value.
        let shares_to_redeem = amount
            .checked_mul(total_shares)
            .and_then(|v| v.checked_div(current_value))
            .unwrap_or(0);
        if shares_to_redeem <= 0 {
            return Ok(0);
        }

        let withdrawn = Self::withdraw_from_vault(env, shares_to_redeem)?;

        let new_total_shares = total_shares
            .checked_sub(shares_to_redeem)
            .ok_or(Error::ArithmeticError)?;
        env.storage()
            .instance()
            .set(&DataKey::VaultShares, &new_total_shares);

        match deduction {
            ShareDeduction::Member(member) => {
                let mut member_vault_shares: Map<Address, i128> = env
                    .storage()
                    .instance()
                    .get(&DataKey::MemberVaultShares)
                    .unwrap_or(Map::new(env));
                let current = member_vault_shares.get(member.clone()).unwrap_or(0);
                let updated = current
                    .checked_sub(shares_to_redeem)
                    .ok_or(Error::ArithmeticError)?;
                member_vault_shares.set(member, updated);
                env.storage()
                    .instance()
                    .set(&DataKey::MemberVaultShares, &member_vault_shares);
            }
            ShareDeduction::Proportional => {
                Self::deduct_shares_proportional(env, shares_to_redeem, total_shares)?;
            }
        }

        Ok(withdrawn)
    }

    /// Deduct redeemed shares proportionally from each member's tracked balance.
    fn deduct_shares_proportional(
        env: &Env,
        shares_to_redeem: i128,
        total_shares: i128,
    ) -> Result<(), Error> {
        if shares_to_redeem <= 0 || total_shares <= 0 {
            return Ok(());
        }

        let members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .unwrap_or(Vec::new(env));
        let mut member_vault_shares: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MemberVaultShares)
            .unwrap_or(Map::new(env));

        let member_count = members.len() as usize;
        let mut allocated = 0i128;

        for (idx, member) in members.iter().enumerate() {
            let member_shares = member_vault_shares.get(member.clone()).unwrap_or(0);
            let deduct = if idx + 1 == member_count {
                shares_to_redeem
                    .checked_sub(allocated)
                    .ok_or(Error::ArithmeticError)?
            } else {
                shares_to_redeem
                    .checked_mul(member_shares)
                    .and_then(|v| v.checked_div(total_shares))
                    .unwrap_or(0)
            };
            allocated = allocated
                .checked_add(deduct)
                .ok_or(Error::ArithmeticError)?;
            let updated = member_shares
                .checked_sub(deduct)
                .ok_or(Error::ArithmeticError)?;
            member_vault_shares.set(member.clone(), updated);
        }

        env.storage()
            .instance()
            .set(&DataKey::MemberVaultShares, &member_vault_shares);
        Ok(())
    }

    // Internal: Fisher-Yates shuffle using drand randomness via Soroban PRNG.
    fn shuffle_members(
        env: &Env,
        members: &Vec<Address>,
        randomness: &Bytes,
    ) -> Result<Vec<Address>, Error> {
        let len = members.len();
        let mut result = Vec::new(env);
        for member in members.iter() {
            result.push_back(member);
        }

        // Seed the on-chain PRNG with verified drand randomness.
        env.prng().seed(randomness.clone());

        for i in (1..len).rev() {
            let j: u32 = (env.prng().gen::<u64>() % (i + 1) as u64) as u32;
            let temp_i = result.get(i).ok_or(Error::InvalidParameter)?;
            let temp_j = result.get(j).ok_or(Error::InvalidParameter)?;
            result.set(i, temp_j);
            result.set(j, temp_i);
        }

        Ok(result)
    }

    // Read functions
    pub fn get_pool_info(env: Env) -> Result<(PoolState, u32, u32, u64, i128, i128), Error> {
        let state: PoolState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .unwrap_or(PoolState::Open);
        let current_cycle: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CurrentCycle)
            .unwrap_or(0);
        let max_members: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MaxMembers)
            .unwrap_or(0);
        let cycle_start: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CycleStartTime)
            .unwrap_or(0);
        let contribution: i128 = env
            .storage()
            .instance()
            .get(&DataKey::ContributionPerPeriod)
            .unwrap_or(0);
        let total_contributed: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalContributed)
            .unwrap_or(0);
        Ok((state, current_cycle, max_members, cycle_start, contribution, total_contributed))
    }

    pub fn get_members(env: Env) -> Result<Vec<Address>, Error> {
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .unwrap_or(Vec::new(&env)))
    }

    pub fn get_cycle_winner(env: Env, cycle: u32) -> Result<Address, Error> {
        let winner_order: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::WinnerOrder)
            .unwrap_or(Vec::new(&env));
        winner_order.get(cycle).ok_or(Error::InvalidParameter)
    }

    pub fn get_member_collateral(env: Env, member: Address) -> Result<i128, Error> {
        let collaterals: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MemberCollateral)
            .unwrap_or(Map::new(&env));
        Ok(collaterals.get(member).unwrap_or(0))
    }

    pub fn get_member_vault_shares(env: Env, member: Address) -> Result<i128, Error> {
        let shares: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::MemberVaultShares)
            .unwrap_or(Map::new(&env));
        Ok(shares.get(member).unwrap_or(0))
    }

    pub fn get_name(env: Env) -> Result<String, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .ok_or(Error::NotInitialized)
    }

    pub fn get_description(env: Env) -> Result<String, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Description)
            .ok_or(Error::NotInitialized)
    }

    pub fn get_period_duration(env: Env) -> Result<u64, Error> {
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::PeriodDuration)
            .unwrap_or(0))
    }

    pub fn get_yield_split_bps(env: Env) -> Result<u32, Error> {
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::YieldSplitBps)
            .unwrap_or(0))
    }

    pub fn get_vault_shares(env: Env) -> Result<i128, Error> {
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::VaultShares)
            .unwrap_or(0))
    }

    pub fn get_last_drand_round(env: Env) -> Result<u64, Error> {
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::LastDrandRound)
            .unwrap_or(0))
    }

    pub fn get_winner_order(env: Env) -> Result<Vec<Address>, Error> {
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::WinnerOrder)
            .unwrap_or(Vec::new(&env)))
    }

    pub fn get_cycle_end_time(env: Env) -> Result<u64, Error> {
        let cycle_start: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CycleStartTime)
            .unwrap_or(0);
        let period_duration: u64 = env
            .storage()
            .instance()
            .get(&DataKey::PeriodDuration)
            .unwrap_or(0);
        cycle_start
            .checked_add(period_duration)
            .ok_or(Error::ArithmeticError)
    }

    pub fn has_contributed(env: Env, member: Address, cycle: u32) -> Result<bool, Error> {
        let contributions: Map<(u32, Address), i128> = env
            .storage()
            .instance()
            .get(&DataKey::Contributions)
            .unwrap_or(Map::new(&env));
        Ok(contributions.get((cycle, member)).unwrap_or(0) > 0)
    }
}

#[cfg(test)]
mod test;
