import React, { useState } from "react";
import { QT_META } from "../../lib/constants";
import { Badge, Btn } from "../../components/ui";
import { Input } from "../../components/ui";
import useExamTimer from "./useExamTimer";
import ResultsSummary from "./ResultsSummary";

export default function ExamTaker({ exam, course, user, onBack, onSubmit }) {
  const [answers,     setAnswers]     = useState({});
  const [submitted,   setSubmitted]   = useState(false);
  const [result,      setResult]      = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const timer     = useExamTimer(exam.duration || "1 hour", () => handleSubmit(true));
  const questions = exam.questions || [];
  const answered  = Object.keys(answers).filter(k => answers[k]).length;
  const unanswered = questions.length - answered;

  const setAnswer = (qId, val) => setAnswers(prev => ({ ...prev, [qId]: val }));

  const handleSubmit = (autoSubmit = false) => {
    if (!autoSubmit && unanswered > 0 && !showConfirm) { setShowConfirm(true); return; }
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
      id:           `SUB-EX-${Date.now()}`,
      examId:       exam.id,
      courseId:     course?.id,
      studentId:    user.id,
      studentUuid:  user._uuid,
      answers:      { ...answers },
      questionResults,
      score,
      totalPoints:  exam.totalPoints,
      submittedAt:  new Date().toISOString(),
      graded:       true,
    };
    setResult(submission);
    setSubmitted(true);
    onSubmit(submission);
  };

  if (submitted && result) {
    return <ResultsSummary exam={exam} answers={answers} submission={result} onBack={onBack} />;
  }

  return (
    <div className="exam-enter" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Breadcrumb */}
      <div style={{ height: 46, background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0 }}>
        <button onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", border: "1px solid #334155", borderRadius: 6, background: "#0f172a", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#475569", fontFamily: "inherit" }}
          onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
          onMouseLeave={e => e.currentTarget.style.background = "#f8fafc"}>
          ← Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#475569", flex: 1 }}>
          <span>My Courses</span>
          {course && <><span>›</span><span>{course.code}</span></>}
          <span>›</span>
          <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{exam.title}</span>
        </div>
        <Badge color="warning">In Progress</Badge>
      </div>

      {/* Timer + meta strip */}
      <div style={{ background: "#1e293b", padding: "10px 22px", display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: "#1e293b" }}>{exam.title}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{exam.totalPoints} pts · {questions.length} question{questions.length !== 1 ? "s" : ""}</div>
        </div>
        {/* Answered progress */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: 90, height: 5, background: "rgba(255,255,255,.1)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${questions.length > 0 ? (answered / questions.length) * 100 : 0}%`, height: "100%", background: "#6ee7b7", borderRadius: 3, transition: "width .3s" }} />
          </div>
          <div style={{ fontSize: 10, color: "#64748b" }}>{answered}/{questions.length} answered</div>
        </div>
        {/* Timer */}
        <div style={{ textAlign: "center" }}>
          <div className={`exam-timer${timer.urgent ? " urgent" : ""}`} style={{ color: timer.urgent ? "#fca5a5" : "#e2e8f0" }}>
            {timer.display}
          </div>
          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>Remaining</div>
        </div>
      </div>

      {/* Confirm dialog overlay */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-box" style={{ background: "#1e293b", borderRadius: 12, width: 420, padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a", marginBottom: 8 }}>Submit Exam?</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              You have <strong style={{ color: "#ef4444" }}>{unanswered} unanswered question{unanswered !== 1 ? "s" : ""}</strong>. Unanswered questions will receive 0 points.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setShowConfirm(false)}>Review Answers</Btn>
              <Btn onClick={() => handleSubmit(true)}>Submit Anyway</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Questions list (scrollable) */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: "#0f172a" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {questions.map((q, i) => {
            const ans = answers[q.id] || "";
            return (
              <div key={q.id} style={{ background: "#1e293b", border: `1.5px solid ${ans ? "#c7d2fe" : "#e2e8f0"}`, borderRadius: 12, padding: "18px 20px", transition: "border-color .2s" }}>
                {/* Question header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: ans ? "#4f46e5" : "#0f172a", color: ans ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.6, marginBottom: 2 }}>{q.questionText}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: QT_META[q.type]?.color, background: QT_META[q.type]?.bg, padding: "1px 7px", borderRadius: 9999 }}>
                        {QT_META[q.type]?.label || q.type}
                      </span>
                      <span style={{ fontSize: 10, color: "#475569" }}>{q.points} pt{q.points !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>

                {/* MCQ */}
                {q.type === "MCQ" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 42 }}>
                    {(q.options || []).map(opt => (
                      <div key={opt.id}
                        className={`ans-opt${ans === opt.id ? " selected" : ""}`}
                        onClick={() => setAnswer(q.id, opt.id)}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${ans === opt.id ? "#4f46e5" : "#cbd5e1"}`, background: ans === opt.id ? "#4f46e5" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {ans === opt.id && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1e293b" }} />}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", minWidth: 18 }}>{opt.id}.</span>
                        <span style={{ fontSize: 13, color: "#cbd5e1" }}>{opt.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* True / False */}
                {q.type === "TF" && (
                  <div style={{ display: "flex", gap: 10, paddingLeft: 42 }}>
                    {["True", "False"].map(v => (
                      <button key={v}
                        className={`tf-btn${ans === v ? " selected-" + v.toLowerCase() : ""}`}
                        onClick={() => setAnswer(q.id, v)}
                        style={{ flex: 1 }}>
                        {v === "True" ? "✓ True" : "✗ False"}
                      </button>
                    ))}
                  </div>
                )}

                {/* Identification */}
                {q.type === "Identification" && (
                  <div style={{ paddingLeft: 42 }}>
                    <Input value={ans} onChange={e => setAnswer(q.id, e.target.value)} placeholder="Type your answer here…" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky submit footer */}
      <div style={{ height: 64, background: "#1e293b", borderTop: "1px solid #334155", display: "flex", alignItems: "center", padding: "0 24px", gap: 14, flexShrink: 0, boxShadow: "0 -4px 16px rgba(0,0,0,.06)" }}>
        <div style={{ flex: 1, fontSize: 12, color: "#64748b" }}>
          {unanswered > 0
            ? <span><strong style={{ color: "#ef4444" }}>{unanswered}</strong> question{unanswered !== 1 ? "s" : ""} unanswered</span>
            : <span style={{ color: "#34d399", fontWeight: 700 }}>✓ All questions answered</span>
          }
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="secondary" onClick={onBack}>Save &amp; Exit</Btn>
          <Btn onClick={() => handleSubmit(false)} style={{ paddingLeft: 22, paddingRight: 22 }}>
            Submit Exam →
          </Btn>
        </div>
      </div>
    </div>
  );
}
