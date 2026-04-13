use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};

declare_id!("FoQZVguRJUchiQZba72Z1RzSaD7NWTvnAj8V3NahYvFo");

// ==================== CONSTANTS ====================
const HARVEST_COOLDOWN_SECS: i64 = 60;
const MAX_DEPOSIT_PERCENT: u64 = 10; // 10% of TVL per deposit (BountyFlashGuard)
const CIRCUIT_BREAKER_PAUSE_THRESHOLD: u8 = 30;
const CIRCUIT_BREAKER_RESUME_THRESHOLD: u8 = 40;
const EMERGENCY_DELEVERAGE_THRESHOLD: u8 = 15;
const ORACLE_FRESHNESS_MAX_SECS: u64 = 300;
const XP_PER_DEPOSIT: u64 = 10;
const XP_PER_WITHDRAW: u64 = 5;
const XP_PER_HARVEST: u64 = 25;
const XP_PER_REBALANCE: u64 = 20;
const XP_PER_DELEVERAGE: u64 = 30;
const XP_PER_THREAT_REPORT: u64 = 30;
const XP_PER_LEVEL: u64 = 100;

#[program]
pub mod perp_shield {
    use super::*;

    // ==================== INITIALIZE ====================
    /// Initializes the PerpShield vault with default parameters.
    /// Must be called once before any other instructions.
    pub fn initialize(ctx: Context<Initialize>, usdc_mint: Pubkey) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;

        vault.asset = usdc_mint;
        vault.total_assets = 0;
        vault.long_position = 0;
        vault.short_position = 0;
        vault.funding_accrued = 0;
        vault.harvest_bounty = 100; // 1% (basis points / 10000)
        vault.rebalance_bounty = 50; // 0.5%
        vault.deleverage_bounty = 500; // 5%
        vault.shield_score = 80;
        vault.is_paused = false;
        vault.peak_assets = 0;
        vault.last_oracle_timestamp = clock.unix_timestamp;
        vault.last_deposit_slot = clock.slot;
        vault.last_rebalance = clock.unix_timestamp;
        vault.last_harvest = clock.unix_timestamp;
        vault.vault_bump = ctx.bumps.vault;

