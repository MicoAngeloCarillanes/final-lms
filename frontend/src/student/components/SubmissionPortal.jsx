import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { MaterialType, SubmissionStatus } from "../../lib/constants";
import { fmtSize, fileIcon, fmtDate, safeFileName } from "../../lib/helpers";
import { uploadFileToStorage } from "../../lib/storageHelpers";
import { StatusBadge } from "./TypeBadge";
import FileUploadZone from "./FileUploadZone";
import { Btn } from "../../components/ui";

export default function SubmissionPortal({ material, user, existingSubmission, onSubmissionSaved }) {
  const [file,      setFile]      = useState(() =>
    existingSubmission?.fileName ? { name: existingSubmission.fileName, size: existingSubmission.fileSize || 0 } : null
  );
  const [status,    setStatus]    = useState(() => {
    if (!existingSubmission?.fileName) return SubmissionStatus.NOT_SUBMITTED;
    return existingSubmission.isLate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED;
  });
  const [submitted, setSubmitted] = useState(() => !!existingSubmission?.fileName);
  const [submitAt,  setSubmitAt]  = useState(() => existingSubmission?.submittedAt || null);
  const [toast,     setToast]     = useState("");

  // Sync if existingSubmission arrives asynchronously (parent fetches after mount)
  useEffect(() => {
    if (existingSubmission?.fileName && !submitted) {
      setFile({ name: existingSubmission.fileName, size: existingSubmission.fileSize || 0 });
      setStatus(existingSubmission.isLate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED);
      setSubmitted(true);
      setSubmitAt(existingSubmission.submittedAt || null);
    }
  }, [existingSubmission]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const dueDate   = material.dueDate ? new Date(material.dueDate) : null;
  const isLate    = dueDate && new Date() > dueDate;

  const submit = async () => {
    if (!file) return;
    const now      = new Date().toISOString();
    const newStatus = isLate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED;
    const dbStatus  = isLate ? "Late" : "Submitted";

    if (user?._uuid && material?.id) {
      let fileUrl = null;
      if (file instanceof File) {
        const storagePath = `${material.id}/${user._uuid}/${Date.now()}_${safeFileName(file.name)}`;
        try {
          showToast("Uploading file…");
          fileUrl = await uploadFileToStorage("submissions", storagePath, file);
        } catch (uploadErr) {
          showToast("Upload failed: " + uploadErr.message);
          return;
        }
      }

      const { error } = await supabase.from("work_submissions").upsert({
        material_id:  material.id,
        student_id:   user._uuid,
        file_name:    file.name,
        file_size_kb: file.size ? Math.ceil(file.size / 1024) : null,
        file_url:     fileUrl,
        submitted_at: now,
        status:       dbStatus,
      }, { onConflict: "material_id,student_id" });
      if (error) { showToast("Error saving: " + error.message); return; }
    }

    setSubmitted(true);
    setSubmitAt(now);
    setStatus(newStatus);
    onSubmissionSaved?.({ materialId: material.id, fileName: file.name, fileSize: file.size || 0,
      submittedAt: now, isLate: !!isLate, status: newStatus });
    showToast(isLate ? "Submitted (late — check policy)" : "Submitted successfully!");
  };

  const replace = () => {
    setFile(null); setSubmitted(false);
    setStatus(SubmissionStatus.NOT_SUBMITTED); setSubmitAt(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", overflowY: "auto" }}>
      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#f1f5f9" }}>Submission Portal</div>
        <StatusBadge status={status} />
      </div>

      {/* Due date banner */}
      {dueDate && (
        <div style={{ background: isLate ? "#fee2e2" : "#f0fdf4", border: `1px solid ${isLate ? "#fecaca" : "#bbf7d0"}`, borderRadius: 8, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 15 }}>{isLate ? "⚠" : "📅"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: isLate ? "#991b1b" : "#14532d", textTransform: "uppercase", letterSpacing: "0.05em" }}>{isLate ? "Overdue" : "Due Date"}</div>
            <div style={{ fontSize: 11, color: isLate ? "#dc2626" : "#15803d" }}>{fmtDate(material.dueDate)}</div>
          </div>
          {material.points && <div style={{ fontSize: 13, fontWeight: 900, color: isLate ? "#dc2626" : "#15803d" }}>{material.points}pts</div>}
        </div>
      )}

      {/* Upload zone — hidden once submitted */}
      {!submitted && <FileUploadZone onFile={setFile} />}

      {/* Selected file card */}
      {file && (
        <div className="mat-fade-up" style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 22 }}>{fileIcon(file.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
              {fmtSize(file.size)}
              {submitted && submitAt && <span style={{ marginLeft: 6 }}>· {fmtDate(submitAt)}</span>}
            </div>
          </div>
          {!submitted && <button onClick={() => setFile(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18, lineHeight: 1 }}>×</button>}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {!submitted
          ? <Btn onClick={submit} disabled={!file} style={{ flex: 1, justifyContent: "center" }}>
              ↑ Submit {material.type === MaterialType.LAB ? "Lab" : material.type === "Project" ? "Project" : "Assignment"}
            </Btn>
          : <>
              <div style={{ flex: 1, padding: "8px 12px", background: "rgba(16,185,129,.15)", borderRadius: 6, fontSize: 12, fontWeight: 700, color: "#34d399", display: "flex", alignItems: "center", gap: 6 }}>
                ✓ {status === SubmissionStatus.LATE ? "Late submission received" : "Confirmed"}
              </div>
              <Btn variant="ghost" size="sm" onClick={replace}>Replace</Btn>
            </>
        }
      </div>

      {/* Toast */}
      {toast && (
        <div className="mat-fade-up" style={{ background: "#0f172a", color: "#a5f3fc", borderRadius: 7, padding: "8px 12px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {toast}
        </div>
      )}

      {/* Checklist */}
      <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px", flexShrink: 0, marginTop: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#f1f5f9", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>Checklist</div>
        {[
          [!!file,                              "File attached (.pdf or .docx)"],
          [dueDate && new Date() <= dueDate,    "Submitted before due date"],
          [submitted,                           "Confirmation received"],
        ].map(([done, lbl], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, fontSize: 11, color: done ? "#065f46" : "#94a3b8" }}>
            <span style={{ fontSize: 12 }}>{done ? "✅" : "○"}</span> {lbl}
          </div>
        ))}
      </div>

      {/* Grade result card — shown once teacher has graded */}
      {existingSubmission?.grade != null && (
        <div className="mat-fade-up" style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "2px solid #86efac", borderRadius: 10, padding: "14px 16px", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#14532d", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            🎓 Grade Received
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: existingSubmission.feedback ? 10 : 0 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: existingSubmission.grade >= 75 ? "#16a34a" : "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>{existingSubmission.grade}%</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: existingSubmission.grade >= 75 ? "#15803d" : "#b91c1c" }}>
                {existingSubmission.grade >= 90 ? "Excellent!" : existingSubmission.grade >= 75 ? "Passed" : "Below Passing"}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                Score: {existingSubmission.grade} / {material.points ?? "—"} pts
              </div>
            </div>
          </div>
          {existingSubmission.feedback && (
            <div style={{ background: "rgba(255,255,255,.7)", borderRadius: 7, padding: "9px 11px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.55 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Teacher's Feedback</div>
              {existingSubmission.feedback}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
