/**
 * SubAdminCourseManagement.jsx
 * FOLDER: src/sub-admin/pages/SubAdminCourseManagement.jsx
 *
 * ── REQUIRES TWO NEW SUPABASE TABLES ─────────────────────────────────────────
 *
 *  CREATE TABLE course_sections (
 *    section_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *    course_id           uuid NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
 *    section_label       text NOT NULL DEFAULT 'A',
 *    section_type        text NOT NULL DEFAULT 'regular',   -- 'regular' | 'shared'
 *    primary_program_id  uuid,                              -- for 'regular' sections
 *    program_ids         text[] DEFAULT '{}',               -- for 'shared' sections
 *    day_pattern         text,
 *    time_start          text,
 *    time_end            text,
 *    room                text,
 *    schedule_label      text,
 *    has_lab             boolean DEFAULT false,
 *    lab_day_pattern     text,
 *    lab_time_start      text,
 *    lab_time_end        text,
 *    lab_room            text,
 *    teacher_id          uuid,
 *    academic_year       text DEFAULT '2025-2026',
 *    semester            text,
 *    year_level          text,
 *    created_at          timestamptz DEFAULT now(),
 *    UNIQUE (course_id, section_label)
 *  );
 *
 *  CREATE TABLE student_section_enrollments (
 *    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *    section_id          uuid NOT NULL REFERENCES course_sections(section_id) ON DELETE CASCADE,
 *    student_id          uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 *    enrollment_status   text DEFAULT 'Enrolled',
 *    final_grade         numeric,
 *    created_at          timestamptz DEFAULT now(),
 *    UNIQUE (section_id, student_id)
 *  );
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Navigation flow:
 *   Programs → Courses (of selected program) → Sections (of selected course)
 *
 * Sections support:
 *   • Regular: one program assigned per section  (e.g. ITC 110 - Section A → BSCS)
 *   • Shared:  multiple programs share a section (e.g. NSTP 1 - Shared → BSCS + BSIT + BSBA)
 *   • Each section has its own schedule, teacher, and student roster
 */

import React, { useState, useEffect, useCallback } from "react";
import { supabase }                                 from "../../supabaseClient";
import { departmentApi, programApi }                from "../../lib/api";
import { Badge, Btn, Input, Sel, FF }               from "../../components/ui";
import LMSGrid                                      from "../../components/LMSGrid";
import TopBar                                       from "../../components/TopBar";

// ── Shared styles ──────────────────────────────────────────────────────────────
const S = {
  pane:  { width: 330, borderRight: "1px solid #334155", background: "#1e293b", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flexShrink: 0 },
  grid:  { flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8 },
  label: { fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" },
  sec:   { borderTop: "1px solid #334155", paddingTop: 10, marginTop: 2 },
  sHdr:  { fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 },
};

// ── Small presentational helpers ───────────────────────────────────────────────
const PH = ({ title, sub }) => (
  <div style={{ marginBottom: 2 }}>
    <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>{title}</div>
    {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sub}</div>}
  </div>
);

const InfoPill = ({ label, color = "#6366f1" }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: `${color}22`, color, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
    {label}
  </span>
);

const TypeBadge = ({ type }) =>
  type === "shared"
    ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "rgba(245,158,11,.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.3)", whiteSpace: "nowrap" }}>🔗 Shared</span>
    : <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "rgba(99,102,241,.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,.3)", whiteSpace: "nowrap" }}>📌 Regular</span>;

// ── Day-toggle helpers ─────────────────────────────────────────────────────────
const DAYS_ORDER = ["M","T","W","Th","F","Sa","Su"];
const DAYS_META  = [
  { key: "M",  label: "Mon" }, { key: "T",  label: "Tue" },
  { key: "W",  label: "Wed" }, { key: "Th", label: "Thu" },
  { key: "F",  label: "Fri" }, { key: "Sa", label: "Sat" },
  { key: "Su", label: "Sun" },
];

function daysArrayToString(arr) {
  return DAYS_ORDER.filter(d => arr.includes(d)).join("");
}
function daysStringToArray(str) {
  if (!str) return [];
  const result = [];
  let s = str;
  for (const d of ["Th","Sa","Su","M","T","W","F"]) {
    if (s.includes(d)) { result.push(d); s = s.replaceAll(d, ""); }
  }
  return result;
}

const DayToggleButtons = ({ value, onChange }) => {
  const selected = daysStringToArray(value);
  const toggle = (key) => {
    const next = selected.includes(key) ? selected.filter(d => d !== key) : [...selected, key];
    onChange(daysArrayToString(next));
  };
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {DAYS_META.map(({ key, label }) => {
        const active = selected.includes(key);
        return (
          <button key={key} onClick={() => toggle(key)} type="button"
            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
              border: active ? "1.5px solid #6366f1" : "1.5px solid #334155",
              background: active ? "rgba(99,102,241,.25)" : "#0f172a",
              color: active ? "#a5b4fc" : "#475569", transition: "all .15s" }}>
            {label}
          </button>
        );
      })}
    </div>
  );
};

// ── Schedule label builder ─────────────────────────────────────────────────────
function buildScheduleLabel(days, timeStart, timeEnd) {
  if (!days || !timeStart || !timeEnd) return "";
  // Convert HH:MM → H:MM AM/PM
  const fmt = (t) => {
    if (!t) return t;
    const [hh, mm] = t.split(":").map(Number);
    if (isNaN(hh)) return t;
    const ampm = hh >= 12 ? "PM" : "AM";
    const h = hh % 12 || 12;
    return `${h}:${String(mm).padStart(2,"0")} ${ampm}`;
  };
  return `${days} ${fmt(timeStart)} - ${fmt(timeEnd)}`;
}

