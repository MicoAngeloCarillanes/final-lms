import React from "react";
import { Btn } from "../../components/ui";
import QuestionItem from "./QuestionItem";

export default function ExamPreview({ exam, onClose }) {
  const totalPts = exam.questions.reduce((s, q) => s + q.points, 0);

  return (
    <div className="mat-detail-enter" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Preview banner */}
      <div style={{ background: "#0f172a", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#a5f3fc", background: "rgba(165,243,252,.12)", padding: "4px 10px", borderRadius: 9999, letterSpacing: "0.04em" }}>
          👁 STUDENT PREVIEW
        </span>
        <span style={{ color: "#64748b", fontSize: 13, flex: 1 }}>This is how the exam will appear to students</span>
        <Btn variant="ghost" size="sm" onClick={onClose} style={{ color: "#a5b4fc", border: "1px solid rgba(165,180,252,.3)" }}>
          ← Back to Builder
        </Btn>
      </div>

      {/* Exam paper */}
      <div style={{ flex: 1, overflowY: "auto", background: "#0f172a", padding: "24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", background: "#1e293b", borderRadius: 12, border: "1px solid #334155", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,.07)" }}>
          {/* Header */}
          <div style={{ background: "#1e293b", padding: "20px 28px" }}>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#fff", letterSpacing: "-0.02em", marginBottom: 4 }}>
              {exam.title || "Untitled Exam"}
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 12, color: "#94a3b8" }}>
              {exam.date     && <span>📅 {exam.date}</span>}
              {exam.duration && <span>⏱ {exam.duration}</span>}
              <span>📊 {totalPts} total points</span>
              <span>📋 {exam.questions.length} question{exam.questions.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Instruction strip */}
          <div style={{ background: "#0f172a", borderBottom: "1px solid #334155", padding: "9px 28px" }}>
            <span style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>Read each item carefully. Write your answers legibly.</span>
          </div>

          {/* Questions */}
          <div style={{ padding: "22px 28px" }}>
            {exam.questions.length === 0
              ? <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0", fontSize: 14 }}>No questions added yet.</div>
              : exam.questions.map((q, i) => (
                  <QuestionItem key={q.id} q={q} idx={i} total={exam.questions.length} mode="preview" />
                ))
            }
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #1e293b", padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f172a" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>— End of Exam —</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#4f46e5" }}>Total: {totalPts} pts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
