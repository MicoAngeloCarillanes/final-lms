import React, { useState } from "react";
import { supabase } from "../../supabaseClient";
import { EXAM_TERMS, TERM_META } from "../../lib/constants";
import { gradeColor, csGradePct } from "../../lib/helpers";
import { Btn } from "../../components/ui";

/**
 * Teacher inputs Project / Recitation / Attendance (each /100) per term
 * for one student × course combination. Shows auto-computed CS% per term.
 */
export default function ClassStandingModal({ student, course, existing, teacherUuid, onSave, onClose }) {
  const initVals = () => {
    const s = {};
    EXAM_TERMS.forEach(t => {
      const e = existing.find(x => x.term === t);
      s[t] = { project: e?.project ?? "", recitation: e?.recitation ?? "", attendance: e?.attendance ?? "" };
    });
    return s;
  };

  const [vals,   setVals]   = useState(initVals);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const upd = (term, field, raw) => {
    const v = raw === "" ? "" : Math.max(0, Math.min(100, Number(raw)));
    setVals(p => ({ ...p, [term]: { ...p[term], [field]: v } }));
  };

  const csFor = (term) => {
    const v   = vals[term];
    const arr = [v.project, v.recitation, v.attendance].filter(x => x !== "");
    return arr.length ? Math.round(arr.reduce((a, b) => a + Number(b), 0) / arr.length) : null;
  };

  const handleSave = async () => {
    setSaving(true); setErr("");

    if (!student._uuid) {
      setErr("Error: student record could not be resolved. Please reload and try again.");
      setSaving(false);
      return;
    }
    const rows = EXAM_TERMS
      .map(term => {
        const v = vals[term];
        return {
          student_id:  student._uuid,
          course_id:   course._uuid,
          term,
          project:    v.project    !== "" ? Number(v.project)    : null,
          recitation: v.recitation !== "" ? Number(v.recitation) : null,
          attendance: v.attendance !== "" ? Number(v.attendance) : null,
          updated_by: teacherUuid,
          updated_at: new Date().toISOString(),
        };
      })
      .filter(r => r.project != null || r.recitation != null || r.attendance != null);

    if (!rows.length) { setSaving(false); onClose(); return; }

    const { error } = await supabase
      .from("class_standing")
      .upsert(rows, { onConflict: "student_id,course_id,term" });

    setSaving(false);
    if (error) { setErr("Error: " + error.message); return; }

    onSave(rows.map(r => ({
      studentUuid: r.student_id, courseUuid: r.course_id, term: r.term,
      project: r.project, recitation: r.recitation, attendance: r.attendance,
    })));
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ background: "#1e293b", borderRadius: 14, width: 660, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.25)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #334155", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: "#f1f5f9" }}>🏆 Class Standing Grades</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {student.fullName} <span style={{ color: "#475569" }}>·</span> {course.code}: {course.name}
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#475569", fontSize: 22, lineHeight: 1 }}
            onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
            onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {/* Formula chip */}
          <div style={{ background: "rgba(16,185,129,.12)", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12 }}>
            <span style={{ fontWeight: 800, color: "#34d399" }}>Grade Formula: </span>
            <span style={{ color: "#34d399" }}>Course Work <strong>30%</strong> + Class Standing <strong>30%</strong> + Exams <strong>40%</strong></span>
            <div style={{ fontSize: 11, color: "#16a34a", marginTop: 3 }}>
              Class Standing % = average(Project + Recitation + Attendance) — each scored out of 100
            </div>
          </div>

          {/* Input grid */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#1e293b" }}>
                {["Term", "Project /100", "Recitation /100", "Attendance /100", "CS Grade"].map(h => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXAM_TERMS.map((term, i) => {
                const cs = csFor(term);
                const tm = TERM_META[term];
                return (
                  <tr key={term} style={{ borderBottom: "1px solid #1e293b", background: i % 2 === 0 ? "#1e293b" : "#0f172a" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: tm.color, background: tm.bg, padding: "3px 10px", borderRadius: 9999 }}>{term}</span>
                    </td>
                    {["project", "recitation", "attendance"].map(field => (
                      <td key={field} style={{ padding: "8px 12px" }}>
                        <input type="number" min={0} max={100}
                          value={vals[term][field]}
                          onChange={e => upd(term, field, e.target.value)}
                          placeholder="—"
                          style={{ width: 76, border: "1.5px solid #334155", background: "#0f172a", color: "#e2e8f0", borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "inherit", textAlign: "center", outline: "none" }}
                          onFocus={e => e.target.style.borderColor = "#6366f1"}
                          onBlur={e  => e.target.style.borderColor = "#334155"}
                        />
                      </td>
                    ))}
                    <td style={{ padding: "10px 12px" }}>
                      {cs != null
                        ? <span style={{ fontWeight: 900, fontSize: 15, color: gradeColor(cs) }}>{cs}%</span>
                        : <span style={{ color: "#475569", fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #334155", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          {err ? <span style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>{err}</span> : <span />}
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "💾 Save Class Standing"}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
