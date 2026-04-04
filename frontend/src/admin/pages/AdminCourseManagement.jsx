/**
 * AdminCourseManagement.jsx
 * FOLDER: src/admin/pages/AdminCourseManagement.jsx
 *
 * Three-level drill-down:  Codes → Courses → Sections
 *
 * Admin can:
 *   • Navigate courses grouped by alphabetic code prefix (ITC, CS, GCAS, STAT…)
 *   • Add / Edit / Delete courses, including a per-section Student Limit
 *   • "Delete Data" — wipes ALL operational data tied to a course without deleting
 *     the course record itself (sections, enrollments, teacher assignments,
 *     materials, exams/quizzes, schedules)
 *   • Full section management identical to Sub-Admin:
 *       Add / Edit / Delete sections · assign teachers · enroll students
 *
 * REQUIRES this column on the courses table (run once in Supabase SQL editor):
 *   ALTER TABLE courses ADD COLUMN IF NOT EXISTS student_limit integer DEFAULT NULL;
 */

import React, { useState, useEffect, useCallback } from "react";
import { supabase }                                 from "../../supabaseClient";
import { programApi }                               from "../../lib/api";
import { Badge, Btn, Input, Sel, FF }               from "../../components/ui";
import LMSGrid                                      from "../../components/LMSGrid";
import TopBar                                       from "../../components/TopBar";

// ── Shared styles ──────────────────────────────────────────────────────────────
const S = {
  pane:  { width: 300, borderRight: "1px solid #334155", background: "#1e293b", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flexShrink: 0 },
  grid:  { flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8 },
  label: { fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" },
  sec:   { borderTop: "1px solid #334155", paddingTop: 10, marginTop: 4 },
  sHdr:  { fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 },
  hint:  { fontSize: 11, color: "#475569", fontStyle: "italic", lineHeight: 1.6 },
};

// ── Presentational helpers ─────────────────────────────────────────────────────
const PH = ({ title, sub, icon }) => (
  <div style={{ marginBottom: 2 }}>
    <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", display: "flex", alignItems: "center", gap: 6 }}>
      {icon && <span>{icon}</span>}{title}
    </div>
    {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sub}</div>}
  </div>
);

const InfoPill = ({ label, color = "#6366f1" }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
    background: `${color}22`, color, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
    {label}
  </span>
);

const TypeBadge = ({ type }) =>
  type === "shared"
    ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "rgba(245,158,11,.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.3)", whiteSpace: "nowrap" }}>🔗 Shared</span>
    : <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "rgba(99,102,241,.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,.3)", whiteSpace: "nowrap" }}>📌 Regular</span>;

const StatCard = ({ icon, value, label, color }) => (
  <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <div>
      <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{label}</div>
    </div>
  </div>
);

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
  const result = []; let s = str;
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

// ── Schedule helpers ──────────────────────────────────────────────────────────
function buildScheduleLabel(days, timeStart, timeEnd) {
  if (!days || !timeStart || !timeEnd) return "";
  const fmt = (t) => {
    const [hh, mm] = t.split(":").map(Number);
    if (isNaN(hh)) return t;
    return `${hh % 12 || 12}:${String(mm).padStart(2,"0")} ${hh >= 12 ? "PM" : "AM"}`;
  };
  return `${days} ${fmt(timeStart)} - ${fmt(timeEnd)}`;
}
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
    const ap = e.match(/[AaPp][Mm]/);
    if (ap && !s.match(/[AaPp][Mm]/)) s += " " + ap[0];
    return { s: parseMinutes(s), e: parseMinutes(e) };
  };
  const a = parse(rA), b = parse(rB);
  if (!a || !b || a.s === null || b.s === null) return false;
  return a.s < b.e && b.s < a.e;
}
function parseScheduleLabel(label) {
  if (!label) return null;
  const m = label.match(/([A-Za-z]+)\s+([\d:]+\s*(?:[AaPp][Mm])?\s*[-–]\s*[\d:]+\s*[AaPp][Mm])/);
  return m ? { days: m[1], timeRange: m[2] } : null;
}
function schedulesConflict(labelA, labelB) {
  const a = parseScheduleLabel(labelA), b = parseScheduleLabel(labelB);
  if (!a || !b) return false;
  return daysOverlap(a.days, b.days) && timesOverlap(a.timeRange, b.timeRange);
}

// ── Code prefix extractor ──────────────────────────────────────────────────────
function codePrefix(courseCode) {
  return (courseCode || "").match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || "OTHER";
}

const YEAR_LEVELS  = ["1st Year","2nd Year","3rd Year","4th Year","5th Year"];
const SEMESTERS    = ["1st Semester","2nd Semester","Summer"];
const QUICK_LABELS = ["A","B","C","D","E","F"];
const emptyCourse  = { code: "", name: "", units: "3", studentLimit: "" }; // "" = unlimited
const blankSectForm = () => ({
  sectionLabel: "A", useCustomLabel: false, customLabel: "",
  sectionType: "regular", programId: "", sharedProgramIds: [],
  yearLevel: "", semester: "",
  days: "MWF", timeStart: "", timeEnd: "", room: "",
  hasLab: false, labDays: "", labTimeStart: "", labTimeEnd: "", labRoom: "",
  teacherId: "",
});

