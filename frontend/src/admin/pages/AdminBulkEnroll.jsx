/**
 * AdminBulkEnroll.jsx
 * FOLDER: src/admin/pages/AdminBulkEnroll.jsx
 *
 * Lets the admin bulk-assign students to courses automatically based on
 * matching Program + Year Level + Semester.
 *
 * Logic:
 *   - Courses match when: course.programId === selected program
 *                     AND course.yearLevel  === selected year level
 *                     AND course.semester   === selected semester
 *   - Students match when: student.programId === selected program
 *                      AND student.yearLevel  === selected year level
 *                      AND student.semester   === selected semester
 *   - On "Assign", every matching student is enrolled in every matching course,
 *     skipping pairs that are already enrolled.
 */
import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import { programApi } from "../../lib/api";
import { Badge, Btn, Sel, FF } from "../../components/ui";
import TopBar from "../../components/TopBar";

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const SEMESTERS   = ["1st Semester", "2nd Semester", "Summer"];

const S = {
  label: { fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" },
  card:  { background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "14px 16px" },
  row:   { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: "1px solid #1e293b" },
};

export default function AdminBulkEnroll({ users = [], courses = [], enrollments = [], setEnrollments }) {
  const students = users.filter(u => u.role === "student");

  const [programOpts,  setProgramOpts]  = useState([]);
  const [selProgram,   setSelProgram]   = useState("");   // programId string
  const [selYear,      setSelYear]      = useState("");
  const [selSem,       setSelSem]       = useState("");
  const [assigning,    setAssigning]    = useState(false);
  const [result,       setResult]       = useState(null); // { enrolled, skipped, errors }
  const [toast,        setToast]        = useState({ msg: "", type: "success" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 4000);
  };

  useEffect(() => {
    programApi.getOptions()
      .then(opts => setProgramOpts(opts ?? []))
      .catch(console.error);
  }, []);

  const ready = selProgram && selYear && selSem;

  // ── Matching courses ─────────────────────────────────────────────────────────
  const matchedCourses = useMemo(() => {
    if (!ready) return [];
    return courses.filter(c =>
      String(c.programId) === selProgram &&
      c.yearLevel === selYear &&
      c.semester  === selSem
    );
  }, [courses, selProgram, selYear, selSem, ready]);

  // ── Matching students ────────────────────────────────────────────────────────
  const matchedStudents = useMemo(() => {
    if (!ready) return [];
    return students.filter(s =>
      String(s.programId) === selProgram &&
      s.yearLevel === selYear &&
      s.semester  === selSem
    );
  }, [students, selProgram, selYear, selSem, ready]);

  // ── Preview: how many pairs already enrolled vs new ─────────────────────────
  const { newPairs, alreadyPairs } = useMemo(() => {
    if (!ready || !matchedCourses.length || !matchedStudents.length) {
      return { newPairs: 0, alreadyPairs: 0 };
    }
    const enrolledSet = new Set(enrollments.map(e => `${e.studentId}||${e.courseId}`));
    let newCount = 0, skipCount = 0;
    matchedStudents.forEach(s => {
      matchedCourses.forEach(c => {
        if (enrolledSet.has(`${s.id}||${c.id}`)) skipCount++;
        else newCount++;
      });
    });
    return { newPairs: newCount, alreadyPairs: skipCount };
  }, [matchedCourses, matchedStudents, enrollments, ready]);

  // ── Bulk assign ──────────────────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!ready || assigning || matchedCourses.length === 0 || matchedStudents.length === 0) return;
    setAssigning(true);
    setResult(null);

    const enrolledSet = new Set(enrollments.map(e => `${e.studentId}||${e.courseId}`));
    let enrolled = 0, skipped = 0, errors = 0;
    const newEnrollments = [];

    for (const student of matchedStudents) {
      for (const course of matchedCourses) {
        // Skip already-enrolled pairs
        if (enrolledSet.has(`${student.id}||${course.id}`)) { skipped++; continue; }

        const { error } = await supabase.from("student_course_assignments").upsert({
          student_id:        student._uuid,
          course_id:         course._uuid,
          enrollment_status: "Enrolled",
          academic_year:     "2025-2026",
          semester:          course.semester || null,
        }, { onConflict: "student_id,course_id" });

        if (error) { errors++; }
        else {
          enrolled++;
          newEnrollments.push({ studentId: student.id, courseId: course.id, grade: null, status: "Enrolled" });
        }
      }
    }

    if (newEnrollments.length > 0) {
      setEnrollments(prev => [...prev, ...newEnrollments]);
    }

    setResult({ enrolled, skipped, errors });
    showToast(
      errors > 0
        ? `Done with ${errors} error(s). ${enrolled} enrolled, ${skipped} skipped.`
        : `✓ ${enrolled} enrollment${enrolled !== 1 ? "s" : ""} created, ${skipped} already existed.`,
      errors > 0 ? "error" : "success"
    );
    setAssigning(false);
  };

  const programName = programOpts.find(p => String(p.programId) === selProgram)?.name || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar title="Bulk Course Assignment" subtitle="Auto-enroll students into courses by Program · Year Level · Semester" />

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, maxWidth: 460, background: toast.type === "error" ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)", border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`, borderRadius: 8, padding: "10px 16px", color: toast.type === "error" ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600 }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>

        {/* ── Step 1: Criteria ── */}
        <div style={S.card}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", marginBottom: 14 }}>
            Step 1 — Select Criteria
          </div>
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

        {/* ── Step 2: Preview (only when criteria is fully set) ── */}
        {ready && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Matched Courses */}
            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9" }}>📚 Matched Courses</div>
                <Badge color={matchedCourses.length > 0 ? "info" : "default"}>{matchedCourses.length}</Badge>
              </div>
              {matchedCourses.length === 0 ? (
                <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "16px 0" }}>
                  No courses found for {selYear} · {selSem} in this program.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {matchedCourses.map((c, i) => (
                    <div key={c._uuid} style={{ ...S.row, borderBottom: i < matchedCourses.length - 1 ? "1px solid #334155" : "none" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{c.code}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{c.name}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "#475569" }}>{c.units} units</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Matched Students */}
            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9" }}>🎓 Matched Students</div>
                <Badge color={matchedStudents.length > 0 ? "success" : "default"}>{matchedStudents.length}</Badge>
              </div>
              {matchedStudents.length === 0 ? (
                <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "16px 0" }}>
                  No students found for {selYear} · {selSem} in this program.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", maxHeight: 220, overflowY: "auto" }}>
                  {matchedStudents.map((s, i) => (
                    <div key={s._uuid} style={{ ...S.row, borderBottom: i < matchedStudents.length - 1 ? "1px solid #334155" : "none" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{s.fullName}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{s.id} · {s.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Summary + Assign button ── */}
        {ready && (matchedCourses.length > 0 || matchedStudents.length > 0) && (
          <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9", marginBottom: 6 }}>
                Step 2 — Assign Courses
              </div>
              {matchedCourses.length > 0 && matchedStudents.length > 0 ? (
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                  <span style={{ color: "#a5b4fc", fontWeight: 700 }}>{matchedStudents.length} student{matchedStudents.length !== 1 ? "s" : ""}</span>
                  {" "}&times;{" "}
                  <span style={{ color: "#60a5fa", fontWeight: 700 }}>{matchedCourses.length} course{matchedCourses.length !== 1 ? "s" : ""}</span>
                  {" "}={" "}
                  <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{matchedStudents.length * matchedCourses.length} total pairs</span>
                  {alreadyPairs > 0 && <span style={{ color: "#475569" }}> · {alreadyPairs} already enrolled (will skip)</span>}
                  {newPairs > 0    && <span style={{ color: "#34d399" }}> · {newPairs} new enrollment{newPairs !== 1 ? "s" : ""}</span>}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#475569" }}>
                  {matchedCourses.length === 0
                    ? "No courses matched — add courses for this program / year / semester first."
                    : "No students matched — no students are set to this program / year / semester."}
                </div>
              )}
              {result && (
                <div style={{ marginTop: 8, fontSize: 12, display: "flex", gap: 12 }}>
                  <span style={{ color: "#34d399", fontWeight: 700 }}>✓ {result.enrolled} enrolled</span>
                  <span style={{ color: "#475569" }}>↷ {result.skipped} skipped</span>
                  {result.errors > 0 && <span style={{ color: "#f87171", fontWeight: 700 }}>⚠ {result.errors} errors</span>}
                </div>
              )}
            </div>

            <Btn
              onClick={handleAssign}
              disabled={assigning || newPairs === 0}
              style={{ whiteSpace: "nowrap", flexShrink: 0, fontSize: 14, padding: "10px 22px" }}
            >
              {assigning
                ? "⏳ Assigning…"
                : newPairs === 0
                ? "✓ All Already Enrolled"
                : `🎓 Assign ${newPairs} Enrollment${newPairs !== 1 ? "s" : ""}`}
            </Btn>
          </div>
        )}

        {/* Empty state when criteria not yet set */}
        {!ready && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>Select a Program, Year Level, and Semester above</div>
            <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>Students and courses matching all three criteria will be previewed before assigning.</div>
          </div>
        )}
      </div>
    </div>
  );
}
