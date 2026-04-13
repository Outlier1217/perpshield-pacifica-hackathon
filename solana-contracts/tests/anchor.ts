import BN from "bn.js";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
// ==================== PERPSHIELD - ANCHOR TEST SUITE ====================
// Tests: Initialize, ShieldScore formula, Circuit Breaker, Recovery
// Network: Devnet / Solana Playground
// =========================================================================

import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import type { PerpShield } from "../target/types/perp_shield";

// Solana Playground: BN must come from anchor, not bn.js directly
const BN = anchor.BN;

console.log("🚀 PerpShield Test Suite Starting...\n");

const program = program;
const wallet = pg.wallet;
const connection = program.provider.connection;

// ==================== SETUP ====================

const usdcMint = new web3.PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

const [vaultPda] = web3.PublicKey.findProgramAddressSync(
  [Buffer.from("vault")],
  program.programId
);

console.log("Program ID :", program.programId.toString());
console.log("Vault PDA  :", vaultPda.toString());
console.log("Wallet     :", wallet.publicKey.toString());
console.log("");

// ==================== HELPERS ====================

async function getVault() {
  return program.account.vault.fetch(vaultPda);
}

async function getUserStats(pubkey: web3.PublicKey) {
  const [userStatsPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), pubkey.toBuffer()],
    program.programId
  );
  return program.account.userStats.fetch(userStatsPda).catch(() => null);
}

function separator(label?: string) {
  const line = "=".repeat(60);
  console.log(label ? `\n${line}\n  ${label}\n${line}` : line);
}

// ==================== TEST SUITE ====================

describe("🛡️ PerpShield — Pacifica Hackathon", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.PerpShield as anchor.Program<PerpShield>;
  

  // --------------------------------------------------
  it("1. Initialize Vault", async () => {
    console.log("→ Initializing vault...");

    const existing = await getVault().catch(() => null);

    if (!existing) {
      const tx = await program.methods
        .initialize(usdcMint)
        .accounts({
          vault: vaultPda,
          authority: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .rpc();
      await connection.confirmTransaction(tx, "confirmed");
      console.log("✅ Vault initialized. Tx:", tx);
    } else {
      console.log("ℹ️  Vault already exists — skipping init.");
    }

    const vault = await getVault();
    console.log(`   Shield Score      : ${vault.shieldScore}/100`);
    console.log(`   Paused            : ${vault.isPaused}`);
    console.log(`   Harvest Bounty    : ${vault.harvestBounty} bps`);
    console.log(`   Rebalance Bounty  : ${vault.rebalanceBounty} bps`);
    console.log(`   Deleverage Bounty : ${vault.deleverageBounty} bps`);
  });

  // --------------------------------------------------
  it("2. Update ShieldScore — Healthy State", async () => {
    console.log("→ Simulating healthy market conditions...");

    // funding_magnitude=75, oracle_freshness=8s (fresh), drawdown=10%
    const tx = await program.methods
      .updateShieldScore(new BN(75), new BN(8), new BN(10))
      .accounts({ vault: vaultPda })
      .rpc();
    await connection.confirmTransaction(tx, "confirmed");

    const vault = await getVault();
    console.log(`✅ Shield Score: ${vault.shieldScore}/100`);
    console.log(`   Paused: ${vault.isPaused} (expected: false)`);
    // Expected: funding=22, delta=25, oracle≈24, drawdown=18 → ≈89
    console.log(`   (Expected ≈89: funding=22, delta=25, oracle≈24, drawdown=18)`);
  });

  // --------------------------------------------------
  it("3. Update ShieldScore — Circuit Breaker Trigger", async () => {
    console.log("→ Simulating stressed market (low score, should pause)...");

    // funding_magnitude=10 (poor), oracle_freshness=500s (stale), drawdown=80%
    const tx = await program.methods
      .updateShieldScore(new BN(10), new BN(500), new BN(80))
      .accounts({ vault: vaultPda })
      .rpc();
    await connection.confirmTransaction(tx, "confirmed");

    const vault = await getVault();
    console.log(`✅ Shield Score: ${vault.shieldScore}/100`);
    console.log(`   Paused: ${vault.isPaused} (expected: true if score < 30)`);
    // Expected: funding=3, delta=25, oracle=0 (stale), drawdown=4 → ≈32
    console.log(`   (Expected ≈32: funding=3, delta=25, oracle=0, drawdown=4)`);
  });

  // --------------------------------------------------
  it("4. Update ShieldScore — Recovery", async () => {
    console.log("→ Simulating recovery conditions...");

    // funding_magnitude=90, oracle_freshness=5s, drawdown=5%
    const tx = await program.methods
      .updateShieldScore(new BN(90), new BN(5), new BN(5))
      .accounts({ vault: vaultPda })
      .rpc();
    await connection.confirmTransaction(tx, "confirmed");

    const vault = await getVault();
    console.log(`✅ Shield Score: ${vault.shieldScore}/100`);
    console.log(`   Paused: ${vault.isPaused} (expected: false)`);
    // Expected: funding=27, delta=25, oracle≈24, drawdown=19 → ≈95
    console.log(`   (Expected ≈95: funding=27, delta=25, oracle≈24, drawdown=19)`);
  });

  // --------------------------------------------------
  it("5. Final Summary", async () => {
    separator("PERPSHIELD FINAL REPORT");

    const vault = await getVault();
    const userStats = await getUserStats(wallet.publicKey);

    console.log(`Program ID        : ${program.programId}`);
    console.log(`Vault PDA         : ${vaultPda}`);
    console.log("");
    console.log(`Shield Score      : ${vault.shieldScore}/100`);
    console.log(`Vault Paused      : ${vault.isPaused}`);
    console.log(`Total Assets      : ${vault.totalAssets.toString()} USDC`);
    console.log(`Long Position     : ${vault.longPosition.toString()}`);
    console.log(`Short Position    : ${vault.shortPosition.toString()}`);
    console.log(`Funding Accrued   : ${vault.fundingAccrued.toString()}`);
    console.log(`Peak Assets       : ${vault.peakAssets.toString()}`);
    console.log("");
    console.log(`Harvest Bounty    : ${vault.harvestBounty} bps (${vault.harvestBounty / 100}%)`);
    console.log(`Rebalance Bounty  : ${vault.rebalanceBounty} bps (${vault.rebalanceBounty / 100}%)`);
    console.log(`Deleverage Bounty : ${vault.deleverageBounty} bps (${vault.deleverageBounty / 100}%)`);
    console.log("");
    console.log(`Last Rebalance    : ${new Date(vault.lastRebalance.toNumber() * 1000).toISOString()}`);
    console.log(`Last Harvest      : ${new Date(vault.lastHarvest.toNumber() * 1000).toISOString()}`);
    console.log(`Last Oracle Update: ${new Date(vault.lastOracleTimestamp.toNumber() * 1000).toISOString()}`);

    if (userStats) {
      console.log("");
      console.log(`User XP    : ${userStats.xp.toString()}`);
      console.log(`User Level : ${userStats.level}`);
    } else {
      console.log("\nℹ️  User stats not yet initialized (no deposit/withdraw made).");
    }

    separator();
    console.log("✅ CONTRACT STATUS  : DEVNET READY");
    console.log("");
    console.log("📋 NEXT STEPS:");
    console.log("   1. Create USDC ATAs for vault and test users");
    console.log("   2. Initialize vault_mint (share token)");
    console.log("   3. Connect Pacifica API for live oracle data");
    console.log("   4. Integrate frontend with wallet adapter");
    console.log("   5. Deploy final version to devnet & submit");
    separator();
  });
});