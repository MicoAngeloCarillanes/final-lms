import React from "react";
import { QT_META } from "../../lib/constants";
import { Input } from "../../components/ui";

/**
 * Renders a single exam question in one of three modes:
 *   "build"   — full editor (active question in ExamBuilder)
 *   "card"    — collapsed summary card (question list panel)
 *   "preview" — read-only student-facing view (ExamPreview)
 */
export default function QuestionItem({ q, idx, total, mode, isActive, onSelect, onChange, onDelete, onMove }) {
  const meta = QT_META[q.type] || QT_META.MCQ;

  // ── Preview Mode ────────────────────────────────────────────────────────────
  if (mode === "preview") {
    return (
      <div className="q-card preview" style={{ padding: "16px 18px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1e293b", color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
            {idx + 1}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.5, marginBottom: 8 }}>
              {q.questionText || <em style={{ color: "#94a3b8" }}>No question text</em>}
            </div>

            {q.type === "MCQ" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {(q.options || []).map(opt => (
                  <div key={opt.id} className="mcq-option" style={{ cursor: "default" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #e2e8f0", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginRight: 4 }}>{opt.id}.</span>
                    <span style={{ fontSize: 13, color: "#cbd5e1" }}>{opt.label || <em style={{ color: "#94a3b8" }}>Option {opt.id}</em>}</span>
                  </div>
                ))}
              </div>
            )}

            {q.type === "TF" && (
              <div style={{ display: "flex", gap: 8 }}>
                {["True", "False"].map(v => (
                  <div key={v} className="tf-btn" style={{ flex: 1, padding: "9px", border: "1.5px solid #e2e8f0", borderRadius: 8, textAlign: "center", fontSize: 13, fontWeight: 700, color: "#94a3b8", background: "#0f172a" }}>{v}</div>
                ))}
              </div>
            )}

            {q.type === "Identification" && (
              <div style={{ padding: "9px 13px", background: "#0f172a", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>
                Write your answer here…
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: meta.color, background: meta.bg, padding: "3px 9px", borderRadius: 9999 }}>
            {q.points} pt{q.points !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    );
  }

  // ── Card Mode (collapsed) ───────────────────────────────────────────────────
  if (mode === "card") {
    return (
      <div className={`q-card${isActive ? " active" : ""}`}
        onClick={onSelect}
        style={{ padding: "11px 13px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: isActive ? "#4f46e5" : "#f1f5f9", color: isActive ? "#fff" : "#64748b", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {idx + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {q.questionText.trim() || <em style={{ color: "#94a3b8", fontWeight: 400 }}>Untitled question</em>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: meta.color, background: meta.bg, padding: "1px 6px", borderRadius: 9999 }}>{meta.label}</span>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{q.points} pt{q.points !== 1 ? "s" : ""}</span>
          </div>
        </div>
        {/* Reorder buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onMove(-1); }} disabled={idx === 0}
            style={{ border: "none", background: "none", cursor: idx === 0 ? "not-allowed" : "pointer", color: idx === 0 ? "#e2e8f0" : "#94a3b8", fontSize: 13, lineHeight: 1, padding: 2 }}>▲</button>
          <button onClick={e => { e.stopPropagation(); onMove(1); }} disabled={idx === total - 1}
            style={{ border: "none", background: "none", cursor: idx === total - 1 ? "not-allowed" : "pointer", color: idx === total - 1 ? "#e2e8f0" : "#94a3b8", fontSize: 13, lineHeight: 1, padding: 2 }}>▼</button>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ border: "none", background: "none", cursor: "pointer", color: "#fca5a5", fontSize: 15, lineHeight: 1, padding: "2px 4px", borderRadius: 4, flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
          onMouseLeave={e => e.currentTarget.style.color = "#fca5a5"}>✕</button>
      </div>
    );
  }

  // ── Build Mode (active editor) ──────────────────────────────────────────────
  const updField = (field, val) => onChange({ ...q, [field]: val });
  const updOpt   = (id, label) => onChange({ ...q, options: q.options.map(o => o.id === id ? { ...o, label } : o) });

  return (
    <div className="q-card active exam-builder-enter" style={{ padding: "16px 18px" }}>
      {/* Type pill + points */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: meta.color, background: meta.bg, padding: "4px 10px", borderRadius: 9999, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span>{meta.icon}</span> {meta.label}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Points:</label>
          <input type="number" min={1} max={100} value={q.points}
            onChange={e => updField("points", Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            style={{ width: 56, border: "1.5px solid #e2e8f0", borderRadius: 6, padding: "5px 8px", fontSize: 13, fontWeight: 800, textAlign: "center", fontFamily: "inherit", outline: "none", color: "#4f46e5" }}
            onFocus={e => e.target.style.borderColor = "#6366f1"}
            onBlur={e  => e.target.style.borderColor = "#334155"}
          />
        </div>
      </div>

      {/* Question text */}
      <textarea
        className="edit-textarea"
        rows={2}
        value={q.questionText}
        onChange={e => updField("questionText", e.target.value)}
        placeholder={`Enter question ${idx + 1} text…`}
        style={{ marginBottom: 12, resize: "vertical" }}
      />

      {/* MCQ options */}
      {q.type === "MCQ" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Options — click radio to mark correct</div>
          {(q.options || []).map(opt => (
            <div key={opt.id} className={`mcq-option${q.correctAnswer === opt.id ? " correct" : ""}`} style={{ cursor: "default" }}>
              <input type="radio" name={`correct-${q.id}`}
                checked={q.correctAnswer === opt.id}
                onChange={() => updField("correctAnswer", opt.id)}
                style={{ accentColor: "#10b981", width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
              />
              <span style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", minWidth: 16 }}>{opt.id}.</span>
              <input type="text" value={opt.label}
                onChange={e => updOpt(opt.id, e.target.value)}
                placeholder={`Option ${opt.id}`}
                style={{ flex: 1, border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", background: "transparent", color: "#e2e8f0" }}
              />
              {q.correctAnswer === opt.id && <span style={{ fontSize: 10, fontWeight: 800, color: "#10b981", flexShrink: 0 }}>✓ Correct</span>}
            </div>
          ))}
        </div>
      )}

      {/* True / False */}
      {q.type === "TF" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Correct Answer</div>
          <div style={{ display: "flex", gap: 10 }}>
            {["True", "False"].map(v => (
              <button key={v}
                className={`tf-btn${q.correctAnswer === v ? " selected-" + v.toLowerCase() : ""}`}
                onClick={() => updField("correctAnswer", v)}>
                {v === "True" ? "✓ True" : "✗ False"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Identification */}
      {q.type === "Identification" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Answer Key (keyword / exact phrase)</div>
          <Input
            value={q.correctAnswer}
            onChange={e => updField("correctAnswer", e.target.value)}
            placeholder="e.g. Binary Search Tree"
          />
        </div>
      )}
    </div>
  );
}
