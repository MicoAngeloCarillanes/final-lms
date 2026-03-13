import React, { useState } from "react";
import { letterGrade, gradeColor, fmtSize, fmtDate } from "../../lib/helpers";
import { Btn } from "../../components/ui";

export default function GradingModal({ submission, onSave, onClose }) {
  const [grade,    setGrade]    = useState(submission.grade    ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [saved,    setSaved]    = useState(false);

  const handleSave = () => {
    const g = grade === "" ? null : Math.max(0, Math.min(100, Number(grade)));
    onSave({ ...submission, grade: g, feedback: feedback.trim() || null });
    setSaved(true);
    setTimeout(onClose, 900);
  };

  const subStatusColor = {
    Submitted: ["#d1fae5", "#065f46"],
    Late:      ["#fee2e2", "#991b1b"],
    Pending:   ["rgba(100,116,139,.2)", "#94a3b8"],
    Graded:    ["#fef3c7", "#92400e"],
  };
  const [sbg, stxt] = subStatusColor[submission.status] || subStatusColor.Pending;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ background: "#1e293b", borderRadius: 14, width: 520, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.25)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #334155", display: "flex", alignItems: "flex-start", justifyContent: "space-between", background: "#0f172a", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", letterSpacing: "-0.02em" }}>Review Submission</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{submission.studentName}</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#475569", fontSize: 22, lineHeight: 1, padding: 2 }}
            onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
            onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Submission metadata card */}
          <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "13px 15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 26 }}>{submission.fileName?.endsWith(".pdf") ? "📄" : "📝"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {submission.fileName || "No file submitted"}
                </div>
                {submission.fileSize && <div style={{ fontSize: 11, color: "#64748b" }}>{fmtSize(submission.fileSize)}</div>}
              </div>
              <span style={{ background: sbg, color: stxt, padding: "3px 9px", borderRadius: 9999, fontSize: 11, fontWeight: 800 }}>
                {submission.status}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["Student ID", submission.studentId], ["Submitted At", fmtDate(submission.submittedAt)]].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{l}</div>
                  <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
            {/* View submitted file */}
            {submission.fileName && (
              <div style={{ marginTop: 10 }}>
                {submission.fileUrl
                  ? (
                    <Btn variant="ghost" size="sm" style={{ border: "1px solid #c7d2fe" }}
                      onClick={() => window.open(submission.fileUrl, "_blank", "noopener,noreferrer")}>
                      👁 View Submitted File
                    </Btn>
                  ) : (
                    <span style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>
                      ⚠ File recorded (pre-storage) — no URL available
                    </span>
                  )
                }
              </div>
            )}
          </div>

          {/* Grading section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>Grade Entry</div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
                  Score (0–100) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number" min={0} max={100} value={grade}
                    onChange={e => setGrade(e.target.value)}
                    placeholder="—"
                    style={{ width: 80, border: "1px solid #334155", borderRadius: 7, padding: "9px 12px", fontSize: 20, fontWeight: 900, textAlign: "center", color: "#4f46e5", fontFamily: "inherit", outline: "none" }}
                    onFocus={e => e.target.style.borderColor = "#6366f1"}
                    onBlur={e  => e.target.style.borderColor = "#334155"}
                  />
                  {grade !== "" && !isNaN(Number(grade)) && (
                    <div style={{ fontSize: 22, fontWeight: 900, color: gradeColor(Number(grade)) }}>
                      {letterGrade(Number(grade))}
                    </div>
                  )}
                  {grade !== "" && !isNaN(Number(grade)) && (
                    <div style={{ flex: 1, height: 8, background: "#0f172a", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, Number(grade))}%`, height: "100%", background: gradeColor(Number(grade)), borderRadius: 4, transition: "width .3s" }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Feedback */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
                Feedback / Comments
              </label>
              <textarea
                className="edit-textarea"
                rows={4}
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Write feedback for the student (optional)…"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "13px 20px", borderTop: "1px solid #334155", display: "flex", gap: 8, justifyContent: "flex-end", background: "#0f172a", flexShrink: 0 }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          {saved
            ? <div style={{ padding: "8px 16px", background: "rgba(16,185,129,.15)", borderRadius: 6, fontSize: 13, fontWeight: 700, color: "#34d399", display: "flex", alignItems: "center", gap: 6 }}>✓ Saved!</div>
            : <Btn onClick={handleSave} disabled={grade === ""}>💾 Save Grade</Btn>
          }
        </div>
      </div>
    </div>
  );
}
