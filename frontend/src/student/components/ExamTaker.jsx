import React, { useState, useEffect, useCallback, useMemo } from "react";
import { QT_META } from "../../lib/constants";
import { Badge, Btn, Input } from "../../components/ui";
import ResultsSummary from "./ResultsSummary";

/**
 * ExamTaker — Anti-cheat edition
 *  • 1 question per screen
 *  • Randomized question order
 *  • No backtracking
 *  • Per-question countdown timer (auto-advances on expire)
 *  • Start-time / end-time gate (exam locked until startTime, locked after endTime)
 */

function pad(n) { return String(n).padStart(2, "0"); }

function parseTimeToday(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatCountdown(totalSecs) {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${pad(m)}:${pad(s)}`;
}

export default function ExamTaker({ exam, course, user, onBack, onSubmit }) {
  // ── Time gate check ────────────────────────────────────────────────────────
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(t);
  }, []);

  const startDt = exam.startTime ? parseTimeToday(exam.startTime) : null;
  const endDt   = exam.endTime   ? parseTimeToday(exam.endTime)   : null;
  const tooEarly = startDt && now < startDt;
  const tooLate  = endDt   && now > endDt;

  // ── Question setup ─────────────────────────────────────────────────────────
  const questions = useMemo(() => {
    const qs = [...(exam.questions || [])];
    if (exam.randomize !== false) {
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
    }
    return qs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id]);

  const qTimerSecs = (exam.qTimer || 3) * 60; // minutes → seconds

  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [answers,     setAnswers]     = useState({});
  const [submitted,   setSubmitted]   = useState(false);
  const [result,      setResult]      = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [secsLeft,    setSecsLeft]    = useState(qTimerSecs);
  const [autoAdv,     setAutoAdv]     = useState(false); // flash when auto-advancing

  const currentQ  = questions[currentIdx] || null;
  const isLast    = currentIdx === questions.length - 1;
  const noBack    = exam.noBacktrack !== false;

  // ── Per-question timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (submitted || !currentQ) return;
    setSecsLeft(qTimerSecs);
    setAutoAdv(false);
  }, [currentIdx, currentQ?.id, submitted]);

  useEffect(() => {
    if (submitted || !currentQ) return;
    if (secsLeft <= 0) {
      setAutoAdv(true);
      const t = setTimeout(() => {
        setAutoAdv(false);
        if (isLast) doSubmit(true);
        else setCurrentIdx(i => i + 1);
      }, 800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setSecsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secsLeft, submitted, currentQ, isLast]);

  // ── Exam-level end-time auto-submit ────────────────────────────────────────
  useEffect(() => {
    if (!endDt || submitted) return;
    const ms = endDt - new Date();
    if (ms <= 0) { doSubmit(true); return; }
    const t = setTimeout(() => doSubmit(true), ms);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endDt, submitted]);

  const setAnswer = (qId, val) => setAnswers(prev => ({ ...prev, [qId]: val }));

  const doSubmit = useCallback((auto = false) => {
    setShowConfirm(false);
    let score = 0;
    const questionResults = questions.map(q => {
      const given   = answers[q.id] || "";
      const correct = q.correctAnswer || "";
      let isCorrect = false;
      if (q.type === "Identification") {
        isCorrect = given.trim().toLowerCase() === correct.trim().toLowerCase();
      } else {
        isCorrect = given === correct;
      }
      const pointsAwarded = isCorrect ? q.points : 0;
      score += pointsAwarded;
      return { questionId: q.id, givenAnswer: given || null, isCorrect, pointsAwarded };
    });
    const submission = {
      id:          `SUB-EX-${Date.now()}`,
      examId:      exam.id,
      courseId:    course?.id,
      studentId:   user.id,
      studentUuid: user._uuid,
      answers:     { ...answers },
      questionResults,
      score,
      totalPoints: exam.totalPoints,
      submittedAt: new Date().toISOString(),
      graded:      true,
    };
    setResult(submission);
    setSubmitted(true);
    onSubmit(submission);
  }, [questions, answers, exam, course, user, onSubmit]);

  const handleNext = () => {
    if (isLast) {
      const unanswered = questions.filter(q => !answers[q.id]).length;
      if (unanswered > 0) { setShowConfirm(true); return; }
      doSubmit(false);
    } else {
      setCurrentIdx(i => i + 1);
    }
  };

  if (submitted && result) {
    return <ResultsSummary exam={exam} answers={answers} submission={result} onBack={onBack} />;
  }

  // ── Time gate screens ──────────────────────────────────────────────────────
  if (tooEarly) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", background: "#0f172a", gap: 16 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontWeight: 900, fontSize: 18, color: "#f1f5f9" }}>Exam Not Yet Open</div>
        <div style={{ fontSize: 14, color: "#64748b", textAlign: "center" }}>
          This exam opens at <strong style={{ color: "#a5b4fc" }}>{exam.startTime}</strong>.<br />
          Please come back at that time.
        </div>
        <Btn variant="secondary" onClick={onBack}>← Go Back</Btn>
      </div>
    );
  }

  if (tooLate) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", background: "#0f172a", gap: 16 }}>
        <div style={{ fontSize: 48 }}>⏰</div>
        <div style={{ fontWeight: 900, fontSize: 18, color: "#f1f5f9" }}>Exam Closed</div>
        <div style={{ fontSize: 14, color: "#64748b", textAlign: "center" }}>
          This exam closed at <strong style={{ color: "#f87171" }}>{exam.endTime}</strong>.
        </div>
        <Btn variant="secondary" onClick={onBack}>← Go Back</Btn>
      </div>
    );
  }

  if (!currentQ) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", background: "#0f172a", gap: 12 }}>
        <div style={{ fontSize: 32 }}>📋</div>
        <div style={{ fontSize: 14, color: "#64748b" }}>No questions in this exam.</div>
        <Btn variant="secondary" onClick={onBack}>← Go Back</Btn>
      </div>
    );
  }

  const urgentQ  = secsLeft <= 30;
  const timerPct = (secsLeft / qTimerSecs) * 100;
  const timerColor = urgentQ ? "#f87171" : secsLeft < qTimerSecs * 0.4 ? "#fbbf24" : "#34d399";
  const ans = answers[currentQ.id] || "";

  return (
    <div className="exam-enter" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#0f172a" }}>

      {/* Top bar */}
      <div style={{ height: 48, background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", padding: "0 18px", gap: 14, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exam.title}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{exam.totalPoints} pts · {questions.length} questions</div>
        </div>

        {/* Question progress */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#a5b4fc" }}>{currentIdx + 1} / {questions.length}</div>
          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>Question</div>
        </div>

        {/* Exam end time countdown */}
        {endDt && (
          <div style={{ textAlign: "center", padding: "4px 10px", background: "rgba(239,68,68,.1)", borderRadius: 7, border: "1px solid rgba(239,68,68,.3)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#f87171" }}>
              Closes {exam.endTime}
            </div>
          </div>
        )}

        <Badge color="warning">In Progress</Badge>
      </div>

      {/* Per-question timer bar */}
      <div style={{ height: 6, background: "#1e293b", flexShrink: 0, position: "relative" }}>
        <div style={{ height: "100%", background: timerColor, width: `${timerPct}%`, transition: "width 1s linear, background .5s", borderRadius: "0 3px 3px 0" }} />
        {autoAdv && (
          <div style={{ position: "absolute", top: 6, right: 8, fontSize: 11, fontWeight: 800, color: "#f87171", background: "#1e293b", padding: "2px 8px", borderRadius: 6, border: "1px solid #f87171" }}>
            ⏰ Time's up — moving on…
          </div>
        )}
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 4, padding: "8px 18px", background: "#1e293b", borderBottom: "1px solid #334155", flexShrink: 0, overflowX: "auto" }}>
        {questions.map((q, i) => {
          const done = !!answers[q.id];
          const isCur = i === currentIdx;
          return (
            <div key={q.id}
              style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900,
                background: isCur ? "#4f46e5" : done ? "rgba(16,185,129,.25)" : "rgba(100,116,139,.15)",
                color:      isCur ? "#fff"    : done ? "#34d399"              : "#475569",
                border:     `2px solid ${isCur ? "#6366f1" : done ? "#34d399" : "#334155"}`,
                // no click if noBack and i < currentIdx
                cursor: (!noBack || i >= currentIdx) ? "pointer" : "not-allowed",
                opacity: noBack && i < currentIdx ? 0.4 : 1,
              }}
              onClick={() => { if (!noBack || i >= currentIdx) setCurrentIdx(i); }}
              title={noBack && i < currentIdx ? "Backtracking is disabled" : `Question ${i + 1}`}
            >
              {i + 1}
            </div>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, paddingLeft: 8, flexShrink: 0 }}>
          <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 900, color: timerColor, letterSpacing: "0.04em" }}>
            {formatCountdown(secsLeft)}
          </div>
          <span style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>per Q</span>
        </div>
      </div>

      {/* Single-question area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 720 }}>
          {/* Question header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#4f46e5", color: "#fff", fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {currentIdx + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.6, marginBottom: 8 }}>
                {currentQ.questionText}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: QT_META[currentQ.type]?.color, background: QT_META[currentQ.type]?.bg, padding: "2px 8px", borderRadius: 9999 }}>
                  {QT_META[currentQ.type]?.label || currentQ.type}
                </span>
                <span style={{ fontSize: 10, color: "#475569" }}>{currentQ.points} pt{currentQ.points !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>

          {/* Answer area */}
          <div style={{ background: "#1e293b", borderRadius: 12, border: `1.5px solid ${ans ? "#6366f1" : "#334155"}`, padding: "20px 24px", transition: "border-color .2s" }}>
            {/* MCQ */}
            {currentQ.type === "MCQ" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(currentQ.options || []).map(opt => (
                  <div key={opt.id}
                    className={`ans-opt${ans === opt.id ? " selected" : ""}`}
                    onClick={() => setAnswer(currentQ.id, opt.id)}
                    style={{ padding: "13px 16px" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${ans === opt.id ? "#4f46e5" : "#334155"}`, background: ans === opt.id ? "#4f46e5" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {ans === opt.id && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#475569", minWidth: 18 }}>{opt.id}.</span>
                    <span style={{ fontSize: 14, color: "#cbd5e1" }}>{opt.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* TF */}
            {currentQ.type === "TF" && (
              <div style={{ display: "flex", gap: 12 }}>
                {["True", "False"].map(v => (
                  <button key={v}
                    className={`tf-btn${ans === v ? " selected-" + v.toLowerCase() : ""}`}
                    onClick={() => setAnswer(currentQ.id, v)}
                    style={{ flex: 1, padding: "16px", fontSize: 15 }}>
                    {v === "True" ? "✓ True" : "✗ False"}
                  </button>
                ))}
              </div>
            )}

            {/* Identification */}
            {currentQ.type === "Identification" && (
              <Input value={ans} onChange={e => setAnswer(currentQ.id, e.target.value)}
                placeholder="Type your answer here…"
                style={{ fontSize: 15, padding: "12px 14px" }}
                onKeyDown={e => e.key === "Enter" && !isLast && setCurrentIdx(i => i + 1)} />
            )}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, alignItems: "center" }}>
            {/* Back button — disabled if noBack */}
            <Btn variant="secondary"
              disabled={noBack || currentIdx === 0}
              onClick={() => setCurrentIdx(i => i - 1)}
              style={{ opacity: (noBack || currentIdx === 0) ? 0.35 : 1, cursor: (noBack || currentIdx === 0) ? "not-allowed" : "pointer" }}>
              {noBack ? "🚫 No Backtrack" : "← Previous"}
            </Btn>

            <div style={{ fontSize: 12, color: "#475569" }}>
              {!ans && <span style={{ color: "#64748b" }}>⚪ Not answered</span>}
              {ans  && <span style={{ color: "#34d399", fontWeight: 700 }}>✓ Answered</span>}
            </div>

            <Btn onClick={handleNext}>
              {isLast ? "Submit Exam →" : "Next →"}
            </Btn>
          </div>
        </div>
      </div>

      {/* Confirm submit dialog */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-box" style={{ background: "#1e293b", borderRadius: 12, width: 420, padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#f1f5f9", marginBottom: 8 }}>Submit Exam?</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              You have <strong style={{ color: "#f87171" }}>{questions.filter(q => !answers[q.id]).length} unanswered question{questions.filter(q => !answers[q.id]).length !== 1 ? "s" : ""}</strong>.<br />
              Unanswered questions will receive 0 points.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setShowConfirm(false)}>Review</Btn>
              <Btn onClick={() => doSubmit(true)}>Submit Anyway</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
