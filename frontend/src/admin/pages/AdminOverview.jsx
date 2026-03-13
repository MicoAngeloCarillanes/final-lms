import React from "react";
import { StatCard, Card } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

export default function AdminOverview({ users, courses, enrollments }) {
  const students = users.filter(u => u.role === "student");
  const teachers = users.filter(u => u.role === "teacher");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Admin Overview" subtitle="System summary and quick stats" />
      <div style={{ flex: 1, padding: "18px 20px", overflow: "hidden", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, flexShrink: 0 }}>
          <StatCard icon="🎓" label="Total Students" value={students.length}    color="#10b981" bg="#d1fae5" />
          <StatCard icon="👩‍🏫" label="Total Teachers" value={teachers.length}    color="#6366f1" bg="#ede9fe" />
          <StatCard icon="📚" label="Total Courses"  value={courses.length}     color="#f59e0b" bg="#fef3c7" />
          <StatCard icon="📋" label="Enrollments"    value={enrollments.length} color="#3b82f6" bg="#dbeafe" />
        </div>

        {/* Two-column quick-look grids */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, overflow: "hidden" }}>
          <Card style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", marginBottom: 10 }}>Students</div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <LMSGrid
                columns={[
                  { field: "id",        header: "ID",       width: 90 },
                  { field: "fullName",  header: "Name" },
                  { field: "yearLevel", header: "Year",     width: 90 },
                  { field: "semester",  header: "Semester" },
                ]}
                rowData={students}
                height="100%"
                pageSize={6}
              />
            </div>
          </Card>

          <Card style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", marginBottom: 10 }}>Courses</div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <LMSGrid
                columns={[
                  { field: "code",  header: "Code",   width: 80 },
                  { field: "name",  header: "Course" },
                  { field: "units", header: "Units",  width: 55 },
                ]}
                rowData={courses}
                height="100%"
                pageSize={6}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
