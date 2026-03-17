import React, { useState } from "react";
import Sidebar       from "../components/Sidebar";
import Dashboard     from "../components/Dashboard";
import StudentCourses from "./pages/StudentCourses";
import StudentProfile from "./pages/StudentProfile";
import ChatPage      from "../components/ChatPage";

export default function StudentDashboard({ user, onLogout, onUpdateUser, courses, examSubmissions, onSubmitExam, enrollments }) {
  const myEnrollments = enrollments.filter(e => e.studentId === user.id);
  const [page, setPage] = useState("dashboard");

  const nav = [
    { id: "dashboard", label: "Dashboard",  icon: "🏠", badge: null },
    { id: "courses",   label: "My Courses", icon: "📚", badge: myEnrollments.length },
    { id: "profile",   label: "My Profile", icon: "👤", badge: null },
    { id: "chat",      label: "Chat",       icon: "💬", badge: null },
  ];

  const pages = {
    dashboard: <Dashboard      user={user} courses={courses} enrollments={enrollments} />,
    courses:   <StudentCourses user={user} courses={courses} onSubmitExam={onSubmitExam} examSubmissions={examSubmissions} enrollments={enrollments} />,
    profile:   <StudentProfile user={user} onUpdateUser={onUpdateUser} />,
    chat:      <ChatPage       user={user} />,
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
