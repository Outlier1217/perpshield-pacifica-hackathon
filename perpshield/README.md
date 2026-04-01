PerpShield Vault
A Delta-Neutral Yield Vault on Pacifica Perpetuals
PerpShield is an ERC-4626 compliant yield vault that automatically executes delta-neutral strategies on Pacifica perpetuals to generate sustainable yield from funding rates. The vault combines automated position management, bounty-driven rebalancing, and a real-time risk scoring system to provide passive yield with built-in security mechanisms.

🚀 Overview
PerpShield transforms Pacifica's perpetual funding rates into a passive yield product. Users deposit USDC, and the vault automatically opens a delta-neutral position (50% long spot / 50% short perpetual) on Pacifica, collecting funding rate payments from the short position. The system is fully automated through on-chain bounties, eliminating the need for keeper bots while maintaining robust risk controls.

Key Features
ERC-4626 Compliant: Standardized yield vault interface for maximum composability

Delta-Neutral Strategy: 50/50 long/short split to isolate funding rate yield

Pacifica Integration: Direct interaction with Pacifica perpetual contracts

Bounty-Driven Automation: Anyone can harvest yield or rebalance positions for rewards

ShieldScore Risk System: Real-time risk scoring with circuit breakers

Gamification: XP and level system with bounty multipliers

Emergency Safeguards: Auto-pause, emergency deleverage, and withdrawal protections

📋 Table of Contents
Architecture

Contract Details

Core Functions

Risk Management

Gamification

Security Features

Deployment

Testing

Frontend Integration

Strategy Document

🏗 Architecture
text
┌─────────────────────────────────────────────────────────────┐
│                       PerpShieldVault                       │
│  (ERC-4626 + ReentrancyGuard + Ownable)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  Pacifica Perp  │  │ Pacifica Oracle │  │  USDC Asset │ │
│  │   Integration   │  │   Integration   │  │   (ERC20)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Bounty    │  │  Shield     │  │  XP & Level System  │ │
│  │   System    │  │   Score     │  │   (Gamification)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Flash      │  │  Circuit    │  │   Emergency         │ │
│  │  Guard      │  │  Breaker    │  │   Withdrawals       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
Core Components
Pacifica Integration Layer

IPacificaPerp: Handles position opening/closing and funding rate queries

IPacificaOracle: Provides market data and health checks for ShieldScore

Position Management

Delta-neutral position tracking (50% long / 50% short)

Proportional position adjustments on deposits/withdrawals

Automated rebalancing when delta drifts >5%

Yield Generation

Funding rate collection from short perpetual positions

60-second harvest cooldown to prevent manipulation

Bounty distribution to harvesters

Risk System

Real-time ShieldScore calculation (0-100)

Auto-pause at score < 30

Emergency deleverage at score < 15

Liquidation buffer monitoring (20% threshold)

📄 Contract Details
File Structure
text
contracts/
├── PerpShieldVault.sol    # Main vault contract (ERC-4626)
└── MockUSDC.sol           # Mock USDC for testing (6 decimals)
Key Variables
Variable	Type	Description
pacificaPerp	IPacificaPerp	Pacifica perpetual contract interface
pacificaOracle	IPacificaOracle	Pacifica oracle for price feeds
bnbMarket	address	BNB-USD market address on Pacifica
totalAssetsVault	uint256	Total USDC held by vault
shieldScore	uint256	Real-time risk score (0-100)
longPositionId	uint256	Pacifica position ID for long leg
shortPositionId	uint256	Pacifica position ID for short leg
Constants
Constant	Value	Description
HARVEST_BOUNTY_BPS	10 (0.1%)	Bounty for harvesting yield
REBALANCE_BOUNTY_BPS	5 (0.05%)	Bounty for rebalancing positions
DELEVERAGE_BOUNTY_BPS	50 (0.5%)	Bounty for emergency deleverage
PAUSE_THRESHOLD	30	ShieldScore for auto-pause
EMERGENCY_THRESHOLD	15	ShieldScore for emergency mode
MAX_DEPOSIT_PER_BLOCK_BPS	1000 (10%)	Anti-sandwich deposit limit
⚙ Core Functions
Deposit
solidity
function deposit(uint256 assets, address receiver) 
    external 
    returns (uint256 shares)
Description: Deposit USDC and receive pshUSDC shares

Requirements:

Not paused or in emergency mode

Amount ≤ 10% of TVL per block (anti-manipulation)

Actions:

Transfer USDC from user to vault
Mint proportional shares
Open/update delta-neutral position on Pacifica
Award XP to depositor
Update ShieldScore
Withdraw
solidity
function withdraw(uint256 assets, address receiver, address owner) 
    external 
    returns (uint256 shares)
