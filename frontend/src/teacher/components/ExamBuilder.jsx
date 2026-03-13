import React, { useState, useRef } from "react";
import { QT_META, EXAM_TERMS } from "../../lib/constants";
import { Btn, Input } from "../../components/ui";
import { ExamSchema, blankQ } from "./examSchema";
import QuestionItem from "./QuestionItem";
import ExamPreview from "./ExamPreview";

/**
 * Full main-content-area takeover. Triggered by clicking "+ Create Exam".
 * Owns all question state. Validates via ExamSchema before saving.
 *
 * Layout (100vh, no full-page scroll):
 *   [Breadcrumb bar — 46px fixed]
 *   [Meta row — 54px fixed]
 *   [Toolbar row — 46px fixed]
 *   [Two-column body — flex:1, each col scrolls independently]
 *     Left  310px : Question list (scrollable) + "Add Question" dropdown
 *     Right flex:1: Active question editor (scrollable)
 */
export default function ExamBuilder({ course, initialExam, onSave, onBack }) {
  // ── Exam meta ───────────────────────────────────────────────────────────────
  const [title,    setTitle]    = useState(initialExam?.title    || "");
  const [date,     setDate]     = useState(initialExam?.date     || "");
  const [duration, setDuration] = useState(initialExam?.duration || "");
  const [term,     setTerm]     = useState(initialExam?.term     || "");

  // ── Question list ───────────────────────────────────────────────────────────
  const [examQuestions, setExamQuestions] = useState(initialExam?.questions || []);
  const [activeQId,     setActiveQId]     = useState(null);
  const [showTypeMenu,  setShowTypeMenu]  = useState(false);
  const [previewMode,   setPreviewMode]   = useState(false);
  const [valErrors,     setValErrors]     = useState([]);
  const [saved,         setSaved]         = useState(false);
  const typeMenuRef = useRef(null);

  const activeQ  = examQuestions.find(q => q.id === activeQId) || null;
  const totalPts = examQuestions.reduce((s, q) => s + (q.points || 0), 0);

  // Close type menu on outside click
  useRef(() => {
    const handler = (e) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target)) setShowTypeMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  });

  // ── Question CRUD ───────────────────────────────────────────────────────────
  const addQuestion = (type) => {
    const q = blankQ(type);
    setExamQuestions(prev => [...prev, q]);
    setActiveQId(q.id);
    setShowTypeMenu(false);
    setValErrors([]);
  };

  const updateQuestion = (updated) => {
    setExamQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
  };

  const deleteQuestion = (id) => {
    setExamQuestions(prev => {
      const next = prev.filter(q => q.id !== id);
      if (activeQId === id) setActiveQId(next[next.length - 1]?.id || null);
      return next;
    });
  };

  const moveQuestion = (id, dir) => {
    setExamQuestions(prev => {
      const idx    = prev.findIndex(q => q.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  // ── Validation + Save ───────────────────────────────────────────────────────
  const handleSave = () => {
    const examData = {
      title, date, duration,
      term:        term || null,
      questions:   examQuestions,
      totalPoints: totalPts,
      id:          `EX${Date.now()}`,
      courseId:    course.id,
      createdAt:   new Date().toISOString(),
    };
    const result = ExamSchema.validate(examData);
    if (!result.ok) { setValErrors(result.errors); return; }
    setValErrors([]);
    setSaved(true);
    setTimeout(() => { onSave(examData); }, 700);
  };

  if (previewMode) {
    return (
      <ExamPreview
        exam={{ title, date, duration, questions: examQuestions }}
        onClose={() => setPreviewMode(false)}
      />
    );
  }

  return (
    <div className="exam-builder-enter" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Breadcrumb bar ── */}
      <div style={{ height: 46, background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0 }}>
        <button onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", border: "1px solid #334155", borderRadius: 6, background: "#0f172a", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#475569", fontFamily: "inherit" }}
          onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
          onMouseLeave={e => e.currentTarget.style.background = "#0f172a"}>
          ← Back to Courses
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#475569", flex: 1 }}>
          <span>My Courses</span>
          {course && <><span>›</span><span>{course.code}</span></>}
          <span>›</span>
          <span style={{ color: "#e2e8f0", fontWeight: 700 }}>Exam Builder</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,.15)", padding: "3px 9px", borderRadius: 9999 }}>
          ✏ Builder Mode
        </span>
      </div>

      {/* ── Exam meta row ── */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Exam title…"
          style={{ flex: 2, border: "1.5px solid #e2e8f0", borderRadius: 7, padding: "7px 11px", fontSize: 15, fontWeight: 800, fontFamily: "inherit", color: "#0f172a", outline: "none", minWidth: 0 }}
          onFocus={e => e.target.style.borderColor = "#6366f1"}
          onBlur={e  => e.target.style.borderColor = "#334155"}
        />
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <select value={term} onChange={e => setTerm(e.target.value)}
            style={{ width: "100%", border: `1.5px solid ${term ? "#e2e8f0" : "#ef4444"}`, borderRadius: 7, padding: "7px 11px", fontSize: 13, fontFamily: "inherit", color: term ? "#0f172a" : "#94a3b8", outline: "none", background: "#1e293b", cursor: "pointer", appearance: "auto" }}>
            <option value="" disabled>— Term (required) —</option>
            {EXAM_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {!term && <span style={{ position: "absolute", top: -6, right: 6, fontSize: 10, fontWeight: 800, color: "#ef4444", background: "#1e293b", padding: "0 3px" }}>required</span>}
        </div>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
        <Input value={duration} onChange={e => setDuration(e.target.value)} placeholder="Duration (e.g. 2 hours)" style={{ flex: 1, minWidth: 0 }} />
        {/* Live point counter */}
        <div style={{ flexShrink: 0, textAlign: "center", padding: "5px 14px", background: totalPts > 0 ? "#ede9fe" : "#0f172a", borderRadius: 8, border: "1.5px solid", borderColor: totalPts > 0 ? "#c7d2fe" : "#e2e8f0" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: totalPts > 0 ? "#4f46e5" : "#94a3b8", lineHeight: 1 }}>{totalPts}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Total pts</div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ background: "#0f172a", borderBottom: "1px solid #334155", padding: "8px 18px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ position: "relative" }} ref={typeMenuRef}>
          <Btn onClick={() => setShowTypeMenu(v => !v)}>
            <span style={{ fontSize: 15 }}>＋</span> Add Question ▾
          </Btn>
          {showTypeMenu && (
            <div className="qtype-menu">
              {Object.entries(QT_META).map(([type, m]) => (
                <div key={type} className="qtype-item" onClick={() => addQuestion(type)}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: m.bg, color: m.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{m.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: "#475569" }}>
                      {type === "MCQ" ? "4 choices, one correct" : type === "TF" ? "True or False toggle" : "Keyword answer"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 7, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", background: "#0f172a", padding: "4px 10px", borderRadius: 9999, border: "1px solid #334155" }}>
            {examQuestions.length} question{examQuestions.length !== 1 ? "s" : ""}
          </span>
          <Btn variant="secondary" onClick={() => { setValErrors([]); setPreviewMode(true); }}>
            👁 Preview
          </Btn>
          {saved
            ? <div style={{ padding: "7px 16px", background: "rgba(16,185,129,.15)", borderRadius: 6, fontSize: 13, fontWeight: 800, color: "#34d399", display: "flex", alignItems: "center", gap: 5 }}>✓ Saved!</div>
            : <Btn onClick={handleSave}>💾 Save Exam</Btn>
          }
        </div>
      </div>

      {/* ── Validation errors ── */}
      {valErrors.length > 0 && (
        <div style={{ padding: "8px 18px", background: "#1e293b", borderBottom: "1px solid #fecaca", flexShrink: 0 }}>
          {valErrors.map((e, i) => (
            <div key={i} className="val-error" style={{ marginBottom: i < valErrors.length - 1 ? 5 : 0 }}>⚠ {e}</div>
          ))}
        </div>
      )}

      {/* ── Two-column body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT — Question list */}
        <div style={{ width: 310, borderRight: "1px solid #334155", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", flexShrink: 0 }}>
          <div style={{ padding: "10px 13px 6px", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>Question List</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 11px 14px" }}>
            {examQuestions.length === 0
              ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: "#475569" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>No questions yet</div>
                  <div style={{ fontSize: 12 }}>Click "Add Question" to begin building your exam.</div>
                </div>
              )
              : examQuestions.map((q, i) => (
                  <QuestionItem
                    key={q.id} q={q} idx={i} total={examQuestions.length}
                    mode="card"
                    isActive={q.id === activeQId}
                    onSelect={() => setActiveQId(q.id)}
                    onChange={updateQuestion}
                    onDelete={() => deleteQuestion(q.id)}
                    onMove={(dir) => moveQuestion(q.id, dir)}
                  />
                ))
            }
          </div>
        </div>

        {/* RIGHT — Active question editor */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", background: "#1e293b" }}>
          {activeQ
            ? (
              <QuestionItem
                key={activeQ.id}
                q={activeQ}
                idx={examQuestions.findIndex(q => q.id === activeQ.id)}
                total={examQuestions.length}
                mode="build"
                isActive={true}
                onChange={updateQuestion}
                onDelete={() => deleteQuestion(activeQ.id)}
                onMove={(dir) => moveQuestion(activeQ.id, dir)}
              />
            )
            : (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#475569" }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>✏</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f0", marginBottom: 6 }}>Question Editor</div>
                <div style={{ fontSize: 13, textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>
                  Add a question using the button above, or select one from the list on the left to start editing.
                </div>
                <div style={{ marginTop: 22, display: "flex", gap: 10 }}>
                  {Object.entries(QT_META).map(([type, m]) => (
                    <button key={type} onClick={() => addQuestion(type)}
                      style={{ padding: "10px 16px", border: `1.5px solid ${m.bg}`, borderRadius: 8, background: m.bg, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: m.color, display: "flex", alignItems: "center", gap: 6 }}>
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}
