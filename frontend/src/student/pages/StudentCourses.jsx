/**
 * StudentCourses.jsx — Google Classroom-style layout (mirrors TeacherCourses)
 *
 * Course list → click course → Course Room
 *   Stream     — read course announcements + see upcoming work
 *   Classwork  — all materials & exams grouped by term, click to open
 *   Grades     — full grade report scoped to this course
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import {
  MAT_META, MaterialType, isSubmittable,
  EXAM_TERMS, TERM_META, termFromDate,
} from "../../lib/constants";
import {
  gradeColor, letterGrade, computeTermGrade, csGradePct,
} from "../../lib/helpers";
import {
  normalizeMaterial, normalizeExam, normalizeWorkSub,
} from "../../lib/normalizers";
import { Badge, Btn, StatCard } from "../../components/ui";
import TopBar   from "../../components/TopBar";
import { TypeBadge } from "../components/TypeBadge";
import MaterialDetailView from "../components/MaterialDetailView";
import StudentAttendanceTab from "../components/StudentAttendanceTab";
import ExamTaker          from "../components/ExamTaker";

// ─── Dark theme tokens (matches rest of app) ──────────────────────────────────
const C = {
  bg:    "#0f172a",
  bg2:   "#1e293b",
  bdr:   "#334155",
  txt:   "#e2e8f0",
  muted: "#64748b",
  dim:   "#475569",
};

function timeAgo(ts) {
  const s = (Date.now() - new Date(ts)) / 1000;
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const BANNER_COLORS = [
  "#1565c0","#6a1b9a","#00695c","#e65100","#1b5e20","#880e4f","#0277bd","#4527a0",
];
const bannerColor = (code = "") =>
  BANNER_COLORS[code.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % BANNER_COLORS.length];

// ═══════════════════════════════════════════════════════════════════════════════
//  STREAM TAB — read-only feed of course announcements
// ═══════════════════════════════════════════════════════════════════════════════
function StreamTab({ course, upcoming }) {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!course._uuid) return;
    setLoading(true);
    supabase.from("announcements").select("*")
      .eq("course_id", course._uuid)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => { setPosts(data || []); setLoading(false); });

    const sub = supabase.channel(`s-course-ann-${course._uuid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements",
        filter: `course_id=eq.${course._uuid}` }, () => {
        supabase.from("announcements").select("*").eq("course_id", course._uuid)
          .order("pinned",{ascending:false}).order("created_at",{ascending:false})
          .then(({ data }) => setPosts(data || []));
      }).subscribe();
    return () => sub.unsubscribe();
  }, [course._uuid]);

  return (
    <div style={{ display: "flex", gap: 20, padding: "24px 0", alignItems: "flex-start" }}>

      {/* LEFT — upcoming sidebar */}
      <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.txt, marginBottom: 10 }}>Upcoming</div>
          {upcoming.length === 0
            ? <div style={{ fontSize: 12, color: C.muted }}>No work due soon.</div>
            : upcoming.slice(0, 5).map(m => (
              <div key={m.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.bdr}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{m.title}</div>
                <div style={{ fontSize: 11, color: "#f87171", fontWeight: 600 }}>
                  Due {new Date(m.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* RIGHT — announcements feed */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Loading…</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📢</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.txt, marginBottom: 6 }}>No announcements yet</div>
            <div style={{ fontSize: 13 }}>Your teacher hasn't posted anything here yet.</div>
          </div>
        ) : posts.map(p => (
          <div key={p.id} style={{ background: C.bg2, border: `1px solid ${p.pinned ? "#6366f1" : C.bdr}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(99,102,241,.2)", color: "#a5b4fc", fontSize: 15, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {p.author_name?.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.txt }}>{p.author_name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{timeAgo(p.created_at)}</div>
              </div>
              {p.pinned && <span style={{ fontSize: 10, fontWeight: 800, color: "#a5b4fc", background: "rgba(99,102,241,.15)", padding: "2px 8px", borderRadius: 9999, flexShrink: 0 }}>📌 Pinned</span>}
            </div>
            <div style={{ padding: "0 18px 16px 70px" }}>
              {p.title && <div style={{ fontWeight: 800, fontSize: 14, color: C.txt, marginBottom: 6 }}>{p.title}</div>}
              <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{p.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CLASSWORK TAB — flat list grouped by term (read-only for student)
// ═══════════════════════════════════════════════════════════════════════════════
function ClassworkTab({ course, mats, exams, examSubmissions, user, onOpenMaterial, onTakeExam, workSubmissions }) {
  const [collapsed, setCollapsed] = useState({});

  const courseMats  = mats.filter(m => m.courseId === course.id);
  const courseExams = exams.filter(e => e.courseId === course.id);

  const TERM_ORDER = { Prelim: 0, Midterm: 1, "Semi-Final": 2, Finals: 3, "No topic": 4 };
  const grouped    = {};
  const termKey    = t => EXAM_TERMS.includes(t) ? t : "No topic";

  courseMats.forEach(m  => { const k = termKey(m.term);  if (!grouped[k]) grouped[k] = []; grouped[k].push({ ...m,  _kind: "material" }); });
  courseExams.forEach(e => { const k = termKey(e.term);  if (!grouped[k]) grouped[k] = []; grouped[k].push({ ...e,  _kind: "exam"     }); });

  const sortedGroups = Object.keys(grouped)
    .sort((a, b) => (TERM_ORDER[a] ?? 99) - (TERM_ORDER[b] ?? 99))
    .map(term => ({
      term,
      items: grouped[term].sort((a, b) => {
        const da = a.dueDate || a.date || "";
        const db = b.dueDate || b.date || "";
        return db.localeCompare(da);
      }),
    }));

  const toggleCollapse = t => setCollapsed(p => ({ ...p, [t]: !p[t] }));

  const formatDue = (item) => {
    if (item._kind === "exam") {
      if (!item.date) return null;
      const d = new Date(item.date);
      return item.startTime
        ? `${d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}, ${item.startTime}`
        : d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
    }
    if (!item.dueDate) return null;
    const d = new Date(item.dueDate), now = new Date();
    const ms = d - now;
    if (ms > 0 && ms < 86400000)  return "Due Tomorrow";
    if (ms > 0 && ms < 172800000) return `Due ${d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;
    return `Due ${d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;
  };

  const getSubmissionStatus = (item) => {
    if (item._kind === "exam") {
      const sub = examSubmissions.find(s => s.examId === item.id && s.studentId === user.id);
      if (sub) return { label: `${sub.score}/${sub.totalPoints} pts`, color: sub.score/sub.totalPoints >= 0.75 ? "#34d399" : "#f87171", taken: true };
      return null;
    }
    if (isSubmittable(item.type)) {
      const sub = workSubmissions.find(s => s.materialId === item.id);
      if (!sub) return null;
      if (sub.status === "GRADED") return { label: `${sub.grade ?? "?"}%`, color: gradeColor(sub.grade ?? 0), taken: true };
      if (sub.status === "SUBMITTED" || sub.status === "LATE") return { label: "Submitted", color: "#34d399", taken: true };
    }
    return null;
  };

  const itemIcon = (item) => {
    if (item._kind === "exam") {
      const isQuiz = item.examType === "Quiz";
      return (
        <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          background: isQuiz ? "rgba(236,72,153,.25)" : "rgba(245,158,11,.25)",
          color:      isQuiz ? "#f472b6" : "#fbbf24" }}>
          📝
        </div>
      );
    }
    const meta = MAT_META[item.type] || MAT_META[MaterialType.LECTURE];
    const hasDeadline = item.dueDate && new Date(item.dueDate) > new Date(Date.now() - 86400000);
    return (
      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
        background: hasDeadline ? "rgba(245,158,11,.25)" : meta.bg,
        color:      hasDeadline ? "#fbbf24" : meta.color }}>
        {meta.icon}
      </div>
    );
  };

  if (sortedGroups.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "70px 20px", color: C.muted }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>📚</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.txt, marginBottom: 8 }}>No classwork yet</div>
        <div style={{ fontSize: 13 }}>Your teacher hasn't posted any materials or exams yet.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 0" }}>
      {/* Top bar — collapse all */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button
          onClick={() => setCollapsed(
            sortedGroups.reduce((a, { term }) => ({ ...a, [term]: !Object.values(collapsed).every(v => v) }), {})
          )}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "none", border: `1px solid ${C.bdr}`, borderRadius: 9999, color: "#6366f1", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          ✕ {Object.values(collapsed).every(v => v) ? "Expand all" : "Collapse all"}
        </button>
      </div>

      {sortedGroups.map(({ term, items }) => (
        <div key={term} style={{ marginBottom: 24 }}>
          {/* Term header */}
          <div
            onClick={() => toggleCollapse(term)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", cursor: "pointer", borderBottom: `2px solid ${C.bdr}`, marginBottom: collapsed[term] ? 0 : 2 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.txt }}>{term}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{items.length} item{items.length !== 1 ? "s" : ""}</span>
              <span style={{ fontSize: 18, color: C.dim, transform: collapsed[term] ? "rotate(-90deg)" : "rotate(0)", transition: "transform .2s" }}>∧</span>
            </div>
          </div>

          {!collapsed[term] && items.map((item, idx) => {
            const dueText  = formatDue(item);
            const subStatus = getSubmissionStatus(item);
            const isLate    = item._kind === "material" && item.dueDate && new Date(item.dueDate) < new Date();
            const isExam    = item._kind === "exam";
            const isQuiz    = isExam && item.examType === "Quiz";
            const taken     = isExam && examSubmissions.find(s => s.examId === item.id && s.studentId === user.id);
            const canTake   = isExam && !taken;

            return (
              <div
                key={item.id || item._uuid || idx}
                onClick={() => isExam ? (canTake ? onTakeExam(item) : null) : onOpenMaterial(item)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: `1px solid ${C.bdr}`, cursor: (isExam && !canTake) ? "default" : "pointer", background: C.bg2, transition: "background .1s" }}
                onMouseEnter={e => { if (!isExam || canTake) e.currentTarget.style.background = "rgba(99,102,241,.06)"; }}
                onMouseLeave={e => e.currentTarget.style.background = C.bg2}>

                {itemIcon(item)}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                    {isExam ? (
                      <>
                        <span style={{ fontSize: 10, fontWeight: 800, color: isQuiz?"#f472b6":"#fbbf24", background: isQuiz?"rgba(236,72,153,.2)":"rgba(245,158,11,.2)", padding:"1px 7px", borderRadius:9999 }}>
                          {isQuiz ? "Quiz" : "Exam"}
                        </span>
                        {item.totalPoints && <span style={{ fontSize: 11, color: C.muted }}>{item.totalPoints} pts</span>}
                        {item.startTime && <span style={{ fontSize: 11, color: "#34d399" }}>🕐 {item.startTime}–{item.endTime}</span>}
                      </>
                    ) : (
                      <>
                        <TypeBadge type={item.type} />
                        {item.points && <span style={{ fontSize: 11, color: C.muted }}>{item.points} pts</span>}
                      </>
                    )}
                  </div>
                </div>

                {/* Submission status badge */}
                {subStatus && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: subStatus.color, background: `${subStatus.color}22`, padding: "2px 8px", borderRadius: 9999, flexShrink: 0, border: `1px solid ${subStatus.color}44` }}>
                    ✓ {subStatus.label}
                  </span>
                )}

                {/* Due date */}
                {dueText && !subStatus && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: isLate ? "#f87171" : C.muted, flexShrink: 0, minWidth: 110, textAlign: "right" }}>
                    {dueText}
                  </span>
                )}

                {/* Exam action */}
                {isExam && canTake && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,.15)", padding: "4px 10px", borderRadius: 6, flexShrink: 0, border: "1px solid rgba(99,102,241,.3)" }}>
                    Take →
                  </span>
                )}
                {isExam && taken && !subStatus && (
                  <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>Completed</span>
                )}

                {!isExam && <div style={{ width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 16 }}>›</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GRADES TAB — per-course grade breakdown (from StudentGrades, scoped to one)
// ═══════════════════════════════════════════════════════════════════════════════
function GradesTab({ course, user, examSubmissions }) {
  const [allExams,       setAllExams]       = useState([]);
  const [allMaterials,   setAllMaterials]   = useState([]);
  const [classStandings, setClassStandings] = useState([]);
  const [workSubs,       setWorkSubs]       = useState([]);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    if (!course._uuid || !user._uuid) return;
    setLoading(true);
    (async () => {
      const [eRes, qRes, mRes, csRes, wsRes] = await Promise.all([
        supabase.from("exams").select("*").eq("course_id", course._uuid),
        supabase.from("exam_questions").select("*"),
        supabase.from("materials").select("material_id,course_id,material_type,term,total_points,title").eq("course_id", course._uuid),
        supabase.from("class_standing").select("*").eq("student_id", user._uuid).eq("course_id", course._uuid),
        supabase.from("work_submissions").select("material_id,score,status").eq("student_id", user._uuid).eq("status", "Graded"),
      ]);
      if (eRes.data) setAllExams(eRes.data.map(r => ({
        id: r.exam_id, courseId: course.id, title: r.title, term: r.term,
        examType: r.exam_type || "Exam", totalPoints: r.total_points,
        questions: (qRes.data || []).filter(q => q.exam_id === r.exam_id),
      })));
      setAllMaterials(mRes.data || []);
      setClassStandings((csRes.data || []).map(r => ({
        courseUuid: r.course_id, term: r.term,
        project: r.project, recitation: r.recitation, attendance: r.attendance,
      })));
      setWorkSubs(wsRes.data || []);
      setLoading(false);
    })();
  }, [course._uuid, course.id, user._uuid]);

  const cellCls = v => v == null ? "" : v >= 90 ? "grade-cell-high" : v >= 75 ? "grade-cell-pass" : v >= 60 ? "grade-cell-warn" : "grade-cell-fail";

  const termData = {};
  EXAM_TERMS.forEach(term => {
    const cwMats = allMaterials.filter(m => m.course_id === course._uuid && m.term === term && (m.material_type === "Lab" || m.material_type === "Assignment"));
    const cwSubs = cwMats.map(m => { const w = workSubs.find(w => w.material_id === m.material_id); return w ? w.score : null; }).filter(x => x != null);
    const cw = cwSubs.length > 0 ? Math.round(cwSubs.reduce((a, b) => a + b, 0) / cwSubs.length) : null;
    const cwDetail = cwMats.map(m => ({ title: m.title, score: workSubs.find(w => w.material_id === m.material_id)?.score ?? null }));

    const csEntry = classStandings.find(cs => cs.courseUuid === course._uuid && cs.term === term) || null;
    const cs = csGradePct(csEntry);

    const termExams = allExams.filter(ex => ex.courseId === course.id && ex.term === term);
    const subs      = examSubmissions.filter(s => s.studentId === user.id && s.courseId === course.id);
    const examOnly  = termExams.filter(ex => (ex.examType || "Exam") === "Exam");
    const quizOnly  = termExams.filter(ex => ex.examType === "Quiz");
    const toAvg     = arr => { const p = arr.map(ex => { const s = subs.find(s => s.examId === ex.id); return s ? Math.round((s.score / s.totalPoints) * 100) : null; }).filter(x => x != null); return p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : null; };
    const exam = toAvg(examOnly);
    const quiz = toAvg(quizOnly);
    const examDetail = termExams.map(ex => { const s = subs.find(s => s.examId === ex.id); return { title: ex.title, examType: ex.examType || "Exam", pct: s ? Math.round((s.score / s.totalPoints) * 100) : null, score: s?.score ?? null, total: ex.totalPoints }; });
    termData[term] = { cw, cwDetail, csEntry, cs, exam, quiz, examDetail, grade: computeTermGrade({ cw, cs, exam, quiz }) };
  });

  const tg = EXAM_TERMS.map(t => termData[t].grade).filter(x => x != null);
  const overall = tg.length > 0 ? Math.round(tg.reduce((a, b) => a + b, 0) / tg.length) : null;
  const status  = overall == null ? "Pending" : overall >= 75 ? "Pass" : "Fail";

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading grades…</div>;

  return (
    <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Overall grade card */}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 160, background: status === "Pass" ? "rgba(16,185,129,.1)" : overall == null ? C.bg2 : "rgba(239,68,68,.1)", border: `1px solid ${status === "Pass" ? "#34d399" : overall == null ? C.bdr : "#f87171"}`, borderRadius: 12, padding: "20px 16px", textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: overall != null ? gradeColor(overall) : C.muted, lineHeight: 1 }}>{overall != null ? `${overall}%` : "—"}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Overall Grade</div>
          {overall != null && <div style={{ fontSize: 13, fontWeight: 800, color: gradeColor(overall), marginTop: 4 }}>{letterGrade(overall)}</div>}
          <Badge color={status === "Pass" ? "success" : status === "Fail" ? "danger" : "default"} style={{ marginTop: 8, display: "inline-block" }}>{status}</Badge>
        </div>

        {/* Per-term overview */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {EXAM_TERMS.map(term => {
            const g  = termData[term].grade;
            const tm = TERM_META[term];
            return (
              <div key={term} style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: tm.color, background: tm.bg, padding: "2px 8px", borderRadius: 9999, display: "inline-block", marginBottom: 10 }}>{term}</span>
                <div style={{ fontSize: 22, fontWeight: 900, color: g != null ? gradeColor(g) : C.muted }}>{g != null ? `${g}%` : "—"}</div>
                {g != null && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{letterGrade(g)}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Formula strip */}
      <div style={{ display: "flex", gap: 12, padding: "8px 12px", background: C.bg2, borderRadius: 8, border: `1px solid ${C.bdr}`, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Formula</span>
        {[["📚 Course Work","30%","#ede9fe","#6366f1"],["✏ Quizzes","30%","#fce7f3","#ec4899"],["🏆 Class Standing","30%","#d1fae5","#10b981"],["📝 Exams","40%","#fef3c7","#f59e0b"]].map(([lbl,pct,bg,col]) => (
          <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
            <span style={{ background: bg, color: col, fontWeight: 800, padding: "2px 7px", borderRadius: 9999 }}>{pct}</span>
            <span style={{ color: C.muted }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* Per-term detail cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
        {EXAM_TERMS.map(term => {
          const td = termData[term];
          const tm = TERM_META[term];
          return (
            <div key={term} style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Term header */}
              <div style={{ background: C.bg, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.bdr}` }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: tm.color, background: tm.bg, padding: "3px 10px", borderRadius: 9999 }}>{term}</span>
                {td.grade != null
                  ? <span className={cellCls(td.grade)} style={{ fontWeight: 900, fontSize: 15, padding: "3px 10px", borderRadius: 6 }}>{td.grade}%</span>
                  : <span style={{ fontSize: 12, color: C.muted }}>Pending</span>}
              </div>

              {/* Component rows */}
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "📚 Course Work", pct: td.cw, weight: "30%", detail: td.cwDetail?.map(d => `${d.title}: ${d.score ?? "—"}`).join(" · ") },
                  { label: "✏ Quizzes",      pct: td.quiz, weight: "30%", detail: td.examDetail?.filter(e => e.examType === "Quiz").map(e => `${e.title}: ${e.pct != null ? e.pct+"%" : "—"}`).join(" · ") },
                  { label: "🏆 Class Standing", pct: td.cs, weight: "30%", detail: td.csEntry ? `Project: ${td.csEntry.project ?? "—"} · Recitation: ${td.csEntry.recitation ?? "—"} · Attendance: ${td.csEntry.attendance ?? "—"}` : null },
                  { label: "📝 Exams",       pct: td.exam, weight: "40%", detail: td.examDetail?.filter(e => e.examType !== "Quiz").map(e => `${e.title}: ${e.pct != null ? e.pct+"%" : "—"}`).join(" · ") },
                ].map(({ label, pct, weight, detail }) => (
                  <div key={label}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: detail ? 4 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 9, color: C.dim, background: "rgba(148,163,184,.12)", padding: "1px 5px", borderRadius: 9999 }}>{weight}</span>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 14, color: pct != null ? gradeColor(pct) : C.muted }}>
                        {pct != null ? `${pct}%` : "—"}
                      </span>
                    </div>
                    {detail && <div style={{ fontSize: 10, color: C.dim, paddingLeft: 4, lineHeight: 1.5 }}>{detail}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COURSE ROOM — full screen with tab bar
// ═══════════════════════════════════════════════════════════════════════════════
function CourseRoom({ course, user, mats, exams, examSubmissions, workSubmissions, onBack, onOpenMaterial, onTakeExam }) {
  const [tab, setTab] = useState("stream");

  const TABS = [
    { id: "stream",     label: "Dashboard"  },
    { id: "classwork",  label: "Classwork"  },
    { id: "attendance", label: "Attendance" },
    { id: "grades",     label: "Grades"     },
  ];

  const bg = bannerColor(course.code);

  // Upcoming: submittable materials with future due dates
  const upcoming = mats
    .filter(m => m.courseId === course.id && m.dueDate && new Date(m.dueDate) > new Date())
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: C.bg }}>

      {/* Header */}
      <div style={{ background: C.bg2, borderBottom: `1px solid ${C.bdr}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px", borderBottom: `1px solid #1e293b` }}>
          <button onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", border: `1px solid ${C.bdr}`, borderRadius: 6, background: C.bg, cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.txt, fontFamily: "inherit" }}
            onMouseEnter={e => e.currentTarget.style.background = C.bdr}
            onMouseLeave={e => e.currentTarget.style.background = C.bg}>
            ← My Courses
          </button>
          <span style={{ color: C.dim }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>{course.code}: {course.name}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <span style={{ fontSize: 11, color: C.muted }}>{course.teacherName && `👩‍🏫 ${course.teacherName}`}</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, padding: "0 20px" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "12px 18px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 14, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? "#6366f1" : C.muted,
                borderBottom: `3px solid ${tab === t.id ? "#6366f1" : "transparent"}`,
                marginBottom: -1, transition: "color .15s" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "stream" && (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
            {/* Course banner */}
            <div style={{ borderRadius: 8, overflow: "hidden", margin: "20px 0 0", position: "relative", height: 180, background: bg, display: "flex", alignItems: "flex-end" }}>
              <div style={{ padding: "20px 28px", zIndex: 1 }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", textShadow: "0 1px 4px rgba(0,0,0,.3)", marginBottom: 5 }}>
                  {course.code}: {course.name}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", fontWeight: 500 }}>
                  {course.schedule}{course.yearLevel ? ` · ${course.yearLevel}` : ""}{course.semester ? ` · ${course.semester}` : ""}
                  {course.teacherName ? ` · ${course.teacherName}` : ""}
                </div>
              </div>
              <div style={{ position: "absolute", bottom: -40, right: 40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,.07)" }} />
              <div style={{ position: "absolute", top: -20, right: 140, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,.04)" }} />
            </div>
            <StreamTab course={course} upcoming={upcoming} />
          </div>
        )}

        {tab === "classwork" && (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
            <ClassworkTab
              course={course} user={user} mats={mats} exams={exams}
              examSubmissions={examSubmissions} workSubmissions={workSubmissions}
              onOpenMaterial={onOpenMaterial} onTakeExam={onTakeExam}
            />
          </div>
        )}

        {tab === "attendance" && (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
            <StudentAttendanceTab course={course} user={user} />
          </div>
        )}

        {tab === "grades" && (
          <div style={{ padding: "0 24px" }}>
            <GradesTab course={course} user={user} examSubmissions={examSubmissions} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function StudentCourses({ user, courses, onSubmitExam, examSubmissions, enrollments }) {
  const myEnrollments = enrollments.filter(e => e.studentId === user.id);
  const myCourses     = myEnrollments
    .map(e => ({ ...courses.find(c => c.id === e.courseId) || {}, ...e }))
    .filter(c => c.id);

  const [allMaterials,    setAllMaterials]    = useState([]);
  const [allExams,        setAllExams]        = useState([]);
  const [workSubmissions, setWorkSubmissions] = useState([]);

  const [selCourse,        setSelCourse]        = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [selectedExam,     setSelectedExam]     = useState(null);

  // Load materials + exams
  useEffect(() => {
    const uuidToCode = {};
    courses.forEach(c => { if (c._uuid) uuidToCode[c._uuid] = c.id; });
    const uuids = myCourses.map(c => c._uuid).filter(Boolean);
    if (!uuids.length) return;

    Promise.all([
      supabase.from("materials").select("*").in("course_id", uuids).eq("is_published", true),
      supabase.from("exams").select("*").in("course_id", uuids).eq("is_published", true),
      supabase.from("exam_questions").select("*"),
    ]).then(([mRes, eRes, qRes]) => {
      if (mRes.data) setAllMaterials(mRes.data.map(r => normalizeMaterial({ ...r, courses: { course_code: uuidToCode[r.course_id] || r.course_id } })));
      if (eRes.data) setAllExams(eRes.data.map(r => normalizeExam({ ...r, courses: { course_code: uuidToCode[r.course_id] || r.course_id }, exam_questions: (qRes.data || []).filter(q => q.exam_id === r.exam_id) })));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, courses]);

  // Load + realtime work submissions
  useEffect(() => {
    if (!user?._uuid) return;
    supabase.from("work_submissions").select("*").eq("student_id", user._uuid)
      .then(({ data }) => { if (data) setWorkSubmissions(data.map(r => normalizeWorkSub(r))); });

    const ch = supabase.channel(`stu-ws-${user._uuid}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "work_submissions", filter: `student_id=eq.${user._uuid}` },
        payload => setWorkSubmissions(prev => prev.map(s => s.materialId === payload.new.material_id ? normalizeWorkSub(payload.new) : s)))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?._uuid]);

  const handleSubmissionSaved = useCallback(sub => {
    setWorkSubmissions(prev => {
      const i = prev.findIndex(s => s.materialId === sub.materialId);
      if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], ...sub }; return n; }
      return [...prev, sub];
    });
  }, []);

  // ── ExamTaker ──────────────────────────────────────────────────────────────
  if (selectedExam) {
    return (
      <ExamTaker
        exam={selectedExam}
        course={myCourses.find(c => c.id === selectedExam.courseId)}
        user={user}
        onBack={() => setSelectedExam(null)}
        onSubmit={sub => { onSubmitExam(sub); setSelectedExam(null); }}
      />
    );
  }

  // ── Material detail ────────────────────────────────────────────────────────
  if (selectedMaterial) {
    return (
      <MaterialDetailView
        material={selectedMaterial}
        course={myCourses.find(c => c.id === selectedMaterial.courseId)}
        onBack={() => setSelectedMaterial(null)}
        user={user}
        existingSubmission={workSubmissions.find(s => s.materialId === selectedMaterial.id)}
        onSubmissionSaved={handleSubmissionSaved}
      />
    );
  }

  // ── Course Room ────────────────────────────────────────────────────────────
  if (selCourse) {
    return (
      <CourseRoom
        course={selCourse} user={user}
        mats={allMaterials} exams={allExams}
        examSubmissions={examSubmissions}
        workSubmissions={workSubmissions}
        onBack={() => setSelCourse(null)}
        onOpenMaterial={m => setSelectedMaterial(m)}
        onTakeExam={e => setSelectedExam(e)}
      />
    );
  }

  // ── Course list ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      <TopBar
        title="My Courses"
        subtitle={`${myCourses.length} enrolled course${myCourses.length !== 1 ? "s" : ""} — click to open`}
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {myCourses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Not enrolled in any courses</div>
            <div style={{ fontSize: 13 }}>Contact your department admin to get enrolled.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myCourses.map(course => {
              const accent     = bannerColor(course.code);
              const courseMats = allMaterials.filter(m => m.courseId === course.id).length;
              const pending    = allMaterials.filter(m => m.courseId === course.id && m.dueDate && new Date(m.dueDate) > new Date()).length;
              const isFinished = course.status === "Finished";

              return (
                <div
                  key={course.id}
                  onClick={() => setSelCourse(course)}
                  style={{ display: "flex", alignItems: "center", gap: 0, background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "border-color .15s, background .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = "rgba(99,102,241,.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.bdr; e.currentTarget.style.background = C.bg2; }}>

                  {/* Colored left accent bar */}
                  <div style={{ width: 5, alignSelf: "stretch", background: accent, flexShrink: 0 }} />

                  {/* Course code */}
                  <div style={{ width: 100, padding: "16px 14px", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", borderRight: `1px solid ${C.bdr}` }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: C.txt, letterSpacing: "-0.01em" }}>{course.code}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: accent, background: `${accent}22`, padding: "2px 7px", borderRadius: 9999, display: "inline-block", width: "fit-content" }}>
                      {isFinished ? "Finished" : "Ongoing"}
                    </div>
                  </div>

                  {/* Course name + meta */}
                  <div style={{ flex: 1, padding: "14px 18px", minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.txt, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {course.name}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      {course.teacherName && <span style={{ fontSize: 11, color: C.muted }}>👩‍🏫 {course.teacherName}</span>}
                      {course.schedule    && <span style={{ fontSize: 11, color: C.muted }}>🕐 {course.schedule}</span>}
                      {course.yearLevel   && <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "rgba(148,163,184,.12)", padding: "2px 7px", borderRadius: 9999 }}>{course.yearLevel}</span>}
                      {course.semester    && <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "rgba(148,163,184,.12)", padding: "2px 7px", borderRadius: 9999 }}>{course.semester}</span>}
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "rgba(148,163,184,.12)", padding: "2px 7px", borderRadius: 9999 }}>{course.units} units</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: 0, flexShrink: 0, borderLeft: `1px solid ${C.bdr}` }}>
                    {[
                      { icon: "📄", value: courseMats, label: "Materials", color: "#34d399" },
                      { icon: "⏰", value: pending,    label: "Upcoming",  color: pending > 0 ? "#f87171" : "#64748b" },
                      { icon: "📊", label: "Grades",   value: course.grade != null ? `${course.grade}%` : "—", color: course.grade != null ? gradeColor(course.grade) : "#64748b" },
                    ].map(({ icon, value, label, color }, i) => (
                      <div key={label} style={{ width: 80, padding: "14px 10px", textAlign: "center", borderRight: i < 2 ? `1px solid ${C.bdr}` : "none" }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Arrow */}
                  <div style={{ width: 36, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, fontSize: 18, flexShrink: 0 }}>›</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
