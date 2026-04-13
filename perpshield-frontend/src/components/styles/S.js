export const S = {
  app: {
    minHeight: "100vh",
    background: "#060810",
    color: "#e2e8f0",
    fontFamily: "'Syne', 'Space Mono', monospace",
    overflowX: "hidden",
  },
  noise: {
    position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
    backgroundRepeat: "repeat", backgroundSize: "200px",
  },
  wrap: { maxWidth: 1280, margin: "0 auto", padding: "0 24px", position: "relative", zIndex: 1 },

  header: {
    borderBottom: "1px solid rgba(99,179,237,0.12)",
    background: "rgba(6,8,16,0.85)",
    backdropFilter: "blur(20px)",
    position: "sticky", top: 0, zIndex: 100,
  },
  headerInner: {
    maxWidth: 1280, margin: "0 auto", padding: "0 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    height: 64,
  },
  logo: {
    display: "flex", alignItems: "center", gap: 10,
    fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px",
    color: "#fff",
  },
  logoAccent: { color: "#38bdf8" },

  card: (glowColor = "#38bdf8") => ({
    background: "rgba(13,17,32,0.8)",
    border: `1px solid rgba(${glowColor === "#38bdf8" ? "56,189,248" : glowColor === "#10b981" ? "16,185,129" : glowColor === "#f59e0b" ? "245,158,11" : "239,68,68"},0.2)`,
    borderRadius: 16,
    boxShadow: `0 0 32px rgba(${glowColor === "#38bdf8" ? "56,189,248" : glowColor === "#10b981" ? "16,185,129" : glowColor === "#f59e0b" ? "245,158,11" : "239,68,68"},0.06)`,
    backdropFilter: "blur(12px)",
    padding: 24,
    transition: "box-shadow 0.3s, border-color 0.3s",
  }),

  btn: (color = "#38bdf8", disabled = false) => ({
    background: disabled ? "rgba(30,35,55,0.6)" : `linear-gradient(135deg, ${color}22, ${color}44)`,
    border: `1px solid ${disabled ? "rgba(255,255,255,0.06)" : color + "66"}`,
    color: disabled ? "#475569" : "#fff",
    borderRadius: 10,
    padding: "11px 18px",
    fontFamily: "inherit",
    fontWeight: 700,
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s",
    letterSpacing: "0.3px",
    width: "100%",
    textAlign: "center",
  }),

  input: {
    background: "rgba(13,17,32,0.9)",
    border: "1px solid rgba(56,189,248,0.2)",
    borderRadius: 10,
    color: "#e2e8f0",
    padding: "12px 16px",
    fontSize: 15,
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  },

  badge: (color) => ({
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "4px 12px", borderRadius: 20,
    fontSize: 11, fontWeight: 700, letterSpacing: "0.5px",
    background: `${color}22`, color, border: `1px solid ${color}44`,
    textTransform: "uppercase",
  }),

  label: { fontSize: 11, color: "#64748b", letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 },
  value: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: "#f8fafc" },

  grid2: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  gridAuto: (min = 160) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }),
};