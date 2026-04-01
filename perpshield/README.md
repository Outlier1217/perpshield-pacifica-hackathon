# PerpShield Vault

**Delta-Neutral Yield Vault on Pacifica Perpetuals**

PerpShield is an ERC-4626 compliant vault that generates passive yield by executing automated delta-neutral strategies on perpetual markets. It captures funding rates while maintaining balanced exposure and built-in risk protection.

---

## 🚀 Key Features

- **ERC-4626 Standard** – Composable and DeFi-ready vault  
- **Delta-Neutral Strategy** – 50% long / 50% short exposure  
- **Automated Yield Farming** – Funding rate capture  
- **Bounty-Driven Automation** – No keeper bots required  
- **Real-Time Risk System** – ShieldScore (0–100) with circuit breakers  
- **Emergency Safeguards** – Auto-pause & deleveraging  
- **Gamification** – XP, levels, and bounty multipliers  

---

## ⚙️ How It Works

1. Users deposit USDC  
2. Vault opens a delta-neutral position  
3. Funding rates generate yield  
4. Anyone can trigger:
   - `harvest()` → collect yield  
   - `rebalance()` → maintain neutrality  
5. Risk system continuously monitors safety  

---

## 🛡 Risk Management

- **ShieldScore System** (real-time risk metric)  
- Auto-pause below critical thresholds  
- Emergency deleverage for extreme conditions  
- Always-available withdrawals  

---

## 📦 Contracts

- `PerpShieldVault.sol` – Main ERC-4626 vault  
- `MockUSDC.sol` – Test token (6 decimals)  

---

## 🚀 Deployment

```bash
npm install
npx hardhat run scripts/deploy.js --network <network>

🧪 Testing
npx hardhat test

👤 Author

Mustak Aalam
Web3 Developer · AI + DeFi Builder

