/**
 * SubAdminCourseManagement.jsx
 * FOLDER: src/sub-admin/pages/SubAdminCourseManagement.jsx
 *
 * Available to Department Admins only (scope === "department").
 *
 * Flow: Programs (of this dept) → Courses (of selected program)
 *   • Assign / reassign a teacher to a course
 *     - Validates no schedule conflict (day + time) for the teacher
 *   • Bulk-assign multiple students to a course offering
 *   • View currently enrolled students, remove enrollments
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { departmentApi, programApi } from "../../lib/api";
import { Badge, Btn, Sel, FF } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

const S = {
  pane:  { width: 310, borderRight: "1px solid #334155", background: "#1e293b", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flexShrink: 0 },
  grid:  { flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8 },
  label: { fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" },
  sec:   { borderTop: "1px solid #334155", paddingTop: 12, marginTop: 4 },
};

const PH = ({ title, sub }) => (
  <div style={{ marginBottom: 2 }}>
    <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>{title}</div>
    {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sub}</div>}
  </div>
);

// ─── Schedule conflict helpers ────────────────────────────────────────────────
function splitDays(s) {
  return (s.match(/Th|Sa|Su|[MTWFS]/gi) || []).map(d => d.toUpperCase());
}
function daysOverlap(a, b) {
  const da = new Set(splitDays(a));
  return splitDays(b).some(d => da.has(d));
}
function parseMinutes(t) {
  const m = (t || "").trim().match(/(\d+):(\d+)\s*([AaPp][Mm]?)?/);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}
function timesOverlap(rA, rB) {
  const parse = r => {
    const parts = (r || "").split(/[-–]/);
    if (parts.length < 2) return null;
    let s = parts[0].trim(), e = parts[parts.length - 1].trim();
    const apMatch = e.match(/[AaPp][Mm]/);
    if (apMatch && !s.match(/[AaPp][Mm]/)) s += " " + apMatch[0];
    return { s: parseMinutes(s), e: parseMinutes(e) };
  };
  const a = parse(rA), b = parse(rB);
  if (!a || !b || a.s === null || b.s === null) return false;
  return a.s < b.e && b.s < a.e;
}
function parseScheduleLabel(label) {
  if (!label) return null;
  const m = label.match(/([A-Za-z]+)\s+([\d:]+\s*(?:[AaPp][Mm])?\s*[-–]\s*[\d:]+\s*[AaPp][Mm])/);
  if (!m) return null;
  return { days: m[1], timeRange: m[2] };
}
function schedulesConflict(labelA, labelB) {
  const a = parseScheduleLabel(labelA);
  const b = parseScheduleLabel(labelB);
  if (!a || !b) return false;
  return daysOverlap(a.days, b.days) && timesOverlap(a.timeRange, b.timeRange);
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SubAdminCourseManagement({ user, users = [] }) {
  const teachers = users.filter(u => u.role === "teacher");
  const students  = users.filter(u => u.role === "student");

  const [level,       setLevel]       = useState("prog");
  const [selProg,     setSelProg]     = useState(null);
  const [selCourse,   setSelCourse]   = useState(null);
  const [progs,       setProgs]       = useState([]);
  const [courses,     setCourses]     = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [teacherSel,  setTeacherSel]  = useState("");
  const [assigning,   setAssigning]   = useState(false);
  const [selStudents, setSelStudents] = useState([]);
  const [enrolling,   setEnrolling]   = useState(false);
  const [toast,       setToast]       = useState({ msg: "", type: "success" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 4000);
  };

  // ── Init: resolve dept → load programs ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const scopeRef = user.subAdminScopeRef || "";
        const res = await departmentApi.getList({ size: 200 });
        const match = res.items.find(d =>
          d.name.toLowerCase() === scopeRef.toLowerCase() ||
          d.code.toLowerCase() === scopeRef.toLowerCase()
        );
        if (match) {
          await loadProgs(match.departmentId);
        } else {
          const pRes = await programApi.getList({ size: 200 });
          setProgs(pRes.items ?? []);
        }
      } catch (e) { showToast(e.message, "error"); }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user._uuid]);

  const loadProgs = useCallback(async (dId) => {
    const res = await programApi.getList({ size: 200 });
    setProgs((res.items ?? []).filter(p => p.departmentId === dId));
  }, []);

  // ── Load courses + their existing tca assignment_id ──────────────────────────
  const loadCourses = useCallback(async (programId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          course_id, course_code, course_name, units, status, is_active, program_id,
          schedules ( schedule_id, schedule_label, year_level, semester ),
          teacher_course_assignments ( assignment_id, teacher_id, assigned_at )
        `)
        .eq("program_id", programId)
        .eq("is_active", true)
        .order("course_code");
      if (error) throw new Error(error.message);

      const enriched = (data ?? []).map(c => {
        const sch    = c.schedules?.[0];
        const tca    = c.teacher_course_assignments?.[0];
        const teacher = tca?.teacher_id ? users.find(u => u._uuid === tca.teacher_id) : null;
        return {
          _uuid:         c.course_id,
          _assignmentId: tca?.assignment_id || null,   // PK — used for safe UPDATE
          id:            c.course_code,
          code:          c.course_code,
          name:          c.course_name,
          units:         c.units,
          status:        c.status || "Ongoing",
          programId:     c.program_id,
          schedule:      sch?.schedule_label || "",
          yearLevel:     sch?.year_level     || "",
          semester:      sch?.semester       || "",
          teacherId:     tca?.teacher_id     || null,
          teacherName:   teacher?.fullName   || "Unassigned",
        };
      });
      setCourses(enriched);

      const courseUuids = enriched.map(c => c._uuid);
      if (courseUuids.length > 0) {
        const { data: enData } = await supabase
          .from("student_course_assignments")
          .select("student_id, course_id, enrollment_status, final_grade")
          .in("course_id", courseUuids);
        setEnrollments((enData ?? []).map(e => {
          const st = users.find(u => u._uuid === e.student_id);
          const co = enriched.find(c => c._uuid === e.course_id);
          return {
            studentUuid: e.student_id,
            studentId:   st?.id || e.student_id,
            courseUuid:  e.course_id,
            courseId:    co?.id || e.course_id,
            status:      e.enrollment_status,
            grade:       e.final_grade,
          };
        }));
      } else {
        setEnrollments([]);
      }
    } catch (e) { showToast(e.message, "error"); }
    setLoading(false);
  }, [users]);

  const drillProg = async (prog) => {
    setSelProg(prog); setSelCourse(null); setTeacherSel([]); setSelStudents([]);
    setLevel("course");
    await loadCourses(prog.programId);
  };

  const goBack = () => {
    setLevel("prog"); setSelProg(null); setSelCourse(null);
    setCourses([]); setEnrollments([]); setTeacherSel(""); setSelStudents([]);
  };

  // ── Assign teacher ────────────────────────────────────────────────────────────
  const assignTeacher = async () => {
    if (!teacherSel || !selCourse || assigning) return;
    const teacher = teachers.find(t => t.id === teacherSel);
    if (!teacher) { showToast("Teacher not found.", "error"); return; }

    setAssigning(true);
    try {
      // ── 1. Schedule conflict check ───────────────────────────────────────────
      // Only run if this course has a schedule label to compare against.
      if (selCourse.schedule) {
        const { data: otherTca } = await supabase
          .from("teacher_course_assignments")
          .select("course_id")
          .eq("teacher_id", teacher._uuid)
          .neq("course_id", selCourse._uuid);   // exclude this course itself

        if (otherTca && otherTca.length > 0) {
          const otherIds = otherTca.map(r => r.course_id);
          const { data: otherScheds } = await supabase
            .from("schedules")
            .select("course_id, schedule_label")
            .in("course_id", otherIds);

          const conflict = (otherScheds || []).find(s =>
            schedulesConflict(selCourse.schedule, s.schedule_label)
          );
          if (conflict) {
            // Try to find friendly course code for the conflict
            const { data: conflictCourseRow } = await supabase
              .from("courses")
              .select("course_code")
              .eq("course_id", conflict.course_id)
              .single();
            showToast(
              `Schedule conflict! ${teacher.fullName} already teaches ${conflictCourseRow?.course_code || "another course"} at "${conflict.schedule_label}". Pick a different teacher or fix the schedule first.`,
              "error"
            );
            setAssigning(false);
            return;
          }
        }
      }

      // ── 2. Save to DB via RPC ─────────────────────────────────────────────────
      // Direct table ops on teacher_course_assignments are blocked by RLS for
      // the anon role — SELECT/DELETE/UPDATE all silently fail or return null,
      // causing duplicate-key errors on INSERT. The fix is a SECURITY DEFINER
      // Postgres function (assign_teacher_to_course) that runs as the DB owner,
      // bypasses RLS, and handles INSERT-vs-UPDATE atomically.
      const { error: rpcErr } = await supabase.rpc("assign_teacher_to_course", {
        p_course_id:     selCourse._uuid,
        p_teacher_id:    teacher._uuid,
        p_academic_year: "2025-2026",
        p_semester:      selCourse.semester || null,
      });
      if (rpcErr) { showToast("Error saving assignment: " + rpcErr.message, "error"); setAssigning(false); return; }

      // ── 3. Update local state ────────────────────────────────────────────────
      const updated = { ...selCourse, teacherId: teacher._uuid, teacherName: teacher.fullName };
      setCourses(prev => prev.map(c => c._uuid === selCourse._uuid ? updated : c));
      setSelCourse(updated);
      setTeacherSel("");
      showToast(`${teacher.fullName} assigned to ${selCourse.code}.`);
    } catch (e) { showToast(e.message, "error"); }
    setAssigning(false);
  };

  // ── Bulk-enroll students ──────────────────────────────────────────────────────
  const enrollStudents = async () => {
    if (!selCourse || selStudents.length === 0) return;
    setEnrolling(true);
    let enrolled = 0, skipped = 0;
    try {
      for (const sId of selStudents) {
        const student = students.find(s => s.id === sId);
        if (!student) continue;
        if (enrollments.find(e => e.studentId === sId && e.courseId === selCourse.id)) { skipped++; continue; }
        const { error } = await supabase.from("student_course_assignments").insert({
          student_id: student._uuid, course_id: selCourse._uuid,
          enrollment_status: "Enrolled", academic_year: "2025-2026",
          semester: selCourse.semester || null,
        });
        if (!error) {
          setEnrollments(prev => [...prev, {
            studentUuid: student._uuid, studentId: student.id,
            courseUuid: selCourse._uuid, courseId: selCourse.id,
            status: "Enrolled", grade: null,
          }]);
          enrolled++;
        }
      }
      setSelStudents([]);
      showToast(skipped > 0
        ? `${enrolled} enrolled, ${skipped} already enrolled (skipped).`
        : `${enrolled} student${enrolled !== 1 ? "s" : ""} enrolled in ${selCourse.code}.`
      );
    } catch (e) { showToast(e.message, "error"); }
    setEnrolling(false);
  };

  // ── Remove enrollment ─────────────────────────────────────────────────────────
  const removeEnrollment = async (studentId, courseId) => {
    const student = students.find(s => s.id === studentId);
    const course  = courses.find(c => c.id === courseId);
    if (!student || !course) return;
    const { error } = await supabase.from("student_course_assignments")
      .delete().eq("student_id", student._uuid).eq("course_id", course._uuid);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    setEnrollments(prev => prev.filter(e => !(e.studentId === studentId && e.courseId === courseId)));
    showToast("Enrollment removed.");
  };

  const toggleStudent = sId =>
    setSelStudents(prev => prev.includes(sId) ? prev.filter(x => x !== sId) : [...prev, sId]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const courseEnrollments = selCourse
    ? enrollments
        .filter(e => e.courseId === selCourse.id)
        .map(e => ({ ...e, studentName: students.find(s => s.id === e.studentId)?.fullName || e.studentId }))
    : [];
  const enrolledIds        = new Set(courseEnrollments.map(e => e.studentId));
  const unenrolledStudents = students.filter(s => !enrolledIds.has(s.id));

  // ── Columns ───────────────────────────────────────────────────────────────────
  const progCols = [
    { field: "code",        header: "Code",    width: 80 },
    { field: "name",        header: "Program" },
    { field: "description", header: "Description" },
    { field: "isActive", header: "Status", width: 90,
      cellRenderer: v => (
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: v === 1 ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)", color: v === 1 ? "#34d399" : "#f87171" }}>
          {v === 1 ? "Active" : "Inactive"}
        </span>
      )},
    { field: "programId", header: "Actions", width: 90, sortable: false,
      cellRenderer: (_, row) => <Btn size="sm" onClick={() => drillProg(row)}>View →</Btn> },
  ];

  const courseCols = [
    { field: "code",        header: "Code",     width: 80 },
    { field: "name",        header: "Course" },
    { field: "teacherName", header: "Teacher",  width: 160 },
    { field: "schedule",    header: "Schedule", width: 150 },
    { field: "units",       header: "Units",    width: 55 },
    { field: "yearLevel",   header: "Year",     width: 80 },
    { field: "semester",    header: "Semester", width: 110 },
  ];

  const enrolledCols = [
    { field: "studentName", header: "Student" },
    { field: "status", header: "Status", width: 100,
      cellRenderer: v => <Badge color="success">{v}</Badge> },
    { field: "grade", header: "Grade", width: 70,
      cellRenderer: v => v != null
        ? <span style={{ fontWeight: 700, color: "#fbbf24" }}>{v}%</span>
        : <span style={{ color: "#475569" }}>—</span> },
    { field: "studentId", header: "Remove", width: 80, sortable: false,
      cellRenderer: (v, row) => (
        <Btn size="sm" variant="danger" onClick={e => { e.stopPropagation(); removeEnrollment(v, row.courseId); }}>✕</Btn>
      )},
  ];

  const subtitle = level === "prog"
    ? `${progs.length} program${progs.length !== 1 ? "s" : ""}${user.subAdminScopeRef ? ` · ${user.subAdminScopeRef}` : ""}`
    : `${selProg?.name} · ${courses.length} course${courses.length !== 1 ? "s" : ""}`;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar title="Course Management" subtitle={subtitle}
        actions={level === "course" && <Btn variant="secondary" size="sm" onClick={goBack}>← Back to Programs</Btn>}
      />

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", padding: "6px 18px", background: "#1e293b", borderBottom: "1px solid #334155", flexShrink: 0 }}>
        <button onClick={level === "course" ? goBack : undefined}
          style={{ background: "none", border: "none", color: level === "prog" ? "#f1f5f9" : "#6366f1", fontWeight: 700, cursor: level === "course" ? "pointer" : "default", fontFamily: "inherit", fontSize: 12 }}>
          📚 Programs
        </button>
        {selProg && <><span style={{ color: "#334155" }}>›</span><span style={{ color: "#f1f5f9", fontWeight: 700 }}>{selProg.name}</span></>}
      </div>

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, maxWidth: 440, background: toast.type === "error" ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)", border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`, borderRadius: 8, padding: "10px 14px", color: toast.type === "error" ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Programs level */}
        {level === "prog" && (
          <div style={S.grid}>
            <div style={{ ...S.label, flexShrink: 0 }}>{progs.length} Programs — click "View →" to manage courses</div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              {loading
                ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                : progs.length === 0
                ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40, fontSize: 13 }}>No programs found for your department.</div>
                : <LMSGrid columns={progCols} rowData={progs} height="100%" />}
            </div>
          </div>
        )}

        {/* Courses level */}
        {level === "course" && (
          <>
            {/* Left pane */}
            <div style={S.pane}>
              <PH title="📋 Course Actions" sub={selCourse ? `Selected: ${selCourse.code}` : "Select a course from the grid"} />

              {!selCourse && (
                <div style={{ fontSize: 13, color: "#475569", textAlign: "center", paddingTop: 24 }}>
                  👉 Click a course row to manage teacher &amp; students.
                </div>
              )}

              {/* Assign Teacher */}
              {selCourse && (
                <div style={S.sec}>
                  <div style={{ ...S.label, marginBottom: 8 }}>👩‍🏫 Assign Teacher</div>
                  <FF label="Current Teacher">
                    <div style={{ fontSize: 13, fontWeight: 700, padding: "4px 0", color: selCourse.teacherName === "Unassigned" ? "#475569" : "#34d399" }}>
                      {selCourse.teacherName}
                    </div>
                  </FF>
                  {selCourse.schedule && (
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                      🕐 {selCourse.schedule} · conflict check active
                    </div>
                  )}
                  <FF label="Assign To">
                    <Sel value={teacherSel} onChange={e => setTeacherSel(e.target.value)}>
                      <option value="">— Select Teacher —</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                    </Sel>
                  </FF>
                  <Btn onClick={assignTeacher} disabled={!teacherSel || assigning} style={{ width: "100%" }}>
                    {assigning ? "⏳ Saving…" : "✓ Assign Teacher"}
                  </Btn>
                </div>
              )}

              {/* Bulk Enroll */}
              {selCourse && (
                <div style={{ ...S.sec, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ ...S.label, marginBottom: 4 }}>🎓 Enroll Students in {selCourse.code}</div>
                  {unenrolledStudents.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "10px 0" }}>All students already enrolled.</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" id="sel-all"
                          checked={selStudents.length === unenrolledStudents.length && unenrolledStudents.length > 0}
                          onChange={e => setSelStudents(e.target.checked ? unenrolledStudents.map(s => s.id) : [])}
                          style={{ cursor: "pointer", accentColor: "#6366f1" }} />
                        <label htmlFor="sel-all" style={{ fontSize: 12, color: "#94a3b8", cursor: "pointer", userSelect: "none" }}>
                          Select all ({unenrolledStudents.length})
                        </label>
                        {selStudents.length > 0 && (
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "#a5b4fc", fontWeight: 700 }}>{selStudents.length} selected</span>
                        )}
                      </div>
                      <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", background: "#0f172a" }}>
                        {unenrolledStudents.map(s => (
                          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 0", userSelect: "none" }}>
                            <input type="checkbox" checked={selStudents.includes(s.id)} onChange={() => toggleStudent(s.id)} style={{ cursor: "pointer", accentColor: "#6366f1" }} />
                            <span style={{ fontSize: 12, color: "#e2e8f0" }}>{s.fullName}</span>
                          </label>
                        ))}
                      </div>
                      <Btn onClick={enrollStudents} disabled={selStudents.length === 0 || enrolling} style={{ width: "100%" }}>
                        {enrolling ? "⏳ Enrolling…" : `🎓 Enroll ${selStudents.length > 0 ? selStudents.length + " " : ""}Student${selStudents.length !== 1 ? "s" : ""}`}
                      </Btn>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: selCourse ? "0 0 50%" : 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8, borderBottom: selCourse ? "1px solid #334155" : "none" }}>
                <div style={{ ...S.label, flexShrink: 0 }}>
                  {courses.length} Courses · {selProg?.name}
                  {selCourse && <span style={{ marginLeft: 10, color: "#6366f1" }}>← {selCourse.code} selected</span>}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {loading
                    ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                    : courses.length === 0
                    ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40, fontSize: 13 }}>No active courses in this program.</div>
                    : <LMSGrid columns={courseCols} rowData={courses} height="100%" selectedId={selCourse?.id}
                        onRowClick={c => { setSelCourse(prev => prev?._uuid === c._uuid ? null : c); setTeacherSel(""); setSelStudents([]); }} />}
                </div>
              </div>

              {selCourse && (
                <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0f1a", gap: 8 }}>
                  <div style={{ ...S.label, flexShrink: 0 }}>
                    🎓 Enrolled in {selCourse.code} — {selCourse.name} ({courseEnrollments.length})
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    {courseEnrollments.length === 0
                      ? <div style={{ color: "#334155", fontSize: 13, textAlign: "center", paddingTop: 20 }}>No students enrolled yet.</div>
                      : <LMSGrid columns={enrolledCols} rowData={courseEnrollments} height="100%" />}
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
