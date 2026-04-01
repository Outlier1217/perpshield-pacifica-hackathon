const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with:", deployer.address);

  // Dummy USDC address (abhi mock use kar rahe hain)
  const usdc = "0x0000000000000000000000000000000000000001";

  const Vault = await ethers.getContractFactory("PerpShieldVault");
  const vault = await Vault.deploy(usdc);

  await vault.waitForDeployment();

  console.log("PerpShieldVault deployed at:", vault.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});