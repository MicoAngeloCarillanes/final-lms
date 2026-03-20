/**
 * TeacherCourses.jsx — Google Classroom-style layout
 *
 * Course list → click course → Course Room (full screen takeover)
 *   Stream     — announcements scoped to this course, layout mirrors Google Classroom
 *   Classwork  — all materials + exams in a flat list grouped by term (image 2 layout)
 *                clicking any row opens that material/exam in full detail
 *   People     — grade management per student
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import {
  MAT_META, MaterialType, isSubmittable,
  EXAM_TERMS, TERM_META, QT_META, termFromDate,
} from "../../lib/constants";
import { safeFileName, gradeColor, computeTermGrade, csGradePct } from "../../lib/helpers";
import { normalizeMaterial, normalizeExam } from "../../lib/normalizers";
import { uploadFileToStorage } from "../../lib/storageHelpers";
import { Badge, Btn, Input, Sel, FF, StatCard, Toast } from "../../components/ui";
import LMSGrid      from "../../components/LMSGrid";
import TopBar       from "../../components/TopBar";
import { TypeBadge } from "../../student/components/TypeBadge";
import ExamBuilder               from "../components/ExamBuilder";
import TeacherMaterialDetailView from "../components/TeacherMaterialDetailView";
import ClassStandingModal        from "../components/ClassStandingModal";
import TeacherAttendanceTab      from "../components/TeacherAttendanceTab";
import { useCurrentTerm, fetchTermSettings, termFromDateWithSettings } from "../../lib/termSettingsHelper";

// ─── Color palette (matches existing dark theme) ──────────────────────────────
const C = {
  bg:    "#0f172a",
  bg2:   "#1e293b",
  bdr:   "#334155",
  txt:   "#e2e8f0",
  muted: "#64748b",
  dim:   "#475569",
};

// ─── Time helper ──────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const s = (Date.now() - new Date(ts)) / 1000;
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// course banner gradient pool — cycles by course code hash
const BANNERS = [
  "linear-gradient(135deg,#1565c0 0%,#0d47a1 100%)",
  "linear-gradient(135deg,#6a1b9a 0%,#4a148c 100%)",
  "linear-gradient(135deg,#00695c 0%,#004d40 100%)",
  "linear-gradient(135deg,#e65100 0%,#bf360c 100%)",
  "linear-gradient(135deg,#1b5e20 0%,#33691e 100%)",
  "linear-gradient(135deg,#880e4f 0%,#4a148c 100%)",
];
const bannerFor = (code = "") =>
  BANNERS[code.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % BANNERS.length];

// ═══════════════════════════════════════════════════════════════════════════════
//  STREAM TAB — Google Classroom-style announcements feed
// ═══════════════════════════════════════════════════════════════════════════════
function StreamTab({ course, user }) {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [body,    setBody]    = useState("");
  const [title,   setTitle]   = useState("");
  const [posting, setPosting] = useState(false);
  const [open,    setOpen]    = useState(false);

  useEffect(() => {
    if (!course._uuid) return;
    setLoading(true);
    supabase.from("announcements").select("*")
      .eq("course_id", course._uuid)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => { setPosts(data || []); setLoading(false); });

    const sub = supabase.channel(`course-ann-${course._uuid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements",
        filter: `course_id=eq.${course._uuid}` }, () => {
        supabase.from("announcements").select("*").eq("course_id", course._uuid)
          .order("pinned",{ ascending:false }).order("created_at",{ ascending:false })
          .then(({ data }) => setPosts(data || []));
      }).subscribe();
    return () => sub.unsubscribe();
  }, [course._uuid]);

  const post = async () => {
    if (!body.trim()) return;
    setPosting(true);
    const payload = {
      author_id:   user._uuid,
      author_name: user.fullName,
      author_role: "teacher",
      title:       title.trim() || `${course.code} — ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})}`,
      body:        body.trim(),
      category:    "Academic",
      pinned:      false,
      course_id:   course._uuid,
    };
    const { data, error } = await supabase.from("announcements").insert(payload).select().single();
    if (!error && data) setPosts(prev => [data, ...prev]);
    setTitle(""); setBody(""); setOpen(false); setPosting(false);
  };

  const del = async (id) => {
    await supabase.from("announcements").delete().eq("id", id);
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const pin = async (ann) => {
    const { data } = await supabase.from("announcements").update({ pinned: !ann.pinned }).eq("id", ann.id).select().single();
    if (data) setPosts(prev => prev.map(p => p.id === data.id ? data : p));
  };

  return (
    <div style={{ display: "flex", gap: 20, padding: "24px 0", alignItems: "flex-start" }}>

      {/* LEFT — upcoming sidebar (mirrors GClassroom left panel) */}
      <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.txt, marginBottom: 10 }}>Upcoming</div>
          <div style={{ fontSize: 12, color: C.muted }}>No work due soon.</div>
        </div>
      </div>

      {/* RIGHT — announcements feed */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* "New announcement" button — like GClassroom */}
        {!open && (
          <button onClick={() => setOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#6366f1"}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.bdr}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(99,102,241,.2)", color: "#a5b4fc", fontSize: 14, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {user.fullName?.charAt(0)}
            </div>
            <span style={{ fontSize: 13, color: C.muted }}>Announce something to your class…</span>
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,.12)", padding: "5px 12px", borderRadius: 9999, border: "1px solid rgba(99,102,241,.3)", flexShrink: 0 }}>
              ✏ New announcement
            </span>
          </button>
        )}

        {/* Compose form */}
        {open && (
          <div style={{ background: C.bg2, border: "1px solid #6366f1", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,.3)" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.bdr}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(99,102,241,.2)", color: "#a5b4fc", fontSize: 14, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {user.fullName?.charAt(0)}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>{user.fullName}</span>
              </div>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)…" style={{ marginBottom: 8, background: C.bg }} />
              <textarea
                autoFocus value={body} onChange={e => setBody(e.target.value)}
                placeholder={`Share something with ${course.code}…`} rows={4}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", color: C.txt, resize: "none", outline: "none", lineHeight: 1.6 }}
                onFocus={e => e.target.style.borderColor = "#6366f1"}
                onBlur={e  => e.target.style.borderColor = C.bdr}
              />
            </div>
            <div style={{ padding: "10px 18px", display: "flex", justifyContent: "flex-end", gap: 8, background: C.bg }}>
              <Btn variant="secondary" size="sm" onClick={() => { setOpen(false); setTitle(""); setBody(""); }}>Cancel</Btn>
              <Btn size="sm" onClick={post} disabled={posting || !body.trim()}>
                {posting ? "Posting…" : "Post"}
              </Btn>
            </div>
          </div>
        )}

        {/* Feed */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Loading…</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📢</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.txt, marginBottom: 6 }}>No announcements yet</div>
            <div style={{ fontSize: 13 }}>Use the box above to share something with your class.</div>
          </div>
        ) : posts.map(p => (
          <div key={p.id} style={{ background: C.bg2, border: `1px solid ${p.pinned ? "#6366f1" : C.bdr}`, borderRadius: 10, overflow: "hidden" }}>
            {/* Post header */}
            <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(99,102,241,.2)", color: "#a5b4fc", fontSize: 15, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {p.author_name?.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.txt }}>{p.author_name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{timeAgo(p.created_at)}</div>
              </div>
              {p.pinned && <span style={{ fontSize: 10, fontWeight: 800, color: "#a5b4fc", background: "rgba(99,102,241,.15)", padding: "2px 8px", borderRadius: 9999 }}>📌 Pinned</span>}
              {p.author_id === user._uuid && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => pin(p)}
                    title={p.pinned ? "Unpin" : "Pin"}
                    style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: "3px 6px", borderRadius: 4 }}
                    onMouseEnter={e => e.currentTarget.style.color = "#a5b4fc"}
                    onMouseLeave={e => e.currentTarget.style.color = C.muted}>
                    📌
                  </button>
                  <button onClick={() => del(p.id)}
                    style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: "3px 6px", borderRadius: 4 }}
                    onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                    onMouseLeave={e => e.currentTarget.style.color = C.muted}>
                    ×
                  </button>
                </div>
              )}
            </div>
            {/* Post body */}
            <div style={{ padding: "0 18px 16px 70px" }}>
              {p.title && p.title !== `${course.code} — ${new Date(p.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}` && (
                <div style={{ fontWeight: 800, fontSize: 14, color: C.txt, marginBottom: 6 }}>{p.title}</div>
              )}
              <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{p.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CLASSWORK TAB — flat list grouped by term, GClassroom style (image 2)
// ═══════════════════════════════════════════════════════════════════════════════
function ClassworkTab({
  course, user, mats, exams,
  onOpenMaterial, onBuildExam, onAddMat,
  enrollments,
}) {
  const [createMenu,  setCreateMenu]  = useState(false);
  const [createType,  setCreateType]  = useState(null);  // "material" | "exam"
  const autoTerm = useCurrentTerm();
  const [matF,        setMatF]        = useState({ title: "", type: "Lecture", term: termFromDate(), description: "", dueDate: "" });
  // Sync default term from DB settings once loaded
  React.useEffect(() => {
    setMatF(f => ({ ...f, term: autoTerm }));
  }, [autoTerm]);
  const [exF,         setExF]         = useState({ title: "" });
  const [toast,       setToast]       = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [collapsed,   setCollapsed]   = useState({});
  const fileRef = useRef(null);
  const showToast = m => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const courseMats  = mats.filter(m => m.courseId === course.id);
  const courseExams = exams.filter(e => e.courseId === course.id);

  // Build term groups — sorted by term order
  const termOrder = { Prelim: 0, Midterm: 1, "Semi-Final": 2, Finals: 3, "No topic": 4 };
  const grouped   = {};
  const termKey   = t => EXAM_TERMS.includes(t) ? t : "No topic";

  courseMats.forEach(m  => { const k = termKey(m.term);  if (!grouped[k]) grouped[k] = []; grouped[k].push({ ...m,  _kind: "material" }); });
  courseExams.forEach(e => { const k = termKey(e.term);  if (!grouped[k]) grouped[k] = []; grouped[k].push({ ...e,  _kind: "exam"     }); });

  // Sort items within each group by date descending (most recent first — like GClassroom)
  const sortedGroups = Object.keys(grouped)
    .sort((a, b) => (termOrder[a] ?? 99) - (termOrder[b] ?? 99))
    .map(term => ({
      term,
      items: grouped[term].sort((a, b) => {
        const da = a.dueDate || a.date || a.createdAt || "";
        const db = b.dueDate || b.date || b.createdAt || "";
        return db.localeCompare(da);
      }),
    }));

  const toggleCollapse = (term) => setCollapsed(p => ({ ...p, [term]: !p[term] }));

  const submitMat = async () => {
    if (!matF.title.trim()) { showToast("Title required."); return; }
    await onAddMat(matF, pendingFile,
      () => { setMatF({ title: "", type: "Lecture", term: termFromDate(), description: "", dueDate: "" }); setPendingFile(null); setCreateType(null); },
      showToast
    );
  };

  // Icon for classwork row — matches GClassroom orange/grey circles
  const itemIcon = (item) => {
    if (item._kind === "exam") {
      const isQuiz = item.examType === "Quiz";
      return (
        <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: isQuiz ? "rgba(236,72,153,.25)" : "rgba(245,158,11,.25)", color: isQuiz ? "#f472b6" : "#fbbf24" }}>
          📝
        </div>
      );
    }
    const meta = MAT_META[item.type] || MAT_META[MaterialType.LECTURE];
    const hasDeadline = item.dueDate && new Date(item.dueDate) > new Date(Date.now() - 86400000);
    return (
      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: hasDeadline ? "rgba(245,158,11,.25)" : `${meta.bg}`, color: hasDeadline ? "#fbbf24" : meta.color }}>
        {meta.icon}
      </div>
    );
  };

  const formatDue = (item) => {
    if (item._kind === "exam") {
      if (!item.date) return null;
      const d = new Date(item.date);
      const s = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return item.startTime ? `${s}, ${item.startTime}` : s;
    }
    if (!item.dueDate) return null;
    const d   = new Date(item.dueDate);
    const now = new Date();
    const ms  = d - now;
    if (ms > 0 && ms < 86400000)  return "Due Tomorrow";
    if (ms > 0 && ms < 172800000) return `Due ${d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;
    if (ms < 0) return `Due ${d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;
    return `Due ${d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;
  };

  const dueLate = (item) => {
    if (item._kind !== "material" || !item.dueDate) return false;
    return new Date(item.dueDate) < new Date();
  };

  return (
    <div style={{ padding: "20px 0" }}>
      {/* Top bar — Create + Collapse All (mirrors GClassroom) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginBottom: 20 }}>
        {toast && <span style={{ fontSize: 12, color: "#34d399", fontWeight: 700 }}>✓ {toast}</span>}
        <button
          onClick={() => setCollapsed(
            Object.keys(grouped).reduce((a, k) => ({ ...a, [k]: !Object.values(collapsed).every(v => v) }), {})
          )}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "none", border: `1px solid ${C.bdr}`, borderRadius: 9999, color: "#6366f1", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          ✕ {Object.values(collapsed).every(v => v) ? "Expand all" : "Collapse all"}
        </button>
        <div style={{ position: "relative" }}>
          <Btn onClick={() => setCreateMenu(v => !v)}>
            <span style={{ fontSize: 15 }}>＋</span> Create
          </Btn>
          {createMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 6, zIndex: 30, boxShadow: "0 8px 32px rgba(0,0,0,.5)", minWidth: 170 }}>
              {[
                { icon: "📄", label: "Material",    key: "material" },
                { icon: "📝", label: "Exam / Quiz", key: "exam"     },
              ].map(({ icon, label, key }) => (
                <div key={key}
                  onClick={() => { setCreateType(key); setCreateMenu(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.txt, transition: "background .1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bdr}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 16 }}>{icon}</span>{label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create material form */}
      {createType === "material" && (
        <div style={{ background: C.bg2, border: "1px solid #6366f1", borderRadius: 12, padding: "20px 22px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.txt }}>📄 New Material</div>
          <Input value={matF.title} onChange={e => setMatF(f => ({...f,title:e.target.value}))} placeholder="Title" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FF label="Type">
              <Sel value={matF.type} onChange={e => setMatF(f => ({...f,type:e.target.value}))}>
                {["Lecture","Reading","Lab","Assignment","Project"].map(t => <option key={t}>{t}</option>)}
              </Sel>
            </FF>
            <FF label="Term">
              <Sel value={matF.term} onChange={e => setMatF(f => ({...f,term:e.target.value}))}>
                {EXAM_TERMS.map(t => <option key={t}>{t}</option>)}
              </Sel>
            </FF>
          </div>
          {(matF.type === "Lab" || matF.type === "Assignment" || matF.type === "Project") && (
            <FF label="Due Date">
              <Input type="date" value={matF.dueDate||""} min={new Date().toISOString().slice(0,10)}
                onChange={e => setMatF(f => ({...f,dueDate:e.target.value}))} />
            </FF>
          )}
          <FF label="Instructions (optional)">
            <textarea value={matF.description} onChange={e => setMatF(f => ({...f,description:e.target.value}))}
              rows={3} placeholder="Describe this material…" className="edit-textarea" style={{ resize: "none" }} />
          </FF>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if(f){ setPendingFile(f); setMatF(p=>({...p,attachmentName:f.name})); }}} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Btn variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>📎 Attach</Btn>
            {matF.attachmentName && <span style={{ fontSize: 11, color: "#34d399", fontWeight: 600 }}>✓ {matF.attachmentName}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => { setCreateType(null); setPendingFile(null); }}>Cancel</Btn>
            <Btn onClick={submitMat}>Post</Btn>
          </div>
        </div>
      )}

      {/* Create exam — just title, opens builder */}
      {createType === "exam" && (
        <div style={{ background: C.bg2, border: "1px solid #6366f1", borderRadius: 12, padding: "20px 22px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.txt }}>📝 New Exam / Quiz</div>
          <Input value={exF.title} onChange={e => setExF(f=>({...f,title:e.target.value}))} placeholder="e.g. Prelim Exam — UI Design" />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setCreateType(null)}>Cancel</Btn>
            <Btn onClick={() => {
              if (!exF.title.trim()) { showToast("Enter a title."); return; }
              setCreateType(null);
              onBuildExam({ title: exF.title, questions: [], examType: "Exam", startTime: "", endTime: "", qTimer: 3, randomize: true, noBacktrack: true });
              setExF({ title: "" });
            }}>✦ Open Exam Builder</Btn>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sortedGroups.length === 0 && (
        <div style={{ textAlign: "center", padding: "70px 20px", color: C.muted }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>📚</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.txt, marginBottom: 8 }}>No classwork yet</div>
          <div style={{ fontSize: 13 }}>Click "Create" to add your first material or exam.</div>
        </div>
      )}

      {/* Term groups — flat list exactly like image 2 */}
      {sortedGroups.map(({ term, items }) => (
        <div key={term} style={{ marginBottom: 24 }}>
          {/* Term header row — "No topic" / "Prelim" / etc */}
          <div
            onClick={() => toggleCollapse(term)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", cursor: "pointer", borderBottom: `2px solid ${C.bdr}`, marginBottom: collapsed[term] ? 0 : 2 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.txt }}>{term}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{items.length} item{items.length !== 1 ? "s" : ""}</span>
              <span style={{ fontSize: 18, color: C.dim, transform: collapsed[term] ? "rotate(-90deg)" : "rotate(0)", transition: "transform .2s" }}>∧</span>
            </div>
          </div>

          {/* Items — each is a full-width row like GClassroom */}
          {!collapsed[term] && items.map((item, idx) => {
            const dueText  = formatDue(item);
            const isLate   = dueLate(item);
            const isExam   = item._kind === "exam";
            const isQuiz   = isExam && item.examType === "Quiz";
            return (
              <div
                key={item.id || item._uuid || idx}
                onClick={() => isExam ? null : onOpenMaterial(item)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: `1px solid ${C.bdr}`, cursor: isExam ? "default" : "pointer", background: C.bg2, transition: "background .1s" }}
                onMouseEnter={e => { if (!isExam) e.currentTarget.style.background = "rgba(99,102,241,.06)"; }}
                onMouseLeave={e => e.currentTarget.style.background = C.bg2}>

                {/* Icon circle */}
                {itemIcon(item)}

                {/* Title + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                    {isExam ? (
                      <>
                        <span style={{ fontSize: 10, fontWeight: 800, color: isQuiz?"#f472b6":"#fbbf24", background: isQuiz?"rgba(236,72,153,.2)":"rgba(245,158,11,.2)", padding:"1px 7px", borderRadius:9999 }}>
                          {isQuiz ? "Quiz 30%" : "Exam 40%"}
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

                {/* Due date — right-aligned like GClassroom */}
                {dueText && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: isLate ? "#f87171" : C.muted, flexShrink: 0, minWidth: 110, textAlign: "right" }}>
                    {dueText}
                  </span>
                )}

                {/* 3-dot menu placeholder */}
                <div style={{ width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", color: C.muted, fontSize: 16 }}>⋮</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PEOPLE TAB — grade management (was Grades)
// ═══════════════════════════════════════════════════════════════════════════════
function PeopleTab({ course, user, allUsers, examSubmissions, enrollments }) {
  const [allExams,       setAllExams]       = useState([]);
  const [allMaterials,   setAllMaterials]   = useState([]);
  const [classStandings, setClassStandings] = useState([]);
  const [allWorkSubs,    setAllWorkSubs]    = useState([]);
  const [csModal,        setCsModal]        = useState(null);
  const [detailRow,      setDetailRow]      = useState(null);
  const [toast,          setToast]          = useState("");
  const showToast = m => { setToast(m); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    if (!course._uuid) return;
    (async () => {
      const [eRes, qRes, mRes, csRes] = await Promise.all([
        supabase.from("exams").select("*").eq("course_id", course._uuid),
        supabase.from("exam_questions").select("*"),
        supabase.from("materials").select("material_id,course_id,material_type,term,total_points,title").eq("course_id", course._uuid),
        supabase.from("class_standing").select("*").eq("course_id", course._uuid),
      ]);
      if (eRes.data) setAllExams(eRes.data.map(r => normalizeExam({ ...r, courses:{ course_code:course.id }, exam_questions:(qRes.data||[]).filter(q=>q.exam_id===r.exam_id) })));
      const matIds = (mRes.data||[]).map(m => m.material_id);
      let ws = [];
      if (matIds.length) { const {data} = await supabase.from("work_submissions").select("material_id,student_id,score,status").in("material_id",matIds).eq("status","Graded"); ws = data||[]; }
      setAllMaterials(mRes.data||[]);
      setAllWorkSubs(ws);
      setClassStandings((csRes.data||[]).map(r => ({ studentUuid:r.student_id, courseUuid:r.course_id, term:r.term, project:r.project, recitation:r.recitation, attendance:r.attendance })));
    })();
  }, [course._uuid, course.id]);

  const getTermData = (studentDisplayId, studentUuid) => {
    const result = {};
    EXAM_TERMS.forEach(term => {
      const cwMats = allMaterials.filter(m => m.course_id===course._uuid && m.term===term && (m.material_type==="Lab"||m.material_type==="Assignment"||m.material_type==="Project"));
      const cwSubs = cwMats.map(m => { const w=allWorkSubs.find(w=>w.material_id===m.material_id&&w.student_id===studentUuid); return w?w.score:null; }).filter(x=>x!=null);
      const cw = cwSubs.length>0?Math.round(cwSubs.reduce((a,b)=>a+b,0)/cwSubs.length):null;
      const csEntry = classStandings.find(cs=>cs.studentUuid===studentUuid&&cs.courseUuid===course._uuid&&cs.term===term)||null;
      const cs = csGradePct(csEntry);
      const termExams = allExams.filter(ex=>ex.courseId===course.id&&ex.term===term);
      const subs = examSubmissions.filter(s=>s.studentId===studentDisplayId&&s.courseId===course.id);
      const examOnly = termExams.filter(ex=>(ex.examType||"Exam")==="Exam");
      const quizOnly = termExams.filter(ex=>ex.examType==="Quiz");
      const toAvg = (arr) => { const p=arr.map(ex=>{const s=subs.find(s=>s.examId===ex.id);return s?Math.round((s.score/s.totalPoints)*100):null;}).filter(x=>x!=null); return p.length?Math.round(p.reduce((a,b)=>a+b,0)/p.length):null; };
      result[term] = { cw, cs, csEntry, exam:toAvg(examOnly), quiz:toAvg(quizOnly), grade:computeTermGrade({cw,cs,exam:toAvg(examOnly),quiz:toAvg(quizOnly)}) };
    });
    return result;
  };

  const cellCls = v => v==null?"":v>=90?"grade-cell-high":v>=75?"grade-cell-pass":v>=60?"grade-cell-warn":"grade-cell-fail";

  const enrolled = enrollments.filter(e => e.courseId === course.id);
  const rows = enrolled.map(e => {
    const student  = allUsers.find(u=>u.id===e.studentId||u._uuid===e.studentId)||{};
    const termData = getTermData(e.studentId, student._uuid);
    const tg = EXAM_TERMS.map(t=>termData[t].grade).filter(x=>x!=null);
    const overall = tg.length>0?Math.round(tg.reduce((a,b)=>a+b,0)/tg.length):null;
    return { studentId:e.studentId, studentUuid:student._uuid, studentName:student.fullName||e.studentId, termData, overall, status:overall==null?"Pending":overall>=75?"Pass":"Fail", _student:student, _course:course };
  }).filter(r => r.studentUuid);

  const passC=rows.filter(r=>r.status==="Pass").length;
  const failC=rows.filter(r=>r.status==="Fail").length;
  const avg  =rows.filter(r=>r.overall!=null).length?(rows.filter(r=>r.overall!=null).reduce((a,b)=>a+b.overall,0)/rows.filter(r=>r.overall!=null).length).toFixed(1):"—";

  const termCell = (row, term) => {
    const g = row.termData[term]?.grade;
    return g!=null?<span className={cellCls(g)} style={{display:"block",textAlign:"center",fontWeight:800,padding:"2px 6px",borderRadius:5,fontSize:12}}>{g}%</span>:<span style={{color:C.muted,fontSize:11}}>—</span>;
  };

  const cols = [
    { field:"studentName", header:"Student", width:190,
      cellRenderer:(v,row)=>(
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(99,102,241,.15)",color:"#6366f1",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{v?.charAt(0)}</div>
          <div><div style={{fontWeight:700,fontSize:12,color:C.txt}}>{v}</div><div style={{fontSize:10,color:C.muted}}>{row.studentId}</div></div>
        </div>
      )},
    {field:"_p",header:"Prelim",    width:80,cellRenderer:(_,r)=>termCell(r,"Prelim")},
    {field:"_m",header:"Midterm",   width:80,cellRenderer:(_,r)=>termCell(r,"Midterm")},
    {field:"_s",header:"Semi-Final",width:90,cellRenderer:(_,r)=>termCell(r,"Semi-Final")},
    {field:"_f",header:"Finals",    width:80,cellRenderer:(_,r)=>termCell(r,"Finals")},
    {field:"overall",header:"Overall",width:86,
      cellRenderer:v=>v!=null?<span className={cellCls(v)} style={{display:"block",textAlign:"center",fontWeight:900,fontSize:14,padding:"2px 6px",borderRadius:5}}>{v}%</span>:<span style={{color:C.muted,fontSize:11}}>—</span>},
    {field:"status",header:"Status",width:78,cellRenderer:v=><Badge color={v==="Pass"?"success":v==="Fail"?"danger":"default"}>{v}</Badge>},
    {field:"studentId",header:"Actions",width:120,sortable:false,
      cellRenderer:(_,row)=>(
        <div style={{display:"flex",gap:5}}>
          <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();setCsModal({student:row._student,course});}} style={{fontSize:10,padding:"3px 8px"}}>🏆 CS</Btn>
          <Btn size="sm" variant="ghost" style={{border:`1px solid ${C.bdr}`,fontSize:10,padding:"3px 8px"}} onClick={e=>{e.stopPropagation();setDetailRow(row);}}>View</Btn>
        </div>
      )},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12,padding:"20px 0"}}>
      {toast && <div style={{fontSize:12,color:"#34d399",fontWeight:700,background:"rgba(16,185,129,.15)",padding:"6px 12px",borderRadius:6,alignSelf:"flex-start"}}>✓ {toast}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        <StatCard icon="👥" label="Students"  value={rows.length}                       color="#6366f1" bg="#ede9fe"/>
        <StatCard icon="📊" label="Class Avg" value={avg+(avg!=="—"?"%":"")}             color="#10b981" bg="#d1fae5"/>
        <StatCard icon="✅" label="Passing"   value={passC}                              color="#3b82f6" bg="#dbeafe"/>
        <StatCard icon="❌" label="Failing"   value={failC}                              color="#ef4444" bg="#fee2e2"/>
      </div>
      <div style={{display:"flex",gap:12,padding:"7px 12px",background:C.bg2,borderRadius:8,border:`1px solid ${C.bdr}`,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:10,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Formula</span>
        {[["📚 Course Work","30%","#ede9fe","#6366f1"],["✏ Quizzes","30%","#fce7f3","#ec4899"],["🏆 Class Standing","30%","#d1fae5","#10b981"],["📝 Exams","40%","#fef3c7","#f59e0b"]].map(([lbl,pct,bg,col])=>(
          <div key={lbl} style={{display:"flex",alignItems:"center",gap:5,fontSize:11}}>
            <span style={{background:bg,color:col,fontWeight:800,padding:"2px 7px",borderRadius:9999}}>{pct}</span>
            <span style={{color:C.muted}}>{lbl}</span>
          </div>
        ))}
      </div>
      <div style={{minHeight:300}}><LMSGrid columns={cols} rowData={rows} height="420px" onRowClick={r=>setDetailRow(r)} selectedId={detailRow?.studentId}/></div>

      {csModal && (
        <ClassStandingModal student={csModal.student} course={csModal.course}
          existing={classStandings.filter(cs=>cs.studentUuid===csModal.student._uuid&&cs.courseUuid===course._uuid)}
          teacherUuid={user._uuid}
          onSave={newRows=>{
            setClassStandings(prev=>[...prev.filter(cs=>!(cs.studentUuid===csModal.student._uuid&&cs.courseUuid===course._uuid&&newRows.some(r=>r.term===cs.term))),...newRows]);
            showToast(`Class Standing saved for ${csModal.student.fullName}`);
          }}
          onClose={()=>setCsModal(null)}/>
      )}

      {detailRow && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDetailRow(null)}>
          <div className="modal-box" style={{background:C.bg2,borderRadius:14,width:640,maxHeight:"88vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.bdr}`,background:C.bg,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
              <div>
                <div style={{fontWeight:900,fontSize:15,color:C.txt}}>{detailRow.studentName}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{course.code} · {course.name}</div>
              </div>
              <button onClick={()=>setDetailRow(null)} style={{border:"none",background:"none",cursor:"pointer",color:C.muted,fontSize:22}}
                onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
              <div style={{display:"flex",gap:10,marginBottom:16}}>
                <div style={{flex:1,background:detailRow.status==="Pass"?"rgba(16,185,129,.1)":"rgba(239,68,68,.1)",border:`1px solid ${detailRow.status==="Pass"?"#34d399":"#f87171"}`,borderRadius:10,padding:14,textAlign:"center"}}>
                  <div style={{fontSize:30,fontWeight:900,color:detailRow.status==="Pass"?"#34d399":"#f87171"}}>{detailRow.overall??  "—"}{detailRow.overall!=null?"%":""}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:3}}>Overall Grade</div>
                  <Badge color={detailRow.status==="Pass"?"success":detailRow.status==="Fail"?"danger":"default"} style={{marginTop:6,display:"inline-block"}}>{detailRow.status}</Badge>
                </div>
                <div style={{flex:3,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                  {EXAM_TERMS.map(term=>{const g=detailRow.termData[term]?.grade;const tm=TERM_META[term];return(
                    <div key={term} style={{background:C.bg,border:`1px solid ${C.bdr}`,borderRadius:8,padding:"10px 8px",textAlign:"center"}}>
                      <div style={{fontSize:9,fontWeight:800,color:tm.color,background:tm.bg,padding:"2px 7px",borderRadius:9999,display:"inline-block",marginBottom:6}}>{term}</div>
                      <div style={{fontSize:18,fontWeight:900,color:g!=null?gradeColor(g):"#94a3b8"}}>{g!=null?`${g}%`:"—"}</div>
                    </div>
                  );})}
                </div>
              </div>
            </div>
            <div style={{padding:"12px 20px",borderTop:`1px solid ${C.bdr}`,background:C.bg,display:"flex",gap:10,justifyContent:"flex-end"}}>
              <Btn variant="secondary" onClick={()=>{setDetailRow(null);setCsModal({student:detailRow._student,course});}}>🏆 Edit CS</Btn>
              <Btn variant="secondary" onClick={()=>setDetailRow(null)}>Close</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COURSE ROOM — full screen with tab bar (Google Classroom layout)
// ═══════════════════════════════════════════════════════════════════════════════
const BANNER_COLORS = [
  "#1565c0","#6a1b9a","#00695c","#e65100","#1b5e20","#880e4f","#0277bd","#4527a0",
];
const bannerColor = (code="") => BANNER_COLORS[code.split("").reduce((a,c)=>a+c.charCodeAt(0),0)%BANNER_COLORS.length];

function CourseRoom({ course, user, mats, exams, enrollments, allUsers, examSubmissions, setCourses, onBack, onAddMat, onBuildExam, onOpenMaterial, gradeEntries, onGradeUpdate }) {
  const [tab, setTab] = useState("stream");

  const TABS = [
    { id:"stream",     label:"Dashboard"   },
    { id:"classwork",  label:"Classwork"   },
    { id:"attendance", label:"Attendance"  },
    { id:"people",     label:"Grade"       },
  ];

  const toggleStatus = async () => {
    const next = course.status === "Finished" ? "Ongoing" : "Finished";
    await supabase.from("courses").update({ status: next }).eq("course_id", course._uuid);
    setCourses(prev => prev.map(c => c._uuid===course._uuid?{...c,status:next}:c));
  };

  const bg = bannerColor(course.code);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", background:C.bg }}>

      {/* ── Navigation header (mimics GClassroom top bar) ── */}
      <div style={{ background:C.bg2, borderBottom:"1px solid #334155", flexShrink:0 }}>
        {/* Breadcrumb row */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 20px", borderBottom:"1px solid #1e293b" }}>
          <button onClick={onBack}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", border:"1px solid #334155", borderRadius:6, background:C.bg2, cursor:"pointer", fontSize:12, fontWeight:600, color:C.txt, fontFamily:"inherit" }}
            onMouseEnter={e=>e.currentTarget.style.background=C.bdr}
            onMouseLeave={e=>e.currentTarget.style.background=C.bg2}>
            ← My Courses
          </button>
          <span style={{ color:C.dim }}>›</span>
          <span style={{ fontSize:13, fontWeight:700, color:C.txt }}>{course.code}: {course.name}</span>
          <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:9999,
              background:course.status==="Finished"?"rgba(245,158,11,.2)":"rgba(16,185,129,.15)",
              color:course.status==="Finished"?"#fbbf24":"#34d399",
              border:`1px solid ${course.status==="Finished"?"rgba(245,158,11,.4)":"rgba(16,185,129,.3)"}` }}>
              {course.status==="Finished"?"✅ Finished":"🟢 Ongoing"}
            </span>
            <button onClick={toggleStatus}
              style={{ fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:9999, border:"1px solid #334155", background:C.bg2, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}
              onMouseEnter={e=>e.currentTarget.style.background=C.bdr}
              onMouseLeave={e=>e.currentTarget.style.background=C.bg2}>
              {course.status==="Finished"?"↩ Mark Ongoing":"✓ Mark Finished"}
            </button>
          </div>
        </div>

        {/* Tab bar row */}
        <div style={{ display:"flex", gap:0, padding:"0 20px" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ padding:"12px 18px", border:"none", background:"none", cursor:"pointer", fontFamily:"inherit",
                fontSize:14, fontWeight:tab===t.id?700:500,
                color:tab===t.id?"#6366f1":C.muted,
                borderBottom:`3px solid ${tab===t.id?"#6366f1":"transparent"}`,
                marginBottom:-1, transition:"color .15s" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content area ── */}
      <div style={{ flex:1, overflowY:"auto" }}>

        {/* Stream — has the banner header like GClassroom image 1 */}
        {tab === "stream" && (
          <div style={{ maxWidth: 900, margin:"0 auto", padding:"0 24px" }}>
            {/* Course banner — matches image 1 */}
            <div style={{ borderRadius:8, overflow:"hidden", margin:"20px 0 0", position:"relative", height:200, background:bg, display:"flex", alignItems:"flex-end" }}>
              <div style={{ padding:"24px 28px", zIndex:1 }}>
                <div style={{ fontSize:28, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", textShadow:"0 1px 4px rgba(0,0,0,.3)", marginBottom:6 }}>
                  {course.code}: {course.name}
                </div>
                <div style={{ fontSize:14, color:"rgba(255,255,255,.85)", fontWeight:500 }}>
                  {course.schedule}{course.yearLevel ? ` · ${course.yearLevel}` : ""}{course.semester ? ` · ${course.semester}` : ""}
                </div>
              </div>
              {/* Decorative circles — like GClassroom */}
              <div style={{ position:"absolute", bottom:-40, right:40, width:180, height:180, borderRadius:"50%", background:"rgba(255,255,255,.06)" }}/>
              <div style={{ position:"absolute", top:-30, right:140, width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,.04)" }}/>
            </div>
            <StreamTab course={course} user={user} />
          </div>
        )}

        {/* Classwork — matches image 2 layout */}
        {tab === "classwork" && (
          <div style={{ maxWidth: 900, margin:"0 auto", padding:"0 24px" }}>
            <ClassworkTab
              course={course} user={user} mats={mats} exams={exams}
              onOpenMaterial={onOpenMaterial} onBuildExam={onBuildExam} onAddMat={onAddMat}
              enrollments={enrollments}
            />
          </div>
        )}

        {/* Attendance */}
        {tab === "attendance" && (
          <div style={{ maxWidth: 1100, margin:"0 auto", padding:"0 24px" }}>
            <TeacherAttendanceTab
              course={course} user={user}
              enrollments={enrollments} allUsers={allUsers}
            />
          </div>
        )}

        {/* People (Grades) */}
        {tab === "people" && (
          <div style={{ padding:"0 24px" }}>
            <PeopleTab
              course={course} user={user} allUsers={allUsers}
              examSubmissions={examSubmissions} enrollments={enrollments}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function TeacherCourses({ user, courses, setCourses, allUsers, enrollments, examSubmissions = [] }) {
  const myCourses = courses.filter(c => c.teacher === user.id);

  const [selCourse,        setSelCourse]        = useState(null);
  const [mats,             setMats]             = useState([]);
  const [exams,            setExams]            = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [buildingExam,     setBuildingExam]     = useState(null);
  const [gradeEntries,     setGradeEntries]     = useState([]);
  const [toast,            setToast]            = useState("");
  const showToast = m => { setToast(m); setTimeout(()=>setToast(""),2500); };

  // Load materials + exams for all my courses
  useEffect(() => {
    async function load() {
      const uuidToCode = {};
      courses.forEach(c => { if (c._uuid) uuidToCode[c._uuid] = c.id; });
      const uuids = myCourses.map(c => c._uuid).filter(Boolean);
      if (!uuids.length) return;
      const [mRes, eRes, qRes] = await Promise.all([
        supabase.from("materials").select("*").in("course_id", uuids),
        supabase.from("exams").select("*").in("course_id", uuids),
        supabase.from("exam_questions").select("*"),
      ]);
      if (mRes.data) setMats(mRes.data.map(r => normalizeMaterial({ ...r, courses:{ course_code:uuidToCode[r.course_id]||r.course_id } })));
      if (eRes.data) setExams(eRes.data.map(r => normalizeExam({ ...r, courses:{ course_code:uuidToCode[r.course_id]||r.course_id }, exam_questions:(qRes.data||[]).filter(q=>q.exam_id===r.exam_id) })));
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  // Add material
  const handleAddMat = async (matF, pendingFile, onDone, onErr) => {
    if (!selCourse) return;
    const payload = {
      course_id:       selCourse._uuid, created_by: user._uuid,
      title:           matF.title.trim(), material_type: matF.type,
      description:     null,                             // header subtitle — left blank on create
      content:         matF.description?.trim() || null, // body panel — stores the typed instructions
      attachment_name: matF.attachmentName||null, is_published: true,
    };
    if (matF.term)    payload.term     = matF.term;
    if (matF.dueDate) payload.due_date = new Date(matF.dueDate+"T23:59:59").toISOString();
    const { data:newMat, error } = await supabase.from("materials").insert(payload).select().single();
    if (error) { onErr("Error: "+error.message); return; }
    let url = null;
    if (pendingFile instanceof File) {
      const path = `${selCourse._uuid}/${newMat.material_id}/${Date.now()}_${safeFileName(pendingFile.name)}`;
      try { url = await uploadFileToStorage("materials", path, pendingFile); await supabase.from("materials").update({attachment_url:url}).eq("material_id",newMat.material_id); }
      catch(e) { onErr("Saved but upload failed: "+e.message); }
    }
    setMats(prev => [...prev, normalizeMaterial({...newMat,attachment_url:url,courses:{course_code:selCourse.id}})]);
    onDone();
  };

  const handleMaterialUpdate = async (updated) => {
    const {error} = await supabase.from("materials").update({
      title:updated.title, description:updated.description||null, content:updated.content||null,
      due_date:updated.dueDate||null, total_points:updated.points||null,
      attachment_name:updated.attachment_name||updated.attachmentName||null,
      attachment_url:updated.attachment_url||null,
    }).eq("material_id",updated.id);
    if (error) { showToast("Error: "+error.message); return; }
    setMats(prev=>prev.map(m=>m.id===updated.id?updated:m));
    if (selectedMaterial?.id===updated.id) setSelectedMaterial(updated);
  };

  const handleGradeUpdate = (entry) => {
    setGradeEntries(prev => {
      const i=prev.findIndex(g=>g.studentId===entry.studentId&&g.materialId===entry.materialId);
      if(i>=0){const n=[...prev];n[i]=entry;return n;}
      return [...prev,entry];
    });
  };

  // Exam builder save
  if (buildingExam && selCourse) {
    const parseDur = s => { if(!s) return 60; const h=s.match(/(\d+)\s*hour/i); const m=s.match(/(\d+)\s*min/i); return ((h?parseInt(h[1]):0)*60)+((m?parseInt(m[1]):0)*60)||60; };
    return (
      <ExamBuilder
        course={selCourse} initialExam={buildingExam}
        onBack={() => setBuildingExam(null)}
        onSave={async (saved) => {
          const courseUuid=selCourse._uuid, teacherUuid=user._uuid;
          if (!courseUuid||!teacherUuid) { showToast("UUID missing."); return; }
          const payload = { course_id:courseUuid, created_by:teacherUuid, title:saved.title,
            exam_date:saved.date, duration_minutes:parseDur(saved.duration),
            total_points:saved.totalPoints, instant_feedback:true, is_published:true,
            start_time:saved.startTime||null, end_time:saved.endTime||null,
            exam_type:saved.examType||"Exam", q_timer_minutes:saved.qTimer||3,
            randomize:saved.randomize??true, no_backtrack:saved.noBacktrack??true };
          if (saved.term) payload.term = saved.term;
          const {data:newExam,error:eErr}=await supabase.from("exams").insert(payload).select().single();
          if (eErr) { showToast("Error: "+eErr.message); return; }
          if (saved.questions.length>0) {
            const qRows=saved.questions.map((q,i)=>({exam_id:newExam.exam_id,question_type:q.type,question_text:q.questionText,options:q.type==="MCQ"?q.options:null,correct_answer:q.correctAnswer,points:q.points,sort_order:i}));
            await supabase.from("exam_questions").insert(qRows);
          }
          setExams(prev=>[...prev,{...saved,id:newExam.exam_id,courseId:selCourse.id}]);
          setBuildingExam(null);
          showToast(`"${saved.title}" saved!`);
        }}
      />
    );
  }

  // Material detail
  if (selectedMaterial) {
    return (
      <TeacherMaterialDetailView
        material={selectedMaterial}
        course={myCourses.find(c=>c.id===selectedMaterial.courseId)}
        allUsers={allUsers} user={user}
        onBack={() => setSelectedMaterial(null)}
        onUpdate={handleMaterialUpdate}
        gradeEntries={gradeEntries} onGradeUpdate={handleGradeUpdate}
        enrollments={enrollments}
      />
    );
  }

  // Course room
  if (selCourse) {
    return (
      <CourseRoom
        course={selCourse} user={user} mats={mats} exams={exams}
        enrollments={enrollments} allUsers={allUsers} examSubmissions={examSubmissions}
        setCourses={setCourses}
        onBack={() => setSelCourse(null)}
        onAddMat={handleAddMat}
        onBuildExam={init => setBuildingExam(init)}
        onOpenMaterial={m => setSelectedMaterial(m)}
        gradeEntries={gradeEntries} onGradeUpdate={handleGradeUpdate}
      />
    );
  }

  // ── Course list (dark theme matching the rest of the app) ────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:C.bg }}>
      <TopBar
        title="My Courses"
        subtitle={`${myCourses.length} assigned course${myCourses.length !== 1 ? "s" : ""} — click to open`}
      />
      {toast && <div style={{ padding:"6px 20px", background:"rgba(16,185,129,.1)", fontSize:12, color:"#34d399", fontWeight:700, borderBottom:`1px solid rgba(16,185,129,.2)` }}>✓ {toast}</div>}

      <div style={{ flex:1, overflowY:"auto", padding:"18px 20px" }}>
        {myCourses.length === 0 ? (
          <div style={{ textAlign:"center", padding:"80px 20px", color:C.muted }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📚</div>
            <div style={{ fontSize:16, fontWeight:700, color:C.txt, marginBottom:8 }}>No courses assigned</div>
            <div style={{ fontSize:13 }}>Contact your admin to get courses assigned to you.</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {myCourses.map((course, idx) => {
              const accent      = bannerColor(course.code);
              const enrolled    = enrollments.filter(e => e.courseId === course.id).length;
              const courseMats  = mats.filter(m => m.courseId === course.id).length;
              const courseExams = exams.filter(e => e.courseId === course.id).length;
              const isFinished  = course.status === "Finished";

              return (
                <div
                  key={course.id}
                  onClick={() => setSelCourse(course)}
                  style={{ display:"flex", alignItems:"center", gap:0, background:C.bg2, border:`1px solid ${C.bdr}`, borderRadius:10, overflow:"hidden", cursor:"pointer", transition:"border-color .15s, background .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = "rgba(99,102,241,.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.bdr;  e.currentTarget.style.background = C.bg2; }}>

                  {/* Colored left accent bar */}
                  <div style={{ width:5, alignSelf:"stretch", background:accent, flexShrink:0 }} />

                  {/* Course code badge */}
                  <div style={{ width:100, padding:"16px 14px", flexShrink:0, display:"flex", flexDirection:"column", justifyContent:"center", borderRight:`1px solid ${C.bdr}` }}>
                    <div style={{ fontWeight:900, fontSize:15, color:"#fff", letterSpacing:"-0.01em" }}>{course.code}</div>
                    <div style={{ fontSize:10, fontWeight:700, marginTop:4, color:accent, background:`${accent}22`, padding:"2px 7px", borderRadius:9999, display:"inline-block", width:"fit-content" }}>
                      {isFinished ? "Finished" : "Ongoing"}
                    </div>
                  </div>

                  {/* Course name + meta */}
                  <div style={{ flex:1, padding:"14px 18px", minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:C.txt, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {course.name}
                    </div>
                    <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                      {course.schedule && (
                        <span style={{ fontSize:11, color:C.muted }}>🕐 {course.schedule}</span>
                      )}
                      {course.yearLevel && (
                        <span style={{ fontSize:10, fontWeight:700, color:"#94a3b8", background:"rgba(148,163,184,.12)", padding:"2px 7px", borderRadius:9999 }}>{course.yearLevel}</span>
                      )}
                      {course.semester && (
                        <span style={{ fontSize:10, fontWeight:700, color:"#94a3b8", background:"rgba(148,163,184,.12)", padding:"2px 7px", borderRadius:9999 }}>{course.semester}</span>
                      )}
                      <span style={{ fontSize:10, fontWeight:700, color:"#94a3b8", background:"rgba(148,163,184,.12)", padding:"2px 7px", borderRadius:9999 }}>{course.units} units</span>
                    </div>
                  </div>

                  {/* Stats — students / materials / exams */}
                  <div style={{ display:"flex", gap:0, flexShrink:0, borderLeft:`1px solid ${C.bdr}` }}>
                    {[
                      { icon:"🎓", value:enrolled,    label:"Students",  color:"#60a5fa" },
                      { icon:"📄", value:courseMats,  label:"Materials", color:"#34d399" },
                      { icon:"📝", value:courseExams, label:"Exams",     color:"#fbbf24" },
                    ].map(({ icon, value, label, color }, i) => (
                      <div key={label} style={{ width:80, padding:"14px 10px", textAlign:"center", borderRight: i < 2 ? `1px solid ${C.bdr}` : "none" }}>
                        <div style={{ fontSize:20, fontWeight:900, color, lineHeight:1 }}>{value}</div>
                        <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Arrow */}
                  <div style={{ padding:"0 18px", color:C.dim, fontSize:18, flexShrink:0 }}>›</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
