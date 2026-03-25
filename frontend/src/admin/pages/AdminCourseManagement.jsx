/**
 * AdminCourseManagement.jsx
 * FOLDER: src/admin/pages/AdminCourseManagement.jsx
 *
 * Three-level drill-down: Departments -> Programs -> Courses
 *
 * Admin responsibilities:
 *   - Create / edit Departments
 *   - Create / edit Programs (under a Department)
 *   - Create / edit Courses per Program, assigning year_level + semester
 *     (stored in course_program_map, supports the full curriculum structure)
 *
 * Sub-Admin (department admin) handles: schedules, teacher assignments, student enrollment
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { departmentApi, programApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

const S = {
  pane:    { width: 300, borderRight: "1px solid #334155", background: "#1e293b", padding: "16px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flexShrink: 0 },
  grid:    { flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8 },
  label:   { fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" },
  section: { borderTop: "1px solid #334155", paddingTop: 12, marginTop: 4 },
  hint:    { fontSize: 11, color: "#475569", fontStyle: "italic", lineHeight: 1.5 },
};

const PaneHeader = ({ title, sub, icon }) => (
  <div style={{ marginBottom: 2 }}>
    <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", display: "flex", alignItems: "center", gap: 6 }}>
      {icon && <span>{icon}</span>}{title}
    </div>
    {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sub}</div>}
  </div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{children}</div>
);

const InfoPill = ({ label, color = "#6366f1" }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: `${color}22`, color, border: `1px solid ${color}44` }}>
    {label}
  </span>
);

const StatCard = ({ icon, value, label, color }) => (
  <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <div>
      <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{label}</div>
    </div>
  </div>
);

const emptyDept   = { code: "", name: "", room: "", email: "", phone: "", description: "" };
const emptyProg   = { code: "", name: "", description: "" };
const emptyCourse = { code: "", name: "", units: "3", yearLevel: "1st Year", semester: "1st Semester" };
const YEAR_LEVELS = ["1st Year","2nd Year","3rd Year","4th Year","5th Year"];
const SEMESTERS   = ["1st Semester","2nd Semester","Summer"];

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

export default function AdminCourseManagement({ courses, setCourses, users, enrollments, setEnrollments }) {

  const [level,       setLevel]       = useState("dept");
  const [selDept,     setSelDept]     = useState(null);
  const [selProg,     setSelProg]     = useState(null);
  const [depts,       setDepts]       = useState([]);
  const [progs,       setProgs]       = useState([]);
  const [progCourses, setProgCourses] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [deptForm,    setDeptForm]    = useState(emptyDept);
  const [progForm,    setProgForm]    = useState(emptyProg);
  const [courseForm,  setCourseForm]  = useState(emptyCourse);
  const [editingId,   setEditingId]   = useState(null);
  const [toast,       setToast]       = useState({ msg: "", type: "success" });
  const [confirmDel,  setConfirmDel]  = useState(null);
  const [filterYear,  setFilterYear]  = useState("");
  const [filterSem,   setFilterSem]   = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 2800);
  };

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
      const { data, error } = await supabase
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
            is_active
          )
        `)
        .eq("program_id", programId)
        .order("id", { ascending: true });
      if (error) throw new Error(error.message);
      const enriched = (data ?? [])
        .filter(m => m.courses)
        .map(m => ({
          _mapId:    m.id,
          _uuid:     m.courses.course_id,
          id:        m.courses.course_code,
          code:      m.courses.course_code,
          name:      m.courses.course_name,
          units:     m.courses.units,
          yearLevel: m.year_level,
          semester:  m.semester,
          programId: programId,
        }));
      setProgCourses(enriched);
    } catch (e) { showToast(e.message, "error"); }
    setLoading(false);
  }, []);

  useEffect(() => { loadDepts(); }, [loadDepts]);

  const drillDept = async (dept) => {
    setSelDept(dept); setSelProg(null);
    setEditingId(null); setProgForm(emptyProg); setProgCourses([]);
    setLevel("prog");
    await loadProgs(dept.departmentId);
  };

  const drillProg = async (prog) => {
    setSelProg(prog);
    setEditingId(null); setCourseForm(emptyCourse);
    setFilterYear(""); setFilterSem("");
    setLevel("course");
    await loadCourses(prog.programId);
  };

  const goBack = () => {
    if (level === "course") { setLevel("prog"); setSelProg(null); setProgCourses([]); }
    if (level === "prog")   { setLevel("dept"); setSelDept(null); setProgs([]); }
    setEditingId(null);
  };

  // ── Department CRUD ──────────────────────────────────────────────────────────
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

  // ── Program CRUD ─────────────────────────────────────────────────────────────
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

  // ── Course CRUD ──────────────────────────────────────────────────────────────
  const saveCourse = async () => {
    if (!courseForm.code.trim() || !courseForm.name.trim()) {
      showToast("Code and Name required.", "error"); return;
    }
    try {
      if (editingId) {
        const { error: courseErr } = await supabase.from("courses").update({
          course_code: courseForm.code.trim().toUpperCase(),
          course_name: courseForm.name.trim(),
          units:       parseInt(courseForm.units) || 3,
        }).eq("course_id", editingId);
        if (courseErr) throw new Error(courseErr.message);
        const { error: mapErr } = await supabase
          .from("course_program_map")
          .update({ year_level: courseForm.yearLevel, semester: courseForm.semester })
          .eq("course_id", editingId)
          .eq("program_id", selProg.programId);
        if (mapErr) throw new Error(mapErr.message);
        setProgCourses(prev => prev.map(c => c._uuid === editingId
          ? { ...c,
              code:      courseForm.code.trim().toUpperCase(),
              name:      courseForm.name.trim(),
              units:     parseInt(courseForm.units) || 3,
              yearLevel: courseForm.yearLevel,
              semester:  courseForm.semester,
            }
          : c
        ));
        showToast("Course updated.");
        setEditingId(null); setCourseForm(emptyCourse);
      } else {
        const { data: newCourse, error: courseErr } = await supabase
          .from("courses")
          .insert({
            course_code: courseForm.code.trim().toUpperCase(),
            course_name: courseForm.name.trim(),
            units:       parseInt(courseForm.units) || 3,
          })
          .select("course_id, course_code, course_name, units")
          .single();
        if (courseErr) {
          showToast(courseErr.message.includes("unique") ? "Course code already exists." : courseErr.message, "error");
          return;
        }
        const { data: mapRow, error: mapErr } = await supabase
          .from("course_program_map")
          .insert({
            course_id:  newCourse.course_id,
            program_id: selProg.programId,
            year_level: courseForm.yearLevel,
            semester:   courseForm.semester,
          })
          .select("id")
          .single();
        if (mapErr) {
          await supabase.from("courses").delete().eq("course_id", newCourse.course_id);
          showToast(mapErr.message, "error"); return;
        }
        const newRow = {
          _mapId:    mapRow.id,
          _uuid:     newCourse.course_id,
          id:        newCourse.course_code,
          code:      newCourse.course_code,
          name:      newCourse.course_name,
          units:     newCourse.units,
          yearLevel: courseForm.yearLevel,
          semester:  courseForm.semester,
          programId: selProg.programId,
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
      await supabase.from("course_program_map")
        .delete()
        .eq("course_id", course._uuid)
        .eq("program_id", selProg.programId);
      const { count } = await supabase
        .from("course_program_map")
        .select("*", { count: "exact", head: true })
        .eq("course_id", course._uuid);
      if (count === 0) {
        await Promise.all([
          supabase.from("materials").delete().eq("course_id", course._uuid),
          supabase.from("exams").delete().eq("course_id", course._uuid),
          supabase.from("course_sections").delete().eq("course_id", course._uuid),
        ]);
        await supabase.from("courses").delete().eq("course_id", course._uuid);
        setCourses(prev => prev.filter(c => c._uuid !== course._uuid));
      }
      setProgCourses(prev => prev.filter(c => c._uuid !== course._uuid));
      setConfirmDel(null);
      showToast(count === 0 ? "Course deleted." : "Course removed from this program.");
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const yearStats = YEAR_LEVELS.map(yr => ({
    yr,
    count: progCourses.filter(c => c.yearLevel === yr).length,
    sem1:  progCourses.filter(c => c.yearLevel === yr && c.semester === "1st Semester").length,
    sem2:  progCourses.filter(c => c.yearLevel === yr && c.semester === "2nd Semester").length,
    sum:   progCourses.filter(c => c.yearLevel === yr && c.semester === "Summer").length,
  })).filter(s => s.count > 0);

  const filteredCourses = progCourses.filter(c => {
    if (filterYear && c.yearLevel !== filterYear) return false;
    if (filterSem  && c.semester  !== filterSem)  return false;
    return true;
  });

  // ── Breadcrumb ───────────────────────────────────────────────────────────────
  const Breadcrumb = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", padding: "6px 18px", background: "#1e293b", borderBottom: "1px solid #334155", flexShrink: 0 }}>
      <button onClick={() => { setLevel("dept"); setSelDept(null); setSelProg(null); setProgs([]); setProgCourses([]); setEditingId(null); }}
        style={{ background: "none", border: "none", color: level === "dept" ? "#f1f5f9" : "#6366f1", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
        🏛️ Departments
      </button>
      {selDept && (<>
        <span style={{ color: "#334155" }}>›</span>
        <button onClick={() => { if (level !== "prog") { setLevel("prog"); setSelProg(null); setProgCourses([]); setEditingId(null); } }}
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

  // ── Grid columns ─────────────────────────────────────────────────────────────
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
    { field: "code",        header: "Code",       width: 80 },
    { field: "name",        header: "Program" },
    { field: "description", header: "Description" },
    { field: "isActive",    header: "Status",     width: 90,
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
    { field: "code",      header: "Code",      width: 90 },
    { field: "name",      header: "Course Name" },
    { field: "units",     header: "Units",     width: 65 },
    { field: "yearLevel", header: "Year Level", width: 105,
      cellRenderer: v => <InfoPill label={v} color="#6366f1" /> },
    { field: "semester",  header: "Semester",  width: 135,
      cellRenderer: v => (
        <InfoPill label={v} color={v === "1st Semester" ? "#0ea5e9" : v === "2nd Semester" ? "#8b5cf6" : "#f59e0b"} />
      )},
    { field: "_uuid", header: "Actions", width: 90, sortable: false,
      cellRenderer: (_, row) => (
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          <Btn size="sm" variant="secondary" onClick={() => {
            setEditingId(row._uuid);
            setCourseForm({ code: row.code, name: row.name, units: String(row.units || 3), yearLevel: row.yearLevel || "1st Year", semester: row.semester || "1st Semester" });
          }}>✏️</Btn>
          <Btn size="sm" variant="danger" onClick={() => setConfirmDel({ type: "course", item: row })}>🗑</Btn>
        </div>
      )},
  ];

  const subtitle = level === "dept"
    ? `${depts.length} department${depts.length !== 1 ? "s" : ""}`
    : level === "prog"
    ? `${selDept?.name} · ${progs.length} program${progs.length !== 1 ? "s" : ""}`
    : `${selProg?.name} · ${progCourses.length} course${progCourses.length !== 1 ? "s" : ""}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      <TopBar title="Course Management" subtitle={subtitle}
        actions={level !== "dept" && (
          <Btn variant="secondary" size="sm" onClick={goBack}>← Back</Btn>
        )}
      />

      <Breadcrumb />

      {toast.msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.type === "error" ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)", border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`, borderRadius: 8, padding: "9px 14px", color: toast.type === "error" ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600 }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      {confirmDel && (
        <ConfirmModal
          title={`${confirmDel.type === "course" ? "Remove Course" : "Delete"} "${confirmDel.item.name || confirmDel.item.code}"`}
          message={
            confirmDel.type === "course"
              ? `Remove "${confirmDel.item.name}" from ${selProg?.name}? If this course belongs to other programs it will not be fully deleted.`
              : `Delete "${confirmDel.item.name}"? This cannot be undone from the UI.`
          }
          onConfirm={() => {
            if (confirmDel.type === "dept")   deleteDept(confirmDel.item);
            if (confirmDel.type === "prog")   deleteProg(confirmDel.item);
            if (confirmDel.type === "course") deleteCourse(confirmDel.item);
          }}
          onCancel={() => setConfirmDel(null)}
        />
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ══ DEPARTMENTS ══ */}
        {level === "dept" && (
          <>
            <div style={S.pane}>
              <PaneHeader icon={editingId ? "✏️" : "➕"} title={editingId ? "Edit Department" : "New Department"} />
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
            <div style={S.grid}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={S.label}>{depts.length} Departments</div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <StatCard icon="🏛️" value={depts.length} label="Total" color="#60a5fa" />
                  <StatCard icon="✅" value={depts.filter(d => d.isActive === 1).length} label="Active" color="#34d399" />
                </div>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                {loading ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                  : <LMSGrid columns={deptCols} rowData={depts} height="100%" />}
              </div>
            </div>
          </>
        )}

        {/* ══ PROGRAMS ══ */}
        {level === "prog" && (
          <>
            <div style={S.pane}>
              <PaneHeader icon={editingId ? "✏️" : "➕"} title={editingId ? "Edit Program" : "New Program"} sub={`in ${selDept?.name}`} />
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
              <div style={S.section}>
                <SectionLabel>Department Info</SectionLabel>
                <div style={{ background: "#0f172a", borderRadius: 8, border: "1px solid #334155", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
                  {[["Code", selDept?.code], ["Room", selDept?.room], ["Email", selDept?.email], ["Phone", selDept?.phone]]
                    .filter(([,v]) => v).map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase" }}>{l}</span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={S.grid}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={S.label}>{progs.length} Programs in {selDept?.name}</div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <StatCard icon="🎓" value={progs.length} label="Programs" color="#a5b4fc" />
                  <StatCard icon="✅" value={progs.filter(p => p.isActive === 1).length} label="Active" color="#34d399" />
                </div>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                {loading ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                  : progs.length === 0
                  ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40, fontSize: 13 }}>No programs yet. Create one in the left pane.</div>
                  : <LMSGrid columns={progCols} rowData={progs} height="100%" />}
              </div>
            </div>
          </>
        )}

        {/* ══ COURSES ══ */}
        {level === "course" && (
          <>
            {/* Left pane */}
            <div style={{ ...S.pane, width: 292 }}>
              <PaneHeader
                icon={editingId ? "✏️" : "➕"}
                title={editingId ? "Edit Course" : "Add Course"}
                sub={selProg?.name}
              />

              <FF label="Course Code *">
                <Input value={courseForm.code} onChange={e => setCourseForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CS101" />
              </FF>
              <FF label="Course Name *">
                <Input value={courseForm.name} onChange={e => setCourseForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Intro to CS" />
              </FF>
              <FF label="Units">
                <Sel value={courseForm.units} onChange={e => setCourseForm(f => ({ ...f, units: e.target.value }))}>
                  {["1","2","3","4","5","6"].map(u => <option key={u}>{u}</option>)}
                </Sel>
              </FF>

              {/* Curriculum placement box */}
              <div style={{ background: "rgba(99,102,241,.07)", border: "1px solid rgba(99,102,241,.25)", borderRadius: 8, padding: "12px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#a5b4fc", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                  📅 Curriculum Placement
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <FF label="Year Level">
                    <Sel value={courseForm.yearLevel} onChange={e => setCourseForm(f => ({ ...f, yearLevel: e.target.value }))}>
                      {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
                    </Sel>
                  </FF>
                  <FF label="Semester / Term">
                    <Sel value={courseForm.semester} onChange={e => setCourseForm(f => ({ ...f, semester: e.target.value }))}>
                      {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                    </Sel>
                  </FF>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={saveCourse} style={{ flex: 1 }}>{editingId ? "✓ Save Changes" : "✦ Add Course"}</Btn>
                {editingId && <Btn variant="secondary" onClick={() => { setEditingId(null); setCourseForm(emptyCourse); }}>Cancel</Btn>}
              </div>

              {/* Curriculum summary */}
              {yearStats.length > 0 && (
                <div style={S.section}>
                  <SectionLabel>Curriculum Overview</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {yearStats.map(({ yr, count, sem1, sem2, sum }) => (
                      <div key={yr} style={{ background: "#0f172a", borderRadius: 7, border: "1px solid #334155", padding: "8px 10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#e2e8f0" }}>{yr}</span>
                          <span style={{ fontSize: 10, color: "#6366f1", fontWeight: 700 }}>{count} course{count !== 1 ? "s" : ""}</span>
                        </div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {sem1 > 0 && <span style={{ fontSize: 9, color: "#7dd3fc", background: "rgba(14,165,233,.12)", padding: "1px 6px", borderRadius: 9999 }}>1st Sem: {sem1}</span>}
                          {sem2 > 0 && <span style={{ fontSize: 9, color: "#c4b5fd", background: "rgba(139,92,246,.12)", padding: "1px 6px", borderRadius: 9999 }}>2nd Sem: {sem2}</span>}
                          {sum  > 0 && <span style={{ fontSize: 9, color: "#fde68a", background: "rgba(245,158,11,.12)", padding: "1px 6px", borderRadius: 9999 }}>Summer: {sum}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info callout */}
              <div style={{ ...S.section }}>
                <div style={{ background: "rgba(16,185,129,.07)", border: "1px solid rgba(16,185,129,.18)", borderRadius: 7, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#34d399", marginBottom: 4 }}>🏫 Next Steps</div>
                  <div style={S.hint}>
                    After adding courses, the <strong style={{ color: "#34d399" }}>Department Admin</strong> assigns teachers, sets schedules, and enrolls students per program.
                  </div>
                </div>
              </div>
            </div>

            {/* Right area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* Filter bar */}
              <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Filter by:</div>
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                  style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#e2e8f0", fontFamily: "inherit", cursor: "pointer" }}>
                  <option value="">All Year Levels</option>
                  {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
                </select>
                <select value={filterSem} onChange={e => setFilterSem(e.target.value)}
                  style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#e2e8f0", fontFamily: "inherit", cursor: "pointer" }}>
                  <option value="">All Semesters</option>
                  {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                </select>
                {(filterYear || filterSem) && (
                  <Btn size="sm" variant="secondary" onClick={() => { setFilterYear(""); setFilterSem(""); }}>✕ Clear</Btn>
                )}
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <StatCard icon="📚" value={progCourses.length} label="Total" color="#60a5fa" />
                  {filteredCourses.length !== progCourses.length && (
                    <StatCard icon="🔍" value={filteredCourses.length} label="Filtered" color="#a5b4fc" />
                  )}
                </div>
              </div>

              <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8 }}>
                <div style={{ ...S.label, flexShrink: 0 }}>
                  {filteredCourses.length} Course{filteredCourses.length !== 1 ? "s" : ""} · {selProg?.name}
                  {(filterYear || filterSem) && (
                    <span style={{ color: "#6366f1", marginLeft: 8 }}>
                      {filterYear} {filterYear && filterSem ? "·" : ""} {filterSem}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {loading
                    ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                    : filteredCourses.length === 0 && progCourses.length === 0
                    ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                        <div style={{ fontSize: 48 }}>📚</div>
                        <div style={{ color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 1.7 }}>
                          No courses in <strong style={{ color: "#94a3b8" }}>{selProg?.name}</strong> yet.<br/>
                          Use the left panel to add your first course.
                        </div>
                      </div>
                    )
                    : filteredCourses.length === 0
                    ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40, fontSize: 13 }}>No courses match the selected filters.</div>
                    : <LMSGrid columns={courseCols} rowData={filteredCourses} height="100%" />
                  }
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
