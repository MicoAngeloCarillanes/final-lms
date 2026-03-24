/**
 * AdminCourseManagement.jsx
 * FOLDER: src/admin/pages/AdminCourseManagement.jsx
 *
 * Three-level drill-down: Departments → Programs → Courses
 *
 * UPDATED for new course structure:
 *   - courses table no longer has program_id, schedule, room, year_level, semester
 *   - courses now loaded via course_program_map (many-to-many)
 *   - year_level + semester stored in course_program_map
 *   - schedule / room / teacher → managed in AdminCourseSections
 *   - student enrollment → managed in AdminBulkEnroll
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { departmentApi, programApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

// ─── Shared styles ────────────────────────────────────────────────────────────
const S = {
  pane:    { width: 300, borderRight: "1px solid #334155", background: "#1e293b", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flexShrink: 0 },
  grid:    { flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8 },
  label:   { fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" },
  section: { borderTop: "1px solid #334155", paddingTop: 10, marginTop: 4 },
  hint:    { fontSize: 11, color: "#475569", fontStyle: "italic", lineHeight: 1.5 },
};

const PaneHeader = ({ title, sub }) => (
  <div style={{ marginBottom: 4 }}>
    <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>{title}</div>
    {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sub}</div>}
  </div>
);

const emptyDept   = { code: "", name: "", room: "", email: "", phone: "", description: "" };
const emptyProg   = { code: "", name: "", description: "" };
// schedule / room removed — those live in course_sections now
const emptyCourse = { code: "", name: "", units: "3", yearLevel: "1st Year", semester: "1st Semester" };

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

  // ── Level state ──────────────────────────────────────────────────────────────
  const [level,       setLevel]       = useState("dept");
  const [selDept,     setSelDept]     = useState(null);
  const [selProg,     setSelProg]     = useState(null);

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [depts,       setDepts]       = useState([]);
  const [progs,       setProgs]       = useState([]);
  const [progCourses, setProgCourses] = useState([]);
  const [loading,     setLoading]     = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [deptForm,    setDeptForm]    = useState(emptyDept);
  const [progForm,    setProgForm]    = useState(emptyProg);
  const [courseForm,  setCourseForm]  = useState(emptyCourse);
  const [editingId,   setEditingId]   = useState(null); // course_id UUID when editing

  // ── Toast / confirm ───────────────────────────────────────────────────────────
  const [toast,       setToast]       = useState({ msg: "", type: "success" });
  const [confirmDel,  setConfirmDel]  = useState(null);

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

  // Updated: load courses via course_program_map (not courses.program_id)
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
        .filter(m => m.courses)   // skip any orphaned map rows
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

  // ════════════════════════════════════════════════════════════════════════════
  //  NAVIGATION
  // ════════════════════════════════════════════════════════════════════════════

  const drillDept = async (dept) => {
    setSelDept(dept); setSelProg(null);
    setEditingId(null); setProgForm(emptyProg); setProgCourses([]);
    setLevel("prog");
    await loadProgs(dept.departmentId);
  };

  const drillProg = async (prog) => {
    setSelProg(prog);
    setEditingId(null); setCourseForm(emptyCourse);
    setLevel("course");
    await loadCourses(prog.programId);
  };

  const goBack = () => {
    if (level === "course") { setLevel("prog"); setSelProg(null); setProgCourses([]); }
    if (level === "prog")   { setLevel("dept"); setSelDept(null); setProgs([]); }
    setEditingId(null);
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  DEPARTMENT CRUD (unchanged)
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
  //  PROGRAM CRUD (unchanged)
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
  //  COURSE CRUD  — updated for new schema
  // ════════════════════════════════════════════════════════════════════════════

  const saveCourse = async () => {
    if (!courseForm.code.trim() || !courseForm.name.trim()) {
      showToast("Code and Name required.", "error"); return;
    }
    try {
      if (editingId) {
        // ── Update course catalog row ────────────────────────────────────────
        const { error: courseErr } = await supabase.from("courses").update({
          course_code: courseForm.code.trim().toUpperCase(),
          course_name: courseForm.name.trim(),
          units:       parseInt(courseForm.units) || 3,
        }).eq("course_id", editingId);
        if (courseErr) throw new Error(courseErr.message);

        // ── Update year_level + semester in course_program_map ───────────────
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
        // ── Create new course catalog entry ──────────────────────────────────
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

        // ── Create course_program_map entry ──────────────────────────────────
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
          // Roll back the course if mapping fails
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
      // Remove from course_program_map first (FK cascade handles the rest,
      // but we only remove the mapping for this program — the course itself
      // stays if it belongs to other programs too)
      await supabase.from("course_program_map")
        .delete()
        .eq("course_id", course._uuid)
        .eq("program_id", selProg.programId);

      // Check if this course is still mapped to any other programs
      const { count } = await supabase
        .from("course_program_map")
        .select("*", { count: "exact", head: true })
        .eq("course_id", course._uuid);

      // Only delete the course catalog row if it's no longer used anywhere
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

  // ════════════════════════════════════════════════════════════════════════════
  //  BREADCRUMB
  // ════════════════════════════════════════════════════════════════════════════

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

  // Updated: removed teacher/schedule/room — those live in AdminCourseSections
  const courseCols = [
    { field: "code",      header: "Code",     width: 90 },
    { field: "name",      header: "Course" },
    { field: "units",     header: "Units",    width: 65 },
    { field: "yearLevel", header: "Year",     width: 90 },
    { field: "semester",  header: "Semester", width: 120 },
    { field: "_uuid",     header: "Actions",  width: 110, sortable: false,
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

        {/* ════════ LEVEL: DEPARTMENTS ════════ */}
        {level === "dept" && (
          <>
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
              <PaneHeader title={editingId ? "✏️ Edit Program" : "➕ New Program"} sub={`in ${selDept?.name}`} />
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
            {/* Left pane — create/edit course */}
            <div style={{ ...S.pane, width: 280 }}>
              <PaneHeader
                title={editingId ? "✏️ Edit Course" : "➕ New Course"}
                sub={`in ${selProg?.name}`}
              />

              <FF label="Course Code *">
                <Input value={courseForm.code} onChange={e => setCourseForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CS101" />
              </FF>
              <FF label="Course Name *">
                <Input value={courseForm.name} onChange={e => setCourseForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Intro to CS" />
              </FF>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <FF label="Units">
                  <Sel value={courseForm.units} onChange={e => setCourseForm(f => ({ ...f, units: e.target.value }))}>
                    {["1","2","3","4","5","6"].map(u => <option key={u}>{u}</option>)}
                  </Sel>
                </FF>
                <FF label="Year Level">
                  <Sel value={courseForm.yearLevel} onChange={e => setCourseForm(f => ({ ...f, yearLevel: e.target.value }))}>
                    {["1st Year","2nd Year","3rd Year","4th Year","5th Year"].map(y => <option key={y}>{y}</option>)}
                  </Sel>
                </FF>
              </div>

              <FF label="Semester">
                <Sel value={courseForm.semester} onChange={e => setCourseForm(f => ({ ...f, semester: e.target.value }))}>
                  {["1st Semester","2nd Semester","Summer"].map(s => <option key={s}>{s}</option>)}
                </Sel>
              </FF>

              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={saveCourse} style={{ flex: 1 }}>{editingId ? "✓ Save" : "✦ Create"}</Btn>
                {editingId && <Btn variant="secondary" onClick={() => { setEditingId(null); setCourseForm(emptyCourse); }}>Cancel</Btn>}
              </div>

              {/* Info callout pointing to Course Sections */}
              <div style={{ ...S.section }}>
                <div style={{ background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 7, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc", marginBottom: 4 }}>📅 Schedules & Teachers</div>
                  <div style={S.hint}>
                    Set teacher, schedule, and room in <strong style={{ color: "#a5b4fc" }}>Course Sections</strong>.
                    A course can have multiple sections (A, B, C…) each with its own schedule.
                  </div>
                </div>
              </div>

              <div style={{ ...S.section }}>
                <div style={{ background: "rgba(16,185,129,.07)", border: "1px solid rgba(16,185,129,.18)", borderRadius: 7, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#34d399", marginBottom: 4 }}>🎓 Student Enrollment</div>
                  <div style={S.hint}>
                    Enroll students in bulk via <strong style={{ color: "#34d399" }}>Bulk Assign</strong>,
                    or per-section in <strong style={{ color: "#34d399" }}>Course Sections</strong>.
                  </div>
                </div>
              </div>

              {/* Shared-course hint */}
              <div style={{ ...S.section }}>
                <div style={{ background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.18)", borderRadius: 7, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", marginBottom: 4 }}>🔗 Shared Courses (e.g. NSTP)</div>
                  <div style={S.hint}>
                    To assign a course to <em>multiple programs</em>, go to
                    <strong style={{ color: "#fbbf24" }}> Course Sections → Program Maps</strong>.
                  </div>
                </div>
              </div>
            </div>

            {/* Right area — courses grid */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8 }}>
                <div style={{ ...S.label, flexShrink: 0 }}>
                  {progCourses.length} Courses · {selProg?.name}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {loading
                    ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
                    : progCourses.length === 0
                    ? <div style={{ color: "#475569", textAlign: "center", paddingTop: 40, fontSize: 13 }}>No courses yet. Create one in the left pane.</div>
                    : <LMSGrid columns={courseCols} rowData={progCourses} height="100%" />
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
