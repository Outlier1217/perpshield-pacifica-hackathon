const { ethers } = require("hardhat");

async function main() {
  const [user] = await ethers.getSigners();

  const usdcAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const vaultAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
  const vault = await ethers.getContractAt("PerpShieldVault", vaultAddress);

  // Approve
  await usdc.approve(vaultAddress, ethers.parseUnits("100", 18));

  // Deposit
  await vault.deposit(ethers.parseUnits("100", 18));

  console.log("Deposit successful 🚀");
}

main();