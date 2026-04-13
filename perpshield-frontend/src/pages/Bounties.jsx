import { useVault } from "../contexts/VaultContext";
import { fmt } from "../utils/helpers";
import { S } from "../components/styles/S";
import StatCard from "../components/common/StatCard";
import TxButton from "../components/common/TxButton";
import { getVaultContract } from "../utils/contracts";
import { LEVEL_CONFIG } from "../utils/constants";

export default function Bounties() {
  const { 
    userBounties, totalBounties, threatPool, userLevel, 
    pendingYield, paused, txLoading, notify, tx,
    signer, account
  } = useVault();

  const isLoading = (lbl) => txLoading === lbl;
  const lvlInfo = LEVEL_CONFIG[Math.min(userLevel, LEVEL_CONFIG.length - 1)];

  const harvest = () => tx("Harvest", () => getVaultContract(signer).harvest());
  const rebalance = () => tx("Rebalance", () => getVaultContract(signer).rebalance());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🎁 Keeper Bounties</h2>

      <div style={S.gridAuto(180)}>
        <StatCard label="Your Total Earned" value={`$${fmt(userBounties)}`} color="#10b981" icon="💰"/>
        <StatCard label="Total Paid (Vault)" value={`$${fmt(totalBounties)}`} color="#f59e0b" icon="🏆"/>
        <StatCard label="Threat Reward Pool" value={`$${fmt(threatPool)}`} color="#ef4444" icon="🎯"/>
        <StatCard label="Your Level Mult." value={lvlInfo.mult} color={lvlInfo.color} icon="✨"/>
      </div>

      {/* Bounty table */}
      <div style={S.card()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#94a3b8" }}>BOUNTY SCHEDULE</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: 10, overflow: "hidden" }}>
          {[
            { action: "Harvest Yield", rate: "0.10%", base: "of yield amount", lvl: "+5% per level", color: "#10b981", icon: "🌾" },
            { action: "Rebalance Positions", rate: "0.05%", base: "of total TVL", lvl: "+5% per level", color: "#a78bfa", icon: "⚖️" },
            { action: "Emergency Deleverage", rate: "0.50%", base: "of total TVL", lvl: "+5% per level", color: "#ef4444", icon: "⚠️" },
            { action: "Report Security Threat", rate: "100%", base: "of threat pool", lvl: "fixed pool", color: "#f59e0b", icon: "🚨" },
          ].map((r, i) => (
            <div key={r.action} style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
              padding: "14px 18px", gap: 12, alignItems: "center",
              background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span>{r.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{r.action}</span>
              </div>
              <span style={{ ...S.badge(r.color), justifyContent: "center" }}>{r.rate}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>{r.base}</span>
              <span style={{ fontSize: 12, color: lvlInfo.color }}>{r.lvl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick action buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        <TxButton label="Harvest Yield" icon="🌾" onClick={harvest} color="#10b981" loading={isLoading("Harvest")} disabled={parseFloat(pendingYield) <= 0 || paused}/>
        <TxButton label="Rebalance" icon="⚖️" onClick={rebalance} color="#a78bfa" loading={isLoading("Rebalance")} disabled={paused}/>
      </div>
    </div>
  );
}