import React, { useState } from "react";
import Sidebar               from "../components/Sidebar";
import Dashboard             from "../components/Dashboard";
import AdminOverview         from "./pages/AdminOverview";
import AdminAccounts         from "./pages/AdminAccounts";
import AdminCourseManagement from "./pages/AdminCourseManagement";
import AdminSubAccounts      from "./pages/AdminSubAccounts";
import AdminSchoolYear       from "./pages/AdminSchoolYear";
import AdminCourseOfferings  from "./pages/AdminCourseOfferings";
import ChatPage              from "../components/ChatPage";

export default function AdminDashboard({ user, onLogout, users, setUsers, courses, setCourses, enrollments, setEnrollments }) {
  const [page, setPage] = useState("dashboard");

  const studentTeacherCount = users.filter(u => u.role === "student" || u.role === "teacher").length;

  const nav = [
    { id: "dashboard",  label: "Dashboard",        icon: "🏠", badge: null },
    { id: "overview",   label: "Overview",          icon: "⬡",  badge: null },
    { id: "sub-admins", label: "Sub-Admins",        icon: "🛡️", badge: null },
    { id: "accounts",   label: "Accounts",          icon: "👥", badge: studentTeacherCount },
    { id: "courses",    label: "Course Management", icon: "📚", badge: courses.length },
    { id: "offerings",  label: "Course Offerings",  icon: "📅", badge: null },
    { id: "school-year",label: "School Years",      icon: "🗓️", badge: null },
    { id: "chat",       label: "Chat",              icon: "💬", badge: null },
  ];

  const pages = {
    "dashboard":   <Dashboard user={user} courses={courses} enrollments={enrollments} />,
    "overview":    <AdminOverview users={users} courses={courses} enrollments={enrollments} />,
    "sub-admins":  <AdminSubAccounts user={user} />,
    "accounts":    <AdminAccounts users={users} setUsers={setUsers} />,
    "courses":     <AdminCourseManagement courses={courses} setCourses={setCourses} users={users} enrollments={enrollments} setEnrollments={setEnrollments} />,
    "offerings":   <AdminCourseOfferings />,
    "school-year": <AdminSchoolYear user={user} />,
    "chat":        <ChatPage user={user} courses={courses} enrollments={enrollments} />,
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
