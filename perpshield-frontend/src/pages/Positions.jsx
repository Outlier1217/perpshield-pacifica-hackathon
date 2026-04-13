import { useVault } from "../contexts/VaultContext";
import { fmt, fmtK } from "../utils/helpers";
import { S } from "../components/styles/S";
import StatCard from "../components/common/StatCard";

export default function Positions() {
  const { tvl, longSize, shortSize, delta, userLong, userShort, fundingRate } = useVault();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>📊 Position Overview</h2>

      <div style={S.grid3}>
        <StatCard label="Long Size" value={`$${fmtK(longSize)}`} sub="BNB-PERP Long 1x" color="#10b981" icon="📈"/>
        <StatCard label="Short Size" value={`$${fmtK(shortSize)}`} sub="BNB-PERP Short 1x" color="#ef4444" icon="📉"/>
        <StatCard label="Net Delta" value={`$${fmt(delta)}`} sub={parseFloat(delta) < 1 ? "Perfectly hedged ✓" : "Drift detected"} color={parseFloat(delta) < 1 ? "#10b981" : "#f59e0b"} icon="⚖️"/>
      </div>

      {/* Delta visualization */}
      <div style={S.card()}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 800, color: "#94a3b8" }}>POSITION BALANCE</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "#10b981", fontWeight: 700 }}>📈 LONG</span>
              <span style={{ fontSize: 13, color: "#10b981", fontWeight: 700 }}>${fmtK(longSize)}</span>
            </div>
            <div style={{ height: 12, background: "rgba(255,255,255,0.05)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${parseFloat(tvl) > 0 ? (parseFloat(longSize)/parseFloat(tvl)*100) : 50}%`, background: "linear-gradient(90deg,#10b981,#34d399)", borderRadius: 6, transition: "width 0.5s ease" }}/>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 700 }}>📉 SHORT</span>
              <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 700 }}>${fmtK(shortSize)}</span>
            </div>
            <div style={{ height: 12, background: "rgba(255,255,255,0.05)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${parseFloat(tvl) > 0 ? (parseFloat(shortSize)/parseFloat(tvl)*100) : 50}%`, background: "linear-gradient(90deg,#ef4444,#f87171)", borderRadius: 6, transition: "width 0.5s ease" }}/>
            </div>
          </div>
        </div>
      </div>

      {/* Your exposure */}
      <div style={S.card()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#94a3b8" }}>YOUR EXPOSURE</h3>
        <div style={S.grid2}>
          <StatCard label="Your Long Exposure" value={`$${fmt(userLong)}`} color="#10b981" icon="📈"/>
          <StatCard label="Your Short Exposure" value={`$${fmt(userShort)}`} color="#ef4444" icon="📉"/>
        </div>
      </div>

      {/* Funding rate info */}
      <div style={{ ...S.card("#a78bfa") }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#a78bfa" }}>FUNDING RATE DETAILS</h3>
        <div style={S.gridAuto(160)}>
          <div>
            <p style={S.label}>Current Rate</p>
            <p style={{ ...S.value, color: "#a78bfa" }}>{fmt(fundingRate, 6)}%</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Annual rate</p>
          </div>
          <div>
            <p style={S.label}>Daily Yield (est.)</p>
            <p style={{ ...S.value, color: "#10b981" }}>${fmt(parseFloat(shortSize) * parseFloat(fundingRate) / 100 / 365, 4)}</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>From short position</p>
          </div>
          <div>
            <p style={S.label}>Harvest Bounty</p>
            <p style={{ ...S.value, color: "#f59e0b" }}>0.10%</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Of yield harvested</p>
          </div>
          <div>
            <p style={S.label}>Cooldown</p>
            <p style={{ ...S.value, color: "#38bdf8" }}>60s</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Between harvests</p>
          </div>
        </div>
      </div>
    </div>
  );
}