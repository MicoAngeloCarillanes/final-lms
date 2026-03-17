/**
 * TeacherAttendance.jsx
 * FOLDER: src/teacher/pages/TeacherAttendance.jsx
 *
 * Teacher checks student attendance per course per date.
 * Statuses: Present, Late, Absent, Excused
 * Works for both Face-to-Face and online (teacher marks manually).
 * Data stored in: attendance table (student_id, course_id, date, status, notes)
 *
 * SQL to run in Supabase (if table doesn't exist):
 *   CREATE TABLE IF NOT EXISTS public.attendance (
 *     attendance_id uuid NOT NULL DEFAULT gen_random_uuid(),
 *     student_id    uuid NOT NULL REFERENCES public.users(user_id),
 *     course_id     uuid NOT NULL REFERENCES public.courses(course_id),
 *     date          date NOT NULL,
 *     status        varchar NOT NULL DEFAULT 'Absent'
 *                   CHECK (status IN ('Present','Late','Absent','Excused')),
 *     notes         text,
 *     marked_by     uuid REFERENCES public.users(user_id),
 *     created_at    timestamptz NOT NULL DEFAULT now(),
 *     CONSTRAINT attendance_pkey PRIMARY KEY (attendance_id),
 *     CONSTRAINT attendance_unique UNIQUE (student_id, course_id, date)
 *   );
 *   GRANT ALL ON public.attendance TO anon, authenticated;
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { Btn, Sel } from "../../components/ui";
import TopBar from "../../components/TopBar";

const STATUS_OPTIONS = ["Present", "Late", "Absent", "Excused"];

const STATUS_STYLE = {
  Present: { bg: "rgba(16,185,129,.2)",  color: "#34d399", border: "rgba(16,185,129,.4)"  },
  Late:    { bg: "rgba(245,158,11,.2)",  color: "#fbbf24", border: "rgba(245,158,11,.4)"  },
  Absent:  { bg: "rgba(239,68,68,.2)",   color: "#f87171", border: "rgba(239,68,68,.4)"   },
  Excused: { bg: "rgba(100,116,139,.2)", color: "#94a3b8", border: "rgba(100,116,139,.4)" },
};

const STATUS_ICON = { Present: "✓", Late: "⏰", Absent: "✗", Excused: "〇" };

export default function TeacherAttendance({ user, courses, enrollments, allUsers }) {
  const myCourses = courses.filter(c => c.teacher === user.id);

  const [selCourse, setSelCourse]   = useState(myCourses[0]?.id || "");
  const [selDate,   setSelDate]     = useState(new Date().toISOString().slice(0, 10));
  const [records,   setRecords]     = useState({});   // { studentId: { status, notes, id } }
  const [loading,   setLoading]     = useState(false);
  const [saving,    setSaving]      = useState(false);
  const [toast,     setToast]       = useState("");
  const [history,   setHistory]     = useState([]);   // past dates with records
  const [viewMode,  setViewMode]    = useState("mark"); // "mark" | "history"

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const course      = myCourses.find(c => c.id === selCourse);
  const courseUuid  = course?._uuid;
  const enrolled    = enrollments.filter(e => e.courseId === selCourse);
  const students    = enrolled.map(e => allUsers.find(u => u.id === e.studentId)).filter(Boolean);

  // ── Load attendance for selected course + date ───────────────────────────────
  const loadAttendance = useCallback(async () => {
    if (!courseUuid || !selDate) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance")
      .select("attendance_id, student_id, status, notes")
      .eq("course_id", courseUuid)
      .eq("date", selDate);

    if (!error && data) {
      const map = {};
      // Pre-fill all enrolled students as "Absent"
      students.forEach(s => { map[s.id] = { status: "Absent", notes: "", id: null }; });
      data.forEach(r => {
        const st = allUsers.find(u => u._uuid === r.student_id);
        if (st) map[st.id] = { status: r.status, notes: r.notes || "", id: r.attendance_id };
      });
      setRecords(map);
    }
    setLoading(false);
  }, [courseUuid, selDate, students.length]);

  useEffect(() => { loadAttendance(); }, [courseUuid, selDate]);

  // ── Load history dates ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!courseUuid) return;
    supabase.from("attendance")
      .select("date")
      .eq("course_id", courseUuid)
      .order("date", { ascending: false })
      .then(({ data }) => {
        const dates = [...new Set((data || []).map(r => r.date))];
        setHistory(dates);
      });
  }, [courseUuid]);

  const setStatus = (studentId, status) =>
    setRecords(prev => ({ ...prev, [studentId]: { ...prev[studentId], status, notes: prev[studentId]?.notes || "" } }));

  const setNotes = (studentId, notes) =>
    setRecords(prev => ({ ...prev, [studentId]: { ...prev[studentId], notes } }));

  // ── Mark all ─────────────────────────────────────────────────────────────────
  const markAll = (status) => {
    const updated = {};
    students.forEach(s => { updated[s.id] = { ...records[s.id], status }; });
    setRecords(prev => ({ ...prev, ...updated }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────────
  const saveAttendance = async () => {
    if (!courseUuid) return;
    setSaving(true);
    try {
      const rows = students.map(s => {
        const rec = records[s.id] || { status: "Absent", notes: "" };
        return {
          student_id: s._uuid,
          course_id:  courseUuid,
          date:       selDate,
          status:     rec.status,
          notes:      rec.notes || null,
          marked_by:  user._uuid,
        };
      });

      const { error } = await supabase
        .from("attendance")
        .upsert(rows, { onConflict: "student_id,course_id,date" });

      if (error) { showToast("Error: " + error.message); }
      else {
        showToast(`Attendance saved for ${selDate}!`);
        // refresh history
        if (!history.includes(selDate)) setHistory(prev => [selDate, ...prev].sort((a, b) => b.localeCompare(a)));
        // reload to get IDs
        await loadAttendance();
      }
    } catch (e) { showToast("Error: " + e.message); }
    setSaving(false);
  };

  // ── Summary counts ────────────────────────────────────────────────────────────
  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = Object.values(records).filter(r => r?.status === s).length;
    return acc;
  }, {});
  const attendanceRate = students.length > 0
    ? Math.round(((counts.Present + counts.Late) / students.length) * 100)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="Attendance"
        subtitle={`${course?.code || "—"} · ${selDate}`}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {toast && <span style={{ fontSize: 12, color: "#34d399", fontWeight: 700, background: "rgba(16,185,129,.15)", padding: "4px 10px", borderRadius: 6 }}>✓ {toast}</span>}
            <button
              onClick={() => setViewMode(v => v === "mark" ? "history" : "mark")}
              style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#94a3b8", cursor: "pointer", fontFamily: "inherit" }}>
              {viewMode === "mark" ? "📅 History" : "✏ Mark Attendance"}
            </button>
          </div>
        }
      />

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, padding: "10px 18px", background: "#1e293b", borderBottom: "1px solid #334155", flexShrink: 0, alignItems: "center", flexWrap: "wrap" }}>
        <Sel value={selCourse} onChange={e => setSelCourse(e.target.value)} style={{ width: "auto", minWidth: 160 }}>
          {myCourses.length === 0
            ? <option>No courses assigned</option>
            : myCourses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)
          }
        </Sel>
        <input type="date" value={selDate}
          onChange={e => setSelDate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          style={{ border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "#e2e8f0", background: "#0f172a", cursor: "pointer", outline: "none" }} />
        <div style={{ display: "flex", gap: 6 }}>
          {STATUS_OPTIONS.map(s => {
            const st = STATUS_STYLE[s];
            return (
              <button key={s} onClick={() => markAll(s)}
                style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, border: `1px solid ${st.border}`, background: st.bg, color: st.color, cursor: "pointer", fontFamily: "inherit" }}>
                Mark All {s}
              </button>
            );
          })}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <Btn onClick={saveAttendance} disabled={saving || students.length === 0}>
            {saving ? "⏳ Saving…" : "💾 Save Attendance"}
          </Btn>
        </div>
      </div>

      {viewMode === "history" ? (
        /* ── History view ── */
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#e2e8f0", marginBottom: 12 }}>
            📅 Attendance History — {course?.code}
          </div>
          {history.length === 0
            ? <div style={{ color: "#475569", fontSize: 13, textAlign: "center", paddingTop: 40 }}>No attendance records yet.</div>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.map(date => (
                  <button key={date}
                    onClick={() => { setSelDate(date); setViewMode("mark"); }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc" }}>{date}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>Click to view / edit</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>→</span>
                  </button>
                ))}
              </div>
            )
          }
        </div>
      ) : (
        /* ── Mark attendance view ── */
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Summary bar */}
          <div style={{ display: "flex", gap: 12, padding: "10px 18px", background: "#0f172a", borderBottom: "1px solid #334155", flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
            {STATUS_OPTIONS.map(s => {
              const st = STATUS_STYLE[s];
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: st.color }}>{counts[s]}</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{s}</span>
                </div>
              );
            })}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#64748b" }}>Attendance Rate:</span>
              <span style={{ fontWeight: 900, fontSize: 16, color: attendanceRate >= 75 ? "#34d399" : attendanceRate >= 50 ? "#fbbf24" : "#f87171" }}>
                {attendanceRate}%
              </span>
            </div>
          </div>

          {/* Student list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading
              ? <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>Loading…</div>
              : students.length === 0
              ? <div style={{ padding: 40, textAlign: "center", color: "#475569", fontSize: 13 }}>
                  No students enrolled in this course.
                </div>
              : students.map((student, i) => {
                  const rec = records[student.id] || { status: "Absent", notes: "" };
                  const st  = STATUS_STYLE[rec.status] || STATUS_STYLE.Absent;
                  return (
                    <div key={student.id}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid #1e293b", background: i % 2 === 0 ? "#0f172a" : "#0a0f1a" }}>
                      {/* Avatar */}
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(99,102,241,.2)", color: "#a5b4fc", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {student.fullName?.charAt(0)}
                      </div>
                      {/* Name + ID */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{student.fullName}</div>
                        <div style={{ fontSize: 10, color: "#475569" }}>{student.id}</div>
                      </div>
                      {/* Status toggle buttons */}
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        {STATUS_OPTIONS.map(s => {
                          const sst = STATUS_STYLE[s];
                          const isActive = rec.status === s;
                          return (
                            <button key={s} onClick={() => setStatus(student.id, s)}
                              style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                                border:   `1px solid ${isActive ? sst.border : "#334155"}`,
                                background: isActive ? sst.bg    : "transparent",
                                color:      isActive ? sst.color : "#475569",
                              }}>
                              {STATUS_ICON[s]} {s}
                            </button>
                          );
                        })}
                      </div>
                      {/* Notes */}
                      <input
                        value={rec.notes || ""}
                        onChange={e => setNotes(student.id, e.target.value)}
                        placeholder="Notes…"
                        style={{ width: 130, border: "1px solid #334155", borderRadius: 6, padding: "5px 8px", fontSize: 11, fontFamily: "inherit", color: "#94a3b8", background: "#1e293b", outline: "none" }}
                        onFocus={e => e.target.style.borderColor = "#6366f1"}
                        onBlur={e  => e.target.style.borderColor = "#334155"}
                      />
                    </div>
                  );
                })
            }
          </div>
        </div>
      )}
    </div>
  );
}
