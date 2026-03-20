/**
 * TeacherAttendanceTab.jsx
 *
 * PLACEMENT: frontend/src/teacher/components/TeacherAttendanceTab.jsx
 *
 * Features:
 *  - Teacher configures deduction amounts (per Absent, per Late) once per course
 *  - Teacher creates "sessions" (a class day) with a date, label, and term
 *  - Each session shows enrolled students → teacher marks each as
 *    Present / Absent / Late / Excused
 *  - Per-term attendance grade is auto-computed:
 *      grade = 100 − Σ(absent × deductAbsent) − Σ(late × deductLate)   [floor 0]
 *  - "Sync to Class Standing" pushes the computed grade to
 *    class_standing.attendance for each student × term
 *
 * Supabase tables needed:
 *   attendance_sessions (session_id uuid PK, course_id uuid, session_date date,
 *     label text, term text, deduct_absent numeric, deduct_late numeric,
 *     created_by uuid, created_at timestamptz)
 *
 *   attendance_records (record_id uuid PK, session_id uuid, student_id uuid,
 *     status text CHECK IN ('Present','Absent','Late','Excused'),
 *     UNIQUE(session_id, student_id))
 *
 * SQL to run once in Supabase:
 * ---
 * create table if not exists attendance_sessions (
 *   session_id     uuid default gen_random_uuid() primary key,
 *   course_id      uuid not null,
 *   session_date   date not null,
 *   label          text,
 *   term           text,
 *   deduct_absent  numeric not null default 5,
 *   deduct_late    numeric not null default 2.5,
 *   created_by     uuid,
 *   created_at     timestamptz default now()
 * );
 * create table if not exists attendance_records (
 *   record_id   uuid default gen_random_uuid() primary key,
 *   session_id  uuid not null references attendance_sessions(session_id) on delete cascade,
 *   student_id  uuid not null,
 *   status      text not null default 'Present'
 *     check (status in ('Present','Absent','Late','Excused')),
 *   created_at  timestamptz default now(),
 *   unique(session_id, student_id)
 * );
 * ---
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { supabase } from "../../supabaseClient";
import { EXAM_TERMS, TERM_META } from "../../lib/constants";
import { useCurrentTerm, fetchTermSettings, termFromDateWithSettings } from "../../lib/termSettingsHelper";
import { Btn, FF, Input, Sel } from "../../components/ui";

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

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ["Present", "Absent", "Late", "Excused"];
const STATUS_META = {
  Present: { color: "#34d399", bg: "rgba(52,211,153,.15)", icon: "✓" },
  Absent:  { color: "#f87171", bg: "rgba(248,113,113,.15)", icon: "✗" },
  Late:    { color: "#fbbf24", bg: "rgba(251,191,36,.15)",  icon: "⏰" },
  Excused: { color: "#a5b4fc", bg: "rgba(165,180,252,.15)", icon: "📋" },
};

// ─── Compute attendance grade for one student across sessions in a term ───────
function computeAttendanceGrade(sessions, records, studentUuid, term, deductAbsent, deductLate) {
  const termSessions = sessions.filter(s => s.term === term);
  if (!termSessions.length) return null;
  let deduction = 0;
  termSessions.forEach(sess => {
    const rec = records.find(r => r.session_id === sess.session_id && r.student_id === studentUuid);
    const status = rec ? rec.status : "Present"; // unmarked = present
    if (status === "Absent")  deduction += Number(sess.deduct_absent);
    if (status === "Late")    deduction += Number(sess.deduct_late);
  });
  return Math.max(0, 100 - deduction);
}

// ─── StatusPill ───────────────────────────────────────────────────────────────
// Renders the dropdown via ReactDOM.createPortal into document.body so it is
// NEVER clipped by any overflow or stacking-context ancestor, no matter how
// deeply nested the pill lives in scrollable / overflow:hidden containers.
// Auto-flips upward when there isn't enough space below the button.
function StatusPill({ value, onChange, disabled }) {
  const meta     = STATUS_META[value] || STATUS_META.Present;
  const [open,   setOpen]   = useState(false);
  const [rect,   setRect]   = useState(null);   // DOMRect of the trigger button
  const btnRef   = useRef(null);
  const menuRef  = useRef(null);

  // ── Recalculate position whenever the menu opens ──────────────────────────
  const openMenu = () => {
    if (!btnRef.current) return;
    setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  };

  // ── Close on outside click or Escape ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        btnRef.current  && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown",   onKey);
    };
  }, [open]);

  // ── Also close if the trigger scrolls out of view ────────────────────────
  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true); // capture phase catches all scroll
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  // ── Compute portal position ───────────────────────────────────────────────
  const MENU_HEIGHT = STATUS_OPTIONS.length * 42 + 8; // ~42px per row + padding
  const MENU_WIDTH  = 148;
  const spaceBelow  = rect ? window.innerHeight - rect.bottom : 999;
  const openUp      = rect ? spaceBelow < MENU_HEIGHT + 12 : false;

  const menuStyle = rect
    ? {
        position:     "fixed",
        top:          openUp ? rect.top - MENU_HEIGHT - 4 : rect.bottom + 4,
        left:         Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8),
        width:        MENU_WIDTH,
        zIndex:       99999,
        background:   C.bg2,
        border:       `1px solid ${C.bdr}`,
        borderRadius: 8,
        overflow:     "hidden",
        boxShadow:    "0 12px 40px rgba(0,0,0,.7)",
      }
    : {};

  if (disabled) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "4px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700,
        background: meta.bg, color: meta.color, cursor: "default",
      }}>
        {meta.icon} {value}
      </span>
    );
  }

  return (
    <>
      {/* Trigger button */}
      <button
        ref={btnRef}
        onClick={openMenu}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "4px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700,
          background: meta.bg, color: meta.color,
          border: `1.5px solid ${meta.color}55`, cursor: "pointer",
          fontFamily: "inherit", transition: "opacity .12s",
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        {meta.icon} {value} ▾
      </button>

      {/* Dropdown — portaled to document.body, always visible */}
      {open && rect && ReactDOM.createPortal(
        <div ref={menuRef} style={menuStyle}>
          {STATUS_OPTIONS.map(s => {
            const m       = STATUS_META[s];
            const active  = value === s;
            return (
              <div
                key={s}
                onMouseDown={e => e.preventDefault()} // prevent blur stealing focus
                onClick={() => { onChange(s); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, color: m.color,
                  background: active ? m.bg : "transparent",
                  transition: "background .1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = m.bg}
                onMouseLeave={e => e.currentTarget.style.background = active ? m.bg : "transparent"}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>{m.icon}</span>
                {s}
                {active && <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.6 }}>✓</span>}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function TeacherAttendanceTab({ course, user, enrollments, allUsers }) {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [sessions,  setSessions]  = useState([]);
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState({ msg: "", type: "ok" });

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeSession, setActiveSession] = useState(null); // session_id expanded
  const [showNew,       setShowNew]       = useState(false);
  const autoTerm = useCurrentTerm();
  const [newForm,       setNewForm]       = useState({
    session_date: new Date().toISOString().slice(0, 10),
    label: "",
    term: EXAM_TERMS[0],
    deduct_absent: 5,
    deduct_late: 2.5,
  });
  // Sync term default once DB settings load
  React.useEffect(() => {
    setNewForm(f => ({ ...f, term: autoTerm }));
  }, [autoTerm]);
  const [saving,      setSaving]      = useState(false);
  const [syncing,     setSyncing]     = useState({}); // { [term]: bool }
  const [activeTerm,  setActiveTerm]  = useState("all"); // filter for summary view
  const [viewMode,    setViewMode]    = useState("sessions"); // "sessions" | "summary"

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 3000);
  };

  // ── Enrolled students for this course ──────────────────────────────────────
  const enrolled = enrollments
    .filter(e => e.courseId === course.id)
    .map(e => allUsers.find(u => u.id === e.studentId || u._uuid === e.studentId))
    .filter(Boolean);

  // ── Load sessions + records ────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!course._uuid) return;
    setLoading(true);
    const [sRes, rRes] = await Promise.all([
      supabase.from("attendance_sessions")
        .select("*")
        .eq("course_id", course._uuid)
        .order("session_date", { ascending: false }),
      supabase.from("attendance_records")
        .select("*")
        // join via sessions
        .in("session_id",
          // we'll re-load records after sessions
          ["00000000-0000-0000-0000-000000000000"] // placeholder; overridden below
        ),
    ]);
    const sessData = sRes.data || [];
    setSessions(sessData);

    if (sessData.length) {
      const ids = sessData.map(s => s.session_id);
      const { data: recData } = await supabase
        .from("attendance_records")
        .select("*")
        .in("session_id", ids);
      setRecords(recData || []);
    } else {
      setRecords([]);
    }
    setLoading(false);
  }, [course._uuid]);

  useEffect(() => { load(); }, [load]);

  // ── Create session ─────────────────────────────────────────────────────────
  const createSession = async () => {
    if (!newForm.session_date) { showToast("Date is required.", "err"); return; }
    setSaving(true);
    const label = newForm.label.trim() ||
      new Date(newForm.session_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert({
        course_id:     course._uuid,
        session_date:  newForm.session_date,
        label,
        term:          newForm.term,
        deduct_absent: Number(newForm.deduct_absent),
        deduct_late:   Number(newForm.deduct_late),
        created_by:    user._uuid,
      })
      .select()
      .single();

    if (error) { showToast("Error: " + error.message, "err"); setSaving(false); return; }

    // Pre-insert records with "Present" for all enrolled students
    if (enrolled.length) {
      const rows = enrolled.map(s => ({
        session_id: data.session_id,
        student_id: s._uuid,
        status: "Present",
      }));
      await supabase.from("attendance_records").insert(rows);
    }

    showToast(`Session "${label}" created.`);
    setSaving(false);
    setShowNew(false);
    setNewForm(f => ({ ...f, label: "", session_date: new Date().toISOString().slice(0, 10) }));
    await load();
    setActiveSession(data.session_id);
  };

  // ── Delete session ─────────────────────────────────────────────────────────
  const deleteSession = async (sessId) => {
    if (!window.confirm("Delete this session and all its records?")) return;
    await supabase.from("attendance_sessions").delete().eq("session_id", sessId);
    if (activeSession === sessId) setActiveSession(null);
    await load();
    showToast("Session deleted.");
  };

  // ── Update record status ───────────────────────────────────────────────────
  const setStatus = async (sessionId, studentUuid, status) => {
    // Optimistic update
    setRecords(prev => {
      const i = prev.findIndex(r => r.session_id === sessionId && r.student_id === studentUuid);
      if (i >= 0) {
        const next = [...prev]; next[i] = { ...next[i], status }; return next;
      }
      return [...prev, { session_id: sessionId, student_id: studentUuid, status }];
    });
    await supabase.from("attendance_records").upsert(
      { session_id: sessionId, student_id: studentUuid, status },
      { onConflict: "session_id,student_id" }
    );
  };

  // ── Sync attendance grade to class_standing ────────────────────────────────
  const syncTerm = async (term) => {
    setSyncing(p => ({ ...p, [term]: true }));
    const rows = enrolled
      .map(stu => {
        const grade = computeAttendanceGrade(sessions, records, stu._uuid, term,
          sessions.find(s => s.term === term)?.deduct_absent ?? 5,
          sessions.find(s => s.term === term)?.deduct_late   ?? 2.5);
        if (grade === null) return null;
        return {
          student_id:  stu._uuid,
          course_id:   course._uuid,
          term,
          attendance:  grade,
          updated_by:  user._uuid,
          updated_at:  new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (!rows.length) { showToast("No sessions for this term yet.", "err"); setSyncing(p => ({ ...p, [term]: false })); return; }

    const { error } = await supabase
      .from("class_standing")
      .upsert(rows, { onConflict: "student_id,course_id,term", ignoreDuplicates: false });

    setSyncing(p => ({ ...p, [term]: false }));
    if (error) { showToast("Sync error: " + error.message, "err"); return; }
    showToast(`✓ Attendance grades synced to Class Standing for ${term}.`);
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const getRecord = (sessId, stuUuid) =>
    records.find(r => r.session_id === sessId && r.student_id === stuUuid);

  const termSessions = (term) => sessions.filter(s => s.term === term);

  const gradeFor = (stu, term) => {
    const ts = termSessions(term);
    if (!ts.length) return null;
    // Use the deduction from the first session of this term (or fallback)
    const da = ts[0]?.deduct_absent ?? 5;
    const dl = ts[0]?.deduct_late   ?? 2.5;
    return computeAttendanceGrade(sessions, records, stu._uuid, term, da, dl);
  };

  const gradeColor = (g) =>
    g == null ? C.muted : g >= 90 ? "#34d399" : g >= 75 ? "#60a5fa" : g >= 60 ? "#fbbf24" : "#f87171";

  // ─── Count per session ────────────────────────────────────────────────────
  const sessionCounts = (sess) => {
    const recs = records.filter(r => r.session_id === sess.session_id);
    const count = (s) => recs.filter(r => r.status === s).length;
    const present = count("Present") + (enrolled.length - recs.length); // unmarked = present
    return { Present: present, Absent: count("Absent"), Late: count("Late"), Excused: count("Excused") };
  };

  // ═════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Toast ── */}
      {toast.msg && (
        <div style={{
          padding: "9px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: toast.type === "err" ? "rgba(248,113,113,.15)" : "rgba(52,211,153,.15)",
          color:      toast.type === "err" ? "#f87171" : "#34d399",
          border:     `1px solid ${toast.type === "err" ? "rgba(248,113,113,.3)" : "rgba(52,211,153,.3)"}`,
          alignSelf: "flex-start",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Top bar: View toggle + New Session ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 8, overflow: "hidden" }}>
          {[["sessions", "📅 Sessions"], ["summary", "📊 Summary"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setViewMode(id)}
              style={{
                padding: "7px 16px", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 12, fontWeight: 700, transition: "background .1s",
                background: viewMode === id ? "#6366f1" : "transparent",
                color:      viewMode === id ? "#fff" : C.muted,
              }}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn onClick={() => setShowNew(v => !v)}>
            <span style={{ fontSize: 15 }}>＋</span> New Session
          </Btn>
        </div>
      </div>

      {/* ── New Session Form ── */}
      {showNew && (
        <div style={{
          background: C.bg2, border: "1px solid #6366f1", borderRadius: 12,
          padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14,
        }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.txt }}>📅 Create Attendance Session</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FF label="Date">
              <Input type="date" value={newForm.session_date}
                onChange={async e => {
                  const val = e.target.value;
                  const settings = await fetchTermSettings();
                  const detectedTerm = termFromDateWithSettings(val ? new Date(val) : new Date(), settings);
                  setNewForm(f => ({ ...f, session_date: val, term: detectedTerm }));
                }} />
            </FF>
            <FF label="Term">
              <Sel value={newForm.term} onChange={e => setNewForm(f => ({ ...f, term: e.target.value }))}>
                {EXAM_TERMS.map(t => <option key={t}>{t}</option>)}
              </Sel>
            </FF>
          </div>

          <FF label="Session Label (optional — defaults to date)">
            <Input value={newForm.label}
              onChange={e => setNewForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Lecture 3 — Introduction to Loops" />
          </FF>

          {/* Deduction settings */}
          <div style={{ background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              Grade Deduction Rules
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FF label="Points deducted per Absent">
                <Input type="number" min={0} max={100} step={0.5}
                  value={newForm.deduct_absent}
                  onChange={e => setNewForm(f => ({ ...f, deduct_absent: e.target.value }))} />
              </FF>
              <FF label="Points deducted per Late">
                <Input type="number" min={0} max={100} step={0.5}
                  value={newForm.deduct_late}
                  onChange={e => setNewForm(f => ({ ...f, deduct_late: e.target.value }))} />
              </FF>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
              Starting grade is <strong style={{ color: C.txt }}>100</strong>. Deductions are subtracted each time a student is Absent or Late. Excused absences are not penalized.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowNew(false)}>Cancel</Btn>
            <Btn onClick={createSession} disabled={saving}>{saving ? "Creating…" : "Create Session"}</Btn>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Loading attendance data…</div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
           SESSIONS VIEW — one card per session, expandable roster
         ══════════════════════════════════════════════════════════════════ */}
      {!loading && viewMode === "sessions" && (
        <>
          {sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📅</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.txt, marginBottom: 6 }}>No sessions yet</div>
              <div style={{ fontSize: 13 }}>Click "New Session" to create your first attendance record.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sessions.map(sess => {
                const tm   = TERM_META[sess.term] || {};
                const open = activeSession === sess.session_id;
                const counts = sessionCounts(sess);
                return (
                  <div key={sess.session_id}
                    style={{
                      background: C.bg2, border: `1px solid ${open ? "#6366f1" : C.bdr}`,
                      borderRadius: 12, overflow: "hidden", transition: "border-color .15s",
                    }}>

                    {/* Session header */}
                    <div
                      onClick={() => setActiveSession(open ? null : sess.session_id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "14px 18px", cursor: "pointer",
                      }}
                      onMouseEnter={e => !open && (e.currentTarget.style.background = "rgba(99,102,241,.05)")}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{
                        width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                        background: "rgba(99,102,241,.15)", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 18,
                      }}>📅</div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.txt }}>{sess.label}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: tm.color, background: tm.bg, padding: "2px 8px", borderRadius: 9999 }}>
                            {sess.term}
                          </span>
                          <span style={{ fontSize: 11, color: C.muted }}>
                            {new Date(sess.session_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <span style={{ fontSize: 11, color: "#f87171" }}>−{sess.deduct_absent}pts/absent</span>
                          <span style={{ fontSize: 11, color: "#fbbf24" }}>−{sess.deduct_late}pts/late</span>
                        </div>
                      </div>

                      {/* Quick stats */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        {Object.entries(counts).map(([s, n]) => n > 0 && (
                          <span key={s} style={{
                            fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 9999,
                            background: STATUS_META[s].bg, color: STATUS_META[s].color,
                          }}>{STATUS_META[s].icon} {n}</span>
                        ))}
                      </div>

                      <button
                        onClick={e => { e.stopPropagation(); deleteSession(sess.session_id); }}
                        style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: "4px 6px", borderRadius: 4, flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                        onMouseLeave={e => e.currentTarget.style.color = C.muted}
                        title="Delete session"
                      >🗑</button>

                      <span style={{ color: C.dim, fontSize: 16, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }}>∨</span>
                    </div>

                    {/* Expanded roster */}
                    {open && (
                      <div style={{ borderTop: `1px solid ${C.bdr}`, background: C.bg }}>
                        {enrolled.length === 0 ? (
                          <div style={{ padding: "20px 18px", fontSize: 13, color: C.muted }}>No students enrolled in this course.</div>
                        ) : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr style={{ background: C.bg2 }}>
                                {["Student", "ID", "Status"].map(h => (
                                  <th key={h} style={{ padding: "10px 18px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {enrolled.map((stu, i) => {
                                const rec = getRecord(sess.session_id, stu._uuid);
                                const status = rec ? rec.status : "Present";
                                return (
                                  <tr key={stu._uuid} style={{ borderBottom: `1px solid ${C.bdr}`, background: i % 2 === 0 ? C.bg : C.bg3 }}>
                                    <td style={{ padding: "10px 18px" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <div style={{
                                          width: 28, height: 28, borderRadius: "50%",
                                          background: "rgba(99,102,241,.15)", color: "#6366f1",
                                          fontSize: 11, fontWeight: 900, display: "flex",
                                          alignItems: "center", justifyContent: "center", flexShrink: 0,
                                        }}>{stu.fullName?.charAt(0)}</div>
                                        <span style={{ fontWeight: 600, color: C.txt }}>{stu.fullName}</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: "10px 18px", color: C.muted, fontSize: 11 }}>{stu.id}</td>
                                    <td style={{ padding: "10px 18px" }}>
                                      <StatusPill
                                        value={status}
                                        onChange={s => setStatus(sess.session_id, stu._uuid, s)}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
           SUMMARY VIEW — per-term attendance grade table + sync button
         ══════════════════════════════════════════════════════════════════ */}
      {!loading && viewMode === "summary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Info banner */}
          <div style={{
            background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.3)",
            borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#a5b4fc",
          }}>
            <strong>Attendance Grade Formula:</strong> Starts at 100 — deducted each session a student is <span style={{ color: "#f87171" }}>Absent</span> or <span style={{ color: "#fbbf24" }}>Late</span>. <span style={{ color: STATUS_META.Excused.color }}>Excused</span> absences are not penalized. Click <strong>"Sync to Class Standing"</strong> to push these grades to the Grade tab.
          </div>

          {EXAM_TERMS.map(term => {
            const ts = termSessions(term);
            return (
              <div key={term} style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 12, overflow: "hidden" }}>
                {/* Term header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${C.bdr}`, background: C.bg }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800,
                      color: TERM_META[term]?.color, background: TERM_META[term]?.bg,
                      padding: "3px 12px", borderRadius: 9999,
                    }}>{term}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>
                      {ts.length} session{ts.length !== 1 ? "s" : ""}
                    </span>
                    {ts.length > 0 && (
                      <span style={{ fontSize: 11, color: C.muted }}>
                        (−{ts[0]?.deduct_absent}pts/absent, −{ts[0]?.deduct_late}pts/late)
                      </span>
                    )}
                  </div>
                  <Btn
                    size="sm"
                    disabled={!ts.length || syncing[term]}
                    onClick={() => syncTerm(term)}
                    style={{ fontSize: 11, padding: "5px 12px" }}
                  >
                    {syncing[term] ? "Syncing…" : "🔄 Sync to Class Standing"}
                  </Btn>
                </div>

                {/* Student rows */}
                {enrolled.length === 0 ? (
                  <div style={{ padding: "16px 18px", fontSize: 13, color: C.muted }}>No students enrolled.</div>
                ) : ts.length === 0 ? (
                  <div style={{ padding: "16px 18px", fontSize: 13, color: C.muted }}>No sessions created for {term} yet.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.bg3 }}>
                          <th style={{ padding: "9px 18px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 160 }}>Student</th>
                          {ts.map(s => (
                            <th key={s.session_id} style={{ padding: "9px 12px", textAlign: "center", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", minWidth: 90 }}>
                              <div>{new Date(s.session_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                              <div style={{ fontWeight: 500, color: C.dim, fontSize: 9, textTransform: "none" }}>{s.label?.slice(0, 20)}</div>
                            </th>
                          ))}
                          <th style={{ padding: "9px 16px", textAlign: "center", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 80 }}>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrolled.map((stu, i) => {
                          const grade = gradeFor(stu, term);
                          return (
                            <tr key={stu._uuid} style={{ borderBottom: `1px solid ${C.bdr}`, background: i % 2 === 0 ? C.bg2 : C.bg3 }}>
                              <td style={{ padding: "10px 18px" }}>
                                <div style={{ fontWeight: 600, color: C.txt }}>{stu.fullName}</div>
                                <div style={{ fontSize: 10, color: C.muted }}>{stu.id}</div>
                              </td>
                              {ts.map(sess => {
                                const rec = getRecord(sess.session_id, stu._uuid);
                                const status = rec ? rec.status : "Present";
                                return (
                                  <td key={sess.session_id} style={{ padding: "8px 12px", textAlign: "center" }}>
                                    <StatusPill value={status} onChange={s => setStatus(sess.session_id, stu._uuid, s)} />
                                  </td>
                                );
                              })}
                              <td style={{ padding: "10px 16px", textAlign: "center" }}>
                                <span style={{
                                  fontWeight: 900, fontSize: 15, color: gradeColor(grade),
                                  display: "block",
                                }}>
                                  {grade != null ? `${grade}%` : "—"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
