/**
 * AdminBulkEnroll.jsx
 * FOLDER: src/admin/pages/AdminBulkEnroll.jsx
 *
 * Updated to work with the new course structure:
 *   - Courses are matched via course_program_map (not directly on courses table)
 *   - Students are enrolled into specific sections, not just courses
 *   - If multiple sections exist for a course, admin picks one (or auto-balances)
 *
 * Flow:
 *   Step 1  Select Program + Year Level + Semester
 *   Step 2  Preview matched courses (from course_program_map) and their sections
 *           For each course, pick a section — or "auto-balance" to spread evenly
 *   Step 3  Preview matched students
 *   Step 4  Assign → inserts into student_section_assignments
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { programApi } from "../../lib/api";
import { Badge, Btn, Sel, FF } from "../../components/ui";
import TopBar from "../../components/TopBar";

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const SEMESTERS   = ["1st Semester", "2nd Semester", "Summer"];

const S = {
  card:  { background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "14px 16px" },
  row:   { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: "1px solid #1e293b" },
  badge: (color) => ({ background: `rgba(${color},.12)`, color: `rgb(${color})`, padding: "1px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700 }),
};

export default function AdminBulkEnroll() {
  // ── Reference data ────────────────────────────────────────────────────────
  const [programOpts, setProgramOpts]   = useState([]);
  const [activeSyId,  setActiveSyId]    = useState(null);

  // ── Criteria ──────────────────────────────────────────────────────────────
  const [selProgram, setSelProgram] = useState("");
  const [selYear,    setSelYear]    = useState("");
  const [selSem,     setSelSem]     = useState("");

  // ── Matched data ──────────────────────────────────────────────────────────
  // matchedCourses: [{ course_id, course_code, course_name, units, sections: [...] }]
  const [matchedCourses,   setMatchedCourses]   = useState([]);
  const [matchedStudents,  setMatchedStudents]  = useState([]);
  // selectedSections: { [course_id]: section_id | "auto" }
  const [selectedSections, setSelectedSections] = useState({});

  // ── UI ────────────────────────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [result,    setResult]    = useState(null);
  const [toast,     setToast]     = useState({ msg: "", err: false });

  const showToast = (msg, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast({ msg: "", err: false }), 4000);
  };

  // ── Load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    programApi.getOptions().then(opts => setProgramOpts(opts ?? [])).catch(console.error);
    supabase.from("school_years").select("sy_id").eq("is_active", true).single()
      .then(({ data }) => { if (data) setActiveSyId(data.sy_id); });
  }, []);

  const ready = selProgram && selYear && selSem;

  // ── Load matching courses + their sections ────────────────────────────────
  const loadMatchedCourses = useCallback(async () => {
    if (!ready || !activeSyId) return;
    setLoading(true);
    setResult(null);

    // 1. Get courses from course_program_map that match criteria
    const { data: maps, error: mapErr } = await supabase
      .from("course_program_map")
      .select("course_id, courses(course_id, course_code, course_name, units)")
      .eq("program_id", selProgram)
      .eq("year_level", selYear)
      .eq("semester", selSem);

    if (mapErr || !maps?.length) {
      setMatchedCourses([]);
      setMatchedStudents([]);
      setSelectedSections({});
      setLoading(false);
      return;
    }

    // 2. For each matched course, load active sections for the current SY
    const courseIds = maps.map(m => m.course_id);
    const { data: sectionRows } = await supabase
      .from("v_course_sections")
      .select("*")
      .in("course_id", courseIds)
      .eq("sy_id", activeSyId)
      .eq("is_active", true)
      .order("section_code");

    // 3. Group sections by course_id
    const sectionsByCourse = (sectionRows || []).reduce((acc, s) => {
      if (!acc[s.course_id]) acc[s.course_id] = [];
      acc[s.course_id].push(s);
      return acc;
    }, {});

    const courses = maps.map(m => ({
      ...m.courses,
      sections: sectionsByCourse[m.course_id] || [],
    }));

    setMatchedCourses(courses);

    // 4. Default section selection: if only one section, auto-select it; otherwise "auto"
    const defaults = {};
    courses.forEach(c => {
      defaults[c.course_id] = c.sections.length === 1
        ? c.sections[0].section_id
        : "auto";
    });
    setSelectedSections(defaults);

    // 5. Load matched students
    const { data: studRows } = await supabase
      .from("users")
      .select("user_id, username, first_name, last_name, middle_name, student_id_number, program_id, year_level, semester")
      .eq("role", "student")
      .eq("is_active", true)
      .eq("program_id", selProgram)
      .eq("year_level", selYear)
      .eq("semester", selSem);

    setMatchedStudents(studRows || []);
    setLoading(false);
  }, [ready, activeSyId, selProgram, selYear, selSem]);

  useEffect(() => { loadMatchedCourses(); }, [loadMatchedCourses]);

  // ── Preview: count new pairs ──────────────────────────────────────────────
  const { newPairs, alreadyPairs, canAssign } = useMemo(() => {
    if (!matchedCourses.length || !matchedStudents.length) return { newPairs: 0, alreadyPairs: 0, canAssign: false };

    // Count courses that have no section assigned at all (no sections exist)
    const coursesWithSections = matchedCourses.filter(c => c.sections.length > 0);
    const canAssign = coursesWithSections.length > 0;

    // We don't do a full pre-check of every enrollment here (would require N×M queries)
    // The actual upsert will skip duplicates via ON CONFLICT DO NOTHING
    const totalPairs = matchedStudents.length * coursesWithSections.length;
    return { newPairs: totalPairs, alreadyPairs: 0, canAssign };
  }, [matchedCourses, matchedStudents]);

  // ── Pick section for a student (for "auto" mode: least-full section) ──────
  const pickSection = (course, existingAssignments) => {
    const sectionId = selectedSections[course.course_id];
    if (sectionId !== "auto") return sectionId;

    // Auto-balance: pick section with fewest current enrollments
    const counts = {};
    course.sections.forEach(s => { counts[s.section_id] = s.enrolled_count || 0; });
    existingAssignments.forEach(a => {
      if (counts[a.section_id] !== undefined) counts[a.section_id]++;
    });

    let best = course.sections[0]?.section_id;
    let bestCount = Infinity;
    for (const [sid, cnt] of Object.entries(counts)) {
      if (cnt < bestCount) { bestCount = cnt; best = Number(sid); }
    }
    return best;
  };

  // ── Bulk assign ───────────────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!canAssign || assigning) return;
    setAssigning(true);
    setResult(null);

    const activeCourses = matchedCourses.filter(c => c.sections.length > 0);

    // Gather any existing enrollments for these sections to help auto-balance
    const allSectionIds = activeCourses.flatMap(c => c.sections.map(s => s.section_id));
    const { data: existingEnrollments } = await supabase
      .from("student_section_assignments")
      .select("student_id, section_id")
      .in("section_id", allSectionIds);

    const existingSet = new Set((existingEnrollments || []).map(e => `${e.student_id}||${e.section_id}`));

    let enrolled = 0, skipped = 0, errors = 0;

    for (const course of activeCourses) {
      // For auto mode, pick section once per course per assign run (not per student)
      // This keeps all students together in one section. If you want per-student balancing,
      // change this to call pickSection() inside the student loop.
      const sectionId = pickSection(course, existingEnrollments || []);
      if (!sectionId) { errors++; continue; }

      const rows = matchedStudents
        .filter(s => !existingSet.has(`${s.user_id}||${sectionId}`))
        .map(s => ({
          student_id:        s.user_id,
          section_id:        sectionId,
          enrollment_status: "Enrolled",
          academic_year:     "", // filled from school year label if needed
        }));

      const skippedHere = matchedStudents.length - rows.length;
      skipped += skippedHere;

      if (rows.length > 0) {
        const { data: ins, error } = await supabase
          .from("student_section_assignments")
          .upsert(rows, { onConflict: "student_id,section_id", ignoreDuplicates: true })
          .select("assignment_id");
        if (error) { errors++; }
        else { enrolled += ins?.length ?? 0; skipped += rows.length - (ins?.length ?? 0); }
      }
    }

    setResult({ enrolled, skipped, errors });
    showToast(
      errors > 0
        ? `Done with ${errors} error(s). ${enrolled} enrolled, ${skipped} skipped.`
        : `✓ ${enrolled} enrollment${enrolled !== 1 ? "s" : ""} created, ${skipped} already existed.`,
      errors > 0
    );
    await loadMatchedCourses(); // refresh enrolled counts
    setAssigning(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar title="Bulk Course Assignment" subtitle="Auto-enroll students into sections by Program · Year Level · Semester" />

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, maxWidth: 460,
          background: toast.err ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)",
          border: `1px solid ${toast.err ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`,
          borderRadius: 8, padding: "10px 16px",
          color: toast.err ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600 }}>
          {toast.err ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 960 }}>

        {/* ── Step 1: Criteria ── */}
        <div style={S.card}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", marginBottom: 14 }}>Step 1 — Select Criteria</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <FF label="Program">
              <Sel value={selProgram} onChange={e => { setSelProgram(e.target.value); setResult(null); }}>
                <option value="">— Select Program —</option>
                {programOpts.map(p => (
                  <option key={p.programId} value={p.programId}>{p.code} — {p.name}</option>
                ))}
              </Sel>
            </FF>
            <FF label="Year Level">
              <Sel value={selYear} onChange={e => { setSelYear(e.target.value); setResult(null); }}>
                <option value="">— Select Year Level —</option>
                {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
              </Sel>
            </FF>
            <FF label="Semester">
              <Sel value={selSem} onChange={e => { setSelSem(e.target.value); setResult(null); }}>
                <option value="">— Select Semester —</option>
                {SEMESTERS.map(s => <option key={s}>{s}</option>)}
              </Sel>
            </FF>
          </div>
        </div>

        {/* ── Step 2: Matched courses + section picker ── */}
        {ready && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9" }}>📚 Matched Courses</div>
              <Badge color={matchedCourses.length > 0 ? "info" : "default"}>{matchedCourses.length}</Badge>
            </div>

            {loading && <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "16px 0" }}>Loading…</div>}

            {!loading && matchedCourses.length === 0 && (
              <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "16px 0" }}>
                No courses mapped to this program / year / semester.
                <br/>Go to <em>Course Sections → Program Maps</em> to add mappings.
              </div>
            )}

            {!loading && matchedCourses.map((c, i) => {
              const hasSections = c.sections.length > 0;
              return (
                <div key={c.course_id} style={{
                  ...S.row,
                  borderBottom: i < matchedCourses.length - 1 ? "1px solid #334155" : "none",
                  alignItems: "flex-start", flexDirection: "column", gap: 6, paddingTop: 10, paddingBottom: 10,
                }}>
                  {/* Course info row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{c.course_code}</span>
                      <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>{c.course_name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#475569" }}>{c.units} units</span>
                  </div>

                  {/* Section picker */}
                  {!hasSections ? (
                    <div style={{ fontSize: 11, color: "#f87171", fontStyle: "italic" }}>
                      ⚠ No sections created yet for this SY — add sections first in Course Sections.
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#475569" }}>Assign to section:</span>
                      {c.sections.length > 1 && (
                        <button
                          onClick={() => setSelectedSections(p => ({ ...p, [c.course_id]: "auto" }))}
                          style={{
                            padding: "2px 9px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer",
                            background: selectedSections[c.course_id] === "auto" ? "rgba(99,102,241,.25)" : "rgba(99,102,241,.08)",
                            border: selectedSections[c.course_id] === "auto" ? "1px solid rgba(99,102,241,.5)" : "1px solid transparent",
                            color: "#a5b4fc",
                          }}
                        >
                          Auto-balance
                        </button>
                      )}
                      {c.sections.map(s => {
                        const selected = selectedSections[c.course_id] === s.section_id;
                        const pct = Math.round((s.enrolled_count / s.max_students) * 100);
                        return (
                          <button key={s.section_id}
                            onClick={() => setSelectedSections(p => ({ ...p, [c.course_id]: s.section_id }))}
                            style={{
                              padding: "2px 9px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: selected ? "rgba(16,185,129,.2)" : "#0f172a",
                              border: selected ? "1px solid rgba(16,185,129,.4)" : "1px solid #334155",
                              color: selected ? "#34d399" : "#94a3b8",
                            }}
                          >
                            Section {s.section_code}
                            {s.teacher_name ? ` · ${s.teacher_name.split(" ").slice(-1)[0]}` : ""}
                            {s.schedule ? ` · ${s.schedule}` : ""}
                            <span style={{ color: pct > 90 ? "#f87171" : "#475569", marginLeft: 4 }}>
                              ({s.enrolled_count}/{s.max_students})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Step 3: Matched students ── */}
        {ready && matchedCourses.length > 0 && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9" }}>🎓 Matched Students</div>
              <Badge color={matchedStudents.length > 0 ? "success" : "default"}>{matchedStudents.length}</Badge>
            </div>
            {matchedStudents.length === 0 ? (
              <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "16px 0" }}>
                No students found for this program / year / semester.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", maxHeight: 220, overflowY: "auto" }}>
                {matchedStudents.map((s, i) => (
                  <div key={s.user_id} style={{ ...S.row, borderBottom: i < matchedStudents.length - 1 ? "1px solid #334155" : "none" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                        {[s.last_name, s.first_name, s.middle_name].filter(Boolean).join(", ")}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{s.student_id_number} · {s.username}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Summary + Assign button ── */}
        {ready && canAssign && matchedStudents.length > 0 && (
          <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9", marginBottom: 6 }}>Step 2 — Assign Sections</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                <span style={{ color: "#a5b4fc", fontWeight: 700 }}>{matchedStudents.length} student{matchedStudents.length !== 1 ? "s" : ""}</span>
                {" "}×{" "}
                <span style={{ color: "#60a5fa", fontWeight: 700 }}>{matchedCourses.filter(c => c.sections.length > 0).length} course{matchedCourses.filter(c => c.sections.length > 0).length !== 1 ? "s" : ""}</span>
                {" "}={" "}
                <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{newPairs} total pairs</span>
                <span style={{ color: "#475569" }}> · duplicates will be skipped</span>
              </div>
              {matchedCourses.some(c => c.sections.length === 0) && (
                <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 4 }}>
                  ⚠ {matchedCourses.filter(c => c.sections.length === 0).length} course(s) have no sections and will be skipped.
                </div>
              )}
              {result && (
                <div style={{ marginTop: 8, fontSize: 12, display: "flex", gap: 12 }}>
                  <span style={{ color: "#34d399", fontWeight: 700 }}>✓ {result.enrolled} enrolled</span>
                  <span style={{ color: "#475569" }}>↷ {result.skipped} skipped</span>
                  {result.errors > 0 && <span style={{ color: "#f87171", fontWeight: 700 }}>⚠ {result.errors} error(s)</span>}
                </div>
              )}
            </div>

            <Btn
              onClick={handleAssign}
              disabled={assigning || !canAssign}
              style={{ whiteSpace: "nowrap", flexShrink: 0, fontSize: 14, padding: "10px 22px" }}
            >
              {assigning ? "⏳ Assigning…" : `🎓 Assign ${newPairs} Pair${newPairs !== 1 ? "s" : ""}`}
            </Btn>
          </div>
        )}

        {/* Empty state */}
        {!ready && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>Select Program, Year Level, and Semester above</div>
            <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>
              Students and courses matching all three criteria will preview before assigning.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
