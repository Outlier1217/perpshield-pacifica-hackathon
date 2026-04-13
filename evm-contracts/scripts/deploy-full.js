// scripts/deploy-full.js
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("Starting deployment to localhost...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const network = await ethers.provider.getNetwork();
  console.log("Network Chain ID:", network.chainId);
  console.log("\n");

  // =============================================
  // STEP 1: Deploy MockUSDC
  // =============================================
  console.log("📝 Step 1: Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log("✅ MockUSDC deployed at:", usdcAddress);
  
  // Mint some USDC to deployer for testing
  const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
  await mockUSDC.mint(deployer.address, mintAmount);
  console.log("💰 Minted 10,000 USDC to deployer");
  
  // =============================================
  // STEP 2: Deploy Mock Pacifica Contracts
  // =============================================
  console.log("\n📝 Step 2: Deploying Mock Pacifica contracts...");
  
  const MockPacificaPerp = await ethers.getContractFactory("MockPacificaPerp");
  const mockPerp = await MockPacificaPerp.deploy();
  await mockPerp.waitForDeployment();
  const perpAddress = await mockPerp.getAddress();
  console.log("✅ MockPacificaPerp deployed at:", perpAddress);
  
  const MockPacificaOracle = await ethers.getContractFactory("MockPacificaOracle");
  const mockOracle = await MockPacificaOracle.deploy();
  await mockOracle.waitForDeployment();
  const oracleAddress = await mockOracle.getAddress();
  console.log("✅ MockPacificaOracle deployed at:", oracleAddress);
  
  // Use a mock market address (can be any address)
  const bnbMarketAddress = "0x0000000000000000000000000000000000000004";
  
  // =============================================
  // STEP 3: Deploy PerpShieldVault
  // =============================================
  console.log("\n📝 Step 3: Deploying PerpShieldVault...");
  const Vault = await ethers.getContractFactory("PerpShieldVault");
  const vault = await Vault.deploy(
    usdcAddress,
    perpAddress,      // ✅ Use actual deployed mock
    oracleAddress,    // ✅ Use actual deployed mock
    bnbMarketAddress
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ PerpShieldVault deployed at:", vaultAddress);
  
  // =============================================
  // STEP 4: Display contract info
  // =============================================
  console.log("\n📊 Contract Information:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("MockUSDC:", usdcAddress);
  console.log("MockPacificaPerp:", perpAddress);
  console.log("MockPacificaOracle:", oracleAddress);
  console.log("PerpShieldVault:", vaultAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const name = await vault.name();
  const symbol = await vault.symbol();
  const totalAssets = await vault.totalAssets();
  const shieldScore = await vault.shieldScore();
  const paused = await vault.paused();
  const emergencyMode = await vault.emergencyMode();
  
  console.log("\n📊 Vault Info:");
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Total Assets:", totalAssets.toString());
  console.log("Shield Score:", shieldScore.toString());
  console.log("Paused:", paused);
  console.log("Emergency Mode:", emergencyMode);
  
  // =============================================
  // STEP 5: Save deployment info
  // =============================================
  const deploymentInfo = {
    network: "localhost",
    timestamp: new Date().toISOString(),
    chainId: network.chainId.toString(),
    contracts: {
      mockUSDC: usdcAddress,
      mockPacificaPerp: perpAddress,
      mockPacificaOracle: oracleAddress,
      perpShieldVault: vaultAddress
    },
    deployer: deployer.address
  };
  
  fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📁 Deployment info saved to deployment.json");
  console.log("\n🎉 Deployment successful!");
  console.log("\n📝 Update your frontend App.jsx with these addresses:");
  console.log(`const usdcAddress = "${usdcAddress}";`);
  console.log(`const vaultAddress = "${vaultAddress}";`);
  console.log(`\n✅ Now your deposit should work!`);
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:");
  console.error(error);
  process.exitCode = 1;
});