// ── Schedule conflict helpers ──────────────────────────────────────────────────
function splitDays(s) { return (s.match(/Th|Sa|Su|[MTWFS]/gi) || []).map(d => d.toUpperCase()); }
function daysOverlap(a, b) { const da = new Set(splitDays(a)); return splitDays(b).some(d => da.has(d)); }
function parseMinutes(t) {
  const m = (t || "").trim().match(/(\d+):(\d+)\s*([AaPp][Mm]?)?/);
  if (!m) return null;
  let h = parseInt(m[1]); const min = parseInt(m[2]); const ap = (m[3] || "").toUpperCase();
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
  const a = parseScheduleLabel(labelA), b = parseScheduleLabel(labelB);
  if (!a || !b) return false;
  return daysOverlap(a.days, b.days) && timesOverlap(a.timeRange, b.timeRange);
}

const YEAR_LEVELS = ["1st Year","2nd Year","3rd Year","4th Year","5th Year"];
const SEMESTERS   = ["1st Semester","2nd Semester","Summer"];
const QUICK_LABELS = ["A","B","C","D","E","F"];

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function SubAdminCourseManagement({ user, users = [] }) {
  const teachers = users.filter(u => u.role === "teacher");
  const students  = users.filter(u => u.role === "student");

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [level,      setLevel]      = useState("prog");   // "prog" | "course" | "section"
  const [selProg,    setSelProg]    = useState(null);
  const [selCourse,  setSelCourse]  = useState(null);
  const [selSection, setSelSection] = useState(null);

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [progs,              setProgs]              = useState([]);
  const [courses,            setCourses]            = useState([]);
  const [sections,           setSections]           = useState([]);
  const [sectionEnrollments, setSectionEnrollments] = useState([]);
  const [loading,            setLoading]            = useState(false);
  const [toast,              setToast]              = useState({ msg: "", type: "success" });

  // ── Section form state ────────────────────────────────────────────────────────
  const blankSectForm = (prog) => ({
    sectionLabel:      "A",
    useCustomLabel:    false,
    customLabel:       "",
    sectionType:       "regular",
    programId:         prog?.programId || "",
    sharedProgramIds:  [],
    yearLevel:         "",
    semester:          "",
    // Lecture schedule
    days: "MWF", timeStart: "", timeEnd: "", room: "",
    // Lab
    hasLab: false, labDays: "", labTimeStart: "", labTimeEnd: "", labRoom: "",
    // Teacher
    teacherId: "",
  });

  const [sectForm,          setSectForm]          = useState(() => blankSectForm(null));
  const [editingSectionId,  setEditingSectionId]  = useState(null);
  const [savingSection,     setSavingSection]     = useState(false);
  const [deletingSection,   setDeletingSection]   = useState(null);
  const [sectPane,          setSectPane]          = useState("form"); // "form" | "enroll"

  // ── Enroll state ─────────────────────────────────────────────────────────────
  const [selStudents,      setSelStudents]      = useState([]);
  const [enrolling,        setEnrolling]        = useState(false);
  const [studentFilter,    setStudentFilter]    = useState("");
  const [enrollYearFilter, setEnrollYearFilter] = useState("");

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 4500);
  };

  // ── Init ─────────────────────────────────────────────────────────────────────
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

  // ── Load courses (with section counts) ──────────────────────────────────────
  const loadCourses = useCallback(async (programId) => {
    setLoading(true);
    try {
      const { data: mapData, error: mapErr } = await supabase
        .from("course_program_map")
        .select(`id, year_level, semester, courses ( course_id, course_code, course_name, units, status, is_active )`)
        .eq("program_id", programId)
        .order("id", { ascending: true });
      if (mapErr) throw new Error(mapErr.message);

      const courseRows = (mapData ?? []).filter(m => m.courses?.is_active);
      const courseIds  = courseRows.map(m => m.courses.course_id);

      // Count sections per course
      let sectionCountMap = {};
      if (courseIds.length) {
        const { data: scData } = await supabase
          .from("course_sections")
          .select("course_id, section_id")
          .in("course_id", courseIds);
        (scData || []).forEach(r => {
          sectionCountMap[r.course_id] = (sectionCountMap[r.course_id] || 0) + 1;
        });
      }

      setCourses(courseRows.map(m => ({
        id:            m.courses.course_code,    // LMSGrid selectedId key
        _uuid:         m.courses.course_id,
        _mapYearLevel: m.year_level,
        _mapSemester:  m.semester,
        code:          m.courses.course_code,
        name:          m.courses.course_name,
        units:         m.courses.units,
        status:        m.courses.status || "Ongoing",
        programId:     programId,
        yearLevel:     m.year_level || "",
        semester:      m.semester   || "",
        sectionCount:  sectionCountMap[m.courses.course_id] || 0,
      })));
    } catch (e) { showToast(e.message, "error"); }
    setLoading(false);
  }, []);

  // ── Load sections ────────────────────────────────────────────────────────────
  const loadSections = useCallback(async (courseId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("course_sections")
        .select("*")
        .eq("course_id", courseId)
        .order("section_label", { ascending: true });
      if (error) throw new Error(error.message);

      // Resolve teacher names
      const teacherUuids = [...new Set((data || []).map(s => s.teacher_id).filter(Boolean))];
      let teacherNameMap = {};
      if (teacherUuids.length) {
        const { data: tUsers } = await supabase
          .from("users").select("user_id, full_name").in("user_id", teacherUuids);
        (tUsers || []).forEach(u => { teacherNameMap[u.user_id] = u.full_name; });
      }

      // Resolve program names for all referenced program IDs
      const allPIds = [...new Set((data || []).flatMap(s =>
        s.section_type === "shared"
          ? (s.program_ids || [])
          : (s.primary_program_id ? [s.primary_program_id] : [])
      ))];
      let progMap = {};
      if (allPIds.length) {
        const { data: pData } = await supabase
          .from("program").select("program_id, code, name").in("program_id", allPIds);
        (pData || []).forEach(p => { progMap[p.program_id] = p; });
      }

      const enriched = (data || []).map(s => ({
        ...s,
        id:           s.section_id,   // needed by LMSGrid selectedId
        teacherName:  s.teacher_id ? (teacherNameMap[s.teacher_id] || "Unassigned") : "Unassigned",
        programLabel: s.section_type === "shared"
          ? (s.program_ids || []).map(id => progMap[id]?.code || id).join(" · ")
          : (s.primary_program_id ? (progMap[s.primary_program_id]?.name || "—") : "—"),
        programCodes: s.section_type === "shared"
          ? (s.program_ids || []).map(id => progMap[id]?.code || id)
          : [],
      }));
      setSections(enriched);

      // Load enrollments for all sections of this course
      const sectionIds = enriched.map(s => s.section_id);
      if (sectionIds.length) {
        const { data: enData } = await supabase
          .from("student_section_enrollments")
          .select("id, section_id, student_id, enrollment_status, final_grade")
          .in("section_id", sectionIds);
        setSectionEnrollments(enData || []);
      } else {
        setSectionEnrollments([]);
      }
    } catch (e) { showToast(e.message, "error"); }
    setLoading(false);
  }, []);

  // ── Navigation helpers ────────────────────────────────────────────────────────
  const goProgLevel = () => {
    setLevel("prog");
    setSelProg(null); setSelCourse(null); setSelSection(null);
    setCourses([]); setSections([]); setSectionEnrollments([]);
  };
  const goCourseLevel = () => {
    setLevel("course");
    setSelCourse(null); setSelSection(null);
    setSections([]); setSectionEnrollments([]);
  };

  const drillProg = async (prog) => {
    setSelProg(prog); setSelCourse(null); setSelSection(null);
    setLevel("course");
    await loadCourses(prog.programId);
  };

  const drillSections = async (course) => {
    setSelCourse(course); setSelSection(null);
    setEditingSectionId(null);
    setSectForm(blankSectForm(selProg));
    setSectPane("form");
    setLevel("section");
    await loadSections(course._uuid);
  };

  // ── Section form helpers ──────────────────────────────────────────────────────
  const setSF = (patch) => setSectForm(f => ({ ...f, ...patch }));

  const editSection = (section) => {
    setEditingSectionId(section.section_id);
    setSectForm({
      sectionLabel:     QUICK_LABELS.includes(section.section_label) ? section.section_label : "A",
      useCustomLabel:   !QUICK_LABELS.includes(section.section_label),
      customLabel:      !QUICK_LABELS.includes(section.section_label) ? section.section_label : "",
      sectionType:      section.section_type || "regular",
      programId:        section.primary_program_id || "",
      sharedProgramIds: section.program_ids || [],
      yearLevel:        section.year_level || "",
      semester:         section.semester   || "",
      days:             section.day_pattern  || "MWF",
      timeStart:        section.time_start   || "",
      timeEnd:          section.time_end     || "",
      room:             section.room         || "",
      hasLab:           section.has_lab      || false,
      labDays:          section.lab_day_pattern  || "",
      labTimeStart:     section.lab_time_start   || "",
      labTimeEnd:       section.lab_time_end     || "",
      labRoom:          section.lab_room         || "",
      teacherId:        section.teacher_id || "",
    });
    setSectPane("form");
  };

  const cancelEdit = () => {
    setEditingSectionId(null);
    setSectForm(blankSectForm(selProg));
  };

  // ── Save section ──────────────────────────────────────────────────────────────
  const saveSection = async () => {
    if (!selCourse) return;
    const label = sectForm.useCustomLabel ? sectForm.customLabel.trim() : sectForm.sectionLabel;
    if (!label) { showToast("Please enter a section label.", "error"); return; }
    if (sectForm.sectionType === "regular" && !sectForm.programId) {
      showToast("Please select a program for this section.", "error"); return;
    }
    if (sectForm.sectionType === "shared" && sectForm.sharedProgramIds.length < 2) {
      showToast("Shared sections require at least 2 programs.", "error"); return;
    }
    if (!sectForm.timeStart || !sectForm.timeEnd) {
      showToast("Please fill in schedule start and end times.", "error"); return;
    }
    if (sectForm.hasLab && (!sectForm.labDays || !sectForm.labTimeStart || !sectForm.labTimeEnd)) {
      showToast("Please fill in lab schedule days and times.", "error"); return;
    }

    setSavingSection(true);
    try {
      // Build schedule label
      let schedLabel = buildScheduleLabel(sectForm.days, sectForm.timeStart, sectForm.timeEnd);
      if (sectForm.hasLab)  schedLabel += ` | Lab: ${buildScheduleLabel(sectForm.labDays, sectForm.labTimeStart, sectForm.labTimeEnd)}${sectForm.labRoom ? ` (${sectForm.labRoom})` : ""}`;

      // Schedule conflict check for teacher
      if (sectForm.teacherId && schedLabel) {
        const { data: otherSections } = await supabase
          .from("course_sections")
          .select("section_id, schedule_label, course_id")
          .eq("teacher_id", sectForm.teacherId)
          .neq("section_id", editingSectionId || "00000000-0000-0000-0000-000000000000");

        const conflict = (otherSections || []).find(s =>
          schedulesConflict(schedLabel, s.schedule_label)
        );
        if (conflict) {
          const teacher = teachers.find(t => t._uuid === sectForm.teacherId);
          showToast(`Schedule conflict! ${teacher?.fullName || "This teacher"} already has a section with conflicting hours.`, "error");
          setSavingSection(false);
          return;
        }
      }

      const payload = {
        course_id:          selCourse._uuid,
        section_label:      label,
        section_type:       sectForm.sectionType,
        primary_program_id: sectForm.sectionType === "regular" ? sectForm.programId : null,
        program_ids:        sectForm.sectionType === "shared"  ? sectForm.sharedProgramIds : [],
        day_pattern:        sectForm.days,
        time_start:         sectForm.timeStart,
        time_end:           sectForm.timeEnd,
        room:               sectForm.room || null,
        schedule_label:     schedLabel,
        has_lab:            sectForm.hasLab,
        lab_day_pattern:    sectForm.hasLab ? sectForm.labDays    : null,
        lab_time_start:     sectForm.hasLab ? sectForm.labTimeStart : null,
        lab_time_end:       sectForm.hasLab ? sectForm.labTimeEnd   : null,
        lab_room:           sectForm.hasLab ? (sectForm.labRoom || null) : null,
        teacher_id:         sectForm.teacherId || null,
        year_level:         sectForm.yearLevel || null,
        semester:           sectForm.semester  || null,
        academic_year:      "2025-2026",
      };

      if (editingSectionId) {
        const { error } = await supabase.from("course_sections")
          .update(payload).eq("section_id", editingSectionId);
        if (error) throw new Error(error.message);
        showToast(`Section ${label} updated.`);
      } else {
        const { error } = await supabase.from("course_sections").insert(payload);
        if (error) throw new Error(error.message);
        showToast(`Section ${label} added to ${selCourse.code}.`);
      }

      await loadSections(selCourse._uuid);
      setEditingSectionId(null);

      // Suggest next unused label
      const taken = sections.map(s => s.section_label);
      const next  = QUICK_LABELS.find(l => !taken.includes(l)) || "A";
      setSectForm({ ...blankSectForm(selProg), sectionLabel: next });
    } catch (e) { showToast(e.message, "error"); }
    setSavingSection(false);
  };

  // ── Delete section ────────────────────────────────────────────────────────────
  const deleteSection = async (sectionId) => {
    if (!window.confirm("Delete this section and all its enrollments?")) return;
    setDeletingSection(sectionId);
    try {
      await supabase.from("student_section_enrollments").delete().eq("section_id", sectionId);
      const { error } = await supabase.from("course_sections").delete().eq("section_id", sectionId);
      if (error) throw new Error(error.message);
      setSections(prev => prev.filter(s => s.section_id !== sectionId));
      setSectionEnrollments(prev => prev.filter(e => e.section_id !== sectionId));
      if (selSection?.section_id === sectionId) setSelSection(null);
      showToast("Section deleted.");
    } catch (e) { showToast(e.message, "error"); }
    setDeletingSection(null);
  };

  // ── Select section ────────────────────────────────────────────────────────────
  const selectSection = (section) => {
    if (selSection?.section_id === section.section_id) {
      setSelSection(null); return;
    }
    setSelSection(section);
    setSelStudents([]); setStudentFilter(""); setEnrollYearFilter("");
    setSectPane("enroll");
  };

  // ── Enroll students ───────────────────────────────────────────────────────────
  const enrollStudents = async () => {
    if (!selSection || selStudents.length === 0) return;
    setEnrolling(true);
    let enrolled = 0, skipped = 0;
    try {
      for (const sId of selStudents) {
        const st = students.find(s => s.id === sId);
        if (!st) continue;
        const already = sectionEnrollments.find(
          e => e.section_id === selSection.section_id && String(e.student_id) === String(st._uuid)
        );
        if (already) { skipped++; continue; }
        const { data: inserted, error } = await supabase
          .from("student_section_enrollments")
          .insert({ section_id: selSection.section_id, student_id: st._uuid, enrollment_status: "Enrolled" })
          .select("id, section_id, student_id, enrollment_status, final_grade")
          .single();
        if (!error && inserted) {
          setSectionEnrollments(prev => [...prev, inserted]);
          enrolled++;
        }
      }
      setSelStudents([]);
      showToast(skipped > 0
        ? `${enrolled} enrolled, ${skipped} already enrolled (skipped).`
        : `${enrolled} student${enrolled !== 1 ? "s" : ""} enrolled in Section ${selSection.section_label}.`
      );
    } catch (e) { showToast(e.message, "error"); }
    setEnrolling(false);
  };

  const removeEnrollment = async (enrollmentId) => {
    const { error } = await supabase.from("student_section_enrollments")
      .delete().eq("id", enrollmentId);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    setSectionEnrollments(prev => prev.filter(e => e.id !== enrollmentId));
    showToast("Student removed from section.");
  };

  const toggleStudent = (sId) =>
    setSelStudents(prev => prev.includes(sId) ? prev.filter(x => x !== sId) : [...prev, sId]);

  // ── Derived data ──────────────────────────────────────────────────────────────
  const enrolledRows = selSection
    ? sectionEnrollments
        .filter(e => e.section_id === selSection.section_id)
        .map(e => {
          const st = students.find(s => String(s._uuid) === String(e.student_id));
          const prog = progs.find(p => p.programId === st?.programId);
          return {
            id:          e.id,
            studentName: st?.fullName || e.student_id,
            programCode: prog?.code   || "—",
            yearLevel:   st?.yearLevel || "—",
            status:      e.enrollment_status,
            grade:       e.final_grade,
          };
        })
    : [];

  const enrolledUuids = new Set(
    selSection
      ? sectionEnrollments.filter(e => e.section_id === selSection.section_id).map(e => e.student_id)
      : []
  );

  // Eligible students depend on section type.
  // Coerce IDs to String — primary_program_id is stored as text in the DB
  // (e.g. "1") but s.programId may arrive as a number from the API.
  const eligibleStudents = selSection
    ? students.filter(s => {
        if (enrolledUuids.has(String(s._uuid))) return false;
        if (selSection.section_type === "shared") {
          const ids = (selSection.program_ids || []).map(String);
          return !ids.length || ids.includes(String(s.programId));
        }
        return !selSection.primary_program_id ||
               String(s.programId) === String(selSection.primary_program_id);
      })
    : [];

  const filteredEligible = eligibleStudents.filter(s => {
    if (enrollYearFilter && s.yearLevel !== enrollYearFilter) return false;
    if (!studentFilter) return true;
    return s.fullName?.toLowerCase().includes(studentFilter.toLowerCase()) ||
           s.id?.toLowerCase().includes(studentFilter.toLowerCase());
  });

  const sectionsWithCounts = sections.map(s => ({
    ...s,
    enrollmentCount: sectionEnrollments.filter(e => e.section_id === s.section_id).length,
  }));

  // ── Grid column definitions ───────────────────────────────────────────────────
  const progCols = [
    { field: "code",    header: "Code",    width: 80 },
    { field: "name",    header: "Program" },
    { field: "description", header: "Description" },
    { field: "isActive", header: "Status", width: 80,
      cellRenderer: v => (
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
          background: v === 1 ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)",
          color:      v === 1 ? "#34d399"             : "#f87171" }}>
          {v === 1 ? "Active" : "Inactive"}
        </span>
      )},
    { field: "programId", header: "Actions", width: 100, sortable: false,
      cellRenderer: (_, row) => <Btn size="sm" onClick={() => drillProg(row)}>Manage →</Btn> },
  ];

  const courseCols = [
    { field: "code",    header: "Code",     width: 80 },
    { field: "name",    header: "Course" },
    { field: "units",   header: "Units",    width: 55 },
    { field: "yearLevel", header: "Year",   width: 90,
      cellRenderer: v => v ? <InfoPill label={v} color="#6366f1" /> : null },
    { field: "semester", header: "Semester", width: 120,
      cellRenderer: v => v ? <InfoPill label={v} color={v === "1st Semester" ? "#0ea5e9" : v === "2nd Semester" ? "#8b5cf6" : "#f59e0b"} /> : null },
    { field: "sectionCount", header: "Sections", width: 90,
      cellRenderer: v => (
        <span style={{ fontSize: 11, fontWeight: 700, color: v > 0 ? "#34d399" : "#475569" }}>
          {v > 0 ? `${v} section${v !== 1 ? "s" : ""}` : "None yet"}
        </span>
      )},
    { field: "_uuid", header: "Manage", width: 120, sortable: false,
      cellRenderer: (_, row) => (
        <Btn size="sm" onClick={e => { e.stopPropagation(); drillSections(row); }}>
          Sections →
        </Btn>
      )},
  ];

  const sectionCols = [
    { field: "section_label", header: "Section", width: 85,
      cellRenderer: (v) => (
        <span style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9" }}>
          {selCourse?.code} – {v}
        </span>
      )},
    { field: "section_type", header: "Type", width: 100, cellRenderer: v => <TypeBadge type={v} /> },
    { field: "programLabel", header: "Program(s)" },
    { field: "schedule_label", header: "Schedule", width: 190,
      cellRenderer: v => v
        ? <span style={{ color: "#60a5fa", fontSize: 11, whiteSpace: "nowrap" }}>{v.split(" | Lab:")[0]}</span>
        : <span style={{ color: "#334155", fontSize: 11 }}>Not set</span> },
    { field: "teacherName", header: "Teacher", width: 140,
      cellRenderer: v => (
        <span style={{ color: v === "Unassigned" ? "#475569" : "#34d399", fontWeight: 600, fontSize: 12 }}>{v}</span>
      )},
    { field: "room", header: "Room", width: 80 },
    { field: "year_level", header: "Year", width: 80,
      cellRenderer: v => v ? <InfoPill label={v} color="#6366f1" /> : null },
    { field: "semester", header: "Semester", width: 115,
      cellRenderer: v => v ? (
        <InfoPill label={v} color={v === "1st Semester" ? "#0ea5e9" : v === "2nd Semester" ? "#8b5cf6" : "#f59e0b"} />
      ) : null },
    { field: "enrollmentCount", header: "Enrolled", width: 75,
      cellRenderer: v => (
        <span style={{ fontWeight: 700, color: v > 0 ? "#34d399" : "#475569", fontSize: 12 }}>{v}</span>
      )},
    { field: "section_id", header: "Actions", width: 120, sortable: false,
      cellRenderer: (v, row) => (
        <div style={{ display: "flex", gap: 4 }}>
          <Btn size="sm" variant="secondary" onClick={e => { e.stopPropagation(); editSection(row); }}>✎</Btn>
          <Btn size="sm" variant="danger"
            onClick={e => { e.stopPropagation(); deleteSection(v); }}
            disabled={deletingSection === v}>
            {deletingSection === v ? "…" : "✕"}
          </Btn>
        </div>
      )},
  ];

  const enrolledCols = [
    { field: "studentName", header: "Student" },
    { field: "programCode", header: "Prog.", width: 70 },
    { field: "yearLevel",   header: "Year",   width: 80 },
    { field: "status",      header: "Status", width: 90,
      cellRenderer: v => <Badge color="success">{v}</Badge> },
    { field: "grade", header: "Grade", width: 65,
      cellRenderer: v => v != null
        ? <span style={{ fontWeight: 700, color: "#fbbf24" }}>{v}%</span>
        : <span style={{ color: "#475569" }}>—</span> },
    { field: "id", header: "Remove", width: 75, sortable: false,
      cellRenderer: v => (
        <Btn size="sm" variant="danger" onClick={e => { e.stopPropagation(); removeEnrollment(v); }}>✕</Btn>
      )},
  ];

  // ── Subtitle ──────────────────────────────────────────────────────────────────
  const subtitle =
    level === "prog"    ? `${progs.length} program${progs.length !== 1 ? "s" : ""}${user.subAdminScopeRef ? ` · ${user.subAdminScopeRef}` : ""}` :
    level === "course"  ? `${selProg?.name} · ${courses.length} course${courses.length !== 1 ? "s" : ""}` :
    `${selProg?.name} · ${selCourse?.name} · ${sections.length} section${sections.length !== 1 ? "s" : ""}`;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      <TopBar title="Course Management" subtitle={subtitle}
        actions={
          level !== "prog" && (
            <Btn variant="secondary" size="sm"
              onClick={level === "course" ? goProgLevel : goCourseLevel}>
              ← {level === "course" ? "Back to Programs" : `Back to ${selProg?.name || "Courses"}`}
            </Btn>
          )
        }
      />

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 18px", background: "#1e293b", borderBottom: "1px solid #334155", flexShrink: 0 }}>
        <button onClick={goProgLevel}
          style={{ background: "none", border: "none", color: level === "prog" ? "#f1f5f9" : "#6366f1", fontWeight: 700, cursor: level !== "prog" ? "pointer" : "default", fontFamily: "inherit", fontSize: 12 }}>
          📚 Programs
        </button>
        {selProg && (
          <>
            <span style={{ color: "#334155" }}>›</span>
            <button onClick={level === "section" ? goCourseLevel : undefined}
              style={{ background: "none", border: "none", color: level === "course" ? "#f1f5f9" : "#6366f1", fontWeight: 700, cursor: level === "section" ? "pointer" : "default", fontFamily: "inherit", fontSize: 12 }}>
              {selProg.name}
            </button>
          </>
        )}
        {selCourse && (
          <>
            <span style={{ color: "#334155" }}>›</span>
            <span style={{ color: "#a5b4fc", fontWeight: 700 }}>{selCourse.code} — Sections</span>
          </>
        )}
        {selSection && (
          <>
            <span style={{ color: "#334155" }}>›</span>
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>Section {selSection.section_label}</span>
          </>
        )}
      </div>

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, maxWidth: 480,
          background: toast.type === "error" ? "rgba(239,68,68,.12)" : "rgba(16,185,129,.12)",
          border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`,
          borderRadius: 8, padding: "10px 14px",
          color: toast.type === "error" ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ══════════════════════════════════════════════════════════════
            LEVEL: PROGRAMS
        ══════════════════════════════════════════════════════════════ */}
        {level === "prog" && (
          <div style={S.grid}>
            <div style={{ ...S.label, flexShrink: 0 }}>
              {progs.length} Programs — click "Manage →" to view courses and manage sections
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              {loading
                ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                : progs.length === 0
                ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40, fontSize: 13 }}>No programs found for your department.</div>
                : <LMSGrid columns={progCols} rowData={progs} height="100%" />}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            LEVEL: COURSES
        ══════════════════════════════════════════════════════════════ */}
        {level === "course" && (
          <div style={S.grid}>
            <div style={{ ...S.label, flexShrink: 0 }}>
              {courses.length} Courses · {selProg?.name} — click "Sections →" to manage sections for a course
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              {loading
                ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                : courses.length === 0
                ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40, fontSize: 13 }}>No active courses in this program.</div>
                : <LMSGrid columns={courseCols} rowData={courses} height="100%" onRowClick={drillSections} />}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            LEVEL: SECTIONS
        ══════════════════════════════════════════════════════════════ */}
        {level === "section" && (
          <>
            {/* ── Left Pane ── */}
            <div style={S.pane}>
              <PH title={`📋 ${selCourse?.code}`} sub={selCourse?.name} />

              {/* Pane tab switcher */}
              <div style={{ display: "flex", gap: 4, background: "#0f172a", borderRadius: 8, padding: 4 }}>
                {[
                  { key: "form",   label: editingSectionId ? "✎ Edit Section" : "✦ Add Section" },
                  { key: "enroll", label: `🎓 Enroll${selSection ? ` (${selSection.section_label})` : ""}` },
                ].map(tab => (
                  <button key={tab.key}
                    onClick={() => { if (tab.key === "enroll" && !selSection) return; setSectPane(tab.key); }}
                    style={{ flex: 1, padding: "6px 4px", borderRadius: 6, border: "none", cursor: tab.key === "enroll" && !selSection ? "not-allowed" : "pointer",
                      fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                      background: sectPane === tab.key ? "#4f46e5" : "transparent",
                      color: sectPane === tab.key ? "#fff" : tab.key === "enroll" && !selSection ? "#1e293b" : "#475569",
                      transition: "all .15s" }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ─────────────────────────────────────────────────────────
                  TAB: ADD / EDIT SECTION
              ───────────────────────────────────────────────────────── */}
              {sectPane === "form" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                  {/* Edit banner */}
                  {editingSectionId && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.3)",
                      borderRadius: 7, padding: "6px 10px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc" }}>
                        ✎ Editing: {sections.find(s => s.section_id === editingSectionId)?.section_label}
                      </span>
                      <button onClick={cancelEdit}
                        style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                        ✕ Cancel
                      </button>
                    </div>
                  )}

                  {/* ── Section Label ── */}
                  <div style={S.sec}>
                    <div style={S.sHdr}>🏷️ Section Label</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                      {QUICK_LABELS.map(l => {
                        const active = sectForm.sectionLabel === l && !sectForm.useCustomLabel;
                        return (
                          <button key={l} type="button"
                            onClick={() => setSF({ sectionLabel: l, useCustomLabel: false })}
                            style={{ width: 32, height: 32, borderRadius: 7, fontWeight: 800, fontSize: 12, cursor: "pointer",
                              border: active ? "2px solid #6366f1" : "1.5px solid #334155",
                              background: active ? "rgba(99,102,241,.25)" : "#0f172a",
                              color: active ? "#a5b4fc" : "#475569", transition: "all .15s" }}>
                            {l}
                          </button>
                        );
                      })}
                      <button type="button" onClick={() => setSF({ useCustomLabel: true })}
                        style={{ padding: "0 10px", height: 32, borderRadius: 7, fontWeight: 800, fontSize: 11, cursor: "pointer",
                          border: sectForm.useCustomLabel ? "2px solid #6366f1" : "1.5px solid #334155",
                          background: sectForm.useCustomLabel ? "rgba(99,102,241,.25)" : "#0f172a",
                          color: sectForm.useCustomLabel ? "#a5b4fc" : "#475569", transition: "all .15s" }}>
                        +Custom
                      </button>
                    </div>
                    {sectForm.useCustomLabel && (
                      <Input value={sectForm.customLabel}
                        onChange={e => setSF({ customLabel: e.target.value })}
                        placeholder='e.g. "Shared", "NSTP-1", "GEC-A"'
                        style={{ fontSize: 12 }} />
                    )}
                  </div>

                  {/* ── Section Type ── */}
                  <div style={S.sec}>
                    <div style={S.sHdr}>📌 Section Type</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[
                        { key: "regular", label: "📌 Regular", desc: "One program" },
                        { key: "shared",  label: "🔗 Shared",  desc: "Multiple programs" },
                      ].map(t => (
                        <button key={t.key} type="button"
                          onClick={() => setSF({ sectionType: t.key, sharedProgramIds: [] })}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: sectForm.sectionType === t.key ? "2px solid #6366f1" : "1.5px solid #334155",
                            background: sectForm.sectionType === t.key ? "rgba(99,102,241,.18)" : "#0f172a",
                            color: sectForm.sectionType === t.key ? "#a5b4fc" : "#475569",
                            fontWeight: 700, fontSize: 11, cursor: "pointer", transition: "all .15s", fontFamily: "inherit" }}>
                          <div>{t.label}</div>
                          <div style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>{t.desc}</div>
                        </button>
                      ))}
                    </div>
                    {sectForm.sectionType === "shared" && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.5,
                        background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.2)",
                        borderRadius: 6, padding: "5px 8px" }}>
                        ℹ️ Use Shared for cross-program courses (NSTP, PE, GEC) where multiple programs share the same class schedule.
                      </div>
                    )}
                  </div>

                  {/* ── Program Assignment ── */}
                  <div style={S.sec}>
                    <div style={S.sHdr}>
                      {sectForm.sectionType === "shared" ? "🔗 Programs Sharing This Section" : "📚 Assigned Program"}
                    </div>

                    {sectForm.sectionType === "regular" ? (
                      <FF label="Program">
                        <Sel value={sectForm.programId} onChange={e => setSF({ programId: e.target.value })}>
                          <option value="">— Select Program —</option>
                          {progs.map(p => (
                            <option key={p.programId} value={p.programId}>{p.code} — {p.name}</option>
                          ))}
                        </Sel>
                      </FF>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 150,
                          overflowY: "auto", border: "1px solid #334155", borderRadius: 7,
                          padding: "8px 10px", background: "#0f172a" }}>
                          {progs.length === 0
                            ? <div style={{ fontSize: 11, color: "#475569", textAlign: "center", padding: "8px 0" }}>No programs available.</div>
                            : progs.map(p => {
                              const checked = sectForm.sharedProgramIds.includes(p.programId);
                              return (
                                <label key={p.programId}
                                  style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", userSelect: "none", padding: "3px 0" }}>
                                  <input type="checkbox" checked={checked}
                                    onChange={() => setSF({
                                      sharedProgramIds: checked
                                        ? sectForm.sharedProgramIds.filter(x => x !== p.programId)
                                        : [...sectForm.sharedProgramIds, p.programId],
                                    })}
                                    style={{ cursor: "pointer", accentColor: "#f59e0b", width: 14, height: 14 }} />
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: checked ? "#f59e0b" : "#e2e8f0" }}>{p.code}</div>
                                    <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.3 }}>{p.name}</div>
                                  </div>
                                </label>
                              );
                            })
                          }
                        </div>
                        {sectForm.sharedProgramIds.length > 0 && (
                          <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4, fontWeight: 600 }}>
                            ✓ {sectForm.sharedProgramIds.length} program{sectForm.sharedProgramIds.length !== 1 ? "s" : ""} selected
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* ── Year / Semester ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <FF label="Year Level">
                      <Sel value={sectForm.yearLevel} onChange={e => setSF({ yearLevel: e.target.value })}>
                        <option value="">— Any —</option>
                        {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
                      </Sel>
                    </FF>
                    <FF label="Semester">
                      <Sel value={sectForm.semester} onChange={e => setSF({ semester: e.target.value })}>
                        <option value="">— Any —</option>
                        {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                      </Sel>
                    </FF>
                  </div>

                  {/* ── Schedule ── */}
                  <div style={S.sec}>
                    <div style={S.sHdr}>🗓️ Schedule</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em" }}>📖 Lecture</div>
                      <FF label="Day Pattern">
                        <DayToggleButtons value={sectForm.days} onChange={v => setSF({ days: v })} />
                      </FF>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <FF label="Start Time">
                          <Input type="time" value={sectForm.timeStart} onChange={e => setSF({ timeStart: e.target.value })} />
                        </FF>
                        <FF label="End Time">
                          <Input type="time" value={sectForm.timeEnd} onChange={e => setSF({ timeEnd: e.target.value })} />
                        </FF>
                      </div>
                      <FF label="Room">
                        <Input value={sectForm.room} onChange={e => setSF({ room: e.target.value })} placeholder="e.g. Room 201" />
                      </FF>

                      {/* Lab toggle */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4, borderTop: "1px solid #1e293b" }}>
                        <button type="button" onClick={() => setSF({ hasLab: !sectForm.hasLab })}
                          style={{ width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer", position: "relative",
                            background: sectForm.hasLab ? "#6366f1" : "#334155", transition: "background .2s", flexShrink: 0 }}>
                          <span style={{ position: "absolute", top: 3, left: sectForm.hasLab ? 16 : 3,
                            width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                        </button>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sectForm.hasLab ? "#a5b4fc" : "#475569" }}>
                          🔬 Has Laboratory Class
                        </span>
                      </div>

                      {sectForm.hasLab && (
                        <div style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)",
                          borderRadius: 8, padding: "10px 10px 6px", display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.06em" }}>🔬 Laboratory</div>
                          <FF label="Lab Day Pattern">
                            <DayToggleButtons value={sectForm.labDays} onChange={v => setSF({ labDays: v })} />
                          </FF>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <FF label="Lab Start"><Input type="time" value={sectForm.labTimeStart} onChange={e => setSF({ labTimeStart: e.target.value })} /></FF>
                            <FF label="Lab End"><Input type="time" value={sectForm.labTimeEnd} onChange={e => setSF({ labTimeEnd: e.target.value })} /></FF>
                          </div>
                          <FF label="Lab Room"><Input value={sectForm.labRoom} onChange={e => setSF({ labRoom: e.target.value })} placeholder="e.g. Comp Lab 1" /></FF>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Teacher ── */}
                  <div style={S.sec}>
                    <div style={S.sHdr}>👩‍🏫 Assign Teacher</div>
                    {sectForm.teacherId && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399", marginBottom: 6,
                        padding: "4px 8px", background: "#0f172a", borderRadius: 6, border: "1px solid #334155" }}>
                        ✓ {teachers.find(t => t._uuid === sectForm.teacherId)?.fullName || "Assigned"}
                      </div>
                    )}
                    <FF label="Select Teacher">
                      <Sel value={sectForm.teacherId} onChange={e => setSF({ teacherId: e.target.value })}>
                        <option value="">— None / Unassigned —</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t._uuid}>{t.fullName}</option>
                        ))}
                      </Sel>
                    </FF>
                  </div>

                  <Btn onClick={saveSection} disabled={savingSection} style={{ width: "100%", marginTop: 4 }}>
                    {savingSection ? "⏳ Saving…" : editingSectionId ? "✓ Update Section" : "✦ Add Section"}
                  </Btn>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────
                  TAB: ENROLL STUDENTS
              ───────────────────────────────────────────────────────── */}
              {sectPane === "enroll" && selSection && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                  {/* Section info banner */}
                  <div style={{
                    background: selSection.section_type === "shared" ? "rgba(245,158,11,.08)" : "rgba(99,102,241,.08)",
                    border: `1px solid ${selSection.section_type === "shared" ? "rgba(245,158,11,.25)" : "rgba(99,102,241,.25)"}`,
                    borderRadius: 8, padding: "10px 12px"
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: selSection.section_type === "shared" ? "#f59e0b" : "#a5b4fc" }}>
                      {selCourse?.code} — Section {selSection.section_label}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{selSection.programLabel}</div>
                    {selSection.schedule_label && (
                      <div style={{ fontSize: 11, color: "#60a5fa", marginTop: 2 }}>🕐 {selSection.schedule_label.split(" | Lab:")[0]}</div>
                    )}
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {sectionEnrollments.filter(e => e.section_id === selSection.section_id).length} enrolled
                      </span>
                      <TypeBadge type={selSection.section_type} />
                    </div>
                  </div>

                  {/* Filters */}
                  <Sel value={enrollYearFilter} onChange={e => { setEnrollYearFilter(e.target.value); setSelStudents([]); }}>
                    <option value="">All Year Levels</option>
                    {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
                  </Sel>
                  <Input value={studentFilter} onChange={e => setStudentFilter(e.target.value)}
                    placeholder="Search students…" style={{ fontSize: 12 }} />

                  {filteredEligible.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "12px 0", lineHeight: 1.7 }}>
                      {eligibleStudents.length === 0
                        ? "All eligible students are enrolled in this section."
                        : "No students match the current filter."}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" id="sel-all-sect"
                          checked={selStudents.length === filteredEligible.length && filteredEligible.length > 0}
                          onChange={e => setSelStudents(e.target.checked ? filteredEligible.map(s => s.id) : [])}
                          style={{ cursor: "pointer", accentColor: "#6366f1" }} />
                        <label htmlFor="sel-all-sect" style={{ fontSize: 12, color: "#94a3b8", cursor: "pointer", userSelect: "none" }}>
                          Select all ({filteredEligible.length})
                        </label>
                        {selStudents.length > 0 && (
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "#a5b4fc", fontWeight: 700 }}>
                            {selStudents.length} selected
                          </span>
                        )}
                      </div>
                      <div style={{ maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column",
                        gap: 3, border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", background: "#0f172a" }}>
                        {filteredEligible.map(s => (
                          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 0", userSelect: "none" }}>
                            <input type="checkbox" checked={selStudents.includes(s.id)} onChange={() => toggleStudent(s.id)}
                              style={{ cursor: "pointer", accentColor: "#6366f1" }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.fullName}</div>
                              <div style={{ fontSize: 10, color: "#475569" }}>
                                {[s.yearLevel, s.programName].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                      <Btn onClick={enrollStudents} disabled={selStudents.length === 0 || enrolling} style={{ width: "100%" }}>
                        {enrolling ? "⏳ Enrolling…" : `🎓 Enroll ${selStudents.length > 0 ? `${selStudents.length} ` : ""}Student${selStudents.length !== 1 ? "s" : ""}`}
                      </Btn>
                    </>
                  )}
                </div>
              )}

              {sectPane === "enroll" && !selSection && (
                <div style={{ fontSize: 12, color: "#334155", textAlign: "center", paddingTop: 20, lineHeight: 1.7 }}>
                  👆 Click a section row in the grid to enroll students.
                </div>
              )}
            </div>

            {/* ── Right Area ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* Sections grid */}
              <div style={{
                flex: selSection ? "0 0 52%" : 1, padding: "14px 16px",
                display: "flex", flexDirection: "column", overflow: "hidden",
                background: "#0f172a", gap: 8,
                borderBottom: selSection ? "1px solid #334155" : "none",
              }}>
                <div style={{ ...S.label, flexShrink: 0 }}>
                  {sections.length} Section{sections.length !== 1 ? "s" : ""} · {selCourse?.code} — {selCourse?.name}
                  {selSection && (
                    <span style={{ marginLeft: 10, color: selSection.section_type === "shared" ? "#f59e0b" : "#a5b4fc" }}>
                      ← Section {selSection.section_label} selected
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {loading ? (
                    <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                  ) : sections.length === 0 ? (
                    <div style={{ color: "#475569", textAlign: "center", paddingTop: 50, fontSize: 13, lineHeight: 2 }}>
                      No sections yet.<br />
                      <span style={{ color: "#334155", fontSize: 12 }}>
                        Use the left panel to add sections (A, B, C…) or a Shared section.
                      </span>
                    </div>
                  ) : (
                    <LMSGrid
                      columns={sectionCols}
                      rowData={sectionsWithCounts}
                      height="100%"
                      selectedId={selSection?.section_id}
                      onRowClick={selectSection}
                    />
                  )}
                </div>
              </div>

              {/* Enrolled students in selected section */}
              {selSection && (
                <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0f1a", gap: 8 }}>
                  <div style={{ ...S.label, flexShrink: 0 }}>
                    🎓 Enrolled — {selCourse?.code} Section {selSection.section_label}
                    <span style={{ marginLeft: 8, color: "#60a5fa" }}>
                      ({enrolledRows.length} student{enrolledRows.length !== 1 ? "s" : ""})
                    </span>
                    {selSection.section_type === "shared" && (
                      <span style={{ marginLeft: 8 }}><TypeBadge type="shared" /></span>
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    {enrolledRows.length === 0 ? (
                      <div style={{ color: "#334155", fontSize: 13, textAlign: "center", paddingTop: 20 }}>
                        No students enrolled yet. Switch to the "Enroll" tab in the left panel.
                      </div>
                    ) : (
                      <LMSGrid columns={enrolledCols} rowData={enrolledRows} height="100%" />
                    )}
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
