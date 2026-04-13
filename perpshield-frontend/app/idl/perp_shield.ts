// app/idl/perp_shield.ts
export const IDL = {
  "version": "0.1.0",
  "name": "perp_shield",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "usdcMint", "type": "publicKey" }]
    },
    {
      "name": "deposit",
      "accounts": [
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "userTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultMint", "isMut": true, "isSigner": false },
        { "name": "userVaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "userStats", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "associatedTokenProgram", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "withdraw",
      "accounts": [
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "userTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultMint", "isMut": true, "isSigner": false },
        { "name": "userVaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "userStats", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "shares", "type": "u64" }]
    },
    {
      "name": "harvest",
      "accounts": [
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "caller", "isMut": true, "isSigner": true },
        { "name": "callerTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "userStats", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "rebalance",
      "accounts": [
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "caller", "isMut": true, "isSigner": true },
        { "name": "callerTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "userStats", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "newLong", "type": "u64" },
        { "name": "newShort", "type": "u64" },
        { "name": "newFunding", "type": "i64" }
      ]
    },
    {
      "name": "updateShieldScore",
      "accounts": [
        { "name": "vault", "isMut": true, "isSigner": false }
      ],
      "args": [
        { "name": "fundingMagnitude", "type": "u64" },
        { "name": "oracleFreshness", "type": "u64" },
        { "name": "drawdownPercent", "type": "u64" }
      ]
    },
    {
      "name": "emergencyDeleverage",
      "accounts": [
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "caller", "isMut": true, "isSigner": true },
        { "name": "callerTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "userStats", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "Vault",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "asset", "type": "publicKey" },
          { "name": "totalAssets", "type": "u64" },
          { "name": "longPosition", "type": "u64" },
          { "name": "shortPosition", "type": "u64" },
          { "name": "fundingAccrued", "type": "i64" },
          { "name": "harvestBounty", "type": "u16" },
          { "name": "rebalanceBounty", "type": "u16" },
          { "name": "deleverageBounty", "type": "u16" },
          { "name": "shieldScore", "type": "u8" },
          { "name": "isPaused", "type": "bool" },
          { "name": "peakAssets", "type": "u64" },
          { "name": "lastOracleTimestamp", "type": "i64" },
          { "name": "lastDepositSlot", "type": "u64" },
          { "name": "lastRebalance", "type": "i64" },
          { "name": "lastHarvest", "type": "i64" },
          { "name": "vaultBump", "type": "u8" }
        ]
      }
    },
    {
      "name": "UserStats",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "xp", "type": "u64" },
          { "name": "level", "type": "u8" }
        ]
      }
    }
  ]
};

export const PROGRAM_ID = "FoQZVguRJUchiQZba72Z1RzSaD7NWTvnAj8V3NahYvFo";