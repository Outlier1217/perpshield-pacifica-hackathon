const { ethers } = require("hardhat");

async function main() {
  const [user] = await ethers.getSigners();

  const vaultAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const vault = await ethers.getContractAt("PerpShieldVault", vaultAddress);

  await vault.withdraw(ethers.parseUnits("50", 18));

  console.log("Withdraw successful 💸");
}

main();