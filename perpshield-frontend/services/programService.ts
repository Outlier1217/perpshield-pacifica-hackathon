'use client';

import { Program, AnchorProvider, Idl, BN } from '@project-serum/anchor';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token';
import { PROGRAM_ID, connection, findVaultPDA, findUserStatsPDA, getVaultMintAddress, USDC_MINT } from '../lib/solana';
import idl from '../lib/idl.json';

async function sendTx(wallet: any, tx: Transaction): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );
  
  return signature;
}

export class PerpShieldService {
  private program: Program;
  private wallet: any;

  constructor(wallet: any) {
    this.wallet = wallet;
    const provider = new AnchorProvider(
      connection,
      wallet,
      { commitment: 'confirmed', preflightCommitment: 'confirmed' }
    );
    this.program = new Program(idl as Idl, PROGRAM_ID, provider);
  }

  async getVault() {
    try {
      return await this.program.account.vault.fetch(await findVaultPDA());
    } catch (e) {
      console.error('getVault error:', e);
      return null;
    }
  }

  async getUserStats(userPubkey: PublicKey) {
    try {
      return await this.program.account.userStats.fetch(await findUserStatsPDA(userPubkey));
    } catch { 
      return null; 
    }
  }

  // ✅ CRITICAL FIX: Return REGULAR mint address, not PDA
  async getVaultMint(): Promise<PublicKey> {
    return getVaultMintAddress();
  }

  async initialize(): Promise<string> {
    if (!this.program || !this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const vaultPDA = await findVaultPDA();
    
    const tx = await this.program.methods
      .initialize(USDC_MINT)
      .accounts({
        vault: vaultPDA,
        authority: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    return await sendTx(this.wallet, tx);
  }

async deposit(amount: number) {
  const vaultPDA = await findVaultPDA();
  const vault = await this.getVault();
  if (!vault) throw new Error('Vault not initialized');

  const userUSDCAccount = await getAssociatedTokenAddress(USDC_MINT, this.wallet.publicKey);
  const vaultUSDCAccount = await getAssociatedTokenAddress(USDC_MINT, vaultPDA, true);
  
  const vaultMint = await this.getVaultMint();
  const userVaultTokenAccount = await getAssociatedTokenAddress(vaultMint, this.wallet.publicKey);
  const userStatsPDA = await findUserStatsPDA(this.wallet.publicKey);

  console.log("Vault Mint Address:", vaultMint.toString());
  
  // Check if mint exists
  const mintInfo = await connection.getAccountInfo(vaultMint);
  if (!mintInfo) {
    throw new Error('Vault mint not initialized. Please run initializeVaultMint first.');
  }

  // ✅ Create transaction
  const tx = new Transaction();
  
  // ✅ Step 1: Create user USDC ATA if needed
  const userUSDCAccountInfo = await connection.getAccountInfo(userUSDCAccount);
  if (!userUSDCAccountInfo) {
    console.log('Creating user USDC ATA...');
    tx.add(
      createAssociatedTokenAccountInstruction(
        this.wallet.publicKey, 
        userUSDCAccount, 
        this.wallet.publicKey, 
        USDC_MINT
      )
    );
  }

  // ✅ Step 2: Create user vault token ATA if needed
  const userVaultTokenAccountInfo = await connection.getAccountInfo(userVaultTokenAccount);
  if (!userVaultTokenAccountInfo) {
    console.log('Creating user vault token ATA at:', userVaultTokenAccount.toString());
    tx.add(
      createAssociatedTokenAccountInstruction(
        this.wallet.publicKey,
        userVaultTokenAccount,
        this.wallet.publicKey,
        vaultMint
      )
    );
  }

  const amountRaw = Math.floor(amount * 1_000_000);
  console.log(`Depositing ${amount} USDC (${amountRaw} raw)`);

  // ✅ Step 3: Get deposit instruction
  const depositIx = await this.program.methods
    .deposit(new BN(amountRaw))
    .accounts({
      vault: vaultPDA,
      user: this.wallet.publicKey,
      userTokenAccount: userUSDCAccount,
      vaultTokenAccount: vaultUSDCAccount,
      vaultMint: vaultMint,
      userVaultTokenAccount,
      userStats: userStatsPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  
  tx.add(depositIx);

  console.log("Total instructions in tx:", tx.instructions.length);
  
  // ✅ Send transaction with all instructions
  return await sendTx(this.wallet, tx);
}

  async withdraw(shares: number) {
    const vaultPDA = await findVaultPDA();
    const vault = await this.getVault();
    if (!vault) throw new Error('Vault not initialized');

    const vaultMint = await this.getVaultMint();  // ✅ Use regular mint address
    const userUSDCAccount = await getAssociatedTokenAddress(USDC_MINT, this.wallet.publicKey);
    const vaultUSDCAccount = await getAssociatedTokenAddress(USDC_MINT, vaultPDA, true);
    const userVaultTokenAccount = await getAssociatedTokenAddress(vaultMint, this.wallet.publicKey);
    const userStatsPDA = await findUserStatsPDA(this.wallet.publicKey);

    const tx = await this.program.methods
      .withdraw(new BN(Math.floor(shares * 1_000_000)))
      .accounts({
        vault: vaultPDA,
        user: this.wallet.publicKey,
        userTokenAccount: userUSDCAccount,
        vaultTokenAccount: vaultUSDCAccount,
        vaultMint,
        userVaultTokenAccount,
        userStats: userStatsPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    return await sendTx(this.wallet, tx);
  }

  async harvest() {
    const vaultPDA = await findVaultPDA();
    const vault = await this.getVault();
    if (!vault) throw new Error('Vault not initialized');

    const vaultUSDCAccount = await getAssociatedTokenAddress(USDC_MINT, vaultPDA, true);
    const callerUSDCAccount = await getAssociatedTokenAddress(USDC_MINT, this.wallet.publicKey);
    const userStatsPDA = await findUserStatsPDA(this.wallet.publicKey);

    const tx = await this.program.methods
      .harvest()
      .accounts({
        vault: vaultPDA,
        caller: this.wallet.publicKey,
        callerTokenAccount: callerUSDCAccount,
        vaultTokenAccount: vaultUSDCAccount,
        userStats: userStatsPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    return await sendTx(this.wallet, tx);
  }

  async updateShieldScore(fundingMagnitude: number, oracleFreshnessSecs: number, drawdownPercent: number) {
    const vaultPDA = await findVaultPDA();
    
    const tx = await this.program.methods
      .updateShieldScore(
        new BN(fundingMagnitude),
        new BN(oracleFreshnessSecs),
        new BN(drawdownPercent)
      )
      .accounts({
        vault: vaultPDA,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    return await sendTx(this.wallet, tx);
  }

  async emergencyDeleverage() {
    const vaultPDA = await findVaultPDA();
    const vault = await this.getVault();
    if (!vault) throw new Error('Vault not initialized');

    const vaultUSDCAccount = await getAssociatedTokenAddress(USDC_MINT, vaultPDA, true);
    const callerUSDCAccount = await getAssociatedTokenAddress(USDC_MINT, this.wallet.publicKey);
    const userStatsPDA = await findUserStatsPDA(this.wallet.publicKey);

    const tx = await this.program.methods
      .emergencyDeleverage()
      .accounts({
        vault: vaultPDA,
        caller: this.wallet.publicKey,
        callerTokenAccount: callerUSDCAccount,
        vaultTokenAccount: vaultUSDCAccount,
        userStats: userStatsPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    return await sendTx(this.wallet, tx);
  }
}