Description: Burn shares and receive USDC

Features:

Always available (even when paused)

Proportional position closure

Emergency withdrawal path for crisis scenarios

Harvest
solidity
function harvest() external
Description: Collect accumulated funding rate yield

Bounty: 0.1% of harvested yield (with level multiplier)

Requirements:

60-second cooldown between harvests

Positive pending yield

Not paused

Rebalance
solidity
function rebalance() external
Description: Reset positions to 50/50 delta-neutral

Trigger Conditions:

Delta drift > 5% of TVL, OR

ShieldScore < 40

Bounty: 0.05% of TVL (with level multiplier)

Emergency Deleverage
solidity
function emergencyDeleverage() external
Description: Reduce positions to 25% of TVL (50% total exposure)

Trigger: ShieldScore < 15

Bounty: 0.5% of TVL (with level multiplier)

Effect: Activates emergency mode

Threat Reporting
solidity
function reportThreat(string calldata description, bytes calldata proof) external
Description: Report security threats for bounty

Reward: Paid from dedicated reward pool (owner-funded)

Requirements: Valid description and proof, non-empty reward pool

🛡 Risk Management
ShieldScore Calculation
ShieldScore is a composite risk metric (0-100, higher = safer):

Component	Weight	Source
Funding Rate Magnitude	30%	Pacifica API
Position Delta Drift	25%	On-chain calculation
Oracle Health	25%	Price feed freshness
Drawdown from Peak	20%	NAV tracking
Additional Modifiers:

Liquidation buffer penalty if within 20% of liquidation price

Automatic circuit breakers at thresholds

Circuit Breakers
ShieldScore	Action
< 30	Auto-pause new deposits
< 15	Emergency mode + deleverage bounty
Any	Emergency withdrawals always allowed
Flash Guard
Max Deposit Per Block: 10% of TVL

Purpose: Prevent sandwich attacks and flash loan manipulation

Tracking: blockDepositTotal[block.number]

🎮 Gamification System
XP Rewards
Action	XP Earned
Deposit	10
Withdraw	5
Harvest	25
Rebalance	20
Threat Report	30
Emergency Action	30
Level System
Level	XP Required	Bounty Multiplier
0	0	1.00x
1	100	1.05x
2	500	1.10x
3	2,000	1.15x
4	5,000	1.25x
5	10,000	1.50x
Features:

Level increases automatically when XP threshold is reached

Higher levels receive larger bounties for all actions

XP persists across deposits/withdrawals

🔒 Security Features
Access Controls
Owner: Can pause/resume, fund threat rewards, emergency withdraw

Users: Can deposit/withdraw/harvest/rebalance

Anyone: Can report threats, trigger emergency actions

Protection Mechanisms
ReentrancyGuard: All state-modifying functions protected

Pause Mechanism: Emergency stop for deposits/harvest/rebalance

Emergency Mode: Activates at critical risk levels

Flash Guard: Per-block deposit limits

Withdrawal Priority: Always available even in emergencies

Safe Asset Handling
SafeERC20 for all token transfers

Try-catch wrappers for external calls in emergency mode

Proper approval management for Pacifica contracts

Balance checks before bounty payments

🚀 Deployment
Prerequisites
bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your private key and RPC URLs
Environment Variables
env
PRIVATE_KEY=your_private_key_here
PACIFICA_RPC_URL=https://testnet.pacifica.fi/rpc
PACIFICA_CHAIN_ID=12345
Deployment Script
javascript
// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Update with actual Pacifica testnet addresses
  const USDC_ADDRESS = "0x...";           // USDC on Pacifica
  const PACIFICA_PERP = "0x...";          // Pacifica perp contract
  const PACIFICA_ORACLE = "0x...";        // Pacifica oracle
  const BNB_MARKET = "0x...";             // BNB-USD market

  const Vault = await ethers.getContractFactory("PerpShieldVault");
  const vault = await Vault.deploy(
    USDC_ADDRESS,
    PACIFICA_PERP,
    PACIFICA_ORACLE,
    BNB_MARKET
  );

  await vault.waitForDeployment();
  console.log("PerpShieldVault deployed to:", await vault.getAddress());
}

main().catch(console.error);
Deployment Commands
bash
# Local testnet
npx hardhat run scripts/deploy.js --network localhost

# Pacifica testnet
npx hardhat run scripts/deploy.js --network pacifica

# Mainnet (after testing)
npx hardhat run scripts/deploy.js --network mainnet
🧪 Testing
Run Tests
bash
# Run all tests
npx hardhat test

# Run specific test suite
npx hardhat test test/PerpShieldVault.test.js

