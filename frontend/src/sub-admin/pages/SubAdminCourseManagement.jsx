/**
 * SubAdminCourseManagement.jsx
 * FOLDER: src/sub-admin/pages/SubAdminCourseManagement.jsx
 *
 * Available to Department Admins only (scope === "department").
 *
 * Flow: Programs (of this dept) -> Courses (of selected program)
 *   Level 1 — Programs list: click "Manage" to drill into a program
 *   Level 2 — Course list with:
 *     • Set / edit schedule (day pattern + time + room)
 *     • Assign / reassign a teacher (with conflict check)
 *     • Enroll students from the program's student roster
 *     • View + remove enrolled students
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { departmentApi, programApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

const S = {
  pane:  { width: 316, borderRight: "1px solid #334155", background: "#1e293b", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flexShrink: 0 },
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

const SectionSep = ({ label }) => (
  <div style={{ ...S.sec }}>
    <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{label}</div>
  </div>
);

const InfoPill = ({ label, color = "#6366f1" }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: `${color}22`, color, border: `1px solid ${color}44` }}>
    {label}
  </span>
);

// ── Schedule conflict helpers ──────────────────────────────────────────────────
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

// ── Build schedule label from parts ──────────────────────────────────────────
function buildScheduleLabel(days, timeStart, timeEnd) {
  if (!days || !timeStart || !timeEnd) return "";
  return `${days} ${timeStart} - ${timeEnd}`;
}

const DAYS_OF_WEEK = [
  { key: "M",  label: "Mon" },
  { key: "T",  label: "Tue" },
  { key: "W",  label: "Wed" },
  { key: "Th", label: "Thu" },
  { key: "F",  label: "Fri" },
  { key: "Sa", label: "Sat" },
  { key: "Su", label: "Sun" },
];

function daysArrayToString(arr) {
  const order = ["M","T","W","Th","F","Sa","Su"];
  return order.filter(d => arr.includes(d)).join("");
}

function daysStringToArray(str) {
  if (!str) return [];
  const result = [];
  let s = str;
  const order = ["Th","Sa","Su","M","T","W","F"];
  for (const d of order) {
    if (s.includes(d)) { result.push(d); s = s.replaceAll(d, ""); }
  }
  return result;
}

// Day toggle button component
const DayToggleButtons = ({ value, onChange }) => {
  const selected = daysStringToArray(value);
  const toggle = (key) => {
    const next = selected.includes(key) ? selected.filter(d => d !== key) : [...selected, key];
    onChange(daysArrayToString(next));
  };
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {DAYS_OF_WEEK.map(({ key, label }) => {
        const active = selected.includes(key);
        return (
          <button key={key} onClick={() => toggle(key)} type="button"
            style={{
              padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
              border: active ? "1.5px solid #6366f1" : "1.5px solid #334155",
              background: active ? "rgba(99,102,241,.25)" : "#0f172a",
              color: active ? "#a5b4fc" : "#475569",
              transition: "all .15s",
            }}>
            {label}
          </button>
        );
      })}
    </div>
  );
};
const YEAR_LEVELS  = ["1st Year","2nd Year","3rd Year","4th Year","5th Year"];
const SEMESTERS    = ["1st Semester","2nd Semester","Summer"];

// ── Main component ─────────────────────────────────────────────────────────────
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
  const [toast,       setToast]       = useState({ msg: "", type: "success" });

  // ── Schedule form state ──────────────────────────────────────────────────────
  // hasLab: whether to show a separate Lab schedule block
  const [schedForm, setSchedForm] = useState({
    days: "MWF", timeStart: "", timeEnd: "", room: "",
    hasLab: false,
    labDays: "", labTimeStart: "", labTimeEnd: "", labRoom: "",
  });
  const [savingSched, setSavingSched] = useState(false);

  // ── Teacher assign state ─────────────────────────────────────────────────────
  const [teacherSel,  setTeacherSel]  = useState("");
  const [assigning,   setAssigning]   = useState(false);

  // ── Student enroll state ─────────────────────────────────────────────────────
  const [selStudents, setSelStudents] = useState([]);
  const [enrolling,   setEnrolling]   = useState(false);
  const [studentFilter, setStudentFilter] = useState("");

  // ── Enroll tab — "by program year level" filter ──────────────────────────────
  const [enrollYearFilter, setEnrollYearFilter] = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 4000);
  };

  // ── Init: resolve dept scope -> load programs ────────────────────────────────
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

  // ── Load courses via course_program_map ──────────────────────────────────────
  const loadCourses = useCallback(async (programId) => {
    setLoading(true);
    try {
      // 1. Courses for this program via mapping table
      const { data: mapData, error: mapErr } = await supabase
        .from("course_program_map")
        .select(`
          id,
          year_level,
          semester,
          courses (
            course_id,
            course_code,
            course_name,
            units,
            status,
            is_active
          )
        `)
        .eq("program_id", programId)
        .order("id", { ascending: true });
      if (mapErr) throw new Error(mapErr.message);

      const courseRows = (mapData ?? []).filter(m => m.courses && m.courses.is_active);
      const courseIds  = courseRows.map(m => m.courses.course_id);

      // 2. Fetch schedules
      let schMap = {};
      if (courseIds.length) {
        const { data: schData } = await supabase
          .from("schedules")
          .select("schedule_id, course_id, schedule_label, year_level, semester, academic_year, room, day_pattern, time_start, time_end")
          .in("course_id", courseIds);
        (schData ?? []).forEach(row => { schMap[row.course_id] = row; });
      }

      // 3. Fetch teacher assignments
      let tcaMap = {}, asgMap = {};
      if (courseIds.length) {
        const { data: tcaData } = await supabase
          .from("teacher_course_assignments")
          .select("assignment_id, course_id, teacher_id, assigned_at")
          .in("course_id", courseIds)
          .order("assigned_at", { ascending: false });
        (tcaData ?? []).forEach(row => {
          if (!tcaMap[row.course_id]) {
            tcaMap[row.course_id] = row.teacher_id;
            asgMap[row.course_id] = row.assignment_id;
          }
        });
      }

      // 4. Resolve teacher names
      const teacherIds = [...new Set(Object.values(tcaMap).filter(Boolean))];
      let teacherNameMap = {};
      if (teacherIds.length) {
        const { data: tUsers } = await supabase
          .from("users")
          .select("user_id, full_name")
          .in("user_id", teacherIds);
        (tUsers ?? []).forEach(u => { teacherNameMap[u.user_id] = u.full_name; });
      }

      const enriched = courseRows.map(m => {
        const c   = m.courses;
        const sch = schMap[c.course_id] ?? null;
        const tId = tcaMap[c.course_id] ?? null;
        return {
          _uuid:         c.course_id,
          _mapYearLevel: m.year_level,
          _mapSemester:  m.semester,
          _assignmentId: asgMap[c.course_id] || null,
          _scheduleId:   sch?.schedule_id || null,
          id:            c.course_code,
          code:          c.course_code,
          name:          c.course_name,
          units:         c.units,
          status:        c.status || "Ongoing",
          programId:     programId,
          schedule:      sch?.schedule_label || "",
          dayPattern:    sch?.day_pattern     || "",
          timeStart:     sch?.time_start      || "",
          timeEnd:       sch?.time_end        || "",
          yearLevel:     m.year_level         || "",
          semester:      m.semester           || "",
          room:          sch?.room            || "",
          teacherId:     tId,
          teacherName:   tId ? (teacherNameMap[tId] || "Unassigned") : "Unassigned",
        };
      });
      setCourses(enriched);

      // 5. Load enrollments
      if (courseIds.length) {
        const { data: enData } = await supabase
          .from("student_course_assignments")
          .select("student_id, course_id, enrollment_status, final_grade")
          .in("course_id", courseIds);
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
    setSelProg(prog); setSelCourse(null); setTeacherSel(""); setSelStudents([]);
    setLevel("course");
    await loadCourses(prog.programId);
  };

  const goBack = () => {
    setLevel("prog"); setSelProg(null); setSelCourse(null);
    setCourses([]); setEnrollments([]); setTeacherSel(""); setSelStudents([]);
  };

  const selectCourse = (c) => {
    if (selCourse?._uuid === c._uuid) { setSelCourse(null); setTeacherSel(""); setSelStudents([]); return; }
    setSelCourse(c);
    setTeacherSel("");
    setSelStudents([]);
    setStudentFilter("");
    setEnrollYearFilter(c.yearLevel || "");
    // Prefill schedule form from existing schedule
    // schedule_label format: "MWF 12:30 PM - 02:30 PM" or "MWF 12:30 PM - 02:30 PM | Lab: TTh 08:00 AM - 11:00 AM (Room 301)"
    const label = c.schedule || "";
    const labMatch = label.match(/\|\s*Lab:\s*([A-Za-z]+)\s+([\d:]+\s*[AaPp][Mm]\s*[-–]\s*[\d:]+\s*[AaPp][Mm])\s*(?:\(([^)]*)\))?/);
    setSchedForm({
      days:         c.dayPattern || (label ? label.split(" ")[0] : "MWF"),
      timeStart:    c.timeStart  || "",
      timeEnd:      c.timeEnd    || "",
      room:         c.room       || "",
      hasLab:       !!labMatch,
      labDays:      labMatch ? labMatch[1] : "",
      labTimeStart: labMatch ? labMatch[2].split(/[-–]/)[0].trim() : "",
      labTimeEnd:   labMatch ? labMatch[2].split(/[-–]/)[1].trim() : "",
      labRoom:      labMatch ? (labMatch[3] || "") : "",
    });
  };

  // ── Save / update schedule ───────────────────────────────────────────────────
  const saveSchedule = async () => {
    if (!selCourse) return;
    if (!schedForm.timeStart || !schedForm.timeEnd) {
      showToast("Please fill in start and end times.", "error"); return;
    }
    if (schedForm.hasLab && (!schedForm.labDays || !schedForm.labTimeStart || !schedForm.labTimeEnd)) {
      showToast("Please fill in lab schedule days and times.", "error"); return;
    }
    setSavingSched(true);
    try {
      // Build combined label: "MWF 12:30 PM - 02:30 PM | Lab: TTh 08:00 AM - 11:00 AM (Room 301)"
      let label = buildScheduleLabel(schedForm.days, schedForm.timeStart, schedForm.timeEnd);
      if (schedForm.hasLab) {
        const labLabel = `${schedForm.labDays} ${schedForm.labTimeStart} - ${schedForm.labTimeEnd}`;
        label += ` | Lab: ${labLabel}${schedForm.labRoom ? ` (${schedForm.labRoom})` : ""}`;
      }
      const schedPayload = {
        course_id:      selCourse._uuid,
        schedule_label: label,
        day_pattern:    schedForm.days,
        time_start:     schedForm.timeStart,
        time_end:       schedForm.timeEnd,
        room:           schedForm.room || null,
        academic_year:  "2025-2026",
        semester:       selCourse.semester || null,
        year_level:     selCourse.yearLevel || null,
      };

      if (selCourse._scheduleId) {
        // Update existing
        const { error } = await supabase.from("schedules")
          .update(schedPayload)
          .eq("schedule_id", selCourse._scheduleId);
        if (error) throw new Error(error.message);
      } else {
        // Insert new — schedules has a UNIQUE on course_id so upsert
        const { error } = await supabase.from("schedules")
          .upsert(schedPayload, { onConflict: "course_id" });
        if (error) throw new Error(error.message);
      }

      const updated = {
        ...selCourse,
        schedule:   label,
        dayPattern: schedForm.days,
        timeStart:  schedForm.timeStart,
        timeEnd:    schedForm.timeEnd,
        room:       schedForm.room,
      };
      setCourses(prev => prev.map(c => c._uuid === selCourse._uuid ? updated : c));
      setSelCourse(updated);
      showToast("Schedule saved.");
    } catch (e) { showToast(e.message, "error"); }
    setSavingSched(false);
  };

  // ── Assign teacher ────────────────────────────────────────────────────────────
  const assignTeacher = async () => {
    if (!teacherSel || !selCourse || assigning) return;
    const teacher = teachers.find(t => t.id === teacherSel);
    if (!teacher) { showToast("Teacher not found.", "error"); return; }

    setAssigning(true);
    try {
      // Schedule conflict check
      if (selCourse.schedule) {
        const { data: otherTca } = await supabase
          .from("teacher_course_assignments")
          .select("course_id")
          .eq("teacher_id", teacher._uuid)
          .neq("course_id", selCourse._uuid);

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
            const { data: conflictRow } = await supabase
              .from("courses").select("course_code").eq("course_id", conflict.course_id).single();
            showToast(
              `Schedule conflict! ${teacher.fullName} already teaches ${conflictRow?.course_code || "another course"} at "${conflict.schedule_label}". Fix the schedule first.`,
              "error"
            );
            setAssigning(false);
            return;
          }
        }
      }

      // Save via SECURITY DEFINER RPC (bypasses RLS on teacher_course_assignments)
      const { error: rpcErr } = await supabase.rpc("assign_teacher_to_course", {
        p_course_id:     selCourse._uuid,
        p_teacher_id:    teacher._uuid,
        p_academic_year: "2025-2026",
        p_semester:      selCourse.semester || null,
      });
      if (rpcErr) { showToast("Error saving assignment: " + rpcErr.message, "error"); setAssigning(false); return; }

      const updated = { ...selCourse, teacherId: teacher._uuid, teacherName: teacher.fullName };
      setCourses(prev => prev.map(c => c._uuid === selCourse._uuid ? updated : c));
      setSelCourse(updated);
      setTeacherSel("");
      showToast(`${teacher.fullName} assigned to ${selCourse.code}.`);
    } catch (e) { showToast(e.message, "error"); }
    setAssigning(false);
  };

  // ── Enroll students ───────────────────────────────────────────────────────────
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
  const enrolledIds = new Set(courseEnrollments.map(e => e.studentId));

  // Students eligible for this course: filter by program year level if desired
  const eligibleStudents = students.filter(s => {
    if (enrolledIds.has(s.id)) return false;
    if (enrollYearFilter && s.yearLevel && s.yearLevel !== enrollYearFilter) return false;
    return true;
  });

  const filteredUnenrolled = eligibleStudents.filter(s =>
    !studentFilter || s.fullName?.toLowerCase().includes(studentFilter.toLowerCase()) || s.id?.toLowerCase().includes(studentFilter.toLowerCase())
  );

  // ── Grid columns ──────────────────────────────────────────────────────────────
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
      cellRenderer: (_, row) => <Btn size="sm" onClick={() => drillProg(row)}>Manage →</Btn> },
  ];

  const courseCols = [
    { field: "code",        header: "Code",     width: 80 },
    { field: "name",        header: "Course" },
    { field: "teacherName", header: "Teacher",  width: 150,
      cellRenderer: v => (
        <span style={{ color: v === "Unassigned" ? "#475569" : "#34d399", fontWeight: 600, fontSize: 12 }}>{v}</span>
      )},
    { field: "schedule",    header: "Schedule", width: 160,
      cellRenderer: v => v
        ? <span style={{ color: "#60a5fa", fontSize: 12 }}>{v}</span>
        : <span style={{ color: "#334155", fontSize: 11 }}>Not set</span>
    },
    { field: "room",        header: "Room",     width: 90 },
    { field: "units",       header: "Units",    width: 55 },
    { field: "yearLevel",   header: "Year",     width: 90,
      cellRenderer: v => v ? <InfoPill label={v} color="#6366f1" /> : null },
    { field: "semester",    header: "Semester", width: 120,
      cellRenderer: v => v ? (
        <InfoPill label={v} color={v === "1st Semester" ? "#0ea5e9" : v === "2nd Semester" ? "#8b5cf6" : "#f59e0b"} />
      ) : null },
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
        {selCourse && <><span style={{ color: "#334155" }}>›</span><span style={{ color: "#a5b4fc", fontWeight: 700 }}>{selCourse.code}</span></>}
      </div>

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, maxWidth: 460, background: toast.type === "error" ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)", border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`, borderRadius: 8, padding: "10px 14px", color: toast.type === "error" ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Programs level */}
        {level === "prog" && (
          <div style={S.grid}>
            <div style={{ ...S.label, flexShrink: 0 }}>{progs.length} Programs — click "Manage →" to set schedules and enroll students</div>
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
            {/* Left pane — actions */}
            <div style={S.pane}>
              <PH
                title={selCourse ? `📋 ${selCourse.code}` : "📋 Course Actions"}
                sub={selCourse ? selCourse.name : "Select a course from the grid"}
              />

              {!selCourse && (
                <div style={{ fontSize: 13, color: "#475569", textAlign: "center", paddingTop: 24, lineHeight: 1.7 }}>
                  👉 Click a course row to set its schedule, assign a teacher, and enroll students.
                </div>
              )}

              {/* ─ SCHEDULE ─ */}
              {selCourse && (
                <div style={S.sec}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>🗓️ Schedule</div>

                  {selCourse.schedule && (
                    <div style={{ background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 7, padding: "8px 10px", marginBottom: 10 }}>
                      {selCourse.schedule.includes("| Lab:") ? (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc" }}>📖 Lecture: {selCourse.schedule.split("| Lab:")[0].trim()}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", marginTop: 3 }}>🔬 Lab: {selCourse.schedule.split("| Lab:")[1].trim()}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc" }}>Current: {selCourse.schedule}</div>
                      )}
                      {selCourse.room && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Room: {selCourse.room}</div>}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* ── Lecture Schedule ── */}
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                      📖 Lecture
                    </div>
                    <FF label="Day Pattern">
                      <DayToggleButtons value={schedForm.days} onChange={v => setSchedForm(f => ({ ...f, days: v }))} />
                    </FF>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <FF label="Start Time">
                        <Input type="time" value={schedForm.timeStart} onChange={e => setSchedForm(f => ({ ...f, timeStart: e.target.value }))} />
                      </FF>
                      <FF label="End Time">
                        <Input type="time" value={schedForm.timeEnd} onChange={e => setSchedForm(f => ({ ...f, timeEnd: e.target.value }))} />
                      </FF>
                    </div>
                    <FF label="Room">
                      <Input value={schedForm.room} onChange={e => setSchedForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. Room 201" />
                    </FF>

                    {/* ── Lab toggle ── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4, borderTop: "1px solid #1e293b" }}>
                      <button type="button" onClick={() => setSchedForm(f => ({ ...f, hasLab: !f.hasLab }))}
                        style={{
                          width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer", position: "relative",
                          background: schedForm.hasLab ? "#6366f1" : "#334155", transition: "background .2s", flexShrink: 0,
                        }}>
                        <span style={{
                          position: "absolute", top: 3, left: schedForm.hasLab ? 16 : 3, width: 12, height: 12,
                          borderRadius: "50%", background: "#fff", transition: "left .2s",
                        }} />
                      </button>
                      <span style={{ fontSize: 11, fontWeight: 700, color: schedForm.hasLab ? "#a5b4fc" : "#475569" }}>
                        🔬 Has Laboratory Class
                      </span>
                    </div>

                    {/* ── Laboratory Schedule ── */}
                    {schedForm.hasLab && (
                      <div style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 8, padding: "10px 10px 6px", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          🔬 Laboratory
                        </div>
                        <FF label="Lab Day Pattern">
                          <DayToggleButtons value={schedForm.labDays} onChange={v => setSchedForm(f => ({ ...f, labDays: v }))} />
                        </FF>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <FF label="Lab Start">
                            <Input type="time" value={schedForm.labTimeStart} onChange={e => setSchedForm(f => ({ ...f, labTimeStart: e.target.value }))} />
                          </FF>
                          <FF label="Lab End">
                            <Input type="time" value={schedForm.labTimeEnd} onChange={e => setSchedForm(f => ({ ...f, labTimeEnd: e.target.value }))} />
                          </FF>
                        </div>
                        <FF label="Lab Room">
                          <Input value={schedForm.labRoom} onChange={e => setSchedForm(f => ({ ...f, labRoom: e.target.value }))} placeholder="e.g. Comp Lab 1" />
                        </FF>
                      </div>
                    )}

                    <Btn onClick={saveSchedule} disabled={savingSched} style={{ width: "100%" }}>
                      {savingSched ? "⏳ Saving…" : selCourse._scheduleId ? "✓ Update Schedule" : "✦ Set Schedule"}
                    </Btn>
                  </div>
                </div>
              )}

              {/* ─ TEACHER ─ */}
              {selCourse && (
                <div style={S.sec}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>👩‍🏫 Assign Teacher</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: selCourse.teacherName === "Unassigned" ? "#475569" : "#34d399", marginBottom: 8, padding: "4px 8px", background: "#0f172a", borderRadius: 6, border: "1px solid #334155" }}>
                    {selCourse.teacherName === "Unassigned" ? "No teacher assigned yet" : `✓ ${selCourse.teacherName}`}
                  </div>
                  {selCourse.schedule && (
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>🕐 Conflict check active for: {selCourse.schedule}</div>
                  )}
                  <FF label="Select Teacher">
                    <Sel value={teacherSel} onChange={e => setTeacherSel(e.target.value)}>
                      <option value="">— Select Teacher —</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                    </Sel>
                  </FF>
                  <Btn onClick={assignTeacher} disabled={!teacherSel || assigning} style={{ width: "100%", marginTop: 4 }}>
                    {assigning ? "⏳ Saving…" : "✓ Assign Teacher"}
                  </Btn>
                </div>
              )}

              {/* ─ ENROLL STUDENTS ─ */}
              {selCourse && (
                <div style={{ ...S.sec, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>🎓 Enroll Students</div>

                  {/* Filter by year level */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={enrollYearFilter} onChange={e => { setEnrollYearFilter(e.target.value); setSelStudents([]); }}
                      style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#e2e8f0", fontFamily: "inherit", cursor: "pointer", flex: 1 }}>
                      <option value="">All Year Levels</option>
                      {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>

                  {/* Search */}
                  <Input
                    value={studentFilter}
                    onChange={e => setStudentFilter(e.target.value)}
                    placeholder="Search students…"
                    style={{ fontSize: 12 }}
                  />

                  {filteredUnenrolled.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "8px 0" }}>
                      {eligibleStudents.length === 0 ? "All eligible students are enrolled." : "No students match the filter."}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" id="sel-all"
                          checked={selStudents.length === filteredUnenrolled.length && filteredUnenrolled.length > 0}
                          onChange={e => setSelStudents(e.target.checked ? filteredUnenrolled.map(s => s.id) : [])}
                          style={{ cursor: "pointer", accentColor: "#6366f1" }} />
                        <label htmlFor="sel-all" style={{ fontSize: 12, color: "#94a3b8", cursor: "pointer", userSelect: "none" }}>
                          Select all ({filteredUnenrolled.length})
                        </label>
                        {selStudents.length > 0 && (
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "#a5b4fc", fontWeight: 700 }}>{selStudents.length} selected</span>
                        )}
                      </div>
                      <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3, border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", background: "#0f172a" }}>
                        {filteredUnenrolled.map(s => (
                          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 0", userSelect: "none" }}>
                            <input type="checkbox" checked={selStudents.includes(s.id)} onChange={() => toggleStudent(s.id)} style={{ cursor: "pointer", accentColor: "#6366f1" }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.fullName}</div>
                              {s.yearLevel && <div style={{ fontSize: 10, color: "#475569" }}>{s.yearLevel}</div>}
                            </div>
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

              {/* Courses grid — top half or full */}
              <div style={{ flex: selCourse ? "0 0 52%" : 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8, borderBottom: selCourse ? "1px solid #334155" : "none" }}>
                <div style={{ ...S.label, flexShrink: 0 }}>
                  {courses.length} Courses · {selProg?.name}
                  {selCourse && <span style={{ marginLeft: 10, color: "#a5b4fc" }}>← {selCourse.code} selected</span>}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {loading
                    ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                    : courses.length === 0
                    ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40, fontSize: 13 }}>No active courses in this program.</div>
                    : <LMSGrid columns={courseCols} rowData={courses} height="100%" selectedId={selCourse?.id}
                        onRowClick={c => selectCourse(c)} />}
                </div>
              </div>

              {/* Enrolled students — bottom half */}
              {selCourse && (
                <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0f1a", gap: 8 }}>
                  <div style={{ ...S.label, flexShrink: 0 }}>
                    🎓 Enrolled in {selCourse.code} — {selCourse.name}
                    <span style={{ marginLeft: 8, color: "#60a5fa" }}>({courseEnrollments.length} student{courseEnrollments.length !== 1 ? "s" : ""})</span>
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    {courseEnrollments.length === 0
                      ? <div style={{ color: "#334155", fontSize: 13, textAlign: "center", paddingTop: 20 }}>No students enrolled yet. Use the left panel to enroll students.</div>
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
