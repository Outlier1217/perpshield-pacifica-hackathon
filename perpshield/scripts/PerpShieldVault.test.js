const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PerpShieldVault", function () {
  let vault;
  let owner;
  let user1;
  let user2;
  
  // Mock addresses for testing
  const mockUSDC = "0x0000000000000000000000000000000000000001";
  const mockPacificaPerp = "0x0000000000000000000000000000000000000002";
  const mockPacificaOracle = "0x0000000000000000000000000000000000000003";
  const mockBNBMarket = "0x0000000000000000000000000000000000000004";

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const Vault = await ethers.getContractFactory("PerpShieldVault");
    vault = await Vault.deploy(
      mockUSDC,
      mockPacificaPerp,
      mockPacificaOracle,
      mockBNBMarket
    );
    await vault.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await vault.name()).to.equal("PerpShield Yield Vault");
      expect(await vault.symbol()).to.equal("pshUSDC");
    });

    it("Should initialize with zero assets", async function () {
      expect(await vault.totalAssets()).to.equal(0);
      expect(await vault.shieldScore()).to.equal(100);
    });

    it("Should set the correct owner", async function () {
      expect(await vault.owner()).to.equal(owner.address);
    });
  });

  describe("Deposits", function () {
    it("Should revert with zero amount", async function () {
      await expect(
        vault.connect(user1).deposit(0, user1.address)
      ).to.be.revertedWith("PerpShield: Invalid amount");
    });

    it("Should revert when paused", async function () {
      await vault.connect(owner).emergencyPause();
      await expect(
        vault.connect(user1).deposit(100, user1.address)
      ).to.be.revertedWith("PerpShield: Vault paused");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to pause", async function () {
      await vault.connect(owner).emergencyPause();
      expect(await vault.paused()).to.equal(true);
    });

    it("Should allow owner to resume", async function () {
      await vault.connect(owner).emergencyPause();
      await vault.connect(owner).resume();
      expect(await vault.paused()).to.equal(false);
      expect(await vault.emergencyMode()).to.equal(false);
    });
  });
});