/**
 * AdminDashboard.jsx
 * FOLDER: src/admin/AdminDashboard.jsx
 *
 * Changes:
 *  - Pass setUsers to AdminViewAccounts (needed for deactivate/reactivate)
 */
import React, { useState } from "react";
import Sidebar             from "../components/Sidebar";
import Dashboard           from "../components/Dashboard";
import AdminOverview       from "./pages/AdminOverview";
import AdminCreateAccounts from "./pages/AdminCreateAccounts";
import AdminCreateCourses  from "./pages/AdminCreateCourses";
import AdminViewAccounts   from "./pages/AdminViewAccounts";
import AdminDepartments    from "./pages/AdminDepartments";
import AdminPrograms       from "./pages/AdminPrograms";
import AdminSubAccounts    from "./pages/AdminSubAccounts";
import ChatPage            from "../components/ChatPage";

export default function AdminDashboard({ user, onLogout, users, setUsers, courses, setCourses, enrollments, setEnrollments }) {
  const [page, setPage] = useState("dashboard");

  const nav = [
    { id: "dashboard",       label: "Dashboard",        icon: "🏠", badge: null },
    { id: "overview",        label: "Overview",          icon: "⬡",  badge: null },
    { id: "sub-admins",      label: "Sub-Admins",        icon: "🛡️", badge: null },
    { id: "create-accounts", label: "Create Accounts",   icon: "➕",  badge: null },
    { id: "create-courses",  label: "Course Management", icon: "📚", badge: courses.length },
    { id: "view-accounts",   label: "Account Directory", icon: "👥", badge: users.filter(u => u.role !== "admin").length },
    { id: "departments",     label: "Departments",       icon: "🏛️", badge: null },
    { id: "programs",        label: "Programs",          icon: "🎓", badge: null },
    { id: "chat",            label: "Chat",              icon: "💬", badge: null },
  ];

  const pages = {
    "dashboard":        <Dashboard user={user} courses={courses} enrollments={enrollments} />,
    "overview":         <AdminOverview users={users} courses={courses} enrollments={enrollments} />,
    "sub-admins":       <AdminSubAccounts user={user} />,
    "create-accounts":  <AdminCreateAccounts users={users} setUsers={setUsers} />,
    "create-courses":   <AdminCreateCourses courses={courses} setCourses={setCourses} users={users} enrollments={enrollments} setEnrollments={setEnrollments} />,
    "view-accounts":    <AdminViewAccounts users={users} setUsers={setUsers} />,
    "departments":      <AdminDepartments />,
    "programs":         <AdminPrograms />,
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
