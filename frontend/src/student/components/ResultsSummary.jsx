import React from "react";
import { Badge, Btn } from "../../components/ui";

export default function ResultsSummary({ exam, answers, submission, onBack }) {
  const { score, totalPoints } = submission;
  const pct  = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const pass = pct >= 75;

  const fmtAnswer = (q, ans) => {
    if (!ans) return "—";
    if (q.type === "MCQ") return `${ans}. ${q.options?.find(o => o.id === ans)?.label || ans}`;
    return ans;
  };

  return (
    <div className="exam-enter" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Result header */}
      <div style={{ background: pass ? "linear-gradient(135deg,#064e3b,#065f46)" : "linear-gradient(135deg,#7f1d1d,#991b1b)", padding: "20px 28px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0 }}>
            {pass ? "🏆" : "📋"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginBottom: 3 }}>{exam.title}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
              {score} / {totalPoints} points
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <div style={{ flex: 1, maxWidth: 200 }}>
                <div className="result-bar-wrap">
                  <div className="result-bar" style={{ width: `${pct}%`, background: pct >= 90 ? "#a7f3d0" : pct >= 75 ? "#6ee7b7" : "#fca5a5" }} />
                </div>
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: pct >= 90 ? "#6ee7b7" : pct >= 75 ? "#a7f3d0" : "#fca5a5" }}>{pct}%</span>
              <Badge color={pass ? "success" : "danger"}>{pass ? "PASSED" : "FAILED"}</Badge>
            </div>
          </div>
          <Btn variant="ghost" onClick={onBack} style={{ color: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.25)", flexShrink: 0 }}>
            ← Back to Courses
          </Btn>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: "flex", background: "#1e293b", flexShrink: 0 }}>
        {[
          ["Score",      `${score}/${totalPoints}`,                                                       "#a5f3fc"],
          ["Percentage", `${pct}%`,                                                                        pct >= 75 ? "#6ee7b7" : "#fca5a5"],
          ["Questions",  exam.questions?.length || 0,                                                      "#c4b5fd"],
          ["Correct",    exam.questions?.filter(q => answers[q.id] === q.correctAnswer).length || 0,       "#86efac"],
          ["Status",     pass ? "Passed" : "Failed",                                                       pass ? "#6ee7b7" : "#fca5a5"],
        ].map(([lbl, val, col]) => (
          <div key={lbl} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRight: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: col }}>{val}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Per-question breakdown (scrollable) */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px", background: "#0f172a" }}>
        {!exam.instantFeedback
          ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#e2e8f0", marginBottom: 6 }}>Answers Hidden</div>
              <div style={{ fontSize: 13 }}>The teacher has disabled instant feedback for this exam. Results will be released manually.</div>
            </div>
          )
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760, margin: "0 auto" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                📊 Answer Review
              </div>
              {(exam.questions || []).map((q, i) => {
                const given   = answers[q.id];
                const isRight = given === q.correctAnswer;
                return (
                  <div key={q.id} style={{ background: "#1e293b", border: `1.5px solid ${isRight ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: isRight ? "#d1fae5" : "#fee2e2", color: isRight ? "#065f46" : "#dc2626", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isRight ? "✓" : "✗"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>{i + 1}. {q.questionText}</div>

                        {/* MCQ */}
                        {q.type === "MCQ" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {(q.options || []).map(opt => (
                              <div key={opt.id}
                                className={`ans-opt ${opt.id === q.correctAnswer ? "correct-reveal" : ""} ${opt.id === given && !isRight ? "wrong-reveal" : ""}`}
                                style={{ cursor: "default", fontSize: 12 }}>
                                <span style={{ fontWeight: 800, color: "#94a3b8", minWidth: 18 }}>{opt.id}.</span>
                                <span style={{ flex: 1 }}>{opt.label}</span>
                                {opt.id === q.correctAnswer && <span style={{ fontSize: 10, fontWeight: 800, color: "#10b981" }}>✓ Correct</span>}
                                {opt.id === given && !isRight && <span style={{ fontSize: 10, fontWeight: 800, color: "#ef4444" }}>Your answer</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* T/F */}
                        {q.type === "TF" && (
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            <span>Your answer: <strong style={{ color: isRight ? "#065f46" : "#dc2626" }}>{given || "No answer"}</strong></span>
                            {!isRight && <span style={{ marginLeft: 12 }}>Correct: <strong style={{ color: "#34d399" }}>{q.correctAnswer}</strong></span>}
                          </div>
                        )}

                        {/* Identification */}
                        {q.type === "Identification" && (
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            <span>Your answer: <strong style={{ color: isRight ? "#065f46" : "#dc2626" }}>{given || "No answer"}</strong></span>
                            {!isRight && <span style={{ marginLeft: 12 }}>Expected: <strong style={{ color: "#34d399" }}>{q.correctAnswer}</strong></span>}
                          </div>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: isRight ? "#065f46" : "#94a3b8" }}>
                        {isRight ? `+${q.points}` : "0"} pts
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}
