import { useVault } from "../contexts/VaultContext";
import { S } from "../components/styles/S";
import { LEVEL_CONFIG } from "../utils/constants";

export default function Profile() {
  const { userXP, userLevel } = useVault();
  
  const lvlInfo = LEVEL_CONFIG[Math.min(userLevel, LEVEL_CONFIG.length - 1)];
  const nextLvl = LEVEL_CONFIG[Math.min(userLevel + 1, LEVEL_CONFIG.length - 1)];
  const xpPct = nextLvl ? Math.min((userXP / nextLvl.xp) * 100, 100) : 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🎮 Keeper Profile</h2>

      {/* Level card */}
      <div style={{ ...S.card(lvlInfo.color), display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{
          width: 88, height: 88, borderRadius: "50%", flexShrink: 0,
          background: `conic-gradient(${lvlInfo.color} ${xpPct}%, rgba(255,255,255,0.05) 0)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#060810", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>⭐</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: lvlInfo.color }}>{userLevel}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>Level {userLevel}</h3>
            <span style={S.badge(lvlInfo.color)}>{lvlInfo.label}</span>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#64748b" }}>
            {userXP} XP · Bounty Multiplier: <strong style={{ color: lvlInfo.color }}>{lvlInfo.mult}</strong>
            {nextLvl && ` · Next: ${nextLvl.xp - userXP} XP to Level ${userLevel + 1}`}
          </p>
          <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${xpPct}%`, background: `linear-gradient(90deg,${lvlInfo.color},${lvlInfo.color}88)`, borderRadius: 4, transition: "width 0.5s ease" }}/>
          </div>
        </div>
      </div>

      {/* XP rewards table */}
      <div style={S.card()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#94a3b8" }}>XP REWARDS</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          {[
            { action: "Deposit", xp: "+10 XP", icon: "📤" },
            { action: "Withdraw", xp: "+5 XP", icon: "📥" },
            { action: "Harvest", xp: "+25 XP", icon: "🌾" },
            { action: "Rebalance", xp: "+20 XP", icon: "⚖️" },
            { action: "Emergency", xp: "+30 XP", icon: "⚠️" },
            { action: "Report Threat", xp: "+30 XP", icon: "🚨" },
          ].map(r => (
            <div key={r.action} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{r.icon}</div>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700 }}>{r.action}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#10b981", fontWeight: 700 }}>{r.xp}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Level progression */}
      <div style={S.card()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#94a3b8" }}>LEVEL PROGRESSION</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LEVEL_CONFIG.map((l, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10,
              background: userLevel === i ? `${l.color}15` : "rgba(255,255,255,0.02)",
              border: userLevel === i ? `1px solid ${l.color}44` : "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{ ...S.badge(l.color), minWidth: 80, justifyContent: "center" }}>{l.label}</span>
              <span style={{ fontSize: 13, color: "#64748b", flex: 1 }}>{l.xp.toLocaleString()} XP required</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: l.color }}>{l.mult} bounties</span>
              {userLevel === i && <span style={{ fontSize: 11, color: l.color, fontWeight: 700 }}>← YOU</span>}
              {userLevel > i && <span style={{ fontSize: 11, color: "#10b981" }}>✓</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}