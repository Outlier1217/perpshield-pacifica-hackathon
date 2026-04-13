import { useState } from "react";
import { ethers } from "ethers"; // ← YEH ADD KARO
import { useVault } from "../contexts/VaultContext";
import { getUSDCContract, getVaultContract } from "../utils/contracts";
import { parseAmt, fmt, fmtK } from "../utils/helpers";
import { VAULT_ADDRESS } from "../utils/constants"; // ← YEH BHI ADD KARO
import { S } from "../components/styles/S";
import StatCard from "../components/common/StatCard";
import ShieldGauge from "../components/common/ShieldGauge";
import TxButton from "../components/common/TxButton";
import Modal from "../components/common/Modal";

export default function VaultDashboard() {
  const vaultContext = useVault();
  const {
    account, signer, txLoading, decimals,
    usdcBal, vaultShares, tvl, pendingYield, fundingRate,
    shieldScore, paused, emergency, posOpen, threatPool,
    peakAssets, totalBounties, notify, loadData, tx
  } = vaultContext;

  const [amount, setAmount] = useState("");
  const [fundAmt, setFundAmt] = useState("");
  const [threatDesc, setThreatDesc] = useState("");
  const [threatProof, setThreatProof] = useState("");
  const [modal, setModal] = useState("");

  const isLoading = (lbl) => txLoading === lbl;
  const drawdownPct = peakAssets > 0 && tvl < peakAssets
    ? ((parseFloat(peakAssets) - parseFloat(tvl)) / parseFloat(peakAssets) * 100).toFixed(1)
    : "0.0";

  const mintUSDC = () => tx("Mint USDC", async () => {
    const p = parseAmt(amount, decimals); 
    if (!p || p === 0n) throw new Error("Enter valid amount"); // ← BETTER ERROR
    return getUSDCContract(signer).mint(account, p);
  });

  const deposit = async () => {
    const p = parseAmt(amount, decimals); 
    if (!p || p === 0n) { 
      notify("Please enter a valid amount", "error"); 
      return; 
    }
    try {
      vaultContext.setTxLoading("Deposit");
      notify("Checking allowance...", "info");
      const u = getUSDCContract(signer); 
      const v = getVaultContract(signer);
      const allow = await u.allowance(account, VAULT_ADDRESS);
      if (allow < p) {
        notify("Approving USDC...", "info");
        const at = await u.approve(VAULT_ADDRESS, p);
        await at.wait();
      }
      notify("Depositing into vault...", "info");
      const dt = await v.deposit(p, account);
      await dt.wait();
      notify("Deposit successful! 🎉", "success");
      await loadData();
      setAmount(""); // Clear amount after success
    } catch (e) {
      notify("Deposit failed: " + (e?.reason || e?.message || "").slice(0, 80), "error");
    } finally { vaultContext.setTxLoading(""); }
  };

  const withdraw = () => tx("Withdraw", async () => {
    const p = parseAmt(amount, decimals); 
    if (!p || p === 0n) throw new Error("Enter valid amount");
    return getVaultContract(signer).withdraw(p, account, account);
  });

  const harvest = () => tx("Harvest", () => getVaultContract(signer).harvest());
  const rebalance = () => tx("Rebalance", () => getVaultContract(signer).rebalance());
  const emergDeleverage = () => tx("Emergency Deleverage", () => getVaultContract(signer).emergencyDeleverage());
  const pause = () => tx("Pause", () => getVaultContract(signer).emergencyPause());
  const resume = () => tx("Resume", () => getVaultContract(signer).resume());

  const reportThreat = async () => {
    if (!threatDesc || !threatProof) { notify("Fill all fields", "error"); return; }
    await tx("Report Threat", () =>
      getVaultContract(signer).reportThreat(threatDesc, ethers.toUtf8Bytes(threatProof))
    );
    setThreatDesc(""); setThreatProof(""); setModal("");
  };

  const fundPool = async () => {
    const p = parseAmt(fundAmt, decimals); 
    if (!p || p === 0n) { notify("Enter valid amount", "error"); return; }
    try {
      vaultContext.setTxLoading("Fund Pool");
      const u = getUSDCContract(signer); 
      const v = getVaultContract(signer);
      const allow = await u.allowance(account, VAULT_ADDRESS);
      if (allow < p) { 
        const at = await u.approve(VAULT_ADDRESS, p); 
        await at.wait(); 
      }
      const ft = await v.fundThreatRewardPool(p);
      await ft.wait();
      notify("Threat pool funded! ✅", "success");
      setFundAmt(""); setModal(""); await loadData();
    } catch (e) {
      notify("Fund failed: " + (e?.reason || e?.message || "").slice(0, 60), "error");
    } finally { vaultContext.setTxLoading(""); }
  };

  // Rest of the component remains the same...
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top row: Shield + Key stats */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ ...S.card(shieldScore >= 70 ? "#10b981" : shieldScore >= 40 ? "#f59e0b" : "#ef4444"), minWidth: 220, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <p style={{ ...S.label, alignSelf: "flex-start" }}>Shield Score</p>
          <ShieldGauge score={shieldScore} />
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
              <span>Pause threshold</span><span style={{ color: "#f59e0b" }}>30</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
              <span>Emergency threshold</span><span style={{ color: "#ef4444" }}>15</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
              <span>Positions</span>
              <span style={{ color: posOpen ? "#10b981" : "#64748b" }}>{posOpen ? "Open ✓" : "Closed"}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={S.gridAuto(140)}>
            <StatCard label="Total Value Locked" value={`$${fmtK(tvl)}`} sub="USDC in vault" color="#38bdf8" icon="💰"/>
            <StatCard label="Your Shares" value={fmt(vaultShares)} sub="pshUSDC" color="#38bdf8" icon="🏦"/>
            <StatCard label="Wallet USDC" value={`$${fmtK(usdcBal)}`} sub="Available" color="#64748b" icon="💳"/>
            <StatCard label="Pending Yield" value={`$${fmt(pendingYield, 6)}`} sub="Ready to harvest" color="#10b981" icon="🌾"/>
          </div>
          <div style={S.gridAuto(140)}>
            <StatCard label="Funding Rate" value={`${fmt(fundingRate, 4)}%`} sub="Annual rate" color="#a78bfa" icon="💹"/>
            <StatCard label="Peak TVL" value={`$${fmtK(peakAssets)}`} sub="All-time high" color="#f59e0b" icon="🏔️"/>
            <StatCard label="Drawdown" value={`${drawdownPct}%`} sub="From peak" color={parseFloat(drawdownPct) > 20 ? "#ef4444" : "#64748b"} icon="📉"/>
            <StatCard label="Threat Pool" value={`$${fmt(threatPool)}`} sub="Bug bounty" color="#ef4444" icon="🎯"/>
          </div>
        </div>
      </div>

      {/* Action Panel */}
      <div style={{ ...S.card(), padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <h3 style={{ margin: "0 0 16px", color: "#f8fafc", fontSize: 16, fontWeight: 800 }}>⚡ Actions</h3>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <input
              style={S.input}
              type="number"
              placeholder="Amount (USDC)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 6 }}>
              {["10","100","1000"].map(v => (
                <button key={v} onClick={() => setAmount(v)} style={{
                  background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)",
                  borderRadius: 6, color: "#38bdf8", padding: "3px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                }}>{v}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
          <TxButton label="Mint USDC" icon="🔨" onClick={mintUSDC} color="#38bdf8" loading={isLoading("Mint USDC")} disabled={!amount}/>
          <TxButton label="Deposit" icon="📤" onClick={deposit} color="#10b981" loading={isLoading("Deposit")} disabled={!amount || paused || emergency}/>
          <TxButton label="Withdraw" icon="📥" onClick={withdraw} color="#f59e0b" loading={isLoading("Withdraw")} disabled={!amount || parseFloat(vaultShares) === 0}/>
          <TxButton label="Harvest Yield" icon="🌾" onClick={harvest} color="#10b981" loading={isLoading("Harvest")} disabled={parseFloat(pendingYield) <= 0 || paused}/>
          <TxButton label="Rebalance" icon="⚖️" onClick={rebalance} color="#a78bfa" loading={isLoading("Rebalance")} disabled={paused || !posOpen}/>
          <TxButton label="Report Threat" icon="🚨" onClick={() => setModal("threat")} color="#ef4444"/>
          <TxButton label="Fund Pool" icon="💰" onClick={() => setModal("fund")} color="#10b981"/>
          {!paused
            ? <TxButton label="Pause Vault" icon="⏸️" onClick={pause} color="#ef4444" loading={isLoading("Pause")}/>
            : <TxButton label="Resume Vault" icon="▶️" onClick={resume} color="#10b981" loading={isLoading("Resume")}/>
          }
          <TxButton label="Emergency Delev." icon="⚠️" onClick={emergDeleverage}
            color="#ef4444" loading={isLoading("Emergency Deleverage")}
            disabled={shieldScore >= 15 || !emergency}/>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10 }}>
        {[
          { label: "Vault Status", val: paused ? "⏸ PAUSED" : "▶ ACTIVE", color: paused ? "#ef4444" : "#10b981" },
          { label: "Emergency Mode", val: emergency ? "🚨 ACTIVE" : "✓ INACTIVE", color: emergency ? "#ef4444" : "#10b981" },
          { label: "Positions", val: posOpen ? "📊 OPEN" : "— CLOSED", color: posOpen ? "#38bdf8" : "#64748b" },
          { label: "Total Bounties Paid", val: `$${fmt(totalBounties)}`, color: "#f59e0b" },
        ].map(item => (
          <div key={item.label} style={{ background: "rgba(13,17,32,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>{item.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.val}</span>
          </div>
        ))}
      </div>

      {/* Modals */}
      <Modal show={modal === "threat"} onClose={() => setModal("")} title="🚨 Report Security Threat" color="#ef4444">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <p style={{ ...S.label, marginBottom: 8 }}>Threat Description</p>
            <input style={S.input} type="text" placeholder="Describe the vulnerability or threat..."
              value={threatDesc} onChange={e => setThreatDesc(e.target.value)}/>
          </div>
          <div>
            <p style={{ ...S.label, marginBottom: 8 }}>Proof / Evidence</p>
            <textarea style={{ ...S.input, resize: "vertical", minHeight: 90, fontFamily: "'Space Mono', monospace", fontSize: 12 }}
              placeholder="Transaction hash, calldata, or other proof..."
              value={threatProof} onChange={e => setThreatProof(e.target.value)}/>
          </div>
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#fca5a5", lineHeight: 1.6 }}>
              ⚠️ Submitting a valid threat report pays out the full threat pool (<strong>${fmt(threatPool)} USDC</strong>) to you. Proof is stored on-chain.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
            <TxButton label="Submit Report" icon="🚨" onClick={reportThreat} color="#ef4444" loading={isLoading("Report Threat")}/>
            <TxButton label="Cancel" icon="" onClick={() => setModal("")} color="#64748b"/>
          </div>
        </div>
      </Modal>

      <Modal show={modal === "fund"} onClose={() => setModal("")} title="💰 Fund Threat Reward Pool" color="#10b981">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <p style={{ ...S.label, marginBottom: 8 }}>Amount (USDC)</p>
            <input style={S.input} type="number" placeholder="e.g. 500"
              value={fundAmt} onChange={e => setFundAmt(e.target.value)}/>
          </div>
          <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#6ee7b7", lineHeight: 1.6 }}>
              ℹ️ Funds go to a dedicated reward pool — separate from depositor TVL. Used to incentivize security researchers.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <TxButton label="Fund Pool" icon="💰" onClick={fundPool} color="#10b981" loading={isLoading("Fund Pool")}/>
            <TxButton label="Cancel" icon="" onClick={() => setModal("")} color="#64748b"/>
          </div>
        </div>
      </Modal>
    </div>
  );
}