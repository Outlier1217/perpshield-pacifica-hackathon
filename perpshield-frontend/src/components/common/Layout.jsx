import { useState } from "react";
import { useVault } from "../../contexts/VaultContext";
import { S } from "../styles/S";
import Toast from "./Toast";
import { VAULT_ADDRESS, USDC_ADDRESS } from "../../utils/constants";

export default function Layout({ children, activeTab, setActiveTab }) {
  const { account, connect } = useVault();

  return (
    <>
      {/* Noise overlay */}
      <div style={S.noise} />

      {/* Ambient glow blobs */}
      <div style={{ position: "fixed", top: -200, left: -200, width: 500, height: 500, background: "radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }}/>
      <div style={{ position: "fixed", bottom: -200, right: -200, width: 600, height: 600, background: "radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }}/>

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <span style={{ fontSize: 26 }}>🛡️</span>
            <span>Perp<span style={S.logoAccent}>Shield</span></span>
            <span style={{ ...S.badge("#38bdf8"), marginLeft: 4 }}>TESTNET</span>
          </div>

          <nav style={{ display: "flex", gap: 4 }}>
            {["vault","positions","bounties","profile"].map(t => (
              <button key={t} className="tab-btn" onClick={() => setActiveTab(t)} style={{
                background: activeTab === t ? "rgba(56,189,248,0.12)" : "transparent",
                border: activeTab === t ? "1px solid rgba(56,189,248,0.3)" : "1px solid transparent",
                color: activeTab === t ? "#38bdf8" : "#64748b",
                borderRadius: 8, padding: "7px 16px", cursor: "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.3px",
                textTransform: "capitalize",
              }}>
                {t === "vault" ? "🏦" : t === "positions" ? "📊" : t === "bounties" ? "🎁" : "🎮"} {t}
              </button>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={connect} style={{
              background: account ? "rgba(16,185,129,0.12)" : "rgba(56,189,248,0.15)",
              border: `1px solid ${account ? "#10b98155" : "#38bdf855"}`,
              color: account ? "#10b981" : "#38bdf8",
              borderRadius: 10, padding: "9px 18px",
              fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
              {account ? `${account.slice(0,6)}···${account.slice(-4)}` : "Connect Wallet"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner (not connected) */}
      {!account && (
        <div style={{ textAlign: "center", padding: "80px 24px 60px", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🛡️</div>
          <h1 style={{ fontSize: "clamp(36px,6vw,64px)", fontWeight: 800, margin: "0 0 16px", letterSpacing: "-2px", lineHeight: 1.1 }}>
            Delta-Neutral<br/><span style={{ color: "#38bdf8" }}>Yield Vault</span>
          </h1>
          <p style={{ fontSize: 18, color: "#64748b", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
            Earn funding-rate yield on Pacifica Perp DEX with automated delta-neutral hedging, AI-powered shield scoring, and on-chain threat reporting.
          </p>
          <button onClick={connect} style={{
            background: "linear-gradient(135deg, #38bdf8, #0ea5e9)",
            border: "none", borderRadius: 12, color: "#fff",
            padding: "16px 40px", fontSize: 16, fontWeight: 800,
            cursor: "pointer", letterSpacing: "0.5px",
            boxShadow: "0 0 40px rgba(56,189,248,0.3)",
          }}>
            Connect Wallet to Start →
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 16, maxWidth: 800, margin: "60px auto 0" }}>
            {[
              { icon: "⚖️", title: "Delta Neutral", desc: "Equal long/short exposure eliminates directional risk" },
              { icon: "🛡️", title: "Shield Score", desc: "Real-time AI risk monitoring across 4 dimensions" },
              { icon: "🎁", title: "Keeper Bounties", desc: "Earn rewards for harvesting, rebalancing & reporting threats" },
              { icon: "🎮", title: "XP & Levels", desc: "Level up to unlock higher bounty multipliers" },
            ].map(f => (
              <div key={f.title} style={{ ...S.card(), textAlign: "left" }} className="card-hover">
                <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
                <p style={{ margin: "0 0 6px", fontWeight: 800, color: "#f8fafc" }}>{f.title}</p>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connected Dashboard */}
      {account && (
        <div style={{ ...S.wrap, paddingTop: 32, paddingBottom: 48 }}>
          {children}
        </div>
      )}

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "24px", textAlign: "center",
        background: "rgba(6,8,16,0.6)", backdropFilter: "blur(12px)",
        position: "relative", zIndex: 1,
      }}>
        <p style={{ margin: "0 0 8px", color: "#334155", fontSize: 13 }}>
          🛡️ <strong style={{ color: "#475569" }}>PerpShield Vault</strong> — Delta-Neutral Yield on Pacifica Perp DEX
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "#1e293b" }}>
          Localhost · MockUSDC: {USDC_ADDRESS.slice(0,10)}… · Vault: {VAULT_ADDRESS.slice(0,10)}…
        </p>
      </footer>

      <Toast msg={useVault().toast.msg} type={useVault().toast.type}/>
    </>
  );
}