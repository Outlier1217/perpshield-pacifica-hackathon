const { ethers } = require("hardhat");

async function main() {
  const [user] = await ethers.getSigners();

  const vaultAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const vault = await ethers.getContractAt("PerpShieldVault", vaultAddress);

  // Add fake yield
  await vault.mockAddYield(ethers.parseUnits("20", 18));

  // Harvest
  await vault.harvest();

  console.log("Harvest successful 🌾");
}

main();