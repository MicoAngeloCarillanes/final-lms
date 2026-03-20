/**
 * StudentAttendanceTab.jsx
 *
 * PLACEMENT: frontend/src/student/components/StudentAttendanceTab.jsx
 *
 * Shows the current student's attendance records for a course:
 *  - Per-session status (Present / Absent / Late / Excused)
 *  - Per-term computed grade
 *  - Overall attendance summary
 */
import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { EXAM_TERMS, TERM_META } from "../../lib/constants";

// ─── Dark theme tokens ────────────────────────────────────────────────────────
const C = {
  bg:    "#0f172a",
  bg2:   "#1e293b",
  bg3:   "#162032",
  bdr:   "#334155",
  txt:   "#e2e8f0",
  muted: "#64748b",
  dim:   "#475569",
};

const STATUS_META = {
  Present: { color: "#34d399", bg: "rgba(52,211,153,.15)",  icon: "✓", label: "Present"  },
  Absent:  { color: "#f87171", bg: "rgba(248,113,113,.15)", icon: "✗", label: "Absent"   },
  Late:    { color: "#fbbf24", bg: "rgba(251,191,36,.15)",  icon: "⏰", label: "Late"     },
  Excused: { color: "#a5b4fc", bg: "rgba(165,180,252,.15)", icon: "📋", label: "Excused"  },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.Present;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700,
      background: m.bg, color: m.color,
    }}>
      {m.icon} {m.label}
    </span>
  );
}

function gradeColor(g) {
  if (g == null) return C.muted;
  if (g >= 90)   return "#34d399";
  if (g >= 75)   return "#60a5fa";
  if (g >= 60)   return "#fbbf24";
  return "#f87171";
}

function computeAttendanceGrade(sessions, records, studentUuid, term) {
  const termSessions = sessions.filter(s => s.term === term);
  if (!termSessions.length) return null;
  let deduction = 0;
  termSessions.forEach(sess => {
    const rec = records.find(r => r.session_id === sess.session_id && r.student_id === studentUuid);
    const status = rec ? rec.status : "Present";
    if (status === "Absent") deduction += Number(sess.deduct_absent);
    if (status === "Late")   deduction += Number(sess.deduct_late);
  });
  return Math.max(0, 100 - deduction);
}

export default function StudentAttendanceTab({ course, user }) {
  const [sessions, setSessions] = useState([]);
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!course._uuid || !user._uuid) return;
    (async () => {
      setLoading(true);
      const { data: sessData } = await supabase
        .from("attendance_sessions")
        .select("*")
        .eq("course_id", course._uuid)
        .order("session_date", { ascending: true });

      const sessions = sessData || [];
      setSessions(sessions);

      if (sessions.length) {
        const ids = sessions.map(s => s.session_id);
        const { data: recData } = await supabase
          .from("attendance_records")
          .select("*")
          .in("session_id", ids)
          .eq("student_id", user._uuid);
        setRecords(recData || []);
      }
      setLoading(false);
    })();
  }, [course._uuid, user._uuid]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Loading attendance…</div>;
  }

  if (sessions.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>📅</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.txt, marginBottom: 6 }}>No attendance records yet</div>
        <div style={{ fontSize: 13 }}>Your teacher hasn't created any attendance sessions for this course yet.</div>
      </div>
    );
  }

  const getRecord = (sessId) => records.find(r => r.session_id === sessId);

  // ── Summary counts ────────────────────────────────────────────────────────
  const allStatuses = sessions.map(s => {
    const r = getRecord(s.session_id);
    return r ? r.status : "Present";
  });
  const total   = allStatuses.length;
  const present = allStatuses.filter(s => s === "Present").length;
  const absent  = allStatuses.filter(s => s === "Absent").length;
  const late    = allStatuses.filter(s => s === "Late").length;
  const excused = allStatuses.filter(s => s === "Excused").length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Overall summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { label: "Present",  value: present,  ...STATUS_META.Present },
          { label: "Absent",   value: absent,   ...STATUS_META.Absent  },
          { label: "Late",     value: late,     ...STATUS_META.Late    },
          { label: "Excused",  value: excused,  ...STATUS_META.Excused },
        ].map(({ label, value, color, bg, icon }) => (
          <div key={label} style={{
            background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 10,
            padding: "14px 16px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {label} <span style={{ color: C.dim }}>/ {total}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Per-term grade summary ── */}
      <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}`, background: C.bg, fontWeight: 800, fontSize: 13, color: C.txt }}>
          📊 Attendance Grade per Term
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {EXAM_TERMS.map((term, i) => {
            const grade = computeAttendanceGrade(sessions, records, user._uuid, term);
            const ts    = sessions.filter(s => s.term === term);
            const tm    = TERM_META[term] || {};
            return (
              <div key={term} style={{
                padding: "16px 14px", textAlign: "center",
                borderRight: i < 3 ? `1px solid ${C.bdr}` : "none",
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 800,
                  color: tm.color, background: tm.bg,
                  padding: "2px 10px", borderRadius: 9999,
                  display: "inline-block", marginBottom: 8,
                }}>{term}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: gradeColor(grade) }}>
                  {grade != null ? `${grade}%` : "—"}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  {ts.length} session{ts.length !== 1 ? "s" : ""}
                </div>
                {ts.length > 0 && (
                  <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
                    −{ts[0].deduct_absent}pts/absent · −{ts[0].deduct_late}pts/late
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Full session history ── */}
      <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}`, background: C.bg, fontWeight: 800, fontSize: 13, color: C.txt }}>
          📋 Session History
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg3 }}>
              {["Date", "Session", "Term", "Status", "Impact"].map(h => (
                <th key={h} style={{ padding: "9px 18px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((sess, i) => {
              const rec    = getRecord(sess.session_id);
              const status = rec ? rec.status : "Present";
              const tm     = TERM_META[sess.term] || {};
              const impact = status === "Absent"
                ? `-${sess.deduct_absent} pts`
                : status === "Late"
                ? `-${sess.deduct_late} pts`
                : status === "Excused"
                ? "Excused"
                : "None";
              const impactColor = status === "Absent" ? "#f87171" : status === "Late" ? "#fbbf24" : status === "Excused" ? "#a5b4fc" : "#34d399";

              return (
                <tr key={sess.session_id} style={{ borderBottom: `1px solid ${C.bdr}`, background: i % 2 === 0 ? C.bg2 : C.bg3 }}>
                  <td style={{ padding: "11px 18px", color: C.muted, fontSize: 12 }}>
                    {new Date(sess.session_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td style={{ padding: "11px 18px", color: C.txt, fontWeight: 600 }}>{sess.label}</td>
                  <td style={{ padding: "11px 18px" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: tm.color, background: tm.bg, padding: "2px 8px", borderRadius: 9999 }}>
                      {sess.term}
                    </span>
                  </td>
                  <td style={{ padding: "11px 18px" }}>
                    <StatusBadge status={status} />
                  </td>
                  <td style={{ padding: "11px 18px", fontWeight: 700, fontSize: 12, color: impactColor }}>
                    {impact}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
