// app/hooks/usePerpShield.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { IDL, PROGRAM_ID } from '../idl/perp_shield';

export interface VaultData {
  asset: string;
  totalAssets: number;
  longPosition: number;
  shortPosition: number;
  fundingAccrued: number;
  harvestBounty: number;
  rebalanceBounty: number;
  deleverageBounty: number;
  shieldScore: number;
  isPaused: boolean;
  peakAssets: number;
  lastRebalance: Date;
  lastHarvest: Date;
  lastOracleTimestamp: Date;
}

export function usePerpShield() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [program, setProgram] = useState<Program | null>(null);
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [userStats, setUserStats] = useState<{ xp: number; level: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const vaultPda = new PublicKey("BY6ZZuf2WSzf3cA1mCcGxunGAoW1bXoHfFZXr3kEoK3b");
  const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

  // Initialize program - FIXED
  useEffect(() => {
    if (!wallet.publicKey || !connection) {
      setProgram(null);
      return;
    }

    try {
      // Create provider correctly
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        AnchorProvider.defaultOptions()
      );
      
      // Create program instance
      const program = new Program(IDL as any, PROGRAM_ID, provider);
      setProgram(program);
      console.log("Program initialized successfully");
    } catch (error) {
      console.error("Error initializing program:", error);
    }
  }, [connection, wallet]);

  // Fetch vault data
  const fetchVaultData = useCallback(async () => {
    if (!program) return;

    try {
      const vaultAccount = await (program.account as any).vault.fetch(vaultPda);
      setVaultData({
        asset: vaultAccount.asset.toString(),
        totalAssets: Number(vaultAccount.totalAssets),
        longPosition: Number(vaultAccount.longPosition),
        shortPosition: Number(vaultAccount.shortPosition),
        fundingAccrued: Number(vaultAccount.fundingAccrued),
        harvestBounty: vaultAccount.harvestBounty,
        rebalanceBounty: vaultAccount.rebalanceBounty,
        deleverageBounty: vaultAccount.deleverageBounty,
        shieldScore: vaultAccount.shieldScore,
        isPaused: vaultAccount.isPaused,
        peakAssets: Number(vaultAccount.peakAssets),
        lastRebalance: new Date(Number(vaultAccount.lastRebalance) * 1000),
        lastHarvest: new Date(Number(vaultAccount.lastHarvest) * 1000),
        lastOracleTimestamp: new Date(Number(vaultAccount.lastOracleTimestamp) * 1000),
      });
    } catch (error) {
      console.error("Error fetching vault:", error);
    } finally {
      setLoading(false);
    }
  }, [program]);

  // Fetch user stats
  const fetchUserStats = useCallback(async () => {
    if (!program || !wallet.publicKey) return;

    try {
      const [userStatsPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), wallet.publicKey.toBuffer()],
        program.programId
      );
      const stats = await (program.account as any).userStats.fetch(userStatsPda);
      setUserStats({
        xp: Number(stats.xp),
        level: stats.level,
      });
    } catch (error) {
      console.log("User stats not found");
    }
  }, [program, wallet.publicKey]);

  useEffect(() => {
    if (program) {
      fetchVaultData();
      fetchUserStats();
    }
  }, [program, fetchVaultData, fetchUserStats]);

  // Deposit
  const deposit = async (amount: number) => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const userTokenAccount = await getAssociatedTokenAddress(usdcMint, wallet.publicKey);
    const vaultTokenAccount = await getAssociatedTokenAddress(usdcMint, vaultPda);
    const [userStatsPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), wallet.publicKey.toBuffer()],
      program.programId
    );
    const vaultMint = await getAssociatedTokenAddress(usdcMint, vaultPda);
    const userVaultTokenAccount = await getAssociatedTokenAddress(vaultMint, wallet.publicKey);

    const tx = await (program.methods as any)
      .deposit(new BN(amount))
      .accounts({
        vault: vaultPda,
        user: wallet.publicKey,
        userTokenAccount,
        vaultTokenAccount,
        vaultMint,
        userVaultTokenAccount,
        userStats: userStatsPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const signature = await (program.provider as any).sendTransaction(tx, [wallet.publicKey]);
    await fetchVaultData();
    await fetchUserStats();
    return signature;
  };

  // Withdraw
  const withdraw = async (shares: number) => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const userTokenAccount = await getAssociatedTokenAddress(usdcMint, wallet.publicKey);
    const vaultTokenAccount = await getAssociatedTokenAddress(usdcMint, vaultPda);
    const vaultMint = await getAssociatedTokenAddress(usdcMint, vaultPda);
    const userVaultTokenAccount = await getAssociatedTokenAddress(vaultMint, wallet.publicKey);
    const [userStatsPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), wallet.publicKey.toBuffer()],
      program.programId
    );

    const tx = await (program.methods as any)
      .withdraw(new BN(shares))
      .accounts({
        vault: vaultPda,
        user: wallet.publicKey,
        userTokenAccount,
        vaultTokenAccount,
        vaultMint,
        userVaultTokenAccount,
        userStats: userStatsPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    const signature = await (program.provider as any).sendTransaction(tx, [wallet.publicKey]);
    await fetchVaultData();
    await fetchUserStats();
    return signature;
  };

  // Harvest
  const harvest = async () => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const callerTokenAccount = await getAssociatedTokenAddress(usdcMint, wallet.publicKey);
    const vaultTokenAccount = await getAssociatedTokenAddress(usdcMint, vaultPda);
    const [userStatsPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), wallet.publicKey.toBuffer()],
      program.programId
    );

    const tx = await (program.methods as any)
      .harvest()
      .accounts({
        vault: vaultPda,
        caller: wallet.publicKey,
        callerTokenAccount,
        vaultTokenAccount,
        userStats: userStatsPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    const signature = await (program.provider as any).sendTransaction(tx, [wallet.publicKey]);
    await fetchVaultData();
    await fetchUserStats();
    return signature;
  };

  // Update Shield Score
  const updateShieldScore = async (fundingMagnitude: number, oracleFreshness: number, drawdownPercent: number) => {
    if (!program) throw new Error("Program not initialized");

    const tx = await (program.methods as any)
      .updateShieldScore(new BN(fundingMagnitude), new BN(oracleFreshness), new BN(drawdownPercent))
      .accounts({ vault: vaultPda })
      .transaction();

    const signature = await (program.provider as any).sendTransaction(tx, []);
    await fetchVaultData();
    return signature;
  };

  return {
    program,
    vaultData,
    userStats,
    loading,
    deposit,
    withdraw,
    harvest,
    updateShieldScore,
    refreshData: () => {
      fetchVaultData();
      fetchUserStats();
    },
  };
}