// ── Delete Course Modal ────────────────────────────────────────────────────────
function ConfirmDeleteModal({ item, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "24px 26px", width: 420, maxWidth: "90vw" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#f87171", marginBottom: 8 }}>🗑 Delete "{item.name}"?</div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, lineHeight: 1.6 }}>
          This will permanently delete the course <strong style={{ color: "#e2e8f0" }}>{item.code}</strong> and all its associated data. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger"    onClick={onConfirm}>Delete Course</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Delete Data Modal ──────────────────────────────────────────────────────────
function DeleteDataModal({ item, onConfirm, onCancel, deleting }) {
  const cleared = [
    { icon: "📋", label: "All sections & their schedules" },
    { icon: "🎓", label: "All enrolled students (section enrollments)" },
    { icon: "👩‍🏫", label: "Teacher assignments" },
    { icon: "📝", label: "All coursework materials & student submissions" },
    { icon: "📊", label: "All exams, quizzes & student answers" },
    { icon: "📅", label: "Schedule & term data" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#1e293b", border: "1px solid rgba(245,158,11,.35)", borderRadius: 12, padding: "24px 26px", width: 480, maxWidth: "90vw" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#fbbf24", marginBottom: 4 }}>🧹 Delete Section Data</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 2, fontWeight: 600 }}>{item.code} — {item.name}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
          The <strong style={{ color: "#34d399" }}>course record will be kept</strong>. Only the operational data below will be permanently erased:
        </div>
        <div style={{ background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b", padding: "12px 14px", marginBottom: 20 }}>
          {cleared.map(({ icon, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: "#f87171", paddingBottom: 7, marginBottom: 7, borderBottom: "1px solid #1e293b" }}>
              <span style={{ fontSize: 15 }}>{icon}</span>
              <span>Will be deleted: {label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: "#34d399", paddingTop: 2 }}>
            <span style={{ fontSize: 15 }}>✅</span>
            <strong>Kept: Course record ({item.code} – {item.name})</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onCancel} disabled={deleting}>Cancel</Btn>
          <Btn onClick={onConfirm} disabled={deleting}
            style={{ background: "rgba(245,158,11,.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,.35)" }}>
            {deleting ? "⏳ Deleting…" : "🧹 Delete Data"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Delete Code Group Modal ────────────────────────────────────────────────────
function ConfirmDeleteCodeModal({ item, courseCount, onConfirm, onCancel, deleting }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#1e293b", border: "1px solid rgba(239,68,68,.35)", borderRadius: 12, padding: "24px 26px", width: 440, maxWidth: "90vw" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#f87171", marginBottom: 8 }}>
          🗑 Delete Code Group "{item.prefix}"?
        </div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12, lineHeight: 1.6 }}>
          Are you sure you want to delete the <strong style={{ color: "#e2e8f0" }}>{item.prefix}</strong> code group?
        </p>
        {courseCount > 0 && (
          <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 12, color: "#f87171", lineHeight: 1.6 }}>
            ⚠️ This will <strong>permanently delete {courseCount} course{courseCount !== 1 ? "s" : ""}</strong> and all their associated data (sections, enrollments, materials, exams, schedules). This cannot be undone.
          </div>
        )}
        {courseCount === 0 && (
          <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 12, color: "#fbbf24", lineHeight: 1.6 }}>
            This code group has no courses. It will simply be removed.
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onCancel} disabled={deleting}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? "⏳ Deleting…" : `Delete "${item.prefix}"`}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminCourseManagement({ courses: globalCourses, setCourses: setGlobalCourses, users, enrollments, setEnrollments }) {
  const teachers = (users || []).filter(u => u.role === "teacher");
  const students  = (users || []).filter(u => u.role === "student");

  // ── Navigation ────────────────────────────────────────────────────────────────
  const [level,      setLevel]      = useState("codes"); // "codes" | "course" | "section"
  const [selCode,    setSelCode]    = useState(null);
  const [selCourse,  setSelCourse]  = useState(null);
  const [selSection, setSelSection] = useState(null);

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [codeGroups,         setCodeGroups]        = useState([]);
  const [allCourses,         setAllCourses]         = useState([]);
  const [courses,            setCourses]            = useState([]);
  const [sections,           setSections]           = useState([]);
  const [sectionEnrollments, setSectionEnrollments] = useState([]);
  const [progs,              setProgs]              = useState([]);
  const [loading,            setLoading]            = useState(false);
  const [toast,              setToast]              = useState({ msg: "", type: "success" });

  // ── Course form ───────────────────────────────────────────────────────────────
  const [courseForm,      setCourseForm]      = useState(emptyCourse);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [savingCourse,    setSavingCourse]    = useState(false);

  // ── Section form ──────────────────────────────────────────────────────────────
  const [sectForm,         setSectForm]         = useState(blankSectForm);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [savingSection,    setSavingSection]    = useState(false);
  const [deletingSection,  setDeletingSection]  = useState(null);
  const [sectPane,         setSectPane]         = useState("form");

  // ── Enroll state ─────────────────────────────────────────────────────────────
  const [selStudents,      setSelStudents]      = useState([]);
  const [enrolling,        setEnrolling]        = useState(false);
  const [studentFilter,    setStudentFilter]    = useState("");
  const [enrollYearFilter, setEnrollYearFilter] = useState("");

  // ── Modals ────────────────────────────────────────────────────────────────────
  // ── Code form ─────────────────────────────────────────────────────────────────
  const [codeForm,     setCodeForm]     = useState({ prefix: "" });
  const [editingCode,  setEditingCode]  = useState(null); // old prefix string being edited
  const [savingCode,   setSavingCode]   = useState(false);
  const [deletingCode, setDeletingCode] = useState(false);

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [confirmDel,   setConfirmDel]   = useState(null);
  const [deletingData, setDeletingData] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 4000);
  };

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await Promise.all([loadAllCourses(), loadProgsForForm()]); }
      catch (e) { showToast(e.message, "error"); }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllCourses = useCallback(async () => {
    const { data: rawCourses, error } = await supabase
      .from("courses")
      .select("course_id, course_code, course_name, units, is_active, student_limit")
      .order("course_code", { ascending: true });
    if (error) throw new Error(error.message);

    const courseIds = (rawCourses || []).map(c => c.course_id);
    let sectionCountMap = {};
    if (courseIds.length) {
      const { data: scData } = await supabase
        .from("course_sections").select("course_id").in("course_id", courseIds);
      (scData || []).forEach(r => { sectionCountMap[r.course_id] = (sectionCountMap[r.course_id] || 0) + 1; });
    }

    const normalized = (rawCourses || []).map(c => ({
      id: c.course_code, _uuid: c.course_id,
      code: c.course_code, name: c.course_name,
      units: c.units, isActive: c.is_active,
      studentLimit: c.student_limit ?? null,  // null = unlimited
      sectionCount: sectionCountMap[c.course_id] || 0,
    }));
    setAllCourses(normalized);
    buildGroups(normalized);
  }, []);

  const buildGroups = (list) => {
    const map = {};
    list.forEach(c => { const p = codePrefix(c.code); map[p] = (map[p] || 0) + 1; });
    setCodeGroups(
      Object.entries(map)
        .map(([prefix, count]) => ({ id: prefix, prefix, count }))
        .sort((a, b) => a.prefix.localeCompare(b.prefix))
    );
  };

  const loadProgsForForm = useCallback(async () => {
    try { const r = await programApi.getList({ size: 200 }); setProgs(r.items ?? []); }
    catch (_) {}
  }, []);

  // ── Code CRUD ─────────────────────────────────────────────────────────────────
  const saveCode = async () => {
    const prefix = codeForm.prefix.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (!prefix) { showToast("Code prefix is required (letters only).", "error"); return; }

    if (editingCode) {
      // Rename prefix across all matching courses
      const affected = allCourses.filter(c => codePrefix(c.code) === editingCode);
      if (affected.length === 0) {
        // No courses — just update local state
        setCodeGroups(prev => prev.map(g => g.prefix === editingCode ? { ...g, id: prefix, prefix } : g).sort((a,b) => a.prefix.localeCompare(b.prefix)));
        setEditingCode(null); setCodeForm({ prefix: "" });
        showToast("Code renamed.");
        return;
      }
      setSavingCode(true);
      try {
        for (const c of affected) {
          // Replace only the leading alphabetic prefix in the course_code
          const newCode = c.code.replace(new RegExp("^" + editingCode, "i"), prefix);
          const { error } = await supabase.from("courses")
            .update({ course_code: newCode }).eq("course_id", c._uuid);
          if (error) throw new Error(error.message);
        }
        await loadAllCourses();
        setEditingCode(null); setCodeForm({ prefix: "" });
        showToast(`Code renamed from "${editingCode}" to "${prefix}".`);
      } catch (e) { showToast(e.message, "error"); }
      setSavingCode(false);
    } else {
      // "Add" a new code — just navigate to that code level (empty courses list)
      // The code group will appear automatically once the admin adds a course there
      const exists = codeGroups.some(g => g.prefix === prefix);
      if (exists) {
        drillCode(prefix);
        setCodeForm({ prefix: "" });
        showToast(`Navigated to "${prefix}" — add courses here.`);
      } else {
        // Navigate to empty course level for this prefix
        setSelCode(prefix);
        setLevel("course");
        setEditingCourseId(null);
        setCourseForm({ code: prefix + " ", name: "", units: "3" });
        setCourses([]);
        setCodeForm({ prefix: "" });
        showToast(`New code "${prefix}" created — add a course to register it.`);
      }
    }
  };

  const deleteCodeGroup = async (prefix) => {
    const affected = allCourses.filter(c => codePrefix(c.code) === prefix);
    setDeletingCode(true);
    try {
      for (const course of affected) {
        await runDeleteData(course, true);
        await supabase.from("courses").delete().eq("course_id", course._uuid);
      }
      const updated = allCourses.filter(c => codePrefix(c.code) !== prefix);
      setAllCourses(updated);
      buildGroups(updated);
      setGlobalCourses(prev => prev.filter(c => codePrefix(c.code) !== prefix));
      setConfirmDel(null);
      showToast(`Code group "${prefix}" and all its courses deleted.`);
    } catch (e) { showToast(e.message, "error"); }
    setDeletingCode(false);
  };

  const loadSections = useCallback(async (courseId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("course_sections").select("*").eq("course_id", courseId).order("section_label");
      if (error) throw new Error(error.message);

      const tUuids = [...new Set((data || []).map(s => s.teacher_id).filter(Boolean))];
      let tMap = {};
      if (tUuids.length) {
        const { data: tU } = await supabase.from("users").select("user_id, full_name").in("user_id", tUuids);
        (tU || []).forEach(u => { tMap[u.user_id] = u.full_name; });
      }
      const allPIds = [...new Set((data || []).flatMap(s =>
        s.section_type === "shared" ? (s.program_ids || []) : (s.primary_program_id ? [s.primary_program_id] : [])
      ))];
      let pMap = {};
      if (allPIds.length) {
        const { data: pD } = await supabase.from("program").select("program_id, code, name").in("program_id", allPIds);
        (pD || []).forEach(p => { pMap[p.program_id] = p; });
      }
      const enriched = (data || []).map(s => ({
        ...s, id: s.section_id,
        teacherName:  s.teacher_id ? (tMap[s.teacher_id] || "Unassigned") : "Unassigned",
        programLabel: s.section_type === "shared"
          ? (s.program_ids || []).map(id => pMap[id]?.code || id).join(" · ")
          : (s.primary_program_id ? (pMap[s.primary_program_id]?.name || "—") : "—"),
      }));
      setSections(enriched);
      const sIds = enriched.map(s => s.section_id);
      if (sIds.length) {
        const { data: en } = await supabase.from("student_section_enrollments")
          .select("id, section_id, student_id, enrollment_status, final_grade").in("section_id", sIds);
        setSectionEnrollments(en || []);
      } else { setSectionEnrollments([]); }
    } catch (e) { showToast(e.message, "error"); }
    setLoading(false);
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────────
  const goCodeLevel = () => {
    setLevel("codes"); setSelCode(null); setSelCourse(null); setSelSection(null);
    setCourses([]); setSections([]); setSectionEnrollments([]);
    setEditingCourseId(null); setCourseForm(emptyCourse);
  };
  const goCourseLevel = () => {
    setLevel("course"); setSelCourse(null); setSelSection(null);
    setSections([]); setSectionEnrollments([]);
    setEditingSectionId(null); setSectForm(blankSectForm());
  };
  const drillCode = (prefix) => {
    setSelCode(prefix); setSelCourse(null); setSelSection(null);
    setLevel("course"); setEditingCourseId(null); setCourseForm(emptyCourse);
    setCourses(allCourses.filter(c => codePrefix(c.code) === prefix));
  };
  const drillSections = async (course) => {
    setSelCourse(course); setSelSection(null);
    setEditingSectionId(null); setSectForm(blankSectForm());
    setSectPane("form"); setLevel("section");
    await loadSections(course._uuid);
  };

  // ── Course CRUD ───────────────────────────────────────────────────────────────
  const saveCourse = async () => {
    const code = courseForm.code.trim().toUpperCase();
    const name = courseForm.name.trim();
    if (!code || !name) { showToast("Code and Name are required.", "error"); return; }
    const limitRaw = courseForm.studentLimit.toString().trim();
    const limit = limitRaw === "" ? null : parseInt(limitRaw);
    if (limitRaw !== "" && (isNaN(limit) || limit < 1)) {
      showToast("Student limit must be a positive number or leave blank for unlimited.", "error"); return;
    }
    setSavingCourse(true);
    try {
      if (editingCourseId) {
        const { error } = await supabase.from("courses")
          .update({ course_code: code, course_name: name, units: parseInt(courseForm.units) || 3, student_limit: limit })
          .eq("course_id", editingCourseId);
        if (error) throw new Error(error.message);
        const updated = allCourses.map(c => c._uuid === editingCourseId
          ? { ...c, code, name, id: code, units: parseInt(courseForm.units) || 3, studentLimit: limit } : c);
        setAllCourses(updated); buildGroups(updated);
        setCourses(updated.filter(c => codePrefix(c.code) === selCode));
        setGlobalCourses(prev => prev.map(c => c._uuid === editingCourseId ? { ...c, code, name, id: code } : c));
        setEditingCourseId(null); setCourseForm(emptyCourse);
        showToast("Course updated.");
      } else {
        const { data: nc, error: ce } = await supabase.from("courses")
          .insert({ course_code: code, course_name: name, units: parseInt(courseForm.units) || 3, student_limit: limit })
          .select("course_id, course_code, course_name, units, student_limit").single();
        if (ce) { showToast(ce.message.includes("unique") ? "Course code already exists." : ce.message, "error"); setSavingCourse(false); return; }
        const row = { id: nc.course_code, _uuid: nc.course_id, code: nc.course_code, name: nc.course_name, units: nc.units, studentLimit: nc.student_limit ?? null, isActive: true, sectionCount: 0 };
        const updated = [...allCourses, row].sort((a, b) => a.code.localeCompare(b.code));
        setAllCourses(updated); buildGroups(updated);
        if (selCode === codePrefix(row.code)) setCourses(prev => [...prev, row]);
        setCourseForm(emptyCourse);
        showToast("Course created.");
      }
    } catch (e) { showToast(e.message, "error"); }
    setSavingCourse(false);
  };

  const deleteCourse = async (course) => {
    try {
      await runDeleteData(course, true);
      const { error } = await supabase.from("courses").delete().eq("course_id", course._uuid);
      if (error) throw new Error(error.message);
      const updated = allCourses.filter(c => c._uuid !== course._uuid);
      setAllCourses(updated); buildGroups(updated);
      setCourses(prev => prev.filter(c => c._uuid !== course._uuid));
      setGlobalCourses(prev => prev.filter(c => c._uuid !== course._uuid));
      setConfirmDel(null);
      showToast("Course deleted.");
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Delete Data ───────────────────────────────────────────────────────────────
  const runDeleteData = async (course, silent = false) => {
    if (!silent) setDeletingData(true);
    try {
      // 1. Section IDs
      const { data: sectRows } = await supabase.from("course_sections").select("section_id").eq("course_id", course._uuid);
      const sIds = (sectRows || []).map(s => s.section_id);

      // 2. Section enrollments
      if (sIds.length) await supabase.from("student_section_enrollments").delete().in("section_id", sIds);

      // 3. Legacy enrollments
      await supabase.from("student_course_assignments").delete().eq("course_id", course._uuid);

      // 4. Sections (includes teacher_id)
      await supabase.from("course_sections").delete().eq("course_id", course._uuid);

      // 5. Legacy teacher assignments
      await supabase.from("teacher_course_assignments").delete().eq("course_id", course._uuid);

      // 6. Exams cascade: answers → submissions → questions → exams
      const { data: examRows } = await supabase.from("exams").select("exam_id").eq("course_id", course._uuid);
      const eIds = (examRows || []).map(e => e.exam_id);
      if (eIds.length) {
        const { data: subRows } = await supabase.from("exam_submissions").select("exam_submission_id").in("exam_id", eIds);
        const subIds = (subRows || []).map(s => s.exam_submission_id);
        if (subIds.length) {
          await supabase.from("exam_question_answers").delete().in("exam_submission_id", subIds);
          await supabase.from("exam_submissions").delete().in("exam_submission_id", subIds);
        }
        await supabase.from("exam_questions").delete().in("exam_id", eIds);
        await supabase.from("exams").delete().in("exam_id", eIds);
      }

      // 7. Materials cascade: work_submissions → materials
      const { data: matRows } = await supabase.from("materials").select("material_id").eq("course_id", course._uuid);
      const mIds = (matRows || []).map(m => m.material_id);
      if (mIds.length) await supabase.from("work_submissions").delete().in("material_id", mIds);
      await supabase.from("materials").delete().eq("course_id", course._uuid);

      // 8. Schedules
      await supabase.from("schedules").delete().eq("course_id", course._uuid);

      if (!silent) {
        const updated = allCourses.map(c => c._uuid === course._uuid ? { ...c, sectionCount: 0 } : c);
        setAllCourses(updated);
        setCourses(prev => prev.map(c => c._uuid === course._uuid ? { ...c, sectionCount: 0 } : c));
        setSections([]); setSectionEnrollments([]); setSelSection(null);
        setConfirmDel(null); setDeletingData(false);
        showToast(`All data cleared from "${course.name}". Course record kept.`);
      }
    } catch (e) {
      if (!silent) { setDeletingData(false); showToast(e.message, "error"); }
      else throw e;
    }
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
      semester:         section.semester || "",
      days:             section.day_pattern || "MWF",
      timeStart:        section.time_start || "",
      timeEnd:          section.time_end || "",
      room:             section.room || "",
      hasLab:           section.has_lab || false,
      labDays:          section.lab_day_pattern || "",
      labTimeStart:     section.lab_time_start || "",
      labTimeEnd:       section.lab_time_end || "",
      labRoom:          section.lab_room || "",
      teacherId:        section.teacher_id || "",
    });
    setSectPane("form");
  };
  const cancelEditSection = () => { setEditingSectionId(null); setSectForm(blankSectForm()); };

  // ── Save section ──────────────────────────────────────────────────────────────
  const saveSection = async () => {
    if (!selCourse) return;
    const label = sectForm.useCustomLabel ? sectForm.customLabel.trim() : sectForm.sectionLabel;
    if (!label) { showToast("Please enter a section label.", "error"); return; }
    if (sectForm.sectionType === "regular" && !sectForm.programId) { showToast("Please select a program.", "error"); return; }
    if (sectForm.sectionType === "shared" && sectForm.sharedProgramIds.length < 2) { showToast("Shared sections require at least 2 programs.", "error"); return; }
    if (!sectForm.timeStart || !sectForm.timeEnd) { showToast("Please fill in schedule times.", "error"); return; }
    if (sectForm.hasLab && (!sectForm.labDays || !sectForm.labTimeStart || !sectForm.labTimeEnd)) { showToast("Please fill in lab schedule.", "error"); return; }

    setSavingSection(true);
    try {
      let schedLabel = buildScheduleLabel(sectForm.days, sectForm.timeStart, sectForm.timeEnd);
      if (sectForm.hasLab) schedLabel += ` | Lab: ${buildScheduleLabel(sectForm.labDays, sectForm.labTimeStart, sectForm.labTimeEnd)}${sectForm.labRoom ? ` (${sectForm.labRoom})` : ""}`;

      if (sectForm.teacherId && schedLabel) {
        const { data: others } = await supabase.from("course_sections").select("section_id, schedule_label")
          .eq("teacher_id", sectForm.teacherId).neq("section_id", editingSectionId || "00000000-0000-0000-0000-000000000000");
        const conflict = (others || []).find(s => schedulesConflict(schedLabel, s.schedule_label));
        if (conflict) {
          const t = teachers.find(t => t._uuid === sectForm.teacherId);
          showToast(`Schedule conflict! ${t?.fullName || "This teacher"} already has conflicting hours.`, "error");
          setSavingSection(false); return;
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
        lab_day_pattern:    sectForm.hasLab ? sectForm.labDays       : null,
        lab_time_start:     sectForm.hasLab ? sectForm.labTimeStart  : null,
        lab_time_end:       sectForm.hasLab ? sectForm.labTimeEnd    : null,
        lab_room:           sectForm.hasLab ? (sectForm.labRoom || null) : null,
        teacher_id:         sectForm.teacherId || null,
        year_level:         sectForm.yearLevel || null,
        semester:           sectForm.semester  || null,
        academic_year:      "2025-2026",
      };

      if (editingSectionId) {
        const { error } = await supabase.from("course_sections").update(payload).eq("section_id", editingSectionId);
        if (error) throw new Error(error.message);
        showToast(`Section ${label} updated.`);
      } else {
        const { error } = await supabase.from("course_sections").insert(payload);
        if (error) throw new Error(error.message);
        showToast(`Section ${label} added to ${selCourse.code}.`);
      }

      await loadSections(selCourse._uuid);
      setEditingSectionId(null);
      const newCount = sections.length + (editingSectionId ? 0 : 1);
      const updatedAll = allCourses.map(c => c._uuid === selCourse._uuid ? { ...c, sectionCount: newCount } : c);
      setAllCourses(updatedAll);
      setCourses(prev => prev.map(c => c._uuid === selCourse._uuid ? { ...c, sectionCount: newCount } : c));
      const taken = sections.map(s => s.section_label);
      setSectForm({ ...blankSectForm(), sectionLabel: QUICK_LABELS.find(l => !taken.includes(l)) || "A" });
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

  const selectSection = (section) => {
    if (selSection?.section_id === section.section_id) { setSelSection(null); return; }
    setSelSection(section);
    setSelStudents([]); setStudentFilter(""); setEnrollYearFilter(""); setSectPane("enroll");
  };

  // ── Enroll ────────────────────────────────────────────────────────────────────
  const enrollStudents = async () => {
    if (!selSection || selStudents.length === 0) return;

    // Check student limit on the course
    const limit = selCourse?.studentLimit ?? null;
    if (limit != null) {
      const currentCount = sectionEnrollments.filter(e => e.section_id === selSection.section_id).length;
      const available = limit - currentCount;
      if (available <= 0) {
        showToast(`This section is full — limit of ${limit} students has been reached.`, "error"); return;
      }
      if (selStudents.length > available) {
        showToast(`Only ${available} spot${available !== 1 ? "s" : ""} remaining (limit: ${limit}). Reduce your selection.`, "error"); return;
      }
    }

    setEnrolling(true); let enrolled = 0, skipped = 0;
    try {
      for (const sId of selStudents) {
        const st = students.find(s => s.id === sId);
        if (!st) continue;
        const already = sectionEnrollments.find(e => e.section_id === selSection.section_id && String(e.student_id) === String(st._uuid));
        if (already) { skipped++; continue; }
        const { data: ins, error } = await supabase.from("student_section_enrollments")
          .insert({ section_id: selSection.section_id, student_id: st._uuid, enrollment_status: "Enrolled" })
          .select("id, section_id, student_id, enrollment_status, final_grade").single();
        if (!error && ins) { setSectionEnrollments(prev => [...prev, ins]); enrolled++; }
      }
      setSelStudents([]);
      showToast(skipped > 0 ? `${enrolled} enrolled, ${skipped} skipped.` : `${enrolled} student${enrolled !== 1 ? "s" : ""} enrolled.`);
    } catch (e) { showToast(e.message, "error"); }
    setEnrolling(false);
  };

  const removeEnrollment = async (id) => {
    const { error } = await supabase.from("student_section_enrollments").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setSectionEnrollments(prev => prev.filter(e => e.id !== id));
    showToast("Student removed from section.");
  };

  const toggleStudent = (sId) => setSelStudents(prev => prev.includes(sId) ? prev.filter(x => x !== sId) : [...prev, sId]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const sectionsWithCounts = sections.map(s => ({
    ...s, enrollmentCount: sectionEnrollments.filter(e => e.section_id === s.section_id).length,
  }));
  const enrolledUuids = new Set(selSection ? sectionEnrollments.filter(e => e.section_id === selSection.section_id).map(e => e.student_id) : []);
  const eligibleStudents = selSection ? students.filter(s => {
    if (enrolledUuids.has(String(s._uuid))) return false;
    if (selSection.section_type === "shared") {
      const ids = (selSection.program_ids || []).map(String);
      return !ids.length || ids.includes(String(s.programId));
    }
    return !selSection.primary_program_id || String(s.programId) === String(selSection.primary_program_id);
  }) : [];
  const filteredEligible = eligibleStudents.filter(s => {
    if (enrollYearFilter && s.yearLevel !== enrollYearFilter) return false;
    if (!studentFilter) return true;
    return s.fullName?.toLowerCase().includes(studentFilter.toLowerCase()) || s.id?.toLowerCase().includes(studentFilter.toLowerCase());
  });
  const enrolledRows = selSection ? sectionEnrollments.filter(e => e.section_id === selSection.section_id).map(e => {
    const st = students.find(s => String(s._uuid) === String(e.student_id));
    const pg = progs.find(p => p.programId === st?.programId);
    return { id: e.id, studentName: st?.fullName || e.student_id, programCode: pg?.code || "—", yearLevel: st?.yearLevel || "—", status: e.enrollment_status, grade: e.final_grade };
  }) : [];

  // ── Grid columns ──────────────────────────────────────────────────────────────
  const codeCols = [
    { field: "prefix", header: "Code",    width: 120,
      cellRenderer: v => <span style={{ fontWeight: 800, fontSize: 14, color: "#a5b4fc", letterSpacing: "0.04em" }}>{v}</span> },
    { field: "count",  header: "Courses", width: 100,
      cellRenderer: v => <span style={{ fontWeight: 700, fontSize: 12, color: v > 0 ? "#34d399" : "#475569" }}>{v} course{v !== 1 ? "s" : ""}</span> },
    { field: "prefix", header: "Actions", width: 220, sortable: false,
      cellRenderer: (_, row) => (
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          <Btn size="sm" variant="secondary"
            onClick={() => { setEditingCode(row.prefix); setCodeForm({ prefix: row.prefix }); }}>
            ✏️ Edit
          </Btn>
          <Btn size="sm" variant="danger"
            onClick={() => setConfirmDel({ type: "codeGroup", item: row })}>
            🗑 Delete
          </Btn>
          <Btn size="sm" onClick={() => drillCode(row.prefix)}>Manage →</Btn>
        </div>
      )},
  ];

  const courseCols = [
    { field: "code",  header: "Code",  width: 100 },
    { field: "name",  header: "Course" },
    { field: "units", header: "Units", width: 60 },
    { field: "sectionCount", header: "Sections", width: 90,
      cellRenderer: v => <span style={{ fontWeight: 700, fontSize: 11, color: v > 0 ? "#34d399" : "#475569" }}>{v > 0 ? `${v} section${v !== 1 ? "s" : ""}` : "None"}</span> },
    { field: "studentLimit", header: "Limit / Section", width: 120,
      cellRenderer: v => v != null
        ? <span style={{ fontWeight: 700, fontSize: 12, color: "#fbbf24" }}>👥 {v} max</span>
        : <span style={{ fontSize: 11, color: "#475569" }}>Unlimited</span> },
    { field: "isActive", header: "Status", width: 80,
      cellRenderer: v => (
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
          background: v ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)", color: v ? "#34d399" : "#f87171" }}>
          {v ? "Active" : "Inactive"}
        </span>
      )},
    { field: "_uuid", header: "Actions", width: 200, sortable: false,
      cellRenderer: (_, row) => (
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          <Btn size="sm" variant="secondary"
            onClick={() => { setEditingCourseId(row._uuid); setCourseForm({ code: row.code, name: row.name, units: String(row.units || 3), studentLimit: row.studentLimit != null ? String(row.studentLimit) : "" }); }}>
            ✏️
          </Btn>
          <Btn size="sm" variant="danger" onClick={() => setConfirmDel({ type: "course", item: row })}>🗑</Btn>
          <Btn size="sm"
            style={{ background: "rgba(245,158,11,.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,.3)", padding: "5px 9px", fontSize: 11 }}
            onClick={() => setConfirmDel({ type: "deleteData", item: row })}>
            🧹 Data
          </Btn>
          <Btn size="sm" onClick={e => { e.stopPropagation(); drillSections(row); }}>Sections →</Btn>
        </div>
      )},
  ];

  const sectionCols = [
    { field: "section_label", header: "Section", width: 90,
      cellRenderer: v => <span style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9" }}>{selCourse?.code} – {v}</span> },
    { field: "section_type",  header: "Type",     width: 100, cellRenderer: v => <TypeBadge type={v} /> },
    { field: "programLabel",  header: "Program(s)" },
    { field: "schedule_label", header: "Schedule", width: 195,
      cellRenderer: v => v
        ? <span style={{ color: "#60a5fa", fontSize: 11, whiteSpace: "nowrap" }}>{v.split(" | Lab:")[0]}</span>
        : <span style={{ color: "#334155", fontSize: 11 }}>Not set</span> },
    { field: "teacherName", header: "Teacher", width: 140,
      cellRenderer: v => <span style={{ color: v === "Unassigned" ? "#475569" : "#34d399", fontWeight: 600, fontSize: 12 }}>{v}</span> },
    { field: "room",        header: "Room",     width: 80 },
    { field: "year_level",  header: "Year",     width: 80, cellRenderer: v => v ? <InfoPill label={v} color="#6366f1" /> : null },
    { field: "semester",    header: "Semester", width: 115,
      cellRenderer: v => v ? <InfoPill label={v} color={v === "1st Semester" ? "#0ea5e9" : v === "2nd Semester" ? "#8b5cf6" : "#f59e0b"} /> : null },
    { field: "enrollmentCount", header: "Enrolled", width: 110,
      cellRenderer: (v, row) => {
        const limit = selCourse?.studentLimit ?? null;
        if (limit == null) return <span style={{ fontWeight: 700, color: v > 0 ? "#34d399" : "#475569", fontSize: 12 }}>{v}</span>;
        const remaining = limit - v;
        const color = remaining <= 0 ? "#f87171" : remaining <= 5 ? "#fbbf24" : "#34d399";
        return (
          <span style={{ fontWeight: 700, fontSize: 11, color }}>
            {v} / {limit}{remaining <= 0 ? " 🚫" : ""}
          </span>
        );
      }},
    { field: "section_id", header: "Actions", width: 110, sortable: false,
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
    { field: "status",      header: "Status", width: 90, cellRenderer: v => <Badge color="success">{v}</Badge> },
    { field: "grade", header: "Grade", width: 70,
      cellRenderer: v => v != null ? <span style={{ fontWeight: 700, color: "#fbbf24" }}>{v}%</span> : <span style={{ color: "#475569" }}>—</span> },
    { field: "id", header: "Remove", width: 80, sortable: false,
      cellRenderer: v => <Btn size="sm" variant="danger" onClick={e => { e.stopPropagation(); removeEnrollment(v); }}>✕</Btn> },
  ];

  const subtitle =
    level === "codes"   ? `${codeGroups.length} code group${codeGroups.length !== 1 ? "s" : ""} · ${allCourses.length} total courses` :
    level === "course"  ? `${selCode} · ${courses.length} course${courses.length !== 1 ? "s" : ""}` :
    `${selCode} · ${selCourse?.name} · ${sections.length} section${sections.length !== 1 ? "s" : ""}`;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      <TopBar title="Course Management" subtitle={subtitle}
        actions={level !== "codes" && (
          <Btn variant="secondary" size="sm" onClick={level === "course" ? goCodeLevel : goCourseLevel}>
            ← {level === "course" ? "Back to Codes" : `Back to ${selCode}`}
          </Btn>
        )}
      />

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 18px", background: "#1e293b", borderBottom: "1px solid #334155", flexShrink: 0 }}>
        <button onClick={goCodeLevel}
          style={{ background: "none", border: "none", color: level === "codes" ? "#f1f5f9" : "#6366f1", fontWeight: 700, cursor: level !== "codes" ? "pointer" : "default", fontFamily: "inherit", fontSize: 12 }}>
          🗂️ Codes
        </button>
        {selCode && (<>
          <span style={{ color: "#334155" }}>›</span>
          <button onClick={level === "section" ? goCourseLevel : undefined}
            style={{ background: "none", border: "none", color: level === "course" ? "#f1f5f9" : "#6366f1", fontWeight: 700, cursor: level === "section" ? "pointer" : "default", fontFamily: "inherit", fontSize: 12 }}>
            {selCode}
          </button>
        </>)}
        {selCourse && (<>
          <span style={{ color: "#334155" }}>›</span>
          <span style={{ color: "#a5b4fc", fontWeight: 700 }}>{selCourse.code} — Sections</span>
        </>)}
        {selSection && (<>
          <span style={{ color: "#334155" }}>›</span>
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>Section {selSection.section_label}</span>
        </>)}
      </div>

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, maxWidth: 500,
          background: toast.type === "error" ? "rgba(239,68,68,.12)" : "rgba(16,185,129,.12)",
          border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`,
          borderRadius: 8, padding: "10px 14px", color: toast.type === "error" ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600 }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      {/* Modals */}
      {confirmDel?.type === "course" && (
        <ConfirmDeleteModal
          item={confirmDel.item}
          onConfirm={() => deleteCourse(confirmDel.item)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
      {confirmDel?.type === "deleteData" && (
        <DeleteDataModal
          item={confirmDel.item}
          deleting={deletingData}
          onConfirm={() => runDeleteData(confirmDel.item)}
          onCancel={() => { if (!deletingData) setConfirmDel(null); }}
        />
      )}
      {confirmDel?.type === "codeGroup" && (
        <ConfirmDeleteCodeModal
          item={confirmDel.item}
          deleting={deletingCode}
          courseCount={confirmDel.item.count}
          onConfirm={() => deleteCodeGroup(confirmDel.item.prefix)}
          onCancel={() => { if (!deletingCode) setConfirmDel(null); }}
        />
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ══ LEVEL: CODES ══ */}
        {level === "codes" && (
          <>
            <div style={{ ...S.pane, width: 258 }}>
              {/* ── Add / Edit Code form ── */}
              <PH
                icon={editingCode ? "✏️" : "➕"}
                title={editingCode ? `Edit Code "${editingCode}"` : "New Code"}
                sub={editingCode ? "Rename prefix on all matching courses" : "Add a new course code group"}
              />

              <FF label="Code Prefix *">
                <Input
                  value={codeForm.prefix}
                  onChange={e => setCodeForm({ prefix: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
                  placeholder="e.g. ITC, CS, GCAS"
                  maxLength={10}
                  style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}
                />
              </FF>

              {editingCode && (
                <div style={{ fontSize: 11, color: "#64748b", background: "rgba(99,102,241,.07)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 6, padding: "7px 10px", lineHeight: 1.5 }}>
                  ⚠️ Renaming <strong style={{ color: "#a5b4fc" }}>{editingCode}</strong> will update the course code prefix for all {allCourses.filter(c => codePrefix(c.code) === editingCode).length} matching course{allCourses.filter(c => codePrefix(c.code) === editingCode).length !== 1 ? "s" : ""} in the database.
                </div>
              )}

              <div style={{ display: "flex", gap: 6 }}>
                <Btn onClick={saveCode} disabled={savingCode} style={{ flex: 1 }}>
                  {savingCode ? "⏳ Saving…" : editingCode ? "✓ Save Rename" : "✦ Create Code"}
                </Btn>
                {editingCode && (
                  <Btn variant="secondary" onClick={() => { setEditingCode(null); setCodeForm({ prefix: "" }); }}>
                    Cancel
                  </Btn>
                )}
              </div>

              {/* Stats */}
              <div style={{ ...S.sec, display: "flex", flexDirection: "column", gap: 8 }}>
                <StatCard icon="🗂️" value={codeGroups.length}                         label="Code Groups"   color="#a5b4fc" />
                <StatCard icon="📚" value={allCourses.length}                          label="Total Courses" color="#60a5fa" />
                <StatCard icon="✅" value={allCourses.filter(c => c.isActive).length}  label="Active"        color="#34d399" />
              </div>

              <div style={S.sec}>
                <div style={{ background: "rgba(99,102,241,.07)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 7, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc", marginBottom: 4 }}>ℹ️ How it works</div>
                  <div style={S.hint}>
                    Code groups are derived from course code prefixes (ITC, CS, GCAS…). Creating a code navigates you directly to it so you can add courses. Renaming a code updates <em>all</em> courses under that prefix.
                  </div>
                </div>
              </div>
            </div>
            <div style={S.grid}>
              <div style={{ ...S.label, flexShrink: 0 }}>{codeGroups.length} Code Groups — click "Manage →" to view courses</div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                {loading
                  ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                  : codeGroups.length === 0
                  ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 60, fontSize: 13 }}>No courses found.</div>
                  : <LMSGrid columns={codeCols} rowData={codeGroups} height="100%" />}
              </div>
            </div>
          </>
        )}

        {/* ══ LEVEL: COURSES ══ */}
        {level === "course" && (
          <>
            <div style={S.pane}>
              <PH icon={editingCourseId ? "✏️" : "➕"} title={editingCourseId ? "Edit Course" : "Add Course"} sub={`Code group: ${selCode}`} />
              <FF label="Course Code *">
                <Input value={courseForm.code} onChange={e => setCourseForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. ITC 110" />
              </FF>
              <FF label="Course Name *">
                <Input value={courseForm.name} onChange={e => setCourseForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Introduction to Computing" />
              </FF>
              <FF label="Units">
                <Sel value={courseForm.units} onChange={e => setCourseForm(f => ({ ...f, units: e.target.value }))}>
                  {["1","2","3","4","5","6"].map(u => <option key={u}>{u}</option>)}
                </Sel>
              </FF>

              {/* Student limit */}
              <FF label="Student Limit per Section">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Input
                    type="number"
                    min="1"
                    value={courseForm.studentLimit}
                    onChange={e => setCourseForm(f => ({ ...f, studentLimit: e.target.value }))}
                    placeholder="Leave blank for unlimited"
                    style={{ flex: 1 }}
                  />
                  {courseForm.studentLimit && (
                    <button
                      type="button"
                      onClick={() => setCourseForm(f => ({ ...f, studentLimit: "" }))}
                      title="Set to unlimited"
                      style={{ background: "rgba(100,116,139,.15)", border: "1px solid #334155", borderRadius: 6,
                        color: "#94a3b8", fontSize: 11, fontWeight: 700, padding: "7px 10px",
                        cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
                      ∞ Unlimited
                    </button>
                  )}
                </div>
                {courseForm.studentLimit && (
                  <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                    <span>👥</span>
                    <span>Max <strong>{courseForm.studentLimit}</strong> students per section of this course</span>
                  </div>
                )}
                {!courseForm.studentLimit && (
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                    ∞ No limit — sections can hold any number of students
                  </div>
                )}
              </FF>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={saveCourse} disabled={savingCourse} style={{ flex: 1 }}>
                  {savingCourse ? "⏳ Saving…" : editingCourseId ? "✓ Save Changes" : "✦ Add Course"}
                </Btn>
                {editingCourseId && <Btn variant="secondary" onClick={() => { setEditingCourseId(null); setCourseForm(emptyCourse); }}>Cancel</Btn>}
              </div>

              {/* Button legend */}
              <div style={S.sec}>
                <div style={S.sHdr}>Action Buttons</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    { color: "#94a3b8", icon: "✏️", label: "Edit code / name / units" },
                    { color: "#f87171", icon: "🗑",  label: "Permanently delete course" },
                    { color: "#fbbf24", icon: "🧹",  label: "Delete section data (keeps course)" },
                    { color: "#a5b4fc", icon: "→",   label: "Go to section management" },
                  ].map(({ color, icon, label }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#475569" }}>
                      <span style={{ color, fontWeight: 700, minWidth: 16 }}>{icon}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={S.grid}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={S.label}>{courses.length} Course{courses.length !== 1 ? "s" : ""} · {selCode}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <StatCard icon="📚" value={courses.length} label="Total" color="#60a5fa" />
                  <StatCard icon="📋" value={courses.reduce((a, c) => a + c.sectionCount, 0)} label="Sections" color="#a5b4fc" />
                </div>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                {loading
                  ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                  : courses.length === 0
                  ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                      <div style={{ fontSize: 48 }}>📚</div>
                      <div style={{ color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 1.8 }}>
                        No courses with the <strong style={{ color: "#a5b4fc" }}>{selCode}</strong> prefix yet.<br />
                        Use the left panel to add one.
                      </div>
                    </div>
                  )
                  : <LMSGrid columns={courseCols} rowData={courses} height="100%" />}
              </div>
            </div>
          </>
        )}

        {/* ══ LEVEL: SECTIONS ══ */}
        {level === "section" && (
          <>
            {/* Left Pane */}
            <div style={{ ...S.pane, width: 330 }}>
              <PH title={`📋 ${selCourse?.code}`} sub={selCourse?.name} />

              <div style={{ display: "flex", gap: 4, background: "#0f172a", borderRadius: 8, padding: 4 }}>
                {[
                  { key: "form",   label: editingSectionId ? "✎ Edit Section" : "✦ Add Section" },
                  { key: "enroll", label: `🎓 Enroll${selSection ? ` (${selSection.section_label})` : ""}` },
                ].map(tab => (
                  <button key={tab.key}
                    onClick={() => { if (tab.key === "enroll" && !selSection) return; setSectPane(tab.key); }}
                    style={{ flex: 1, padding: "6px 4px", borderRadius: 6, border: "none",
                      cursor: tab.key === "enroll" && !selSection ? "not-allowed" : "pointer",
                      fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                      background: sectPane === tab.key ? "#4f46e5" : "transparent",
                      color: sectPane === tab.key ? "#fff" : tab.key === "enroll" && !selSection ? "#1e293b" : "#475569",
                      transition: "all .15s" }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ADD / EDIT SECTION */}
              {sectPane === "form" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {editingSectionId && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.3)", borderRadius: 7, padding: "6px 10px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc" }}>
                        ✎ Editing: {sections.find(s => s.section_id === editingSectionId)?.section_label}
                      </span>
                      <button onClick={cancelEditSection} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>✕ Cancel</button>
                    </div>
                  )}

                  {/* Label */}
                  <div style={S.sec}>
                    <div style={S.sHdr}>🏷️ Section Label</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                      {QUICK_LABELS.map(l => {
                        const active = sectForm.sectionLabel === l && !sectForm.useCustomLabel;
                        return (
                          <button key={l} type="button" onClick={() => setSF({ sectionLabel: l, useCustomLabel: false })}
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
                    {sectForm.useCustomLabel && <Input value={sectForm.customLabel} onChange={e => setSF({ customLabel: e.target.value })} placeholder='e.g. "Shared", "NSTP-1"' style={{ fontSize: 12 }} />}
                  </div>

                  {/* Type */}
                  <div style={S.sec}>
                    <div style={S.sHdr}>📌 Section Type</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[{ key: "regular", label: "📌 Regular", desc: "One program" }, { key: "shared", label: "🔗 Shared", desc: "Multiple programs" }].map(t => (
                        <button key={t.key} type="button" onClick={() => setSF({ sectionType: t.key, sharedProgramIds: [] })}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 7,
                            border: sectForm.sectionType === t.key ? "2px solid #6366f1" : "1.5px solid #334155",
                            background: sectForm.sectionType === t.key ? "rgba(99,102,241,.18)" : "#0f172a",
                            color: sectForm.sectionType === t.key ? "#a5b4fc" : "#475569",
                            fontWeight: 700, fontSize: 11, cursor: "pointer", transition: "all .15s", fontFamily: "inherit" }}>
                          <div>{t.label}</div><div style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>{t.desc}</div>
                        </button>
                      ))}
                    </div>
                    {sectForm.sectionType === "shared" && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.5, background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 6, padding: "5px 8px" }}>
                        ℹ️ Use Shared for cross-program courses (NSTP, PE, GEC).
                      </div>
                    )}
                  </div>

                  {/* Program */}
                  <div style={S.sec}>
                    <div style={S.sHdr}>{sectForm.sectionType === "shared" ? "🔗 Programs Sharing This Section" : "📚 Assigned Program"}</div>
                    {sectForm.sectionType === "regular" ? (
                      <FF label="Program">
                        <Sel value={sectForm.programId} onChange={e => setSF({ programId: e.target.value })}>
                          <option value="">— Select Program —</option>
                          {progs.map(p => <option key={p.programId} value={p.programId}>{p.code} — {p.name}</option>)}
                        </Sel>
                      </FF>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 150, overflowY: "auto", border: "1px solid #334155", borderRadius: 7, padding: "8px 10px", background: "#0f172a" }}>
                          {progs.length === 0
                            ? <div style={{ fontSize: 11, color: "#475569", textAlign: "center", padding: "8px 0" }}>No programs available.</div>
                            : progs.map(p => {
                              const checked = sectForm.sharedProgramIds.includes(p.programId);
                              return (
                                <label key={p.programId} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", userSelect: "none", padding: "3px 0" }}>
                                  <input type="checkbox" checked={checked}
                                    onChange={() => setSF({ sharedProgramIds: checked ? sectForm.sharedProgramIds.filter(x => x !== p.programId) : [...sectForm.sharedProgramIds, p.programId] })}
                                    style={{ cursor: "pointer", accentColor: "#f59e0b", width: 14, height: 14 }} />
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: checked ? "#f59e0b" : "#e2e8f0" }}>{p.code}</div>
                                    <div style={{ fontSize: 10, color: "#475569" }}>{p.name}</div>
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                        {sectForm.sharedProgramIds.length > 0 && (
                          <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4, fontWeight: 600 }}>
                            ✓ {sectForm.sharedProgramIds.length} program{sectForm.sharedProgramIds.length !== 1 ? "s" : ""} selected
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Year / Semester */}
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

                  {/* Schedule */}
                  <div style={S.sec}>
                    <div style={S.sHdr}>🗓️ Schedule</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em" }}>📖 Lecture</div>
                      <FF label="Day Pattern"><DayToggleButtons value={sectForm.days} onChange={v => setSF({ days: v })} /></FF>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <FF label="Start Time"><Input type="time" value={sectForm.timeStart} onChange={e => setSF({ timeStart: e.target.value })} /></FF>
                        <FF label="End Time"><Input type="time" value={sectForm.timeEnd} onChange={e => setSF({ timeEnd: e.target.value })} /></FF>
                      </div>
                      <FF label="Room"><Input value={sectForm.room} onChange={e => setSF({ room: e.target.value })} placeholder="e.g. Room 201" /></FF>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4, borderTop: "1px solid #1e293b" }}>
                        <button type="button" onClick={() => setSF({ hasLab: !sectForm.hasLab })}
                          style={{ width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer", position: "relative", background: sectForm.hasLab ? "#6366f1" : "#334155", transition: "background .2s", flexShrink: 0 }}>
                          <span style={{ position: "absolute", top: 3, left: sectForm.hasLab ? 16 : 3, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                        </button>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sectForm.hasLab ? "#a5b4fc" : "#475569" }}>🔬 Has Laboratory Class</span>
                      </div>

                      {sectForm.hasLab && (
                        <div style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 8, padding: "10px 10px 6px", display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.06em" }}>🔬 Laboratory</div>
                          <FF label="Lab Day Pattern"><DayToggleButtons value={sectForm.labDays} onChange={v => setSF({ labDays: v })} /></FF>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <FF label="Lab Start"><Input type="time" value={sectForm.labTimeStart} onChange={e => setSF({ labTimeStart: e.target.value })} /></FF>
                            <FF label="Lab End"><Input type="time" value={sectForm.labTimeEnd} onChange={e => setSF({ labTimeEnd: e.target.value })} /></FF>
                          </div>
                          <FF label="Lab Room"><Input value={sectForm.labRoom} onChange={e => setSF({ labRoom: e.target.value })} placeholder="e.g. Comp Lab 1" /></FF>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Teacher */}
                  <div style={S.sec}>
                    <div style={S.sHdr}>👩‍🏫 Assign Teacher</div>
                    {sectForm.teacherId && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399", marginBottom: 6, padding: "4px 8px", background: "#0f172a", borderRadius: 6, border: "1px solid #334155" }}>
                        ✓ {teachers.find(t => t._uuid === sectForm.teacherId)?.fullName || "Assigned"}
                      </div>
                    )}
                    <FF label="Select Teacher">
                      <Sel value={sectForm.teacherId} onChange={e => setSF({ teacherId: e.target.value })}>
                        <option value="">— None / Unassigned —</option>
                        {teachers.map(t => <option key={t.id} value={t._uuid}>{t.fullName}</option>)}
                      </Sel>
                    </FF>
                  </div>

                  <Btn onClick={saveSection} disabled={savingSection} style={{ width: "100%", marginTop: 4 }}>
                    {savingSection ? "⏳ Saving…" : editingSectionId ? "✓ Update Section" : "✦ Add Section"}
                  </Btn>
                </div>
              )}

              {/* ENROLL TAB */}
              {sectPane === "enroll" && selSection && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{
                    background: selSection.section_type === "shared" ? "rgba(245,158,11,.08)" : "rgba(99,102,241,.08)",
                    border: `1px solid ${selSection.section_type === "shared" ? "rgba(245,158,11,.25)" : "rgba(99,102,241,.25)"}`,
                    borderRadius: 8, padding: "10px 12px"
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: selSection.section_type === "shared" ? "#f59e0b" : "#a5b4fc" }}>
                      {selCourse?.code} — Section {selSection.section_label}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{selSection.programLabel}</div>
                    {selSection.schedule_label && <div style={{ fontSize: 11, color: "#60a5fa", marginTop: 2 }}>🕐 {selSection.schedule_label.split(" | Lab:")[0]}</div>}
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{sectionEnrollments.filter(e => e.section_id === selSection.section_id).length} enrolled</span>
                      <TypeBadge type={selSection.section_type} />
                      {selCourse?.studentLimit != null && (() => {
                        const enrolled = sectionEnrollments.filter(e => e.section_id === selSection.section_id).length;
                        const remaining = selCourse.studentLimit - enrolled;
                        return (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
                            background: remaining <= 0 ? "rgba(239,68,68,.15)" : remaining <= 5 ? "rgba(245,158,11,.15)" : "rgba(16,185,129,.15)",
                            color: remaining <= 0 ? "#f87171" : remaining <= 5 ? "#fbbf24" : "#34d399",
                            border: `1px solid ${remaining <= 0 ? "rgba(239,68,68,.3)" : remaining <= 5 ? "rgba(245,158,11,.3)" : "rgba(16,185,129,.3)"}` }}>
                            {remaining <= 0 ? "🚫 Full" : `👥 ${remaining} / ${selCourse.studentLimit} spots left`}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <Sel value={enrollYearFilter} onChange={e => { setEnrollYearFilter(e.target.value); setSelStudents([]); }}>
                    <option value="">All Year Levels</option>
                    {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
                  </Sel>
                  <Input value={studentFilter} onChange={e => setStudentFilter(e.target.value)} placeholder="Search students…" style={{ fontSize: 12 }} />

                  {filteredEligible.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "12px 0", lineHeight: 1.7 }}>
                      {eligibleStudents.length === 0 ? "All eligible students are enrolled." : "No students match the filter."}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" id="sel-all-admin"
                          checked={selStudents.length === filteredEligible.length && filteredEligible.length > 0}
                          onChange={e => setSelStudents(e.target.checked ? filteredEligible.map(s => s.id) : [])}
                          style={{ cursor: "pointer", accentColor: "#6366f1" }} />
                        <label htmlFor="sel-all-admin" style={{ fontSize: 12, color: "#94a3b8", cursor: "pointer", userSelect: "none" }}>
                          Select all ({filteredEligible.length})
                        </label>
                        {selStudents.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: "#a5b4fc", fontWeight: 700 }}>{selStudents.length} selected</span>}
                      </div>
                      <div style={{ maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3, border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", background: "#0f172a" }}>
                        {filteredEligible.map(s => (
                          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 0", userSelect: "none" }}>
                            <input type="checkbox" checked={selStudents.includes(s.id)} onChange={() => toggleStudent(s.id)} style={{ cursor: "pointer", accentColor: "#6366f1" }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.fullName}</div>
                              <div style={{ fontSize: 10, color: "#475569" }}>{[s.yearLevel, s.programName].filter(Boolean).join(" · ")}</div>
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

            {/* Right Area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{
                flex: selSection ? "0 0 52%" : 1, padding: "14px 16px",
                display: "flex", flexDirection: "column", overflow: "hidden",
                background: "#0f172a", gap: 8,
                borderBottom: selSection ? "1px solid #334155" : "none",
              }}>
                <div style={{ ...S.label, flexShrink: 0 }}>
                  {sections.length} Section{sections.length !== 1 ? "s" : ""} · {selCourse?.code} — {selCourse?.name}
                  {selSection && <span style={{ marginLeft: 10, color: selSection.section_type === "shared" ? "#f59e0b" : "#a5b4fc" }}>← Section {selSection.section_label} selected</span>}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {loading
                    ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                    : sections.length === 0
                    ? (
                      <div style={{ color: "#475569", textAlign: "center", paddingTop: 50, fontSize: 13, lineHeight: 2 }}>
                        No sections yet.<br />
                        <span style={{ color: "#334155", fontSize: 12 }}>Use the left panel to add sections (A, B, C…) or a Shared section.</span>
                      </div>
                    )
                    : <LMSGrid columns={sectionCols} rowData={sectionsWithCounts} height="100%" selectedId={selSection?.section_id} onRowClick={selectSection} />
                  }
                </div>
              </div>

              {selSection && (
                <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0f1a", gap: 8 }}>
                  <div style={{ ...S.label, flexShrink: 0 }}>
                    🎓 Enrolled — {selCourse?.code} Section {selSection.section_label}
                    <span style={{ marginLeft: 8, color: "#60a5fa" }}>({enrolledRows.length} student{enrolledRows.length !== 1 ? "s" : ""})</span>
                    {selSection.section_type === "shared" && <span style={{ marginLeft: 8 }}><TypeBadge type="shared" /></span>}
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    {enrolledRows.length === 0
                      ? <div style={{ color: "#334155", fontSize: 13, textAlign: "center", paddingTop: 20 }}>No students enrolled yet. Switch to the "Enroll" tab.</div>
                      : <LMSGrid columns={enrolledCols} rowData={enrolledRows} height="100%" />
                    }
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
