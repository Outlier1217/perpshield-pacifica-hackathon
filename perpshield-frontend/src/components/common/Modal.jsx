import { S } from "../styles/S";

export default function Modal({ show, onClose, title, color = "#38bdf8", children }) {
  if (!show) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16,
    }} onClick={onClose}>
      <div style={{
        ...S.card(color), maxWidth: 480, width: "100%", boxSizing: "border-box",
        boxShadow: `0 0 60px ${color}22, 0 24px 64px rgba(0,0,0,0.6)`,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color, fontSize: 18, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}