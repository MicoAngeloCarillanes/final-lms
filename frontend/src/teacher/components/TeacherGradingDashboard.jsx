import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { gradeColor } from "../../lib/helpers";
import { MaterialType } from "../../lib/constants";
import { Badge, Btn } from "../../components/ui";
import GradingModal from "./GradingModal";

/**
 * Right pane for Lab/Assignment detail.
 * Shows enrolled students, submission status, submitted-at date,
 * and a "View & Grade" action per row.
 * Uses Supabase Realtime to push new/updated submissions to the teacher live.
 */
export default function TeacherGradingDashboard({ material, courseId, courseUuid, allUsers, user, gradeEntries, onGradeUpdate, enrollments }) {
  const [roster,      setRoster]      = useState([]);
  const [modalSub,    setModalSub]    = useState(null);
  const [savedToast,  setSavedToast]  = useState("");
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fmtDate = (iso) => iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  // ── Core roster fetch ────────────────────────────────────────────────────────
  const loadRoster = useRef(null);
  loadRoster.current = async () => {
    setRefreshing(true);
    const { data: subs } = await supabase
      .from("work_submissions")
      .select("*")
      .eq("material_id", material.id);

    const submissionsByUuid = {};
    (subs || []).forEach(r => { submissionsByUuid[r.student_id] = r; });

    const enrolled = (enrollments || []).filter(e => e.courseId === courseId);
    const rows = enrolled.map(e => {
      const userObj = allUsers.find(u => u.id === e.studentId);
      const sub     = submissionsByUuid[userObj?._uuid];
      return sub
        ? {
            id:          sub.submission_id,
            materialId:  material.id,
            studentId:   e.studentId,
            studentName: userObj?.fullName || e.studentId,
            fileName:    sub.file_name,
            fileSize:    sub.file_size_kb ? sub.file_size_kb * 1024 : null,
            fileUrl:     sub.file_url    || null,
            submittedAt: sub.submitted_at,
            status:      sub.status,          // 'Submitted' | 'Late' | 'Graded'
            grade:       sub.score,           // DB column is `score`
            feedback:    sub.feedback,
          }
        : {
            id: null, materialId: material.id,
            studentId:   e.studentId,
            studentName: userObj?.fullName || e.studentId,
            fileName: null, fileSize: null, submittedAt: null,
            fileUrl: null, status: "Pending", grade: null, feedback: null,
          };
    });
    setRoster(rows);
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  useEffect(() => { loadRoster.current(); }, [material.id, enrollments]);

  // ── Supabase Realtime — re-fetch roster whenever any submission changes ───────
  useEffect(() => {
    const channel = supabase
      .channel(`work_submissions:material_${material.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "work_submissions",
        filter: `material_id=eq.${material.id}`,
      }, () => { loadRoster.current(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [material.id]);

  // Merge in-session grade updates into the display list
  const displayRoster = roster.map(r => {
    const updated = gradeEntries.find(g => g.studentId === r.studentId && g.materialId === material.id);
    return updated ? { ...r, ...updated } : r;
  });

  const submitted = displayRoster.filter(r => r.status !== "Pending").length;
  const graded    = displayRoster.filter(r => r.grade  != null).length;
  const pending   = displayRoster.filter(r => r.status === "Pending").length;
  const avgGrade  = graded
    ? (displayRoster.filter(r => r.grade != null).reduce((s, r) => s + r.grade, 0) / graded).toFixed(1)
    : "—";

  const handleSaveGrade = async (updated) => {
    const g = updated.grade != null ? Number(updated.grade) : null;

    const { error } = await supabase.from("work_submissions").update({
      score:     g,
      feedback:  updated.feedback ?? null,
      status:    g != null ? "Graded" : updated.status,
      graded_by: user?._uuid ?? null,
      graded_at: new Date().toISOString(),
    }).eq("submission_id", updated.id);

    if (error) {
      setSavedToast(`❌ Save failed: ${error.message}`);
      setTimeout(() => setSavedToast(""), 3500);
      return;
    }

    // ── Auto-sync Project grade → class_standing.project ──────────────────────
    // When a "Project" material is graded, write the score directly into
    // class_standing so the teacher doesn't have to re-enter it manually.
    if (material.type === MaterialType.PROJECT && g != null && courseUuid) {
      const studentUser = allUsers.find(u => u.id === updated.studentId);
      const studentUuid = studentUser?._uuid;
      const term        = material.term || "Prelim";
      if (studentUuid) {
        await supabase.from("class_standing").upsert({
          student_id:  studentUuid,
          course_id:   courseUuid,
          term,
          project:     g,
          updated_by:  user?._uuid ?? null,
          updated_at:  new Date().toISOString(),
        }, { onConflict: "student_id,course_id,term", ignoreDuplicates: false });
      }
    }

    setRoster(prev => prev.map(r =>
      r.studentId === updated.studentId
        ? { ...updated, grade: g, status: g != null ? "Graded" : updated.status }
        : r
    ));
    onGradeUpdate({ ...updated, grade: g, status: g != null ? "Graded" : updated.status });
    setModalSub(null);
    setSavedToast(
      material.type === MaterialType.PROJECT && g != null
        ? `Grade saved & synced to Class Standing for ${updated.studentName}`
        : `Grade saved for ${updated.studentName}`
    );
    setTimeout(() => setSavedToast(""), 2500);
  };

  const subColor = { Submitted: "success", Late: "danger", Pending: "default", Graded: "amber" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Section header */}
      <div style={{ padding: "9px 15px", borderBottom: "1px solid #1e293b", background: "#0f172a", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>📋 Submissions & Grading</span>
          {material.type === MaterialType.PROJECT && (
            <span style={{ fontSize: 9, fontWeight: 800, color: "#c084fc", background: "rgba(192,132,252,.15)", padding: "2px 8px", borderRadius: 9999, border: "1px solid rgba(192,132,252,.3)" }}>
              🗂 Project — grade auto-syncs to Class Standing
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#10b981" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "timerPulse 2s infinite" }} />
            Live
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {savedToast && <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", background: "rgba(16,185,129,.15)", padding: "3px 8px", borderRadius: 5 }}>✓ {savedToast}</span>}
          {lastUpdated && <span style={{ fontSize: 10, color: "#94a3b8" }}>Updated {lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button
            onClick={() => loadRoster.current()}
            disabled={refreshing}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", border: "1px solid #334155", borderRadius: 5, background: "#1e293b", cursor: refreshing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: "#4f46e5", fontFamily: "inherit", opacity: refreshing ? 0.6 : 1 }}>
            {refreshing ? "⟳ Refreshing…" : "⟳ Refresh"}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        {[
          ["Total",     displayRoster.length,                       "#6366f1"],
          ["Submitted", submitted,                                   "#10b981"],
          ["Pending",   pending,                                     "#f59e0b"],
          ["Avg Grade", avgGrade + (avgGrade !== "—" ? "%" : ""),   "#3b82f6"],
        ].map(([lbl, val, col]) => (
          <div key={lbl} style={{ padding: "10px 12px", borderRight: "1px solid #1e293b", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: col }}>{val}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Submissions table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr style={{ background: "#1e293b" }}>
              {["Student", "Status", "Submitted At", "Grade", "Action"].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 9, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94a3b8", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRoster.map((row) => (
              <tr key={row.studentId} className="sub-row" style={{ borderBottom: "1px solid #1e293b" }}>
                <td style={{ padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(99,102,241,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#6366f1", flexShrink: 0 }}>
                      {row.studentName?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{row.studentName}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{row.studentId}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <Badge color={subColor[row.status] || "default"}>{row.status}</Badge>
                </td>
                <td style={{ padding: "8px 10px", color: "#64748b", fontSize: 11 }}>
                  {fmtDate(row.submittedAt)}
                </td>
                <td style={{ padding: "8px 10px" }}>
                  {row.grade != null
                    ? <span style={{ fontWeight: 900, fontSize: 14, color: gradeColor(row.grade) }}>{row.grade}%</span>
                    : <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>
                  }
                </td>
                <td style={{ padding: "8px 10px" }}>
                  {row.status !== "Pending"
                    ? <Btn size="sm" variant={row.grade != null ? "success" : "primary"} onClick={() => setModalSub(row)}>
                        {row.grade != null ? "✏ Edit" : "📝 Grade"}
                      </Btn>
                    : <span style={{ fontSize: 11, color: "#cbd5e1" }}>Awaiting</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalSub && (
        <GradingModal
          submission={modalSub}
          onSave={handleSaveGrade}
          onClose={() => setModalSub(null)}
        />
      )}
    </div>
  );
}
