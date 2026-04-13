import { ethers } from "ethers";

export const fmt = (v, d = 2) => parseFloat(v || 0).toFixed(d);

export const fmtK = (v) => {
  const n = parseFloat(v || 0);
  if (n >= 1000) return `${(n/1000).toFixed(2)}K`;
  return n.toFixed(2);
};

export const parseAmt = (a, decimals) => {
  if (!a || a === "0" || a === "") return 0n;
  try { 
    // Remove commas if any
    const cleanAmount = String(a).replace(/,/g, "");
    // Check if it's a valid number
    if (isNaN(parseFloat(cleanAmount))) return 0n;
    return ethers.parseUnits(cleanAmount, decimals);
  }
  catch (e) { 
    console.error("parseAmt error:", e);
    return 0n; 
  }
};