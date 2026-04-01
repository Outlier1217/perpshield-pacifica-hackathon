const { ethers } = require("hardhat");

async function main() {
  const [user] = await ethers.getSigners();

  const usdcAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const vaultAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
  const vault = await ethers.getContractAt("PerpShieldVault", vaultAddress);

  // Approve
  await usdc.approve(vaultAddress, ethers.parseUnits("100", 18));

  // Deposit
  await vault.deposit(ethers.parseUnits("100", 18));

  console.log("Deposit successful 🚀");
}

main();