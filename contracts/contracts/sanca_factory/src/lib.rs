#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    IntoVal, String, Symbol, Vec,
};

/// Errors for the factory contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidMaxMembers = 4,
    InvalidContribution = 5,
    InvalidPeriodDuration = 6,
    InvalidYieldSplit = 7,
    InvalidPlatformFee = 8,
    InvalidWasmHash = 9,
    IndexOutOfBounds = 10,
    NoKeeper = 11,
}

/// Storage keys for factory state.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Usdc,
    DefindexVault,
    PlatformFeeReceiver,
    PlatformFeeBps,
    PoolWasmHash,
    DrandPublicKey,
    Keeper,
    YieldSplitBps,
    TotalPools,
    PoolByIndex(u32),
}

/// Event topics.
const POOL_CREATED: Symbol = symbol_short!("created");
const CONFIG_UPDATED: Symbol = symbol_short!("cfg_upd");

#[contract]
pub struct SancaFactory;

#[contractimpl]
impl SancaFactory {
    /// Constructor called once at deploy time.
    pub fn __constructor(
        env: Env,
        admin: Address,
        usdc: Address,
        defindex_vault: Address,
        platform_fee_receiver: Address,
        platform_fee_bps: u32,
        yield_split_bps: u32,
        pool_wasm_hash: BytesN<32>,
        drand_public_key: BytesN<192>,
    ) {
        admin.require_auth();

        if platform_fee_bps > 5000 {
            // max 50%
            panic!("platform fee too high");
        }
        if yield_split_bps > 10_000 {
            panic!("yield split too high");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
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
        env.storage()
            .instance()
            .set(&DataKey::YieldSplitBps, &yield_split_bps);
        env.storage()
            .instance()
            .set(&DataKey::PoolWasmHash, &pool_wasm_hash);
        env.storage()
            .instance()
            .set(&DataKey::DrandPublicKey, &drand_public_key);
        env.storage().instance().set(&DataKey::TotalPools, &0u32);

        env.storage().instance().extend_ttl(100, 518400);
    }

    /// Create a new SancaPool with the given ROSCA parameters.
    pub fn create_pool(
        env: Env,
        creator: Address,
        max_members: u32,
        contribution_per_period: i128,
        period_duration: u64,
        name: String,
        description: String,
    ) -> Result<Address, Error> {
        creator.require_auth();

        if max_members < 2 || max_members > 50 {
            return Err(Error::InvalidMaxMembers);
        }
        if contribution_per_period < 5_000_000 {
            // 5 USDC with 6 decimals
            return Err(Error::InvalidContribution);
        }
        if period_duration == 0 {
            return Err(Error::InvalidPeriodDuration);
        }

        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Keeper)
            .ok_or(Error::NoKeeper)?;

        let yield_split_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::YieldSplitBps)
            .ok_or(Error::NotInitialized)?;

