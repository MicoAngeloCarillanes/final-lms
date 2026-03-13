import React from "react";

export default function TopBar({ title, subtitle, actions }) {
  return (
    <div style={{
      height: 54, background: "#1e293b", borderBottom: "1px solid #334155",
      display: "flex", alignItems: "center", padding: "0 22px", gap: 16, flexShrink: 0
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>}
    </div>
  );
}
