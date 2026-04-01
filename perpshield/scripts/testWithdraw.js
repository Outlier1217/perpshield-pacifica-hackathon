const { ethers } = require("hardhat");

async function main() {
  const [user] = await ethers.getSigners();

  const vaultAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  const vault = await ethers.getContractAt("PerpShieldVault", vaultAddress);

  await vault.withdraw(ethers.parseUnits("50", 18));

  console.log("Withdraw successful 💸");
}

main();