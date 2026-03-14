/**
 * SubAdminDashboard.jsx
 * FOLDER: src/sub-admin/SubAdminDashboard.jsx  (new folder + file)
 *
 * The dashboard for department/org/registrar sub-admins.
 * They can:
 *   - View their scope (department/org they manage)
 *   - Submit account creation requests (student/teacher) for main-admin approval
 *   - Reset passwords for users in their scope
 *   - Post announcements
 *   - Chat
 */
import React, { useState } from "react";
import Sidebar        from "../components/Sidebar";
import Dashboard      from "../components/Dashboard";
import ChatPage       from "../components/ChatPage";
import SubAdminAccountRequests from "./pages/SubAdminAccountRequests";
import SubAdminPasswordReset   from "./pages/SubAdminPasswordReset";

export default function SubAdminDashboard({ user, onLogout, users }) {
  const [page, setPage] = useState("dashboard");

  const nav = [
    { id: "dashboard",        label: "Dashboard",         icon: "🏠", badge: null },
    { id: "account-requests", label: "Account Requests",  icon: "📥", badge: null },
    { id: "password-reset",   label: "Password Reset",    icon: "🔑", badge: null },
    { id: "chat",             label: "Chat",              icon: "💬", badge: null },
  ];

  const pages = {
    "dashboard":        <Dashboard user={user} courses={[]} enrollments={[]} />,
    "account-requests": <SubAdminAccountRequests user={user} />,
    "password-reset":   <SubAdminPasswordReset user={user} users={users} />,
    "chat":             <ChatPage user={user} />,
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar navItems={nav} active={page} onNav={setPage} user={user} onLogout={onLogout} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a" }}>
        {pages[page]}
      </div>
    </div>
  );
}
