const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment to localhost...");
  
  // Get signers (works with localhost network)
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network Chain ID:", network.chainId);

  // For testing on local network, we'll use mock addresses
  const mockUSDC = "0x0000000000000000000000000000000000000001";
  const mockPacificaPerp = "0x0000000000000000000000000000000000000002";
  const mockPacificaOracle = "0x0000000000000000000000000000000000000003";
  const mockBNBMarket = "0x0000000000000000000000000000000000000004";

  console.log("\n📝 Deploying PerpShieldVault...");
  console.log("Asset (USDC):", mockUSDC);
  console.log("Pacifica Perp:", mockPacificaPerp);
  console.log("Pacifica Oracle:", mockPacificaOracle);
  console.log("BNB Market:", mockBNBMarket);

  const Vault = await ethers.getContractFactory("PerpShieldVault");
  const vault = await Vault.deploy(
    mockUSDC,
    mockPacificaPerp,
    mockPacificaOracle,
    mockBNBMarket
  );

  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("\n✅ PerpShieldVault deployed at:", vaultAddress);
  
  // Get some basic info
  const name = await vault.name();
  const symbol = await vault.symbol();
  const totalAssets = await vault.totalAssets();
  const shieldScore = await vault.shieldScore();
  
  console.log("\n📊 Vault Info:");
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Total Assets:", totalAssets.toString());
  console.log("Shield Score:", shieldScore.toString());
  
  // Check if paused or emergency mode
  const paused = await vault.paused();
  const emergencyMode = await vault.emergencyMode();
  console.log("Paused:", paused);
  console.log("Emergency Mode:", emergencyMode);
  
  console.log("\n🎉 Deployment successful!");
  
  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: "localhost",
    vaultAddress: vaultAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    chainId: network.chainId.toString()
  };
  
  fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📁 Deployment info saved to deployment.json");
  
  // Optional: Try to interact with the contract
  console.log("\n🔍 Testing contract interaction...");
  try {
    const totalSupply = await vault.totalSupply();
    console.log("Total Supply:", totalSupply.toString());
    console.log("✅ Contract is working!");
  } catch (error) {
    console.log("⚠️ Could not read totalSupply, but deployment was successful");
  }
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:");
  console.error(error);
  process.exitCode = 1;
});