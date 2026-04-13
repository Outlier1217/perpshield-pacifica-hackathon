import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { getUSDCContract, getVaultContract } from "../utils/contracts";
import { fmt, fmtK, parseAmt } from "../utils/helpers";

const VaultContext = createContext();

export const useVault = () => useContext(VaultContext);

export const VaultProvider = ({ children }) => {
  const [account, setAccount] = useState("");
  const [signer, setSigner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState("");
  const [decimals, setDecimals] = useState(6);
  
  // Balances
  const [usdcBal, setUsdcBal] = useState("0");
  const [vaultShares, setVaultShares] = useState("0");
  
  // Vault metrics
  const [tvl, setTvl] = useState("0");
  const [longSize, setLongSize] = useState("0");
  const [shortSize, setShortSize] = useState("0");
  const [delta, setDelta] = useState("0");
  const [shieldScore, setShieldScore] = useState(100);
  const [paused, setPaused] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const [fundingRate, setFundingRate] = useState("0");
  const [pendingYield, setPendingYield] = useState("0");
  const [totalBounties, setTotalBounties] = useState("0");
  const [threatPool, setThreatPool] = useState("0");
  const [peakAssets, setPeakAssets] = useState("0");
  
  // User stats
  const [userXP, setUserXP] = useState(0);
  const [userLevel, setUserLevel] = useState(0);
  const [userBounties, setUserBounties] = useState("0");
  const [userLong, setUserLong] = useState("0");
  const [userShort, setUserShort] = useState("0");
  
  const [toast, setToast] = useState({ msg: "", type: "info" });
  const notify = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "info" }), 4500);
  };

  const connect = async () => {
    try {
      if (!window.ethereum) { notify("Please install MetaMask", "error"); return; }
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const _signer = await provider.getSigner();
      const addr = await _signer.getAddress();
      setSigner(_signer);
      setAccount(addr);
      notify("Wallet connected!", "success");
    } catch (e) {
      notify("Connection failed: " + e.message?.slice(0, 60), "error");
    }
  };

  const loadData = useCallback(async () => {
    if (!signer || !account) return;
    try {
      const u = getUSDCContract(signer);
      const v = getVaultContract(signer);

      const dec = Number(await u.decimals());
      setDecimals(dec);

      const [uBal, vBal, peak] = await Promise.all([
        u.balanceOf(account),
        v.balanceOf(account),
        v.peakAssets(),
      ]);

      setUsdcBal(ethers.formatUnits(uBal, dec));
      setVaultShares(ethers.formatUnits(vBal, dec));
      setPeakAssets(ethers.formatUnits(peak, dec));

      try {
        const py = await v.pendingYield();
        const pyNum = Number(py);
        setPendingYield(pyNum < 0 ? "0" : ethers.formatUnits(py, dec));
      } catch { setPendingYield("0"); }

      const [score, isPaused, isEmergency, open, pool, bTotal] = await Promise.all([
        v.shieldScore(), v.paused(), v.emergencyMode(),
        v.positionsOpen(), v.threatRewardPool(), v.totalBountiesPaid(),
      ]);
      setShieldScore(Number(score));
      setPaused(isPaused);
      setEmergency(isEmergency);
      setPosOpen(open);
      setThreatPool(ethers.formatUnits(pool, dec));
      setTotalBounties(ethers.formatUnits(bTotal, dec));

      try {
        const m = await v.getVaultMetrics();
        setTvl(ethers.formatUnits(m[0], dec));
        setLongSize(ethers.formatUnits(m[1], dec));
        setShortSize(ethers.formatUnits(m[2], dec));
        setDelta(ethers.formatUnits(m[3], dec));
        const rate = Number(ethers.formatUnits(m[7], 18)) * 100;
        setFundingRate(rate.toFixed(6));
      } catch {}

      try {
        const s = await v.getUserStats(account);
        setUserXP(Number(s[0]));
        setUserLevel(Number(s[1]));
        setUserBounties(ethers.formatUnits(s[2], dec));
        setUserLong(ethers.formatUnits(s[4], dec));
        setUserShort(ethers.formatUnits(s[5], dec));
      } catch {}

    } catch (e) {
      console.error("loadData error:", e);
    }
  }, [signer, account]);

  useEffect(() => {
    if (signer && account) {
      loadData();
      const id = setInterval(loadData, 6000);
      return () => clearInterval(id);
    }
  }, [signer, account, loadData]);

  const tx = async (label, fn) => {
    try {
      setTxLoading(label);
      notify(`${label} in progress...`, "info");
      const t = await fn();
      await t.wait();
      notify(`${label} successful! 🎉`, "success");
      await loadData();
    } catch (e) {
      const msg = e?.reason || e?.message || "Unknown error";
      notify(`${label} failed: ${msg.slice(0, 80)}`, "error");
    } finally {
      setTxLoading("");
    }
  };

  return (
    <VaultContext.Provider value={{
      account, signer, loading, txLoading, decimals,
      usdcBal, vaultShares, tvl, longSize, shortSize, delta,
      shieldScore, paused, emergency, posOpen, fundingRate,
      pendingYield, totalBounties, threatPool, peakAssets,
      userXP, userLevel, userBounties, userLong, userShort,
      toast, notify, connect, loadData, tx, setTxLoading, setLoading
    }}>
      {children}
    </VaultContext.Provider>
  );
};