        Ok(())
    }

    // ==================== DEPOSIT ====================
    /// Deposits USDC into the vault and mints proportional share tokens to the user.
    /// Enforces BountyFlashGuard: max 10% of current TVL per deposit.
    /// Awards XP to the depositor.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;

        require!(!vault.is_paused, ErrorCode::VaultPaused);
        require!(amount > 0, ErrorCode::ZeroAmount);

        // BountyFlashGuard: enforce 10% TVL deposit cap
        if vault.total_assets > 0 {
            let max_deposit = vault.total_assets / MAX_DEPOSIT_PERCENT;
            require!(amount <= max_deposit, ErrorCode::DepositLimitExceeded);
        }

        // Transfer USDC from user to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Calculate shares to mint (1:1 on first deposit)
        let shares = if vault.total_assets == 0 {
            amount
        } else {
            amount
                .checked_mul(ctx.accounts.vault_mint.supply)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(vault.total_assets)
                .ok_or(ErrorCode::MathOverflow)?
        };

        // Mint share tokens to user
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.vault_mint.to_account_info(),
                    to: ctx.accounts.user_vault_token_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                &[&[b"vault", &[vault.vault_bump]]],
            ),
            shares,
        )?;

        vault.total_assets = vault
            .total_assets
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        vault.last_deposit_slot = clock.slot;

        if vault.total_assets > vault.peak_assets {
            vault.peak_assets = vault.total_assets;
        }

        // Grant XP to depositor
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.xp = user_stats.xp.saturating_add(XP_PER_DEPOSIT);
        user_stats.level = calculate_level(user_stats.xp);

        emit!(DepositEvent {
            user: ctx.accounts.user.key(),
            amount,
            shares,
        });

        Ok(())
    }

    // ==================== WITHDRAW ====================
    /// Burns share tokens and returns proportional USDC to the user.
    /// Awards XP to the withdrawer.
    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        require!(shares > 0, ErrorCode::ZeroAmount);

        let supply = ctx.accounts.vault_mint.supply;
        require!(supply > 0, ErrorCode::ZeroSupply);

        // Calculate USDC amount owed for shares
        let amount = shares
            .checked_mul(vault.total_assets)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(supply)
            .ok_or(ErrorCode::MathOverflow)?;

        // Burn share tokens from user
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.vault_mint.to_account_info(),
                    from: ctx.accounts.user_vault_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            shares,
        )?;

        // Transfer USDC from vault to user
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                &[&[b"vault", &[vault.vault_bump]]],
            ),
            amount,
        )?;

        vault.total_assets = vault.total_assets.saturating_sub(amount);

        // Grant XP to withdrawer
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.xp = user_stats.xp.saturating_add(XP_PER_WITHDRAW);
        user_stats.level = calculate_level(user_stats.xp);

        emit!(WithdrawEvent {
            user: ctx.accounts.user.key(),
            amount,
            shares,
        });

        Ok(())
    }

    // ==================== HARVEST ====================
    /// Collects accrued funding fees and pays a bounty to the caller.
    /// Enforces a 60-second cooldown between harvests.
    /// Awards XP to the caller.
    pub fn harvest(ctx: Context<Harvest>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;

        require!(
            clock
                .unix_timestamp
                .saturating_sub(vault.last_harvest)
                >= HARVEST_COOLDOWN_SECS,
            ErrorCode::CooldownNotOver
        );
        require!(vault.funding_accrued > 0, ErrorCode::NothingToHarvest);

        let bounty_amount = (vault.funding_accrued as u64)
            .saturating_mul(vault.harvest_bounty as u64)
            / 10000;

        // Transfer bounty to caller
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.caller_token_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                &[&[b"vault", &[vault.vault_bump]]],
            ),
            bounty_amount,
        )?;

        vault.funding_accrued = 0;
        vault.total_assets = vault.total_assets.saturating_sub(bounty_amount);
        vault.last_harvest = clock.unix_timestamp;

        // Grant XP to caller
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.xp = user_stats.xp.saturating_add(XP_PER_HARVEST);
        user_stats.level = calculate_level(user_stats.xp);

        emit!(HarvestEvent {
            caller: ctx.accounts.caller.key(),
            bounty: bounty_amount,
        });

        Ok(())
    }

    // ==================== REBALANCE ====================
    /// Rebalances long/short positions when delta drift exceeds 5% of TVL.
    /// Pays a bounty to the caller and awards XP.
    pub fn rebalance(
        ctx: Context<Rebalance>,
        new_long: u64,
        new_short: u64,
        new_funding: i64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;

        // Check if rebalance is needed (delta drift > 5% TVL)
        let delta_drift = vault.long_position.abs_diff(vault.short_position);
        require!(
            delta_drift > vault.total_assets / 20,
            ErrorCode::NoRebalanceNeeded
        );

        vault.long_position = new_long;
        vault.short_position = new_short;
        vault.funding_accrued = vault.funding_accrued.saturating_add(new_funding);
        vault.last_rebalance = clock.unix_timestamp;

        let bounty = vault
            .total_assets
            .saturating_mul(vault.rebalance_bounty as u64)
            / 10000;

        // Transfer bounty to caller
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.caller_token_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                &[&[b"vault", &[vault.vault_bump]]],
            ),
            bounty,
        )?;

        vault.total_assets = vault.total_assets.saturating_sub(bounty);

        // Grant XP to caller
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.xp = user_stats.xp.saturating_add(XP_PER_REBALANCE);
        user_stats.level = calculate_level(user_stats.xp);

        emit!(RebalanceEvent {
            caller: ctx.accounts.caller.key(),
            bounty,
        });

        Ok(())
    }

    // ==================== EMERGENCY DELEVERAGE ====================
    /// Triggers emergency deleveraging when ShieldScore drops below 15.
    /// Pays a large bounty (5%) to incentivize fast response.
    /// Awards XP to the caller.
    pub fn emergency_deleverage(ctx: Context<EmergencyDeleverage>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        require!(
            vault.shield_score < EMERGENCY_DELEVERAGE_THRESHOLD,
            ErrorCode::NoEmergencyNeeded
        );

        let bounty = vault
            .total_assets
            .saturating_mul(vault.deleverage_bounty as u64)
            / 10000;

        // Transfer bounty to caller
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.caller_token_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                &[&[b"vault", &[vault.vault_bump]]],
            ),
            bounty,
        )?;

        // Reset all positions (off-chain Pacifica close is handled by caller)
        vault.long_position = 0;
        vault.short_position = 0;
        vault.funding_accrued = 0;
        vault.total_assets = vault.total_assets.saturating_sub(bounty);

        // Grant XP to caller
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.xp = user_stats.xp.saturating_add(XP_PER_DELEVERAGE);
        user_stats.level = calculate_level(user_stats.xp);

        emit!(EmergencyDeleverageEvent {
            caller: ctx.accounts.caller.key(),
            bounty,
        });

        Ok(())
    }

    // ==================== UPDATE SHIELD SCORE ====================
    /// Updates the composite ShieldScore using on-chain position data and
    /// off-chain oracle inputs. Triggers circuit breaker if score < 30.
    ///
    /// ShieldScore Formula (100 points total):
    ///   - Funding magnitude health  : 30%
    ///   - Delta neutrality          : 25%
    ///   - Oracle freshness          : 25%
    ///   - Drawdown health           : 20%
    pub fn update_shield_score(
        ctx: Context<UpdateShieldScore>,
        funding_magnitude: u64, // 0-100 (0 = no funding, 100 = extreme funding)
        oracle_freshness_secs: u64, // seconds since last oracle update (0 = fresh)
        drawdown_percent: u64, // 0-100 (current drawdown from peak)
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        // Delta drift as % of TVL (on-chain)
        let delta_drift_percent = if vault.total_assets == 0 {
            0u64
        } else {
            let drift = vault.long_position.abs_diff(vault.short_position);
            (drift * 100) / vault.total_assets
        };

        // Clamp inputs to valid ranges
        let funding_magnitude = funding_magnitude.min(100);
        let oracle_freshness_secs = oracle_freshness_secs.min(ORACLE_FRESHNESS_MAX_SECS);
        let drawdown_percent = drawdown_percent.min(100);
        let delta_drift_percent = delta_drift_percent.min(100);

        // Composite ShieldScore
        let score = (funding_magnitude * 30 / 100)
            + ((100u64.saturating_sub(delta_drift_percent)) * 25 / 100)
            + ((100u64.saturating_sub(
                oracle_freshness_secs * 100 / ORACLE_FRESHNESS_MAX_SECS,
            )) * 25
                / 100)
            + ((100u64.saturating_sub(drawdown_percent)) * 20 / 100);

        let final_score = score.min(100) as u8;
        vault.shield_score = final_score;

        // Circuit breaker: pause if score drops below threshold
        if final_score < CIRCUIT_BREAKER_PAUSE_THRESHOLD {
            vault.is_paused = true;
            emit!(CircuitBreakerActivated { score: final_score });
        } else if final_score >= CIRCUIT_BREAKER_RESUME_THRESHOLD {
            vault.is_paused = false;
        }

        vault.last_oracle_timestamp = Clock::get()?.unix_timestamp;

        emit!(ShieldScoreUpdated {
            score: final_score,
            is_paused: vault.is_paused,
        });

        Ok(())
    }

    // ==================== THREAT REPORT ====================
    /// Allows community members to submit threat reports and earn XP.
    /// Off-chain verification of the report happens via the frontend.
    pub fn threat_report(ctx: Context<ThreatReport>) -> Result<()> {
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.xp = user_stats.xp.saturating_add(XP_PER_THREAT_REPORT);
        user_stats.level = calculate_level(user_stats.xp);

        emit!(ThreatReportEvent {
            reporter: ctx.accounts.reporter.key(),
        });

        Ok(())
    }
}

