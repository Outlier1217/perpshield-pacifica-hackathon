export default function Toast({ msg, type }) {
  if (!msg) return null;
  const color = type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#f59e0b";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: "rgba(13,17,32,0.97)", border: `1px solid ${color}55`,
      borderRadius: 12, padding: "14px 20px", maxWidth: 400,
      boxShadow: `0 0 32px ${color}22, 0 8px 32px rgba(0,0,0,0.5)`,
      display: "flex", alignItems: "flex-start", gap: 10,
      animation: "slideIn 0.3s ease",
    }}>
      <span style={{ fontSize: 18 }}>{type === "success" ? "✅" : type === "error" ? "❌" : "⏳"}</span>
      <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>{msg}</p>
    </div>
  );
}