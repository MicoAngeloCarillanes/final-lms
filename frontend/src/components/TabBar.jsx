import React from "react";

export default function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #334155", background: "#1e293b", padding: "0 20px", flexShrink: 0 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{ padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: active === t.id ? "#a5b4fc" : "#475569", borderBottom: `2px solid ${active === t.id ? "#6366f1" : "transparent"}`, marginBottom: -1, transition: "color .15s", whiteSpace: "nowrap" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