# Run with gas reporting
npx hardhat test --gas

# Run with coverage
npx hardhat coverage
Test Coverage
The test suite covers:

Category	Tests
Deployment	12 tests
XP & Level System	3 tests
Deposit	4 tests
Withdraw	4 tests
Harvest	3 tests
Rebalance	2 tests
Emergency Deleverage	2 tests
Emergency Functions	9 tests
Threat Reporting	4 tests
View Functions	3 tests
State Transitions	3 tests
Constants & Math	5 tests
Deployment Verification	5 tests
Total: 62+ comprehensive tests

Test Structure
javascript
describe("PerpShieldVault", function () {
  beforeEach(async function () {
    // Deploy fresh vault before each test
  });

  describe("1. Deployment Tests", function () {
    it("Should set correct name and symbol", async function () {});
    it("Should initialize shieldScore to 100", async function () {});
    // ...
  });

  describe("2. XP & Level System Tests", function () {
    // ...
  });

  // ... 12 more test suites
});
💻 Frontend Integration
API Endpoints (View Functions)
javascript
// Get vault metrics
const metrics = await vault.getVaultMetrics();
console.log({
  tvl: ethers.formatUnits(metrics.tvl, 6),
  shieldScore: metrics.currentShieldScore,
  fundingRate: metrics.fundingRate,
  delta: metrics.delta,
  paused: metrics.isPaused,
  emergency: metrics.isEmergency
});

// Get user stats
const stats = await vault.getUserStats(userAddress);
console.log({
  xp: stats.userXP,
  level: stats.userLevel,
  bountiesEarned: ethers.formatUnits(stats.bountiesEarned, 6),
  shares: ethers.formatUnits(stats.userShares, 18),
  longExposure: ethers.formatUnits(stats.userLongExposure, 6),
  shortExposure: ethers.formatUnits(stats.userShortExposure, 6)
});

// Check liquidation risk
const [atRisk, buffer] = await vault.checkLiquidationRisk();
console.log({ atRisk, bufferPercent: buffer });
Events to Listen
javascript
// Deposit/Withdraw events
vault.on("Deposited", (user, assets, shares) => {});
vault.on("Withdrawn", (user, assets, shares) => {});

// Yield events
vault.on("Harvest", (caller, yield, bounty, newTVL) => {});

// Risk events
vault.on("ShieldScoreUpdated", (score, funding, delta, oracle, drawdown) => {});
vault.on("VaultPaused", (status) => {});
vault.on("EmergencyModeChanged", (status) => {});

// Bounty events
vault.on("Rebalance", (caller, bounty, oldDelta, newDelta) => {});
vault.on("EmergencyDeleverage", (caller, bounty, oldLong, oldShort) => {});
vault.on("ThreatReported", (reporter, description, bounty) => {});
📊 Strategy Document
For the complete strategy, game plan, and hackathon submission details, refer to:

Strategy Document: Included in the hackathon submission package

Pitch Deck: One-pager for judges

Demo Script: 7-step demonstration flow

Key Strategy Points
Innovation: First delta-neutral yield vault built specifically for Pacifica

Technical Excellence: Full ERC-4626 compliance, bounty-driven automation, real-time risk scoring

User Experience: Simple deposit/withdraw, visual shield gauge, live funding rate chart

Security: Multi-layer protection with circuit breakers and emergency paths

Composability: ERC-4626 standard enables integration with any DeFi protocol

🔧 Troubleshooting
Common Issues
Issue	Solution
"PerpShield: Zero amount"	Ensure deposit/withdraw amount > 0
"PerpShield: Cooldown active"	Wait 60 seconds between harvests
"PerpShield: Block deposit limit exceeded"	Reduce deposit amount or wait for next block
"PerpShield: Reward pool empty"	Owner needs to call fundThreatRewardPool
"Ownable: caller is not the owner"	Only owner can call admin functions
Deployment Failures
Invalid addresses: Ensure all constructor addresses are non-zero

Insufficient balance: Deployer needs ETH for gas

Network mismatch: Verify network configuration in hardhat.config.js

📝 License
MIT License - See LICENSE file for details

👥 Authors
Mustak Aalam - Web3 Developer · AI + DeFi Builder

🙏 Acknowledgments
Pacifica: Perpetual exchange and oracle infrastructure

OpenZeppelin: Secure contract libraries

SSV (HashKey): UI/UX inspiration and gamification system

EGV (BNB Chain): Bounty-driven automation concepts

🔗 Links
Documentation: [Coming Soon]

GitHub: [Repository URL]

Demo: [Live Demo URL]

Hackathon: Pacifica Hackathon 2026

🔥 PerpShield — DeFi that doesn't wait, it earns.
