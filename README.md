# 🛡️ PerpShield — Intelligent Risk Management for Perpetual DEXs

> **Built for the Pacifica Hackathon 2026 · Track: DeFi Composability**

PerpShield is an on-chain risk management vault built on Solana that protects liquidity providers on perpetual DEXs from adverse market conditions. It uses a composite **ShieldScore** — a real-time health metric derived from funding rates, delta neutrality, oracle freshness, and drawdown — to autonomously pause activity, trigger rebalances, and incentivize community-driven risk actions through a bounty system.

---

## 🔗 Deployed Program

| Network | Program ID |
|---------|-----------|
| Devnet  | `FoQZVguRJUchiQZba72Z1RzSaD7NWTvnAj8V3NahYvFo` |

**Vault PDA:** `BY6ZZuf2WSzf3cA1mCcGxunGAoW1bXoHfFZXr3kEoK3b`

[View on Solana Explorer →](https://explorer.solana.com/tx/4ooiRNtBsLLed9RgQxYZbhSkgcK5QP24dHN7CYXrs1qktnuehWty4rXL68AiSFFZCa1hpxsJWtuLf76VXYw2WXyB?cluster=devnet)

---

## 🧠 Core Concept

Active liquidity management on perpetuals is dangerous without automated safeguards. Volatile funding rates, delta drift, and stale oracle prices can erode LP positions rapidly. PerpShield addresses this with:

1. **ShieldScore** — A 0–100 composite health score calculated on-chain every update cycle.
2. **Circuit Breaker** — Automatically pauses deposits when ShieldScore < 30; resumes at ≥ 40.
3. **Bounty System** — Any user can trigger rebalancing, harvesting, or emergency deleveraging and earn on-chain rewards for doing so.
4. **XP & Leveling** — Gamified incentive layer that rewards every protocol interaction.

---

## ⚙️ How ShieldScore Works

The ShieldScore is computed from four weighted components:

| Component | Weight | Description |
|-----------|--------|-------------|
| Funding Magnitude | 30% | Derived from Pacifica live funding rate — lower funding = healthier |
| Delta Neutrality | 25% | How balanced long vs. short exposure is, as % of TVL |
| Oracle Freshness | 25% | Recency of last oracle update (staleness degrades score) |
| Drawdown Health | 20% | Current drawdown from peak TVL |

```
ShieldScore = (funding_health × 30/100)
            + (delta_health  × 25/100)
            + (oracle_health × 25/100)
            + (drawdown_health × 20/100)
```

ShieldScore is updated by calling `update_shield_score` with fresh Pacifica oracle data. The frontend fetches this data automatically via the Pacifica API every 15 seconds.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│   Wallet Adapter · Anchor Client · Pacifica API Feed    │
└────────────────────────┬────────────────────────────────┘
                         │ RPC (Devnet)
┌────────────────────────▼────────────────────────────────┐
│              PerpShield Program (Anchor / Rust)          │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐   │
│  │  Vault   │  │UserStats │  │   ShieldScore Logic  │   │
│  │  (PDA)   │  │  (PDA)   │  │   Circuit Breaker    │   │
│  └──────────┘  └──────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│               Pacifica API (Oracle + Funding)            │
│       test-api.pacifica.fi  ·  api.pacifica.fi           │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Program Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize` | Sets up the vault PDA with default bounties and ShieldScore of 80 |
| `deposit` | Deposits USDC, mints proportional share tokens, awards 10 XP |
| `withdraw` | Burns shares, returns proportional USDC, awards 5 XP |
| `harvest` | Collects accrued funding fees with a 1% bounty, awards 25 XP |
| `rebalance` | Rebalances positions when delta drift > 5% of TVL, awards 20 XP |
| `emergency_deleverage` | Triggers full deleverage when ShieldScore < 15, pays 5% bounty, awards 30 XP |
| `update_shield_score` | Recalculates ShieldScore using Pacifica live data; triggers circuit breaker if needed |
| `threat_report` | Community threat submission for 30 XP |

---

## 🔐 Security Features

- **BountyFlashGuard** — Deposits capped at 10% of current TVL per transaction to prevent flash-loan manipulation.
- **Circuit Breaker** — Vault auto-pauses when ShieldScore < 30, protecting users from depositing into deteriorating conditions.
- **Harvest Cooldown** — 60-second cooldown between harvest calls to prevent griefing.
- **Oracle Freshness Check** — Oracle data older than 300 seconds degrades the ShieldScore, creating automated pressure to keep it fresh.
- **PDA Authority** — All vault token transfers are signed by the vault PDA; no admin key has direct access to funds.
- **Checked Arithmetic** — All math uses `checked_mul`, `checked_div`, and `saturating_*` to prevent overflow.

---

## 💰 Bounty System

| Action | Bounty | Who Can Call |
|--------|--------|--------------|
| Harvest Funding | 1% of funding accrued | Anyone |
| Rebalance Positions | 0.5% of TVL | Anyone (when drift > 5%) |
| Emergency Deleverage | 5% of TVL | Anyone (when ShieldScore < 15) |

The bounty model turns vault maintenance into a permissionless keeper network — anyone can earn by keeping the vault healthy.

---

## 🎮 XP & Leveling System

| Action | XP Earned |
|--------|-----------|
| Deposit | +10 XP |
| Withdraw | +5 XP |
| Harvest | +25 XP |
| Rebalance | +20 XP |
| Emergency Deleverage | +30 XP |
| Threat Report | +30 XP |

Level = `floor(total_xp / 100) + 1`. Level progress is displayed on the dashboard.

---

## 🌐 Pacifica Integration

PerpShield uses the Pacifica API to source real-time market data for ShieldScore computation.

**Endpoints used:**
- `GET https://test-api.pacifica.fi/api/v1/prices` — funding rate + oracle price
- `GET https://test-api.pacifica.fi/api/v1/market_info` — market data fallback
- `GET https://api.pacifica.fi/api/v1/prices` — mainnet fallback

**Data flow:**
1. `PacificaService` polls the API every 15 seconds.
2. Funding rate is converted to a 0–100 magnitude score (`fundingMagnitude`).
3. The frontend calls `update_shield_score` on-chain with this data.
4. ShieldScore updates and the circuit breaker fires if needed.

If the API is unreachable, the service gracefully falls back to simulated data (clearly flagged in the UI as `⚠️ Simulated`).

---

## 🖥️ Frontend

Built with **Next.js + TypeScript** using the Solana Wallet Adapter and `@project-serum/anchor`.

**Key features:**
- Live Pacifica data feed with animated indicator
- ShieldScore ring with color-coded status (green / yellow / red)
- One-click vault mint initialization
- Deposit / Withdraw with real-time USDC balance display
- XP progress bar and level display
- Bounty action panel (Harvest, Emergency Deleverage)
- SOL + USDC balance status banners
- Phantom and Solflare wallet support

---

## 🧪 Test Results

All 5 tests passing on Devnet:

```
✅ 1. Initialize Vault           (1179ms)
✅ 2. Update ShieldScore — Healthy State     Score: 89/100
✅ 3. Update ShieldScore — Circuit Breaker   Score: 32/100
✅ 4. Update ShieldScore — Recovery          Score: 95/100
✅ 5. Final Summary
```

**Final vault state after tests:**

```
Shield Score   : 95/100
Vault Paused   : false
Harvest Bounty : 100 bps (1%)
Rebalance Bounty: 50 bps (0.5%)
Deleverage Bounty: 500 bps (5%)
Contract Status: ✅ DEVNET READY
```

---

## 🛠️ Local Setup

### Prerequisites

- Node.js ≥ 18
- Rust + Solana CLI
- Anchor CLI (`cargo install --git https://github.com/coral-xyz/anchor anchor-cli`)

### Build & Deploy

```bash
# Clone the repo
git clone https://github.com/Outlier1217/perpshield-pacifica-hackathon
cd perpshield-pacifica-hackathon

# Build the Anchor program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run tests
anchor test
```

### Frontend

```bash
cd perpshield-frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your Phantom or Solflare wallet (Devnet).

> **Note:** You will need devnet USDC. Use the "Setup USDC Account" button in the UI, then airdrop tokens from a devnet faucet.

---

## 🗺️ Roadmap

- [ ] Create USDC ATAs for vault and test users
- [ ] Initialize `vault_mint` (share token) via program instruction
- [ ] Connect Pacifica API for live oracle data (in progress)
- [ ] Integrate frontend with Wallet Adapter (complete)
- [ ] Deploy final version to devnet and submit
- [ ] Pacifica mainnet integration
- [ ] Multi-asset vault support (ETH-PERP, SOL-PERP)
- [ ] Keeper bot for automated rebalancing
- [ ] On-chain governance for bounty parameters

---

## 📁 Project Structure

```
perpshield/
├── programs/
│   └── perp_shield/
│       └── src/
│           └── lib.rs          # Main Anchor program
├── tests/
│   ├── client.ts               # Setup & vault inspection
│   └── anchor.test.ts          # Full test suite
└── frontend/
    ├── app/
    │   └── page.tsx            # Main dashboard
    ├── services/
    │   ├── programService.ts   # Anchor client wrapper
    │   └── pacificaService.ts  # Pacifica API integration
    └── lib/
        ├── solana.ts           # Connection & PDA helpers
        └── idl.json            # Program IDL
```

---

## 👥 Team

Built solo for the **Pacifica Hackathon 2026** · DeFi Composability Track

---

## 📄 License

MIT