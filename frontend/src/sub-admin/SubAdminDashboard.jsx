/**
 * SubAdminDashboard.jsx
 * FOLDER: src/sub-admin/SubAdminDashboard.jsx
 *
 * Two sub-admin types, determined by user.subAdminScope (fetched from sub_admins.scope in App.jsx):
 *
 *  ── Department Admin  (scope === "department") ──────────────────────────────
 *     Full access:
 *       Dashboard · Account Requests · Password Reset · Announcements · Chat
 *
 *  ── General Sub-Admin (organization / registrar / library / other) ──────────
 *     Restricted — post on the dashboard / announcements only:
 *       Dashboard · Announcements · Chat
 */
import React, { useState } from "react";
import Sidebar                 from "../components/Sidebar";
import Dashboard               from "../components/Dashboard";
import ChatPage                from "../components/ChatPage";
import SubAdminAccountRequests from "./pages/SubAdminAccountRequests";
import SubAdminPasswordReset   from "./pages/SubAdminPasswordReset";
import SubAdminAnnouncements   from "./pages/SubAdminAnnouncements";

// Scope display metadata
const SCOPE_META = {
  department:   { label: "Department Admin",   color: "#a5b4fc", bg: "rgba(99,102,241,.18)"  },
  organization: { label: "Organization Admin", color: "#34d399", bg: "rgba(16,185,129,.18)"  },
  registrar:    { label: "Registrar Admin",    color: "#fbbf24", bg: "rgba(245,158,11,.18)"  },
  library:      { label: "Library Admin",      color: "#60a5fa", bg: "rgba(59,130,246,.18)"  },
  other:        { label: "Sub-Admin",          color: "#94a3b8", bg: "rgba(100,116,139,.18)" },
};

export default function SubAdminDashboard({ user, onLogout, users }) {
  const scope       = user.subAdminScope    || "other";
  const scopeRef    = user.subAdminScopeRef || "";
  const isDeptAdmin = scope === "department";

  const [page, setPage] = useState("dashboard");

  // Department admin — full nav
  const deptNav = [
    { id: "dashboard",        label: "Dashboard",        icon: "🏠", badge: null },
    { id: "account-requests", label: "Account Requests", icon: "📥", badge: null },
    { id: "password-reset",   label: "Password Reset",   icon: "🔑", badge: null },
    { id: "announcements",    label: "Announcements",    icon: "📢", badge: null },
    { id: "chat",             label: "Chat",             icon: "💬", badge: null },
  ];

  // General sub-admin — restricted nav
  const generalNav = [
    { id: "dashboard",     label: "Dashboard",     icon: "🏠", badge: null },
    { id: "announcements", label: "Announcements", icon: "📢", badge: null },
    { id: "chat",          label: "Chat",          icon: "💬", badge: null },
  ];

  const nav = isDeptAdmin ? deptNav : generalNav;

  // Guard: if a general admin somehow navigates to a restricted page, redirect
  const allowed = isDeptAdmin
    ? ["dashboard", "account-requests", "password-reset", "announcements", "chat"]
    : ["dashboard", "announcements", "chat"];

  const activePage = allowed.includes(page) ? page : "dashboard";

  const pages = {
    "dashboard": (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <ScopeBanner scope={scope} scopeRef={scopeRef} isDeptAdmin={isDeptAdmin} />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <Dashboard user={user} courses={[]} enrollments={[]} />
        </div>
      </div>
    ),
    "account-requests": <SubAdminAccountRequests user={user} />,
    "password-reset":   <SubAdminPasswordReset   user={user} users={users} />,
    "announcements":    <SubAdminAnnouncements   user={user} />,
    "chat":             <ChatPage user={user} />,
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar
        navItems={nav}
        active={activePage}
        onNav={setPage}
        user={user}
        onLogout={onLogout}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a" }}>
        {pages[activePage]}
      </div>
    </div>
  );
}

// ── Scope banner ──────────────────────────────────────────────────────────────
function ScopeBanner({ scope, scopeRef, isDeptAdmin }) {
  const meta = SCOPE_META[scope] || SCOPE_META.other;
  return (
    <div style={{
      background: "#1e293b",
      borderBottom: "1px solid #334155",
      padding: "10px 22px",
      display: "flex",
      alignItems: "center",
      gap: 14,
      flexShrink: 0,
    }}>
      <span style={{
        background:    meta.bg,
        color:         meta.color,
        fontSize:      11,
        fontWeight:    800,
        padding:       "4px 12px",
        borderRadius:  9999,
        letterSpacing: "0.04em",
        whiteSpace:    "nowrap",
      }}>
        {meta.label}
      </span>

      {scopeRef && (
        <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>
          {scopeRef}
        </span>
      )}

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: 11, color: "#334155", fontStyle: "italic" }}>
        {isDeptAdmin
          ? "Full access · Accounts, passwords, announcements & chat"
          : "Limited access · Announcements & chat only"}
      </span>
    </div>
  );
}