// ==================== HELPER FUNCTIONS ====================

/// Calculates user level from XP. Level starts at 1, increases every 100 XP.
fn calculate_level(xp: u64) -> u8 {
    ((xp / XP_PER_LEVEL) as u8).saturating_add(1)
}

// ==================== ACCOUNT STRUCTS ====================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Vault::LEN,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.vault_bump)]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, token::mint = vault.asset, token::authority = user)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault.asset, token::authority = vault)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_mint: Account<'info, Mint>,

    #[account(mut, token::mint = vault_mint, token::authority = user)]
    pub user_vault_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserStats::LEN,
        seeds = [b"user", user.key().as_ref()],
        bump
    )]
    pub user_stats: Account<'info, UserStats>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.vault_bump)]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, token::mint = vault.asset, token::authority = user)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault.asset, token::authority = vault)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_mint: Account<'info, Mint>,

    #[account(mut, token::mint = vault_mint, token::authority = user)]
    pub user_vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"user", user.key().as_ref()], bump)]
    pub user_stats: Account<'info, UserStats>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Harvest<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.vault_bump)]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(mut, token::mint = vault.asset, token::authority = caller)]
    pub caller_token_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault.asset, token::authority = vault)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"user", caller.key().as_ref()], bump)]
    pub user_stats: Account<'info, UserStats>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Rebalance<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.vault_bump)]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(mut, token::mint = vault.asset, token::authority = caller)]
    pub caller_token_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault.asset, token::authority = vault)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"user", caller.key().as_ref()], bump)]
    pub user_stats: Account<'info, UserStats>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct EmergencyDeleverage<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.vault_bump)]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(mut, token::mint = vault.asset, token::authority = caller)]
    pub caller_token_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = vault.asset, token::authority = vault)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"user", caller.key().as_ref()], bump)]
    pub user_stats: Account<'info, UserStats>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateShieldScore<'info> {
    #[account(mut, seeds = [b"vault"], bump = vault.vault_bump)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct ThreatReport<'info> {
    #[account(mut)]
    pub reporter: Signer<'info>,

    #[account(mut, seeds = [b"user", reporter.key().as_ref()], bump)]
    pub user_stats: Account<'info, UserStats>,
}

