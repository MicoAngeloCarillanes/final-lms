/**
 * TeacherDashboard.jsx — REPLACE existing file
 * Adds: Dashboard home, Chat
 *
 * FOLDER: src/teacher/TeacherDashboard.jsx
 */
import React, { useState } from "react";
import Sidebar        from "../components/Sidebar";
import Dashboard      from "../components/Dashboard";
import TeacherCourses from "./pages/TeacherCourses";
import TeacherProfile from "./pages/TeacherProfile";
import TeacherGrades  from "./pages/TeacherGrades";
import ChatPage       from "../components/ChatPage";

export default function TeacherDashboard({ user, onLogout, onUpdateUser, courses, setCourses, allUsers, examSubmissions, enrollments }) {
  const myCourses = courses.filter(c => c.teacher === user.id);
  const [page, setPage] = useState("dashboard");

  const nav = [
    { id: "dashboard", label: "Dashboard",     icon: "🏠", badge: null },
    { id: "courses",   label: "My Courses",     icon: "📚", badge: myCourses.length },
    { id: "grades",    label: "Grade Students", icon: "📝", badge: null },
    { id: "profile",   label: "My Profile",     icon: "👤", badge: null },
    { id: "chat",      label: "Chat",           icon: "💬", badge: null },
  ];

  const pages = {
    dashboard: <Dashboard user={user} courses={courses} enrollments={enrollments} />,
    courses:   <TeacherCourses user={user} courses={courses} setCourses={setCourses} allUsers={allUsers} enrollments={enrollments} />,
    grades:    <TeacherGrades  user={user} courses={courses} allUsers={allUsers} examSubmissions={examSubmissions} enrollments={enrollments} />,
    profile:   <TeacherProfile user={user} onUpdateUser={onUpdateUser} />,
    chat:      <ChatPage user={user} />,
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
