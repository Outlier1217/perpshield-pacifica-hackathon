import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
// ==================== CLIENT.TS ====================
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import type { PerpShield } from "../target/types/perp_shield";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.PerpShield as anchor.Program<PerpShield>;


console.log("🟢 PerpShield Testing Started...");
console.log("My address:", program.provider.publicKey.toString());

const balance = await program.provider.connection.getBalance(program.provider.publicKey);
console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);

// Get Program ID
const programId = new web3.PublicKey("FoQZVguRJUchiQZba72Z1RzSaD7NWTvnAj8V3NahYvFo");
console.log("Program ID:", programId.toString());

// Find PDA for Vault
const [vaultPda] = web3.PublicKey.findProgramAddressSync(
  [Buffer.from("vault")],
  programId
);
console.log("Vault PDA:", vaultPda.toString());

console.log("\n✅ Ready for testing! Now run anchor.test.ts");