// ==================== STATE ====================

#[account]
pub struct Vault {
    /// The USDC mint address accepted by this vault
    pub asset: Pubkey,                 // 32
    /// Total USDC assets under management
    pub total_assets: u64,             // 8
    /// Current long position size (in USDC)
    pub long_position: u64,            // 8
    /// Current short position size (in USDC)
    pub short_position: u64,           // 8
    /// Accumulated funding fees (signed: positive = received, negative = paid)
    pub funding_accrued: i64,          // 8
    /// Harvest bounty in basis points (e.g. 100 = 1%)
    pub harvest_bounty: u16,           // 2
    /// Rebalance bounty in basis points (e.g. 50 = 0.5%)
    pub rebalance_bounty: u16,         // 2
    /// Emergency deleverage bounty in basis points (e.g. 500 = 5%)
    pub deleverage_bounty: u16,        // 2
    /// Composite health score 0-100
    pub shield_score: u8,              // 1
    /// Whether the vault is paused due to low ShieldScore
    pub is_paused: bool,               // 1
    /// All-time peak assets (used for drawdown calculation)
    pub peak_assets: u64,              // 8
    /// Unix timestamp of last oracle update
    pub last_oracle_timestamp: i64,    // 8
    /// Slot of last deposit (for MEV/sandwich protection)
    pub last_deposit_slot: u64,        // 8
    /// Unix timestamp of last rebalance
    pub last_rebalance: i64,           // 8
    /// Unix timestamp of last harvest
    pub last_harvest: i64,             // 8
    /// PDA bump seed
    pub vault_bump: u8,                // 1
}

#[account]
pub struct UserStats {
    /// Total XP earned by user
    pub xp: u64,    // 8
    /// Current level (derived from XP)
    pub level: u8,  // 1
}

impl Vault {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 8 + 2 + 2 + 2 + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 1;
}

impl UserStats {
    pub const LEN: usize = 8 + 1;
}

// ==================== EVENTS ====================

#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub shares: u64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub shares: u64,
}

#[event]
pub struct HarvestEvent {
    pub caller: Pubkey,
    pub bounty: u64,
}

#[event]
pub struct RebalanceEvent {
    pub caller: Pubkey,
    pub bounty: u64,
}

#[event]
pub struct EmergencyDeleverageEvent {
    pub caller: Pubkey,
    pub bounty: u64,
}

#[event]
pub struct CircuitBreakerActivated {
    pub score: u8,
}

#[event]
pub struct ShieldScoreUpdated {
    pub score: u8,
    pub is_paused: bool,
}

#[event]
pub struct ThreatReportEvent {
    pub reporter: Pubkey,
}

// ==================== ERRORS ====================

#[error_code]
pub enum ErrorCode {
    #[msg("Vault is paused due to low ShieldScore")]
    VaultPaused,

    #[msg("Deposit amount must be greater than zero")]
    ZeroAmount,

    #[msg("Deposit exceeds 10% TVL limit (BountyFlashGuard)")]
    DepositLimitExceeded,

    #[msg("Token supply is zero; no shares to redeem")]
    ZeroSupply,

    #[msg("No funding accrued to harvest")]
    NothingToHarvest,

    #[msg("60-second harvest cooldown has not elapsed")]
    CooldownNotOver,

    #[msg("Delta drift is within tolerance; rebalance not needed")]
    NoRebalanceNeeded,

    #[msg("ShieldScore is above emergency threshold; deleverage not needed")]
    NoEmergencyNeeded,

    #[msg("Arithmetic overflow")]
    MathOverflow,
}