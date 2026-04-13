import { S } from "../styles/S";

export default function StatCard({ label, value, sub, color = "#38bdf8", icon }) {
  return (
    <div style={{ ...S.card(color), display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={S.label}>{label}</p>
        {icon && <span style={{ fontSize: 18, opacity: 0.7 }}>{icon}</span>}
      </div>
      <p style={{ ...S.value, color }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>{sub}</p>}
    </div>
  );
}