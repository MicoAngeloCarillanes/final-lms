import React, { useState, useRef } from "react";
import { QT_META, EXAM_TERMS, termFromDate } from "../../lib/constants";
import { useCurrentTerm, termFromDateWithSettings, fetchTermSettings } from "../../lib/termSettingsHelper";
import { Btn, Input } from "../../components/ui";
import { ExamSchema, blankQ } from "./examSchema";
import QuestionItem from "./QuestionItem";
import ExamPreview from "./ExamPreview";

/**
 * ExamBuilder — full-screen exam editor.
 * QoL: start_time + end_time fields; term auto-set from exam date.
 * Anti-cheat settings: per-question timer (minutes), randomize, no backtrack.
 */
export default function ExamBuilder({ course, initialExam, onSave, onBack }) {
  const [title,       setTitle]       = useState(initialExam?.title      || "");
  const [date,        setDate]        = useState(initialExam?.date       || "");
  const [startTime,   setStartTime]   = useState(initialExam?.startTime  || "");
  const [endTime,     setEndTime]     = useState(initialExam?.endTime    || "");
  const autoTerm = useCurrentTerm();
  const [term,        setTerm]        = useState(initialExam?.term       || termFromDate());
  // Update term default once DB settings load (only if user hasn't manually changed it yet)
  React.useEffect(() => {
    if (!initialExam?.term) setTerm(autoTerm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTerm]);
  const [qTimer,      setQTimer]      = useState(initialExam?.qTimer     || 3);   // minutes per question
  const [randomize,   setRandomize]   = useState(initialExam?.randomize  ?? true);
  const [noBacktrack, setNoBacktrack] = useState(initialExam?.noBacktrack ?? true);
  const [examType,    setExamType]    = useState(initialExam?.examType   || "Exam"); // "Exam" | "Quiz"

  const [examQuestions, setExamQuestions] = useState(initialExam?.questions || []);
  const [activeQId,     setActiveQId]     = useState(null);
  const [showTypeMenu,  setShowTypeMenu]  = useState(false);
  const [previewMode,   setPreviewMode]   = useState(false);
  const [valErrors,     setValErrors]     = useState([]);
  const [saved,         setSaved]         = useState(false);
  const typeMenuRef = useRef(null);

  const activeQ  = examQuestions.find(q => q.id === activeQId) || null;
  const totalPts = examQuestions.reduce((s, q) => s + (q.points || 0), 0);

  // Auto-set term when date changes (uses DB settings if loaded)
  const handleDateChange = async (val) => {
    setDate(val);
    if (val) {
      const settings = await fetchTermSettings();
      setTerm(termFromDateWithSettings(new Date(val), settings));
    }
  };

  // Validate start < end time
  const timeError = startTime && endTime && startTime >= endTime
    ? "End time must be after start time"
    : null;

  const addQuestion = (type) => {
    const q = blankQ(type);
    setExamQuestions(prev => [...prev, q]);
    setActiveQId(q.id);
    setShowTypeMenu(false);
    setValErrors([]);
  };

  const updateQuestion = (updated) =>
    setExamQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));

  const deleteQuestion = (id) => {
    setExamQuestions(prev => {
      const next = prev.filter(q => q.id !== id);
      if (activeQId === id) setActiveQId(next[next.length - 1]?.id || null);
      return next;
    });
  };

  const moveQuestion = (id, dir) => {
    setExamQuestions(prev => {
      const idx = prev.findIndex(q => q.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const handleSave = () => {
    if (timeError) { setValErrors([timeError]); return; }
    const examData = {
      title, date, startTime, endTime, term,
      examType, qTimer: Number(qTimer) || 3,
      randomize, noBacktrack,
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
    setTimeout(() => onSave(examData), 700);
  };

  if (previewMode) {
    return (
      <ExamPreview
        exam={{ title, date, startTime, endTime, questions: examQuestions }}
        onClose={() => setPreviewMode(false)}
      />
    );
  }

  const S_label = { fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 };
  const S_toggle = (on) => ({
    width: 38, height: 21, borderRadius: 12, background: on ? "#4f46e5" : "#334155",
    position: "relative", cursor: "pointer", flexShrink: 0, transition: "background .2s",
  });
  const S_dot = (on) => ({
    position: "absolute", top: 2, left: on ? 19 : 2, width: 17, height: 17,
    borderRadius: "50%", background: "#fff", transition: "left .2s",
  });

  return (
    <div className="exam-builder-enter" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Breadcrumb */}
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

      {/* Meta row 1 — title, type, term, date */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Exam / Quiz title…"
          style={{ flex: 2, minWidth: 160, border: "1.5px solid #334155", borderRadius: 7, padding: "7px 11px", fontSize: 14, fontWeight: 800, fontFamily: "inherit", color: "#f1f5f9", background: "#0f172a", outline: "none" }}
          onFocus={e => e.target.style.borderColor = "#6366f1"}
          onBlur={e  => e.target.style.borderColor = "#334155"} />

        {/* Exam vs Quiz */}
        <select value={examType} onChange={e => setExamType(e.target.value)}
          style={{ border: "1.5px solid #334155", borderRadius: 7, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", color: "#f1f5f9", background: "#0f172a", cursor: "pointer" }}>
          <option value="Exam">📝 Exam (40%)</option>
          <option value="Quiz">✏ Quiz (30%)</option>
        </select>

        {/* Term — auto-set, still editable */}
        <select value={term} onChange={e => setTerm(e.target.value)}
          style={{ border: `1.5px solid ${term ? "#334155" : "#ef4444"}`, borderRadius: 7, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", color: term ? "#f1f5f9" : "#94a3b8", background: "#0f172a", cursor: "pointer" }}>
          <option value="" disabled>— Term —</option>
          {EXAM_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Date — drives auto-term */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={S_label}>Date</div>
          <Input type="date" value={date} onChange={e => handleDateChange(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            style={{ width: 140 }} />
        </div>

        {/* Total pts */}
        <div style={{ flexShrink: 0, textAlign: "center", padding: "5px 14px", background: totalPts > 0 ? "rgba(99,102,241,.15)" : "#0f172a", borderRadius: 8, border: "1.5px solid", borderColor: totalPts > 0 ? "#6366f1" : "#334155" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: totalPts > 0 ? "#a5b4fc" : "#475569", lineHeight: 1 }}>{totalPts}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Total pts</div>
        </div>
      </div>

      {/* Meta row 2 — start/end time + anti-cheat settings */}
      <div style={{ background: "#0f172a", borderBottom: "1px solid #334155", padding: "8px 18px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0, flexWrap: "wrap" }}>
        {/* Start time */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={S_label}>Start Time</div>
          <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ width: 120 }} />
        </div>

        {/* End time */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ ...S_label, color: timeError ? "#f87171" : "#64748b" }}>End Time {timeError && "⚠"}</div>
          <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
            style={{ width: 120, borderColor: timeError ? "#ef4444" : undefined }} />
        </div>
        {timeError && <span style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>{timeError}</span>}

        <div style={{ width: 1, height: 32, background: "#334155", flexShrink: 0 }} />

        {/* Per-question timer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={S_label}>⏱ Mins / Question</div>
          <input type="number" min={1} max={60} value={qTimer} onChange={e => setQTimer(e.target.value)}
            style={{ width: 70, border: "1px solid #334155", borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "inherit", color: "#f1f5f9", background: "#1e293b", outline: "none" }} />
        </div>

        {/* Randomize toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={S_toggle(randomize)} onClick={() => setRandomize(v => !v)}>
            <div style={S_dot(randomize)} />
          </div>
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>🔀 Randomize</span>
        </div>

        {/* No backtrack toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={S_toggle(noBacktrack)} onClick={() => setNoBacktrack(v => !v)}>
            <div style={S_dot(noBacktrack)} />
          </div>
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>🚫 No Backtrack</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 7, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", background: "#1e293b", padding: "4px 10px", borderRadius: 9999, border: "1px solid #334155" }}>
            {examQuestions.length} question{examQuestions.length !== 1 ? "s" : ""}
          </span>
          <Btn variant="secondary" onClick={() => { setValErrors([]); setPreviewMode(true); }}>👁 Preview</Btn>
          {saved
            ? <div style={{ padding: "7px 16px", background: "rgba(16,185,129,.15)", borderRadius: 6, fontSize: 13, fontWeight: 800, color: "#34d399" }}>✓ Saved!</div>
            : <Btn onClick={handleSave}>💾 Save {examType}</Btn>
          }
        </div>
      </div>

      {/* Validation errors */}
      {valErrors.length > 0 && (
        <div style={{ padding: "8px 18px", background: "#1e293b", borderBottom: "1px solid #fecaca", flexShrink: 0 }}>
          {valErrors.map((e, i) => (
            <div key={i} className="val-error" style={{ marginBottom: i < valErrors.length - 1 ? 5 : 0 }}>⚠ {e}</div>
          ))}
        </div>
      )}

      {/* Two-column body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* LEFT — Question list */}
        <div style={{ width: 310, borderRight: "1px solid #334155", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", flexShrink: 0 }}>
          <div style={{ padding: "10px 13px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>Question List</div>
            <div style={{ position: "relative" }} ref={typeMenuRef}>
              <Btn size="sm" onClick={() => setShowTypeMenu(v => !v)}>＋ Add ▾</Btn>
              {showTypeMenu && (
                <div className="qtype-menu" style={{ right: 0, left: "auto" }}>
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
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 11px 14px" }}>
            {examQuestions.length === 0
              ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: "#475569" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>No questions yet</div>
                  <div style={{ fontSize: 12 }}>Click "Add" to begin.</div>
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
                  Add a question using the button in the left panel, or select one from the list.
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
