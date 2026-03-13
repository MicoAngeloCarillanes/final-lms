import React from "react";

// ─── Badge ────────────────────────────────────────────────────────────────────
export const Badge = ({ children, color = "default" }) => {
  const map = {
    default: ["rgba(100,116,139,.2)", "#94a3b8"],
    success: ["rgba(16,185,129,.15)",  "#34d399"],
    warning: ["rgba(245,158,11,.15)",  "#fbbf24"],
    danger:  ["rgba(239,68,68,.15)",   "#f87171"],
    info:    ["rgba(59,130,246,.15)",  "#60a5fa"],
    purple:  ["rgba(99,102,241,.15)",  "#a5b4fc"],
    amber:   ["rgba(245,158,11,.15)",  "#fbbf24"],
  };
  const [bg, txt] = map[color] || map.default;
  return (
    <span style={{ background: bg, color: txt, padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
};

// ─── Input ────────────────────────────────────────────────────────────────────
export const Input = (props) => (
  <input
    {...props}
    style={{ border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "#e2e8f0", outline: "none", background: "#1e293b", width: "100%", ...props.style }}
    onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)"; }}
    onBlur={e  => { e.target.style.borderColor = "#334155"; e.target.style.boxShadow = "none"; }}
  />
);

// ─── Sel ──────────────────────────────────────────────────────────────────────
export const Sel = ({ children, ...props }) => (
  <select
    {...props}
    style={{ border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "#e2e8f0", outline: "none", background: "#1e293b", width: "100%", cursor: "pointer", ...props.style }}
    onFocus={e => { e.target.style.borderColor = "#6366f1"; }}
    onBlur={e  => { e.target.style.borderColor = "#334155"; }}
  >
    {children}
  </select>
);

// ─── Btn ──────────────────────────────────────────────────────────────────────
export const Btn = ({ children, variant = "primary", size = "md", style: sx, ...rest }) => {
  const vs = {
    primary:   { background: "#4f46e5", color: "#fff",    border: "none" },
    secondary: { background: "#1e293b", color: "#94a3b8", border: "1px solid #334155" },
    danger:    { background: "rgba(239,68,68,.15)", color: "#f87171", border: "1px solid rgba(239,68,68,.3)" },
    success:   { background: "rgba(16,185,129,.15)", color: "#34d399", border: "1px solid rgba(16,185,129,.3)" },
    ghost:     { background: "transparent", color: "#a5b4fc", border: "none" },
  };
  const ps = { sm: "5px 10px", md: "8px 16px", lg: "10px 22px" };
  return (
    <button
      {...rest}
      style={{ ...vs[variant] || vs.primary, padding: ps[size] || ps.md, borderRadius: 6, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, transition: "opacity .15s, transform .1s", ...sx }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      onMouseDown={e  => e.currentTarget.style.transform = "scale(0.97)"}
      onMouseUp={e    => e.currentTarget.style.transform = "scale(1)"}
    >
      {children}
    </button>
  );
};

// ─── FF (Form Field) ──────────────────────────────────────────────────────────
export const FF = ({ label, required, error, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}{required && <span style={{ color: "#f87171" }}> *</span>}
    </label>
    {children}
    {error && <span style={{ fontSize: 11, color: "#f87171" }}>{error}</span>}
  </div>
);

// ─── Card ─────────────────────────────────────────────────────────────────────
export const Card = ({ children, style: sx }) => (
  <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: 16, ...sx }}>
    {children}
  </div>
);

// ─── StatCard ─────────────────────────────────────────────────────────────────
export const StatCard = ({ icon, label, value, color, bg }) => (
  <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
    <div style={{ width: 44, height: 44, borderRadius: 10, background: bg ? bg.replace("#d1fae5","rgba(16,185,129,.15)").replace("#ede9fe","rgba(99,102,241,.15)").replace("#fef3c7","rgba(245,158,11,.15)").replace("#dbeafe","rgba(59,130,246,.15)") : "rgba(99,102,241,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  </div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
export const Toast = ({ msg }) => msg ? (
  <div style={{ background: "rgba(16,185,129,.15)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 8, padding: "9px 14px", color: "#34d399", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
    ✓ {msg}
  </div>
) : null;
