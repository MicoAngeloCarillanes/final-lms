import React, { useState } from "react";
import { supabase } from "../../supabaseClient";
import { gradeColor } from "../../lib/helpers";
import { Badge, Btn, Input, Sel, FF, Card, Toast } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";
import TabBar  from "../../components/TabBar";

export default function AdminCreateCourses({ courses, setCourses, users, enrollments: enrollmentsProp, setEnrollments }) {
  const teachers  = users.filter(u => u.role === "teacher");
  const students  = users.filter(u => u.role === "student");
  const [tab,   setTab]   = useState("courses");
  const [toast, setToast] = useState("");
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // ── Course create form ───────────────────────────────────────────────────────
  const emptyC = { code: "", name: "", teacher: "", schedule: "", units: "3", yearLevel: "1st Year", semester: "1st Semester" };
  const [cf,   setCf]   = useState(emptyC);
  const updC = (f, v) => setCf(p => ({ ...p, [f]: v }));

  // ── Enroll / assign forms ────────────────────────────────────────────────────
  const [enroll,  setEnroll]  = useState({ studentId: "", courseId: "" });
  const [tAssign, setTAssign] = useState({ teacherId: "", courseId: "" });

  // Use App-level enrollments directly — survives navigation and re-login
  const myEnrolls = enrollmentsProp || [];

  // ── Selected course + modals ─────────────────────────────────────────────────
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [confirmModal,   setConfirmModal]   = useState(null);   // { type: "delete"|"clear", course }
  const [editModal,      setEditModal]      = useState(null);   // { course, schedule, yearLevel, semester }
  const [editSaving,     setEditSaving]     = useState(false);

  // ── addCourse ─────────────────────────────────────────────────────────────────
  const addCourse = async () => {
    if (!cf.code.trim() || !cf.name.trim()) return;
    const t = teachers.find(x => x.id === cf.teacher);

    // 1. Insert the course row
    const { data: newCourse, error } = await supabase
      .from("courses")
      .insert({
        course_code: cf.code.trim().toUpperCase(),
        course_name: cf.name.trim(),
        units:       parseInt(cf.units) || 3,
      })
      .select()
      .single();
    if (error) {
      showToast(error.message.includes("unique") ? "Course code already exists." : "Error: " + error.message);
      return;
    }

    // 2. Insert/update schedule using atomic RPC (handles enum casting)
    let scheduleId = null;
    if (cf.schedule.trim()) {
      const { data: sid, error: schErr } = await supabase.rpc("upsert_course_schedule", {
        p_course_id:      newCourse.course_id,
        p_schedule_label: cf.schedule.trim(),
        p_academic_year:  "2025-2026",
        p_semester:       cf.semester  || null,
        p_year_level:     cf.yearLevel || null,
      });
      if (!schErr) scheduleId = sid;
    }

    // 3. Assign teacher using atomic RPC
    if (t?._uuid) {
      await supabase.rpc("assign_teacher_to_course", {
        p_teacher_id:    t._uuid,
        p_course_id:     newCourse.course_id,
        p_academic_year: "2025-2026",
        p_semester:      cf.semester || null,
      });
    }

    setCourses(prev => [...prev, {
      id:          newCourse.course_code,
      code:        newCourse.course_code,
      name:        newCourse.course_name,
      units:       newCourse.units,
      teacher:     cf.teacher || "",
      teacherName: t?.fullName || "Unassigned",
      schedule:    cf.schedule || "",
      yearLevel:   cf.yearLevel || "",
      semester:    cf.semester  || "",
      _uuid:       newCourse.course_id,
    }]);
    setCf(emptyC);
    showToast("Course created successfully!");
  };

  // ── assignStudent ─────────────────────────────────────────────────────────────
  const assignStudent = async () => {
    if (!enroll.studentId || !enroll.courseId) return;

    // Client-side duplicate guard
    if (myEnrolls.find(e => e.studentId === enroll.studentId && e.courseId === enroll.courseId)) {
      showToast("Student is already enrolled in this course."); return;
    }

    const [uRes, cRes] = await Promise.all([
      supabase.from("users").select("user_id").eq("display_id", enroll.studentId).single(),
      supabase.from("courses").select("course_id").eq("course_code", enroll.courseId).single(),
    ]);
    if (uRes.error || cRes.error) { showToast("Could not find student or course."); return; }

    const { error } = await supabase.rpc("enroll_student", {
      p_student_id:    uRes.data.user_id,
      p_course_id:     cRes.data.course_id,
      p_academic_year: "2025-2026",
      p_semester:      "1st Semester",
    });

    if (error) { showToast("Error: " + error.message); return; }

    setEnrollments(prev => [...prev, {
      studentId: enroll.studentId,
      courseId:  enroll.courseId,
      grade:     null,
      status:    "Enrolled",
    }]);
    setEnroll({ studentId: "", courseId: "" });
    showToast("Student enrolled!");
  };

  // ── assignTeacher ─────────────────────────────────────────────────────────────
  const assignTeacher = async () => {
    if (!tAssign.teacherId || !tAssign.courseId) return;
    const t = teachers.find(x => x.id === tAssign.teacherId);

    const [uRes, cRes] = await Promise.all([
      supabase.from("users").select("user_id").eq("display_id", tAssign.teacherId).single(),
      supabase.from("courses").select("course_id").eq("course_code", tAssign.courseId).single(),
    ]);
    if (uRes.error || cRes.error) { showToast("Could not find teacher or course."); return; }

    // Use atomic RPC — INSERT ... ON CONFLICT DO UPDATE in one DB transaction
    const { error } = await supabase.rpc("assign_teacher_to_course", {
      p_teacher_id:    uRes.data.user_id,
      p_course_id:     cRes.data.course_id,
      p_academic_year: "2025-2026",
      p_semester:      "1st Semester",
    });

    if (error) { showToast("Error: " + error.message); return; }

    setCourses(prev => prev.map(c =>
      c.id === tAssign.courseId
        ? { ...c, teacher: tAssign.teacherId, teacherName: t?.fullName || "" }
        : c
    ));
    setTAssign({ teacherId: "", courseId: "" });
    showToast("Teacher assigned!");
  };

  // ── openEditModal ─────────────────────────────────────────────────────────────
  const openEditModal = (course) => {
    setEditModal({
      course,
      schedule:  course.schedule  || "",
      yearLevel: course.yearLevel || "1st Year",
      semester:  course.semester  || "1st Semester",
    });
  };

  // ── saveCourseEdit ────────────────────────────────────────────────────────────
  const saveCourseEdit = async () => {
    if (!editModal) return;
    setEditSaving(true);
    const { course, schedule, yearLevel, semester } = editModal;

    // Use RPC for both create and update — handles USER-DEFINED enum casting
    // and the UNIQUE(course_id) constraint on schedules atomically.
    const { error } = await supabase.rpc("upsert_course_schedule", {
      p_course_id:      course._uuid,
      p_schedule_label: schedule.trim() || null,
      p_academic_year:  "2025-2026",
      p_semester:       semester  || null,
      p_year_level:     yearLevel || null,
    });

    if (error) { showToast("Error saving: " + error.message); setEditSaving(false); return; }

    setCourses(prev => prev.map(c =>
      c._uuid === course._uuid ? { ...c, schedule, yearLevel, semester } : c
    ));
    setSelectedCourse(prev =>
      prev?._uuid === course._uuid ? { ...prev, schedule, yearLevel, semester } : prev
    );
    setEditModal(null);
    setEditSaving(false);
    showToast(`"${course.name}" updated!`);
  };

  // ── deleteCourse ──────────────────────────────────────────────────────────────
  const deleteCourse = async (course) => {
    const { error } = await supabase.from("courses").delete().eq("course_id", course._uuid);
    if (error) { showToast("Error deleting course: " + error.message); return; }
    setCourses(prev => prev.filter(c => c._uuid !== course._uuid));
    setEnrollments(prev => prev.filter(e => e.courseId !== course.id));
    setSelectedCourse(null);
    setConfirmModal(null);
    showToast(`"${course.name}" deleted.`);
  };

  // ── clearCourseData ───────────────────────────────────────────────────────────
  const clearCourseData = async (course) => {
    const [matErr, examErr, enrollErr] = await Promise.all([
      supabase.from("materials").delete().eq("course_id", course._uuid).then(r => r.error),
      supabase.from("exams").delete().eq("course_id", course._uuid).then(r => r.error),
      supabase.from("student_course_assignments").delete().eq("course_id", course._uuid).then(r => r.error),
    ]);
    await supabase.from("teacher_course_assignments").delete().eq("course_id", course._uuid);
    if (matErr || examErr || enrollErr) { showToast("Partial error clearing data."); return; }
    setEnrollments(prev => prev.filter(e => e.courseId !== course.id));
    setCourses(prev => prev.map(c =>
      c._uuid === course._uuid ? { ...c, teacher: "", teacherName: "Unassigned" } : c
    ));
    setConfirmModal(null);
    showToast(`All data cleared for "${course.name}".`);
  };

  // ── Column definitions ────────────────────────────────────────────────────────
  const courseCols = [
    { field: "code",        header: "Code",        width: 80 },
    { field: "name",        header: "Course Name" },
    { field: "teacherName", header: "Teacher",     width: 180 },
    { field: "schedule",    header: "Schedule",    width: 155 },
    { field: "units",       header: "Units",       width: 55 },
    { field: "yearLevel",   header: "Year",        width: 90 },
    { field: "semester",    header: "Semester",    width: 110 },
    { field: "status",      header: "Status",      width: 90,
      cellRenderer: v => (
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
          background: v === "Finished" ? "#fef3c7" : "#dcfce7",
          color:      v === "Finished" ? "#92400e" : "#166534" }}>
          {v || "Ongoing"}
        </span>
      )},
  ];

  const enrollCols = [
    { field: "studentName", header: "Student",  width: 160 },
    { field: "courseCode",  header: "Code",     width: 80 },
    { field: "courseName",  header: "Course" },
    { field: "grade",       header: "Grade",    width: 70,
      cellRenderer: v => v != null
        ? <span style={{ fontWeight: 700, color: gradeColor(v) }}>{v}%</span>
        : <Badge>Pending</Badge> },
    { field: "status",      header: "Status",   width: 90,
      cellRenderer: v => <Badge color="success">{v}</Badge> },
  ];

  const enrollRows = myEnrolls.map(e => ({
    ...e,
    studentName: users.find(u => u.id === e.studentId)?.fullName || e.studentId,
    courseCode:  courses.find(c => c.id === e.courseId)?.code    || e.courseId,
    courseName:  courses.find(c => c.id === e.courseId)?.name    || e.courseId,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Course Management" subtitle="Admin · Courses, Schedules & Assignments" />
      <TabBar
        tabs={[
          { id: "courses",  label: "📚 Courses" },
          { id: "enroll",   label: "🎓 Assign Students" },
          { id: "teachers", label: "👩‍🏫 Assign Teachers" },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

        {/* ════════════════════ COURSES TAB ════════════════════ */}
        {tab === "courses" && (
          <>
            {/* Create form panel */}
            <div style={{ width: 300, borderRight: "1px solid #334155", padding: 16, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", background: "#1e293b" }}>
              <Toast msg={toast} />
              <FF label="Course Code" required><Input value={cf.code} onChange={e => updC("code", e.target.value)} placeholder="e.g. CS101" /></FF>
              <FF label="Course Name" required><Input value={cf.name} onChange={e => updC("name", e.target.value)} placeholder="e.g. Intro to CS" /></FF>
              <FF label="Assign Teacher">
                <Sel value={cf.teacher} onChange={e => updC("teacher", e.target.value)}>
                  <option value="">— Select Teacher —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                </Sel>
              </FF>
              <FF label="Schedule"><Input value={cf.schedule} onChange={e => updC("schedule", e.target.value)} placeholder="e.g. MWF 8:00–9:00 AM" /></FF>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <FF label="Units">
                  <Sel value={cf.units} onChange={e => updC("units", e.target.value)}>
                    {["1", "2", "3", "4", "5", "6"].map(u => <option key={u}>{u}</option>)}
                  </Sel>
                </FF>
                <FF label="Year">
                  <Sel value={cf.yearLevel} onChange={e => updC("yearLevel", e.target.value)}>
                    {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => <option key={y}>{y}</option>)}
                  </Sel>
                </FF>
              </div>
              <FF label="Semester">
                <Sel value={cf.semester} onChange={e => updC("semester", e.target.value)}>
                  {["1st Semester", "2nd Semester", "Summer"].map(s => <option key={s}>{s}</option>)}
                </Sel>
              </FF>
              <Btn onClick={addCourse} style={{ marginTop: 4 }}>✦ Create Course</Btn>
            </div>

            {/* Course grid + action bar */}
            <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  All Courses ({courses.length})
                </div>
                {selectedCourse && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>{selectedCourse.code} selected</span>
                    <Btn size="sm" variant="secondary"
                      onClick={() => openEditModal(selectedCourse)}
                      style={{ fontSize: 11, borderColor: "#6366f1", color: "#4338ca", background: "rgba(99,102,241,.15)" }}>
                      ✏ Edit Course
                    </Btn>
                    <Btn size="sm" variant="secondary"
                      onClick={() => setConfirmModal({ type: "clear", course: selectedCourse })}
                      style={{ fontSize: 11, borderColor: "#f59e0b", color: "#fbbf24", background: "rgba(245,158,11,.15)" }}>
                      🧹 Clear Data
                    </Btn>
                    <Btn size="sm" variant="danger"
                      onClick={() => setConfirmModal({ type: "delete", course: selectedCourse })}>
                      🗑 Delete Course
                    </Btn>
                    <button onClick={() => setSelectedCourse(null)}
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#475569", fontSize: 16 }}>×</button>
                  </div>
                )}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <LMSGrid
                  columns={courseCols}
                  rowData={courses}
                  onRowClick={c => setSelectedCourse(prev => prev?._uuid === c._uuid ? null : c)}
                  selectedId={selectedCourse?.id}
                  height="100%"
                />
              </div>
            </div>
          </>
        )}

        {/* ════════════════ EDIT COURSE MODAL ════════════════ */}
        {editModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#1e293b", borderRadius: 14, padding: 28, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>✏ Edit Course Details</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 18 }}>
                Updating <strong>{editModal.course.code}</strong> — {editModal.course.name}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <FF label="Schedule">
                  <Input
                    value={editModal.schedule}
                    onChange={e => setEditModal(m => ({ ...m, schedule: e.target.value }))}
                    placeholder="e.g. MWF 8:00–9:00 AM"
                  />
                </FF>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <FF label="Year Level">
                    <Sel value={editModal.yearLevel} onChange={e => setEditModal(m => ({ ...m, yearLevel: e.target.value }))}>
                      {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => <option key={y}>{y}</option>)}
                    </Sel>
                  </FF>
                  <FF label="Semester">
                    <Sel value={editModal.semester} onChange={e => setEditModal(m => ({ ...m, semester: e.target.value }))}>
                      {["1st Semester", "2nd Semester", "Summer"].map(s => <option key={s}>{s}</option>)}
                    </Sel>
                  </FF>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
                <Btn variant="secondary" size="sm" onClick={() => setEditModal(null)} disabled={editSaving}>Cancel</Btn>
                <Btn size="sm" onClick={saveCourseEdit} disabled={editSaving}>
                  {editSaving ? "⏳ Saving…" : "💾 Save Changes"}
                </Btn>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ CONFIRM MODAL (delete / clear) ════════════════ */}
        {confirmModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#1e293b", borderRadius: 14, padding: 28, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>
                {confirmModal.type === "delete" ? "🗑" : "🧹"}
              </div>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", marginBottom: 6 }}>
                {confirmModal.type === "delete" ? "Delete Course" : "Clear Course Data"}
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 18, lineHeight: 1.6 }}>
                {confirmModal.type === "delete"
                  ? <>Are you sure you want to <strong>permanently delete</strong> <em>{confirmModal.course.name}</em>? This will remove all materials, exams, submissions, and enrollments. This cannot be undone.</>
                  : <>This will delete all <strong>materials, exams, student enrollments, and teacher assignments</strong> for <em>{confirmModal.course.name}</em>, but keep the course itself. This cannot be undone.</>
                }
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn variant="secondary" size="sm" onClick={() => setConfirmModal(null)}>Cancel</Btn>
                <Btn variant="danger" size="sm" onClick={() =>
                  confirmModal.type === "delete"
                    ? deleteCourse(confirmModal.course)
                    : clearCourseData(confirmModal.course)
                }>
                  {confirmModal.type === "delete" ? "Yes, Delete" : "Yes, Clear"}
                </Btn>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════ ENROLL TAB ════════════════════ */}
        {tab === "enroll" && (
          <div style={{ flex: 1, padding: 18, display: "flex", gap: 16, overflow: "hidden" }}>
            <Card style={{ width: 268, display: "flex", flexDirection: "column", gap: 11, flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>Enroll Student</div>
              <Toast msg={toast} />
              <FF label="Student">
                <Sel value={enroll.studentId} onChange={e => setEnroll(f => ({ ...f, studentId: e.target.value }))}>
                  <option value="">— Select Student —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                </Sel>
              </FF>
              <FF label="Course">
                <Sel value={enroll.courseId} onChange={e => setEnroll(f => ({ ...f, courseId: e.target.value }))}>
                  <option value="">— Select Course —</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
                </Sel>
              </FF>
              <Btn onClick={assignStudent}>Enroll Student</Btn>
            </Card>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Current Enrollments ({enrollRows.length})
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <LMSGrid columns={enrollCols} rowData={enrollRows} height="100%" />
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════ TEACHERS TAB ════════════════════ */}
        {tab === "teachers" && (
          <div style={{ flex: 1, padding: 18, display: "flex", gap: 16, overflow: "hidden" }}>
            <Card style={{ width: 268, display: "flex", flexDirection: "column", gap: 11, flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>Assign Teacher</div>
              <Toast msg={toast} />
              <FF label="Teacher">
                <Sel value={tAssign.teacherId} onChange={e => setTAssign(f => ({ ...f, teacherId: e.target.value }))}>
                  <option value="">— Select Teacher —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                </Sel>
              </FF>
              <FF label="Course">
                <Sel value={tAssign.courseId} onChange={e => setTAssign(f => ({ ...f, courseId: e.target.value }))}>
                  <option value="">— Select Course —</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
                </Sel>
              </FF>
              <Btn onClick={assignTeacher}>Assign Teacher</Btn>
            </Card>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Teacher – Course Assignments
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <LMSGrid
                  columns={[
                    { field: "teacherName", header: "Teacher",  width: 180 },
                    { field: "code",        header: "Code",     width: 80 },
                    { field: "name",        header: "Course Name" },
                    { field: "schedule",    header: "Schedule", width: 155 },
                    { field: "units",       header: "Units",    width: 55 },
                  ]}
                  rowData={courses}
                  height="100%"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