        let wasm_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::PoolWasmHash)
            .ok_or(Error::NotInitialized)?;

        let total_pools: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalPools)
            .unwrap_or(0);

        let mut salt_bytes = [0u8; 32];
        let total_pools_be = total_pools.to_be_bytes();
        salt_bytes[..total_pools_be.len()].copy_from_slice(&total_pools_be);
        let salt = BytesN::from_array(&env, &salt_bytes);

        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).ok_or(Error::NotInitialized)?;
        let defindex_vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::DefindexVault)
            .ok_or(Error::NotInitialized)?;
        let platform_fee_receiver: Address = env
            .storage()
            .instance()
            .get(&DataKey::PlatformFeeReceiver)
            .ok_or(Error::NotInitialized)?;
        let platform_fee_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PlatformFeeBps)
            .ok_or(Error::NotInitialized)?;
        let drand_public_key: BytesN<192> = env
            .storage()
            .instance()
            .get(&DataKey::DrandPublicKey)
            .ok_or(Error::NotInitialized)?;

        let factory = env.current_contract_address();
        let pool_address = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(
                wasm_hash,
                (
                    factory,
                    creator.clone(),
                    usdc,
                    defindex_vault,
                    platform_fee_receiver,
                    platform_fee_bps,
                    max_members,
                    contribution_per_period,
                    period_duration,
                    yield_split_bps,
                    name,
                    description,
                    drand_public_key,
                ),
            );

        env.storage()
            .instance()
            .set(&DataKey::PoolByIndex(total_pools), &pool_address);
        env.storage()
            .instance()
            .set(&DataKey::TotalPools, &(total_pools + 1));

        env.events().publish(
            (POOL_CREATED, pool_address.clone()),
            (
                creator,
                max_members,
                contribution_per_period,
                period_duration,
                yield_split_bps,
            ),
        );

        env.storage().instance().extend_ttl(100, 518400);
        Ok(pool_address)
    }

    // Admin setters
    pub fn set_usdc(env: Env, new_usdc: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;
        env.storage().instance().set(&DataKey::Usdc, &new_usdc);
        env.events().publish((CONFIG_UPDATED, symbol_short!("usdc")), new_usdc);
        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    pub fn set_defindex_vault(env: Env, new_vault: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;
        env.storage()
            .instance()
            .set(&DataKey::DefindexVault, &new_vault);
        env.events()
            .publish((CONFIG_UPDATED, symbol_short!("vault")), new_vault);
        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    pub fn set_platform_fee_receiver(
        env: Env,
        new_receiver: Address,
    ) -> Result<(), Error> {
        Self::require_admin(&env)?;
        env.storage()
            .instance()
            .set(&DataKey::PlatformFeeReceiver, &new_receiver);
        env.events()
            .publish((CONFIG_UPDATED, symbol_short!("fee_recv")), new_receiver);
        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    pub fn set_platform_fee_bps(env: Env, new_fee_bps: u32) -> Result<(), Error> {
        Self::require_admin(&env)?;
        if new_fee_bps > 5000 {
            return Err(Error::InvalidPlatformFee);
        }
        env.storage()
            .instance()
            .set(&DataKey::PlatformFeeBps, &new_fee_bps);
        env.events()
            .publish((CONFIG_UPDATED, symbol_short!("fee_bps")), new_fee_bps);
        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    pub fn set_pool_wasm_hash(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        Self::require_admin(&env)?;
        env.storage()
            .instance()
            .set(&DataKey::PoolWasmHash, &new_wasm_hash);
        env.events()
            .publish((CONFIG_UPDATED, symbol_short!("wasm")), new_wasm_hash);
        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    pub fn set_drand_public_key(env: Env, new_key: BytesN<192>) -> Result<(), Error> {
        Self::require_admin(&env)?;
        env.storage()
            .instance()
            .set(&DataKey::DrandPublicKey, &new_key);
        env.events()
            .publish((CONFIG_UPDATED, symbol_short!("drand")), new_key);
        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    pub fn set_yield_split_bps(env: Env, new_yield_split_bps: u32) -> Result<(), Error> {
        Self::require_admin(&env)?;
        if new_yield_split_bps > 10_000 {
            return Err(Error::InvalidYieldSplit);
        }
        env.storage()
            .instance()
            .set(&DataKey::YieldSplitBps, &new_yield_split_bps);
        env.events()
            .publish((CONFIG_UPDATED, symbol_short!("yield")), new_yield_split_bps);
        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    /// Set the platform keeper that settles cycles on all pools.
    pub fn set_keeper(env: Env, keeper: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;
        env.storage().instance().set(&DataKey::Keeper, &keeper);
        env.events()
            .publish((CONFIG_UPDATED, symbol_short!("keeper")), keeper.clone());
        env.storage().instance().extend_ttl(100, 518400);
        Ok(())
    }

    // Read functions
    pub fn admin(env: Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)
    }

    pub fn usdc(env: Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::Usdc).ok_or(Error::NotInitialized)
    }

    pub fn defindex_vault(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::DefindexVault)
            .ok_or(Error::NotInitialized)
    }

    pub fn platform_fee_receiver(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::PlatformFeeReceiver)
            .ok_or(Error::NotInitialized)
    }

    pub fn platform_fee_bps(env: Env) -> Result<u32, Error> {
        env.storage()
            .instance()
            .get(&DataKey::PlatformFeeBps)
            .ok_or(Error::NotInitialized)
    }

    pub fn pool_wasm_hash(env: Env) -> Result<BytesN<32>, Error> {
        env.storage()
            .instance()
            .get(&DataKey::PoolWasmHash)
            .ok_or(Error::NotInitialized)
    }

    pub fn drand_public_key(env: Env) -> Result<BytesN<192>, Error> {
        env.storage()
            .instance()
            .get(&DataKey::DrandPublicKey)
            .ok_or(Error::NotInitialized)
    }

    pub fn get_keeper(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Keeper)
            .ok_or(Error::NoKeeper)
    }

    pub fn get_yield_split_bps(env: Env) -> Result<u32, Error> {
        env.storage()
            .instance()
            .get(&DataKey::YieldSplitBps)
            .ok_or(Error::NotInitialized)
    }

    pub fn total_pools(env: Env) -> Result<u32, Error> {
        Ok(env.storage().instance().get(&DataKey::TotalPools).unwrap_or(0))
    }

    pub fn get_pool(env: Env, index: u32) -> Result<Address, Error> {
        let total = Self::total_pools(env.clone())?;
        if index >= total {
            return Err(Error::IndexOutOfBounds);
        }
        env.storage()
            .instance()
            .get(&DataKey::PoolByIndex(index))
            .ok_or(Error::IndexOutOfBounds)
    }

    pub fn get_all_pools(env: Env) -> Result<Vec<Address>, Error> {
        let total = Self::total_pools(env.clone())?;
        let mut pools = Vec::new(&env);
        for i in 0..total {
            if let Some(addr) = env.storage().instance().get(&DataKey::PoolByIndex(i)) {
                pools.push_back(addr);
            }
        }
        Ok(pools)
    }

    fn require_admin(env: &Env) -> Result<Address, Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        Ok(admin)
    }
}
