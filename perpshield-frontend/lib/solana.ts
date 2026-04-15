import { Connection, PublicKey, clusterApiUrl, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Idl } from '@project-serum/anchor';
import idl from './idl.json';

// Your deployed program ID
export const PROGRAM_ID = new PublicKey('FoQZVguRJUchiQZba72Z1RzSaD7NWTvnAj8V3NahYvFo');

// Devnet USDC mint (this is the official Solana devnet USDC)
// export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
// lib/solana.ts
// export const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // Devnet USDC
export const USDC_MINT = new PublicKey('USDPqRbLidFGufty2s3oizmDEKdqx7ePTqzDMbf5ZKM'); // Devnet USDC

// Devnet connection
export const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// PDA Seeds
export async function findVaultPDA(): Promise<PublicKey> {
  const [pda] = await PublicKey.findProgramAddress(
    [Buffer.from('vault')],
    PROGRAM_ID
  );
  return pda;
}

export async function findUserStatsPDA(user: PublicKey): Promise<PublicKey> {
  const [pda] = await PublicKey.findProgramAddress(
    [Buffer.from('user_stats'), user.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

// FIX: Use regular keypair for mint, not PDA
let cachedMintKeypair: Keypair | null = null;

export function getVaultMintKeypair(): Keypair {
  if (cachedMintKeypair) return cachedMintKeypair;
  
  // Load from localStorage
  const stored = localStorage.getItem('vault_mint_keypair');
  if (stored) {
    const secret = Uint8Array.from(JSON.parse(stored));
    cachedMintKeypair = Keypair.fromSecretKey(secret);
    return cachedMintKeypair;
  }
  
  // Create new keypair
  cachedMintKeypair = Keypair.generate();
  localStorage.setItem('vault_mint_keypair', JSON.stringify(Array.from(cachedMintKeypair.secretKey)));
  return cachedMintKeypair;
}

export function getVaultMintAddress(): PublicKey {
  return getVaultMintKeypair().publicKey;
}

// Backward compatibility
export async function findVaultMintPDA(): Promise<PublicKey> {
  return getVaultMintAddress();
}
