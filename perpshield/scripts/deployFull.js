const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with:", deployer.address);

  // Deploy Mock USDC
  const USDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDC.deploy();
  await usdc.waitForDeployment();

  console.log("USDC deployed at:", usdc.target);

  // Deploy Vault
  const Vault = await ethers.getContractFactory("PerpShieldVault");
  const vault = await Vault.deploy(usdc.target);
  await vault.waitForDeployment();

  console.log("Vault deployed at:", vault.target);
}

main();