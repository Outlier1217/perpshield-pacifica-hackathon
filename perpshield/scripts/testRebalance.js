const { ethers } = require("hardhat");

async function main() {
  const vaultAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const vault = await ethers.getContractAt("PerpShieldVault", vaultAddress);

  await vault.rebalance();

  console.log("Rebalance successful 🔄");
}

main();