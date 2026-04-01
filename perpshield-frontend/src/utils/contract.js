import { ethers } from "ethers";

export const VAULT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export const VAULT_ABI = [
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function harvest()",
  "function rebalance()",
  "function shieldScore() view returns (uint256)"
];

export async function getContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);

  await provider.send("eth_requestAccounts", []);

  const signer = await provider.getSigner();

  return new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
}