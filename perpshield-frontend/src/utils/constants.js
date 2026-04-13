// Deployed Addresses (localhost hardhat)
export const USDC_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const VAULT_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
export const PERP_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
export const ORACLE_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

// XP Level Configuration
export const LEVEL_CONFIG = [
  { xp: 0, label: "Initiate", mult: "1.00x", color: "#64748b" },
  { xp: 100, label: "Guardian", mult: "1.05x", color: "#38bdf8" },
  { xp: 500, label: "Sentinel", mult: "1.10x", color: "#10b981" },
  { xp: 2000, label: "Warden", mult: "1.15x", color: "#f59e0b" },
  { xp: 5000, label: "Archon", mult: "1.25x", color: "#a78bfa" },
  { xp: 10000, label: "Apex Shield", mult: "1.50x", color: "#f43f5e" },
];

// ABIs
export const USDC_ABI = [
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export const VAULT_ABI = [
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function harvest() external",
  "function rebalance() external",
  "function emergencyDeleverage() external",
  "function emergencyPause() external",
  "function resume() external",
  "function reportThreat(string description, bytes proof) external",
  "function fundThreatRewardPool(uint256 amount) external",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function pendingYield() view returns (int256)",
  "function shieldScore() view returns (uint256)",
  "function paused() view returns (bool)",
  "function emergencyMode() view returns (bool)",
  "function positionsOpen() view returns (bool)",
  "function totalBountiesPaid() view returns (uint256)",
  "function threatRewardPool() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function xp(address) view returns (uint256)",
  "function level(address) view returns (uint256)",
  "function totalBountiesEarned(address) view returns (uint256)",
  "function longPositionId() view returns (uint256)",
  "function shortPositionId() view returns (uint256)",
  "function peakAssets() view returns (uint256)",
  "function getVaultMetrics() view returns (uint256 tvl, uint256 longSize, uint256 shortSize, uint256 delta, uint256 currentShieldScore, bool isPaused, bool isEmergency, int256 fundingRate)",
  "function getUserStats(address) view returns (uint256 userXP, uint256 userLevel, uint256 bountiesEarned, uint256 userShares, uint256 userLongExposure, uint256 userShortExposure)",
];