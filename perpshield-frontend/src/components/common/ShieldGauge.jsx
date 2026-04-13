import { S } from "../styles/S";

export default function ShieldGauge({ score }) {
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "SAFE" : score >= 40 ? "CAUTION" : "CRITICAL";
  const r = 44, c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx={55} cy={55} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={8}/>
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${filled} ${c}`} strokeLinecap="round"
          transform="rotate(-90 55 55)" filter="url(#glow)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text x={55} y={50} textAnchor="middle" fill={color} fontSize={20} fontWeight={800} fontFamily="inherit">{score}</text>
        <text x={55} y={65} textAnchor="middle" fill="#64748b" fontSize={9} fontWeight={700} letterSpacing={1} fontFamily="inherit">{label}</text>
      </svg>
      <span style={S.badge(color)}>{score >= 70 ? "🟢" : score >= 40 ? "🟡" : "🔴"} {label}</span>
    </div>
  );
}