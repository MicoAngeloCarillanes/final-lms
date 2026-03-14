import React from "react";

export default function Sidebar({ navItems, active, onNav, user, onLogout }) {
  const roleColor =
    {
      admin:     "#f59e0b",
      sub_admin: "#fb923c",
      student:   "#10b981",
      teacher:   "#6366f1",
    }[user.role] || "#6366f1";

  const roleLabel =
    {
      admin:     "Admin",
      sub_admin: "Sub-Admin",
      student:   "Student",
      teacher:   "Teacher",
    }[user.role] || user.role;

  return (
    <div style={{ width: 220, background: "#0f172a", height: "100vh", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid #1e293b" }}>

      {/* Logo */}
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: "#4f46e5", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em" }}>EduLMS</div>
            <div style={{ fontSize: 9, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em" }}>Learning Portal</div>
          </div>
        </div>
      </div>

      {/* User chip */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${roleColor}22`, border: `2px solid ${roleColor}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: roleColor, flexShrink: 0 }}>
            {user.fullName?.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.fullName}</div>
            <div style={{ fontSize: 10, color: roleColor, textTransform: "capitalize", fontWeight: 600 }}>
              {roleLabel} · {user.id}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px", overflowY: "auto" }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => onNav(item.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 9,
              padding: "9px 10px", borderRadius: 7, border: "none", cursor: "pointer",
              marginBottom: 2, textAlign: "left",
              background: active === item.id ? "#4f46e5" : "transparent",
              color: active === item.id ? "#fff" : "#64748b",
              fontFamily: "inherit", fontSize: 13,
              fontWeight: active === item.id ? 700 : 400,
              transition: "all .15s"
            }}
            onMouseEnter={e => { if (active !== item.id) e.currentTarget.style.background = "#1e293b"; }}
            onMouseLeave={e => { if (active !== item.id) e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ fontSize: 15, opacity: .85 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge != null && (
              <span style={{ background: active === item.id ? "rgba(255,255,255,.2)" : "#1e293b", color: active === item.id ? "#fff" : "#475569", fontSize: 10, padding: "1px 6px", borderRadius: 9999, fontWeight: 700, border: "1px solid #334155" }}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: "8px", borderTop: "1px solid #1e293b" }}>
        <button onClick={onLogout}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", color: "#475569", fontFamily: "inherit", fontSize: 13, transition: "all .15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,.1)"; e.currentTarget.style.color = "#f87171"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#475569"; }}
        >
          <span>⏻</span> Log Out
        </button>
      </div>
    </div>
  );
}
