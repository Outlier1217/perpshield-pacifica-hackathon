import { ethers } from "ethers";
import { USDC_ADDRESS, VAULT_ADDRESS, USDC_ABI, VAULT_ABI } from "./constants";

export const getUSDCContract = (signer) => {
  return new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
};

export const getVaultContract = (signer) => {
  return new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
};