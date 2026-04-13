import { useState } from "react";
import { S } from "../styles/S";

export default function TxButton({ label, icon, onClick, disabled, color = "#38bdf8", loading }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...S.btn(color, disabled || loading),
        boxShadow: hover && !disabled ? `0 0 16px ${color}44` : "none",
        transform: hover && !disabled ? "translateY(-1px)" : "none",
      }}
    >
      {icon} {loading ? "Processing..." : label}
    </button>
  );
}