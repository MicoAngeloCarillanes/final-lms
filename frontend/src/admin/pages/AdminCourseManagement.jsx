/**
 * AdminCourseManagement.jsx
 * FOLDER: src/admin/pages/AdminCourseManagement.jsx
 *
 * Replaces AdminDepartments + AdminPrograms + AdminCreateCourses
 * with a single unified three-level drill-down:
 *
 *   Departments → Programs (of selected dept) → Courses (of selected program)
 *                                                    ↓
 *                                          Teacher & Students panel
 *
 * Navigation breadcrumb at top shows current position.
 * Each level shows its own list + create/edit form.
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { departmentApi, programApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF, Toast } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

// ─── Shared helpers ───────────────────────────────────────────────────────────
const S = {
  pane:    { width: 300, borderRight: "1px solid #334155", background: "#1e293b", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flexShrink: 0 },
  grid:    { flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8 },
  label:   { fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" },
  section: { borderTop: "1px solid #334155", paddingTop: 10, marginTop: 4 },
};

const PaneHeader = ({ title, sub }) => (
  <div style={{ marginBottom: 4 }}>
    <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>{title}</div>
    {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sub}</div>}
  </div>
);

const emptyDept   = { code: "", name: "", room: "", email: "", phone: "", description: "" };
const emptyProg   = { code: "", name: "", description: "" };
const emptyCourse = { code: "", name: "", units: "3", schedule: "", yearLevel: "1st Year", semester: "1st Semester" };

// ─── Delete confirm modal ─────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "24px 26px", width: 400, maxWidth: "90vw" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9", marginBottom: 8 }}>{title}</div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger"    onClick={onConfirm}>Delete</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminCourseManagement({ courses, setCourses, users, enrollments, setEnrollments }) {
  const teachers = users.filter(u => u.role === "teacher");
  const students = users.filter(u => u.role === "student");

  // ── Level state ──────────────────────────────────────────────────────────────
  const [level,       setLevel]       = useState("dept");    // "dept" | "prog" | "course"
  const [selDept,     setSelDept]     = useState(null);
  const [selProg,     setSelProg]     = useState(null);
  const [selCourse,   setSelCourse]   = useState(null);

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [depts,       setDepts]       = useState([]);
  const [progs,       setProgs]       = useState([]);
  const [progCourses, setProgCourses] = useState([]);  // courses for selected program
  const [loading,     setLoading]     = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [deptForm,    setDeptForm]    = useState(emptyDept);
  const [progForm,    setProgForm]    = useState(emptyProg);
  const [courseForm,  setCourseForm]  = useState(emptyCourse);
  const [editingId,   setEditingId]   = useState(null);   // id of item being edited

  // ── Toast / confirm ───────────────────────────────────────────────────────────
  const [toast,       setToast]       = useState({ msg: "", type: "success" });
  const [confirmDel,  setConfirmDel]  = useState(null);   // { type, item }

  // ── Enroll / teacher assign ───────────────────────────────────────────────────
  const [enroll,      setEnroll]      = useState({ studentId: "" });
  const [teacherSel,  setTeacherSel]  = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 2800);
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  DATA LOADING
  // ════════════════════════════════════════════════════════════════════════════

  const loadDepts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await departmentApi.getList({ size: 100 });
      setDepts(res.items ?? []);
    } catch (e) { showToast(e.message, "error"); }
    setLoading(false);
  }, []);

  const loadProgs = useCallback(async (deptId) => {
    setLoading(true);
    try {
      const res = await programApi.getList({ size: 100 });
      setProgs((res.items ?? []).filter(p => p.departmentId === deptId));
    } catch (e) { showToast(e.message, "error"); }
    setLoading(false);
  }, []);

  const loadCourses = useCallback(async (programId) => {
    setLoading(true);
    try {
      // Fetch courses + schedules in one query
      const { data: courseData, error: courseErr } = await supabase
        .from("courses")
        .select(`
          course_id, course_code, course_name, units, status, is_active, program_id,
          schedules ( schedule_id, schedule_label, year_level, semester )
        `)
        .eq("program_id", programId)
        .eq("is_active", true);
      if (courseErr) throw new Error(courseErr.message);

      const courseIds = (courseData ?? []).map(c => c.course_id);

      // Fetch teacher assignments separately with explicit ORDER so latest wins.
      // Supabase embedded select ordering does NOT sort nested arrays —
      // only a top-level query guarantees the correct ORDER BY.
      let tcaMap = {};
      if (courseIds.length) {
        const { data: tcaData } = await supabase
          .from("teacher_course_assignments")
          .select("course_id, teacher_id, assigned_at")
          .in("course_id", courseIds)
          .order("assigned_at", { ascending: false });

        // Keep only the LATEST assignment per course (first row after ORDER BY DESC)
        (tcaData ?? []).forEach(row => {
          if (!tcaMap[row.course_id]) tcaMap[row.course_id] = row.teacher_id;
        });
      }

      const enriched = (courseData ?? []).map(c => {
        const sch     = c.schedules?.[0];
        const tId     = tcaMap[c.course_id] ?? null;
        const teacher = tId ? users.find(u => u._uuid === tId) : null;
        return {
          _uuid:       c.course_id,
          id:          c.course_code,
          code:        c.course_code,
          name:        c.course_name,
          units:       c.units,
          status:      c.status || "Ongoing",
          programId:   c.program_id,
          schedule:    sch?.schedule_label  || "",
          yearLevel:   sch?.year_level      || "",
          semester:    sch?.semester        || "",
          _scheduleId: sch?.schedule_id     || null,
          teacherId:   tId,
          teacherName: teacher?.fullName    || "Unassigned",
        };
      });
      setProgCourses(enriched);
    } catch (e) { showToast(e.message, "error"); }
    setLoading(false);
  }, [users]);

  useEffect(() => { loadDepts(); }, [loadDepts]);

  // ════════════════════════════════════════════════════════════════════════════
  //  NAVIGATION
  // ════════════════════════════════════════════════════════════════════════════

  const drillDept = async (dept) => {
    setSelDept(dept); setSelProg(null); setSelCourse(null);
    setEditingId(null); setProgForm(emptyProg); setProgCourses([]);
    setLevel("prog");
    await loadProgs(dept.departmentId);
  };

  const drillProg = async (prog) => {
    setSelProg(prog); setSelCourse(null);
    setEditingId(null); setCourseForm(emptyCourse);
    setLevel("course");
    await loadCourses(prog.programId);
  };

  const goBack = () => {
    if (level === "course") { setLevel("prog"); setSelProg(null); setSelCourse(null); setProgCourses([]); }
    if (level === "prog")   { setLevel("dept"); setSelDept(null); setProgs([]); }
    setEditingId(null);
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  DEPARTMENT CRUD
  // ════════════════════════════════════════════════════════════════════════════

  const saveDept = async () => {
    if (!deptForm.code.trim() || !deptForm.name.trim()) { showToast("Code and Name required.", "error"); return; }
    try {
      if (editingId) {
        await departmentApi.update({ departmentId: editingId, ...deptForm });
        setDepts(prev => prev.map(d => d.departmentId === editingId ? { ...d, ...deptForm } : d));
        showToast("Department updated.");
      } else {
        await departmentApi.create(deptForm);
        showToast("Department created.");
        await loadDepts();
      }
      setDeptForm(emptyDept); setEditingId(null);
    } catch (e) { showToast(e.message, "error"); }
  };

  const deleteDept = async (dept) => {
    try {
      await departmentApi.delete(dept.departmentId);
      setDepts(prev => prev.filter(d => d.departmentId !== dept.departmentId));
      setConfirmDel(null);
      showToast("Department deleted.");
    } catch (e) { showToast(e.message, "error"); }
  };

  const toggleDeptActive = async (dept) => {
    const next = dept.isActive === 1 ? 0 : 1;
    try {
      await departmentApi.setActive(dept.departmentId, next);
      setDepts(prev => prev.map(d => d.departmentId === dept.departmentId ? { ...d, isActive: next } : d));
    } catch (e) { showToast(e.message, "error"); }
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  PROGRAM CRUD
  // ════════════════════════════════════════════════════════════════════════════

  const saveProg = async () => {
    if (!progForm.code.trim() || !progForm.name.trim()) { showToast("Code and Name required.", "error"); return; }
    try {
      if (editingId) {
        await programApi.update({ programId: editingId, ...progForm, departmentId: selDept.departmentId });
        setProgs(prev => prev.map(p => p.programId === editingId ? { ...p, ...progForm } : p));
        showToast("Program updated.");
      } else {
        await programApi.create({ ...progForm, departmentId: selDept.departmentId });
        showToast("Program created.");
        await loadProgs(selDept.departmentId);
      }
      setProgForm(emptyProg); setEditingId(null);
    } catch (e) { showToast(e.message, "error"); }
  };

  const deleteProg = async (prog) => {
    try {
      await programApi.delete(prog.programId);
      setProgs(prev => prev.filter(p => p.programId !== prog.programId));
      setConfirmDel(null);
      showToast("Program deleted.");
    } catch (e) { showToast(e.message, "error"); }
  };

  const toggleProgActive = async (prog) => {
    const next = prog.isActive === 1 ? 0 : 1;
    try {
      await programApi.setActive(prog.programId, next);
      setProgs(prev => prev.map(p => p.programId === prog.programId ? { ...p, isActive: next } : p));
    } catch (e) { showToast(e.message, "error"); }
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  COURSE CRUD
  // ════════════════════════════════════════════════════════════════════════════

  const saveCourse = async () => {
    if (!courseForm.code.trim() || !courseForm.name.trim()) { showToast("Code and Name required.", "error"); return; }
    try {
      if (editingId) {
        // Update course row
        await supabase.from("courses").update({
          course_code: courseForm.code.trim().toUpperCase(),
          course_name: courseForm.name.trim(),
          units:       parseInt(courseForm.units) || 3,
        }).eq("course_id", editingId);

        // Update or insert schedule using RPC (handles USER-DEFINED enum casting)
        const editing = progCourses.find(c => c._uuid === editingId);
        await supabase.rpc("upsert_course_schedule", {
          p_course_id:      editingId,
          p_schedule_label: courseForm.schedule,
          p_academic_year:  "2025-2026",
          p_semester:       courseForm.semester  || null,
          p_year_level:     courseForm.yearLevel || null,
        });

        setProgCourses(prev => prev.map(c => c._uuid === editingId
          ? { ...c, code: courseForm.code.trim().toUpperCase(), name: courseForm.name.trim(), units: parseInt(courseForm.units) || 3, schedule: courseForm.schedule, yearLevel: courseForm.yearLevel, semester: courseForm.semester }
          : c
        ));
        showToast("Course updated.");
        setEditingId(null); setCourseForm(emptyCourse);
      } else {
        // Create new course linked to program
        const { data: newCourse, error } = await supabase.from("courses").insert({
          course_code: courseForm.code.trim().toUpperCase(),
          course_name: courseForm.name.trim(),
          units:       parseInt(courseForm.units) || 3,
          program_id:  selProg.programId,
        }).select().single();
        if (error) { showToast(error.message.includes("unique") ? "Course code already exists." : error.message, "error"); return; }

        let scheduleId = null;
        if (courseForm.schedule.trim()) {
          const { data: sid, error: schErr } = await supabase.rpc("upsert_course_schedule", {
            p_course_id:      newCourse.course_id,
            p_schedule_label: courseForm.schedule.trim(),
            p_academic_year:  "2025-2026",
            p_semester:       courseForm.semester  || null,
            p_year_level:     courseForm.yearLevel || null,
          });
          if (!schErr) scheduleId = sid;
        }

        const newRow = {
          _uuid:       newCourse.course_id,
          id:          newCourse.course_code,
          code:        newCourse.course_code,
          name:        newCourse.course_name,
          units:       newCourse.units,
          status:      "Ongoing",
          programId:   selProg.programId,
          schedule:    courseForm.schedule,
          yearLevel:   courseForm.yearLevel,
          semester:    courseForm.semester,
          _scheduleId: scheduleId,
          teacherId:   null,
          teacherName: "Unassigned",
        };
        setProgCourses(prev => [...prev, newRow]);
        setCourses(prev => [...prev, newRow]);
        setCourseForm(emptyCourse);
        showToast("Course created.");
      }
    } catch (e) { showToast(e.message, "error"); }
  };

  const deleteCourse = async (course) => {
    try {
      await Promise.all([
        supabase.from("materials").delete().eq("course_id", course._uuid),
        supabase.from("exams").delete().eq("course_id", course._uuid),
        supabase.from("student_course_assignments").delete().eq("course_id", course._uuid),
        supabase.from("teacher_course_assignments").delete().eq("course_id", course._uuid),
      ]);
      await supabase.from("courses").delete().eq("course_id", course._uuid);
      setProgCourses(prev => prev.filter(c => c._uuid !== course._uuid));
      setCourses(prev => prev.filter(c => c._uuid !== course._uuid));
      setEnrollments(prev => prev.filter(e => e.courseId !== course.id));
      if (selCourse?._uuid === course._uuid) setSelCourse(null);
      setConfirmDel(null);
      showToast("Course deleted.");
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Assign teacher ────────────────────────────────────────────────────────────
  const assignTeacher = async () => {
    if (!teacherSel || !selCourse) return;
    const teacher = teachers.find(t => t.id === teacherSel);
    if (!teacher) return;
    try {
      // Use atomic RPC — INSERT ... ON CONFLICT DO UPDATE in one DB transaction.
      // This avoids the unique constraint violation that DELETE+INSERT causes.
      const { error } = await supabase.rpc("assign_teacher_to_course", {
        p_teacher_id:    teacher._uuid,
        p_course_id:     selCourse._uuid,
        p_academic_year: "2025-2026",
        p_semester:      selCourse.semester || null,
      });
      if (error) throw new Error(error.message);

      const updated = { ...selCourse, teacherId: teacher._uuid, teacherName: teacher.fullName };
      setProgCourses(prev => prev.map(c => c._uuid === selCourse._uuid ? updated : c));
      setCourses(prev => prev.map(c => c._uuid === selCourse._uuid ? updated : c));
      setSelCourse(updated);
      setTeacherSel("");
      showToast(`Teacher assigned to ${selCourse.code}.`);
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Enroll student ────────────────────────────────────────────────────────────
  const enrollStudent = async () => {
    if (!enroll.studentId || !selCourse) return;
    const student = students.find(s => s.id === enroll.studentId);
    if (!student) return;
    if (enrollments.find(e => e.studentId === student.id && e.courseId === selCourse.id)) {
      showToast("Student already enrolled.", "error"); return;
    }
    try {
      // Atomic RPC — INSERT ... ON CONFLICT DO UPDATE
      const { error } = await supabase.rpc("enroll_student", {
        p_student_id:    student._uuid,
        p_course_id:     selCourse._uuid,
        p_academic_year: "2025-2026",
        p_semester:      selCourse.semester || null,
      });
      if (error) throw new Error(error.message);

      setEnrollments(prev => [...prev, {
        studentId: student.id,
        courseId:  selCourse.id,
        grade:     null,
        status:    "Enrolled",
      }]);
      setEnroll({ studentId: "" });
      showToast(`${student.fullName} enrolled in ${selCourse.code}.`);
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Remove enrollment ─────────────────────────────────────────────────────────
  const removeEnrollment = async (studentId, courseId) => {
    const student = students.find(s => s.id === studentId);
    const course  = progCourses.find(c => c.id === courseId);
    if (!student || !course) return;
    try {
      await supabase.from("student_course_assignments")
        .delete()
        .eq("student_id", student._uuid)
        .eq("course_id",  course._uuid);
      setEnrollments(prev => prev.filter(e => !(e.studentId === studentId && e.courseId === courseId)));
      showToast("Enrollment removed.");
    } catch (e) { showToast(e.message, "error"); }
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  BREADCRUMB
  // ════════════════════════════════════════════════════════════════════════════

  const Breadcrumb = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", padding: "6px 18px", background: "#1e293b", borderBottom: "1px solid #334155", flexShrink: 0 }}>
      <button onClick={() => { setLevel("dept"); setSelDept(null); setSelProg(null); setSelCourse(null); setProgs([]); setProgCourses([]); setEditingId(null); }}
        style={{ background: "none", border: "none", color: level === "dept" ? "#f1f5f9" : "#6366f1", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
        🏛️ Departments
      </button>
      {selDept && (<>
        <span style={{ color: "#334155" }}>›</span>
        <button onClick={() => { if (level !== "prog") { setLevel("prog"); setSelProg(null); setSelCourse(null); setProgCourses([]); setEditingId(null); } }}
          style={{ background: "none", border: "none", color: level === "prog" ? "#f1f5f9" : "#6366f1", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
          {selDept.name}
        </button>
      </>)}
      {selProg && (<>
        <span style={{ color: "#334155" }}>›</span>
        <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{selProg.name}</span>
      </>)}
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  //  GRID COLUMNS
  // ════════════════════════════════════════════════════════════════════════════

  const deptCols = [
    { field: "code",  header: "Code",  width: 80 },
    { field: "name",  header: "Department" },
    { field: "room",  header: "Room",  width: 100 },
    { field: "email", header: "Email", width: 190 },
    { field: "isActive", header: "Status", width: 90,
      cellRenderer: (v, row) => (
        <button onClick={e => { e.stopPropagation(); toggleDeptActive(row); }}
          style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, border: "none", cursor: "pointer", background: v === 1 ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)", color: v === 1 ? "#34d399" : "#f87171" }}>
          {v === 1 ? "Active" : "Inactive"}
        </button>
      )},
    { field: "departmentId", header: "Actions", width: 130, sortable: false,
      cellRenderer: (_, row) => (
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          <Btn size="sm" variant="secondary" onClick={() => { setEditingId(row.departmentId); setDeptForm({ code: row.code, name: row.name, room: row.room || "", email: row.email || "", phone: row.phone || "", description: row.description || "" }); }}>✏️</Btn>
          <Btn size="sm" variant="danger"    onClick={() => setConfirmDel({ type: "dept", item: row })}>🗑</Btn>
          <Btn size="sm" onClick={() => drillDept(row)}>View →</Btn>
        </div>
      )},
  ];

  const progCols = [
    { field: "code",           header: "Code",       width: 80 },
    { field: "name",           header: "Program" },
    { field: "description",    header: "Description" },
    { field: "isActive",       header: "Status",     width: 90,
      cellRenderer: (v, row) => (
        <button onClick={e => { e.stopPropagation(); toggleProgActive(row); }}
          style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, border: "none", cursor: "pointer", background: v === 1 ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)", color: v === 1 ? "#34d399" : "#f87171" }}>
          {v === 1 ? "Active" : "Inactive"}
        </button>
      )},
    { field: "programId", header: "Actions", width: 130, sortable: false,
      cellRenderer: (_, row) => (
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          <Btn size="sm" variant="secondary" onClick={() => { setEditingId(row.programId); setProgForm({ code: row.code, name: row.name, description: row.description || "" }); }}>✏️</Btn>
          <Btn size="sm" variant="danger"    onClick={() => setConfirmDel({ type: "prog", item: row })}>🗑</Btn>
          <Btn size="sm" onClick={() => drillProg(row)}>View →</Btn>
        </div>
      )},
  ];

  const courseCols = [
    { field: "code",        header: "Code",    width: 80 },
    { field: "name",        header: "Course" },
    { field: "teacherName", header: "Teacher", width: 160 },
    { field: "schedule",    header: "Schedule",width: 140 },
    { field: "units",       header: "Units",   width: 55 },
    { field: "yearLevel",   header: "Year",    width: 80 },
    { field: "semester",    header: "Semester",width: 110 },
    { field: "_uuid", header: "Actions", width: 120, sortable: false,
      cellRenderer: (_, row) => (
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          <Btn size="sm" variant="secondary" onClick={() => { setEditingId(row._uuid); setSelCourse(row); setCourseForm({ code: row.code, name: row.name, units: String(row.units || 3), schedule: row.schedule || "", yearLevel: row.yearLevel || "1st Year", semester: row.semester || "1st Semester" }); }}>✏️</Btn>
          <Btn size="sm" variant="danger"    onClick={() => setConfirmDel({ type: "course", item: row })}>🗑</Btn>
        </div>
      )},
  ];

  // Enrolled students for selected course
  const courseEnrollments = selCourse
    ? enrollments
        .filter(e => e.courseId === selCourse.id)
        .map(e => ({ ...e, studentName: students.find(s => s.id === e.studentId)?.fullName || e.studentId }))
    : [];

  const enrolledStudentCols = [
    { field: "studentName", header: "Student" },
    { field: "status",      header: "Status",  width: 100, cellRenderer: v => <Badge color="success">{v}</Badge> },
    { field: "grade",       header: "Grade",   width: 70,  cellRenderer: v => v != null ? <span style={{ fontWeight: 700, color: "#fbbf24" }}>{v}%</span> : <span style={{ color: "#475569" }}>—</span> },
    { field: "studentId",   header: "Remove",  width: 80, sortable: false,
      cellRenderer: (v, row) => (
        <Btn size="sm" variant="danger" onClick={e => { e.stopPropagation(); removeEnrollment(v, row.courseId); }}>✕</Btn>
      )},
  ];

  // ════════════════════════════════════════════════════════════════════════════
  //  SUBTITLE helper
  // ════════════════════════════════════════════════════════════════════════════
  const subtitle = level === "dept"
    ? `${depts.length} department${depts.length !== 1 ? "s" : ""}`
    : level === "prog"
    ? `${selDept?.name} · ${progs.length} program${progs.length !== 1 ? "s" : ""}`
    : `${selProg?.name} · ${progCourses.length} course${progCourses.length !== 1 ? "s" : ""}`;

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      <TopBar title="Course Management" subtitle={subtitle}
        actions={level !== "dept" && (
          <Btn variant="secondary" size="sm" onClick={goBack}>← Back</Btn>
        )}
      />

      <Breadcrumb />

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.type === "error" ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)", border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`, borderRadius: 8, padding: "9px 14px", color: toast.type === "error" ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600 }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      {/* Confirm modal */}
      {confirmDel && (
        <ConfirmModal
          title={`Delete ${confirmDel.type === "dept" ? "Department" : confirmDel.type === "prog" ? "Program" : "Course"}`}
          message={`Delete "${confirmDel.item.name}"? This performs a soft delete and cannot be undone from the UI.`}
          onConfirm={() => {
            if (confirmDel.type === "dept")   deleteDept(confirmDel.item);
            if (confirmDel.type === "prog")   deleteProg(confirmDel.item);
            if (confirmDel.type === "course") deleteCourse(confirmDel.item);
          }}
          onCancel={() => setConfirmDel(null)}
        />
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ════════ LEVEL: DEPARTMENTS ════════ */}
        {level === "dept" && (
          <>
            {/* Left pane — create/edit dept */}
            <div style={S.pane}>
              <PaneHeader title={editingId ? "✏️ Edit Department" : "➕ New Department"} />
              <FF label="Code *"><Input value={deptForm.code} onChange={e => setDeptForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CCS" /></FF>
              <FF label="Name *"><Input value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. College of Computer Studies" /></FF>
              <FF label="Room"><Input value={deptForm.room} onChange={e => setDeptForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. Room 301" /></FF>
              <FF label="Email"><Input type="email" value={deptForm.email} onChange={e => setDeptForm(f => ({ ...f, email: e.target.value }))} placeholder="dept@school.edu" /></FF>
              <FF label="Phone"><Input value={deptForm.phone} onChange={e => setDeptForm(f => ({ ...f, phone: e.target.value }))} placeholder="09XXXXXXXXX" /></FF>
              <FF label="Description">
                <textarea value={deptForm.description} onChange={e => setDeptForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Optional…"
                  style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "#e2e8f0", resize: "vertical", outline: "none" }} />
              </FF>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={saveDept} style={{ flex: 1 }}>{editingId ? "✓ Save" : "✦ Create"}</Btn>
                {editingId && <Btn variant="secondary" onClick={() => { setEditingId(null); setDeptForm(emptyDept); }}>Cancel</Btn>}
              </div>
            </div>
            {/* Grid */}
            <div style={S.grid}>
              <div style={{ ...S.label, flexShrink: 0 }}>{depts.length} Departments · Click "View →" to see programs</div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                {loading ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                  : <LMSGrid columns={deptCols} rowData={depts} height="100%" />}
              </div>
            </div>
          </>
        )}

        {/* ════════ LEVEL: PROGRAMS ════════ */}
        {level === "prog" && (
          <>
            <div style={S.pane}>
              <PaneHeader
                title={editingId ? "✏️ Edit Program" : "➕ New Program"}
                sub={`in ${selDept?.name}`}
              />
              <FF label="Code *"><Input value={progForm.code} onChange={e => setProgForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. BSCS" /></FF>
              <FF label="Program Name *"><Input value={progForm.name} onChange={e => setProgForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. BS Computer Science" /></FF>
              <FF label="Description">
                <textarea value={progForm.description} onChange={e => setProgForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional…"
                  style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "#e2e8f0", resize: "vertical", outline: "none" }} />
              </FF>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={saveProg} style={{ flex: 1 }}>{editingId ? "✓ Save" : "✦ Create"}</Btn>
                {editingId && <Btn variant="secondary" onClick={() => { setEditingId(null); setProgForm(emptyProg); }}>Cancel</Btn>}
              </div>

              {/* Dept info */}
              <div style={{ ...S.section, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={S.label}>Department Info</div>
                {[["Code", selDept?.code], ["Room", selDept?.room], ["Email", selDept?.email], ["Phone", selDept?.phone]]
                  .filter(([,v]) => v).map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase" }}>{l}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={S.grid}>
              <div style={{ ...S.label, flexShrink: 0 }}>{progs.length} Programs · Click "View →" to see courses</div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                {loading ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                  : progs.length === 0
                  ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40, fontSize: 13 }}>No programs yet. Create one in the left pane.</div>
                  : <LMSGrid columns={progCols} rowData={progs} height="100%" />}
              </div>
            </div>
          </>
        )}

        {/* ════════ LEVEL: COURSES ════════ */}
        {level === "course" && (
          <>
            {/* Left pane — create course + teacher assign + enroll */}
            <div style={{ ...S.pane, width: 320 }}>
              <PaneHeader
                title={editingId ? "✏️ Edit Course" : "➕ New Course"}
                sub={`in ${selProg?.name}`}
              />
              <FF label="Course Code *"><Input value={courseForm.code} onChange={e => setCourseForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CS101" /></FF>
              <FF label="Course Name *"><Input value={courseForm.name} onChange={e => setCourseForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Intro to CS" /></FF>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <FF label="Units">
                  <Sel value={courseForm.units} onChange={e => setCourseForm(f => ({ ...f, units: e.target.value }))}>
                    {["1","2","3","4","5","6"].map(u => <option key={u}>{u}</option>)}
                  </Sel>
                </FF>
                <FF label="Year Level">
                  <Sel value={courseForm.yearLevel} onChange={e => setCourseForm(f => ({ ...f, yearLevel: e.target.value }))}>
                    {["1st Year","2nd Year","3rd Year","4th Year"].map(y => <option key={y}>{y}</option>)}
                  </Sel>
                </FF>
              </div>
              <FF label="Semester">
                <Sel value={courseForm.semester} onChange={e => setCourseForm(f => ({ ...f, semester: e.target.value }))}>
                  {["1st Semester","2nd Semester","Summer"].map(s => <option key={s}>{s}</option>)}
                </Sel>
              </FF>
              <FF label="Schedule"><Input value={courseForm.schedule} onChange={e => setCourseForm(f => ({ ...f, schedule: e.target.value }))} placeholder="e.g. MWF 8:00–9:00 AM" /></FF>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={saveCourse} style={{ flex: 1 }}>{editingId ? "✓ Save" : "✦ Create"}</Btn>
                {editingId && <Btn variant="secondary" onClick={() => { setEditingId(null); setCourseForm(emptyCourse); setSelCourse(null); }}>Cancel</Btn>}
              </div>

              {/* Assign teacher — only when a course is selected */}
              {selCourse && !editingId && (
                <div style={S.section}>
                  <div style={{ ...S.label, marginBottom: 8 }}>👩‍🏫 Assign Teacher to {selCourse.code}</div>
                  <FF label="Current Teacher">
                    <div style={{ fontSize: 13, color: selCourse.teacherName === "Unassigned" ? "#475569" : "#34d399", fontWeight: 600, padding: "6px 0" }}>
                      {selCourse.teacherName}
                    </div>
                  </FF>
                  <FF label="Change To">
                    <Sel value={teacherSel} onChange={e => setTeacherSel(e.target.value)}>
                      <option value="">— Select Teacher —</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                    </Sel>
                  </FF>
                  <Btn onClick={assignTeacher} disabled={!teacherSel} style={{ width: "100%" }}>Assign Teacher</Btn>
                </div>
              )}

              {/* Enroll student — only when a course is selected */}
              {selCourse && !editingId && (
                <div style={S.section}>
                  <div style={{ ...S.label, marginBottom: 8 }}>🎓 Enroll Student in {selCourse.code}</div>
                  <FF label="Student">
                    <Sel value={enroll.studentId} onChange={e => setEnroll({ studentId: e.target.value })}>
                      <option value="">— Select Student —</option>
                      {students
                        .filter(s => !enrollments.find(e => e.studentId === s.id && e.courseId === selCourse.id))
                        .map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                    </Sel>
                  </FF>
                  <Btn onClick={enrollStudent} disabled={!enroll.studentId} style={{ width: "100%" }}>Enroll Student</Btn>
                </div>
              )}
            </div>

            {/* Right area — course grid + enrolled students */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Course grid */}
              <div style={{ flex: selCourse ? "0 0 55%" : 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8, borderBottom: selCourse ? "1px solid #334155" : "none" }}>
                <div style={{ ...S.label, flexShrink: 0 }}>
                  {progCourses.length} Courses · {selProg?.name}
                  {selCourse && <span style={{ marginLeft: 10, color: "#6366f1" }}>← {selCourse.code} selected</span>}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {loading ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                    : progCourses.length === 0
                    ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40, fontSize: 13 }}>No courses yet. Create one in the left pane.</div>
                    : <LMSGrid columns={courseCols} rowData={progCourses} onRowClick={c => { setSelCourse(prev => prev?._uuid === c._uuid ? null : c); setEditingId(null); setCourseForm(emptyCourse); setTeacherSel(""); setEnroll({ studentId: "" }); }} selectedId={selCourse?.id} height="100%" />}
                </div>
              </div>

              {/* Enrolled students for selected course */}
              {selCourse && (
                <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0f1a", gap: 8 }}>
                  <div style={{ ...S.label, flexShrink: 0 }}>
                    🎓 Students enrolled in {selCourse.code} — {selCourse.name} ({courseEnrollments.length})
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    {courseEnrollments.length === 0
                      ? <div style={{ color: "#334155", fontSize: 13, textAlign: "center", paddingTop: 20 }}>No students enrolled yet.</div>
                      : <LMSGrid columns={enrolledStudentCols} rowData={courseEnrollments} height="100%" />}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
