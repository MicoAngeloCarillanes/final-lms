/**
 * AdminCourseOfferings.jsx
 * FOLDER: src/admin/pages/AdminCourseOfferings.jsx
 *
 * Admin creates predetermined course offerings per SY + term,
 * then runs auto-assign to enroll matching students.
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { Badge, Btn, FF, Input, Sel, Toast } from "../../components/ui";
import TopBar from "../../components/TopBar";

const TERMS = ["Prelim", "Midterm", "Semi-Final", "Finals"];
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

const TERM_COLOR = {
  Prelim:      { bg: "rgba(99,102,241,.15)",  text: "#a5b4fc" },
  Midterm:     { bg: "rgba(59,130,246,.15)",  text: "#60a5fa" },
  "Semi-Final":{ bg: "rgba(245,158,11,.15)",  text: "#fbbf24" },
  Finals:      { bg: "rgba(239,68,68,.15)",   text: "#f87171" },
};

const emptyForm = { courseId: "", syId: "", term: "Prelim", yearLevel: "", programId: "", maxStudents: 40 };

export default function AdminCourseOfferings() {
  const [schoolYears, setSchoolYears] = useState([]);
  const [programs,    setPrograms]    = useState([]);
  const [courses,     setCourses]     = useState([]);
  const [offerings,   setOfferings]   = useState([]);
  const [filterSy,    setFilterSy]    = useState("");
  const [filterTerm,  setFilterTerm]  = useState("");
  const [form,        setForm]        = useState(emptyForm);
  const [showForm,    setShowForm]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [assigning,   setAssigning]   = useState(null); // offeringId being auto-assigned
  const [toast,       setToast]       = useState("");
  const [toastErr,    setToastErr]    = useState("");
  const [assignResult, setAssignResult] = useState(null); // {assigned, skipped, courseCode}

  const showOk  = (m) => { setToast(m);    setTimeout(() => setToast(""),    3500); };
  const showErr = (m) => { setToastErr(m); setTimeout(() => setToastErr(""), 4500); };

  // ── Load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [syRes, progRes, courseRes] = await Promise.all([
        supabase.from("school_years").select("sy_id, label, is_active").order("created_at", { ascending: false }),
        supabase.from("program").select("program_id, name").eq("is_deleted", false).eq("is_active", true),
        supabase.from("courses").select("course_id, course_code, course_name").eq("is_active", true).order("course_code"),
      ]);
      const sys = syRes.data || [];
      setSchoolYears(sys);
      setPrograms(progRes.data || []);
      setCourses(courseRes.data || []);
      // Default filter to active SY
      const active = sys.find(s => s.is_active);
      if (active) { setFilterSy(active.sy_id); setForm(p => ({ ...p, syId: active.sy_id })); }
    }
    load();
  }, []);

  // ── Load offerings ────────────────────────────────────────────────────────
  const loadOfferings = useCallback(async () => {
    if (!filterSy) return;
    setLoading(true);
    let q = supabase
      .from("course_offerings")
      .select(`
        offering_id, course_id, sy_id, term, year_level, program_id,
        max_students, is_active, created_at,
        courses(course_code, course_name),
        school_years(label),
        program(name)
      `)
      .eq("sy_id", filterSy)
      .eq("is_active", true);
    if (filterTerm) q = q.eq("term", filterTerm);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (!error) setOfferings(data || []);
    setLoading(false);
  }, [filterSy, filterTerm]);

  useEffect(() => { loadOfferings(); }, [loadOfferings]);

  // ── Create offering ───────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.courseId || !form.syId || !form.term) {
      showErr("Course, School Year and Term are required."); return;
    }
    setSaving(true);
    const { error } = await supabase.from("course_offerings").insert({
      course_id:    form.courseId,
      sy_id:        form.syId,
      term:         form.term,
      year_level:   form.yearLevel || null,
      program_id:   form.programId ? Number(form.programId) : null,
      max_students: Number(form.maxStudents) || 40,
    });
    setSaving(false);
    if (error) { showErr(error.message); return; }
    setForm(emptyForm);
    setShowForm(false);
    await loadOfferings();
    showOk("Course offering created.");
  };

  // ── Auto-assign students ──────────────────────────────────────────────────
  const handleAutoAssign = async (offering) => {
    setAssigning(offering.offering_id);
    try {
      // Find eligible students: active, role=student, matching year_level if set
      let q = supabase.from("users").select("user_id").eq("role", "student").eq("is_active", true);

      // Get students already enrolled in this course
      const { data: existing } = await supabase
        .from("student_course_assignments")
        .select("student_id")
        .eq("course_id", offering.course_id);
      const alreadyIn = new Set((existing || []).map(r => r.student_id));

      // Filter by year level if set
      if (offering.year_level) {
        const { data: studs } = await supabase
          .from("students")
          .select("user_id")
          .eq("year_level", offering.year_level);
        const yearLevelIds = new Set((studs || []).map(s => s.user_id));
        q = supabase.from("users").select("user_id")
          .eq("role", "student")
          .eq("is_active", true)
          .in("user_id", [...yearLevelIds]);
      }

      const { data: eligibleUsers } = await q;
      const toEnroll = (eligibleUsers || [])
        .map(u => u.user_id)
        .filter(id => !alreadyIn.has(id));

      let assigned = 0;
      if (toEnroll.length > 0) {
        const rows = toEnroll.map(sid => ({
          student_id:        sid,
          course_id:         offering.course_id,
          enrollment_status: "Enrolled",
          academic_year:     offering.school_years?.label ?? "",
        }));
        const { data: ins } = await supabase
          .from("student_course_assignments")
          .upsert(rows, { onConflict: "student_id,course_id", ignoreDuplicates: true })
          .select("assignment_id");
        assigned = ins?.length ?? 0;
      }
      const skipped = toEnroll.length === 0 ? (existing?.length ?? 0) : (toEnroll.length - assigned);

      setAssignResult({
        courseCode: offering.courses?.course_code,
        assigned,
        skipped,
        total: (eligibleUsers || []).length,
      });
      await loadOfferings();
    } catch (err) {
      showErr("Auto-assign failed: " + err.message);
    }
    setAssigning(null);
  };

  // ── Delete offering ───────────────────────────────────────────────────────
  const handleDelete = async (offeringId) => {
    if (!confirm("Remove this course offering?")) return;
    await supabase.from("course_offerings").update({ is_active: false }).eq("offering_id", offeringId);
    await loadOfferings();
    showOk("Offering removed.");
  };

  const activeSyLabel = schoolYears.find(s => s.sy_id === filterSy)?.label ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar title="Course Offerings" icon="📅"
        right={<Btn onClick={() => setShowForm(v => !v)}>{showForm ? "Cancel" : "+ Add Offering"}</Btn>}
      />

      {/* Toast */}
      {(toast || toastErr) && (
        <div style={{ padding: "10px 20px 0" }}>
          <div style={{
            background: toast ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.12)",
            border: `1px solid ${toast ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.3)"}`,
            borderRadius: 8, padding: "9px 14px",
            color: toast ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 600,
          }}>
            {toast || toastErr}
          </div>
        </div>
      )}

      {/* Auto-assign result banner */}
      {assignResult && (
        <div style={{ margin: "10px 20px 0", background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.25)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontWeight: 800, color: "#60a5fa", marginRight: 8 }}>✓ Auto-assign complete for {assignResult.courseCode}</span>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>
              {assignResult.assigned} enrolled · {assignResult.skipped} already enrolled / skipped
            </span>
          </div>
          <button onClick={() => setAssignResult(null)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div style={{ padding: "14px 20px", background: "#1e293b", borderBottom: "1px solid #334155" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9", marginBottom: 12 }}>New Course Offering</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <FF label="Course *" style={{ flex: "0 0 220px" }}>
              <Sel value={form.courseId} onChange={e => setForm(p => ({ ...p, courseId: e.target.value }))}>
                <option value="">Select course…</option>
                {courses.map(c => (
                  <option key={c.course_id} value={c.course_id}>{c.course_code} — {c.course_name}</option>
                ))}
              </Sel>
            </FF>
            <FF label="School Year *" style={{ flex: "0 0 160px" }}>
              <Sel value={form.syId} onChange={e => setForm(p => ({ ...p, syId: e.target.value }))}>
                <option value="">Select SY…</option>
                {schoolYears.map(s => (
                  <option key={s.sy_id} value={s.sy_id}>{s.label}{s.is_active ? " ★" : ""}</option>
                ))}
              </Sel>
            </FF>
            <FF label="Term *" style={{ flex: "0 0 140px" }}>
              <Sel value={form.term} onChange={e => setForm(p => ({ ...p, term: e.target.value }))}>
                {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </Sel>
            </FF>
            <FF label="Year Level (optional)" style={{ flex: "0 0 150px" }}>
              <Sel value={form.yearLevel} onChange={e => setForm(p => ({ ...p, yearLevel: e.target.value }))}>
                <option value="">All levels</option>
                {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
              </Sel>
            </FF>
            <FF label="Program (optional)" style={{ flex: "0 0 180px" }}>
              <Sel value={form.programId} onChange={e => setForm(p => ({ ...p, programId: e.target.value }))}>
                <option value="">All programs</option>
                {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.name}</option>)}
              </Sel>
            </FF>
            <FF label="Max Students" style={{ flex: "0 0 110px" }}>
              <Input type="number" min={1} value={form.maxStudents}
                onChange={e => setForm(p => ({ ...p, maxStudents: e.target.value }))} />
            </FF>
            <Btn onClick={handleCreate} disabled={saving} variant="success">
              {saving ? "Saving…" : "Add Offering"}
            </Btn>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #1e293b", display: "flex", gap: 12, alignItems: "center" }}>
        <Sel value={filterSy} onChange={e => setFilterSy(e.target.value)} style={{ width: 180 }}>
          <option value="">All School Years</option>
          {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}{s.is_active ? " ★" : ""}</option>)}
        </Sel>
        <Sel value={filterTerm} onChange={e => setFilterTerm(e.target.value)} style={{ width: 150 }}>
          <option value="">All Terms</option>
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Sel>
        {activeSyLabel && <span style={{ fontSize: 12, color: "#64748b" }}>Showing: {activeSyLabel}</span>}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>{offerings.length} offering{offerings.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Offerings grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {loading && <div style={{ color: "#475569", textAlign: "center", marginTop: 40 }}>Loading…</div>}
        {!loading && offerings.length === 0 && (
          <div style={{ color: "#475569", textAlign: "center", marginTop: 60, fontSize: 14 }}>
            No offerings for this filter. Add one above.
          </div>
        )}

        {/* Group by term */}
        {!loading && TERMS.filter(t => !filterTerm || t === filterTerm).map(term => {
          const group = offerings.filter(o => o.term === term);
          if (!group.length) return null;
          const { bg, text } = TERM_COLOR[term];
          return (
            <div key={term} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ background: bg, color: text, padding: "3px 12px", borderRadius: 6, fontSize: 12, fontWeight: 800 }}>{term}</span>
                <span style={{ fontSize: 12, color: "#475569" }}>{group.length} course{group.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {group.map(o => {
                  const enrolledCount = o._enrolledCount ?? 0;
                  const pct = Math.round((enrolledCount / (o.max_students || 40)) * 100);
                  const isAssigning = assigning === o.offering_id;
                  return (
                    <div key={o.offering_id} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>{o.courses?.course_code}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{o.courses?.course_name}</div>
                        </div>
                        <button onClick={() => handleDelete(o.offering_id)}
                          style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                          title="Remove offering"
                        >×</button>
                      </div>

                      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                        {o.year_level && <span style={{ background: "rgba(16,185,129,.12)", color: "#34d399", padding: "1px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{o.year_level}</span>}
                        {o.program?.name && <span style={{ background: "rgba(99,102,241,.12)", color: "#a5b4fc", padding: "1px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{o.program?.name}</span>}
                        <span style={{ background: "#0f172a", color: "#64748b", padding: "1px 7px", borderRadius: 4, fontSize: 11 }}>Max {o.max_students}</span>
                      </div>

                      <Btn
                        variant="info"
                        style={{ width: "100%", justifyContent: "center", background: "rgba(59,130,246,.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,.3)" }}
                        onClick={() => handleAutoAssign(o)}
                        disabled={isAssigning}
                      >
                        {isAssigning ? "⏳ Assigning…" : "⚡ Auto-Assign Students"}
                      </Btn>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
