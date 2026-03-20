import React, { useState, useEffect, useRef } from "react";
import { MAT_META, MaterialType } from "../../lib/constants";
import { fileIcon, safeFileName } from "../../lib/helpers";
import { uploadFileToStorage } from "../../lib/storageHelpers";
import { Btn, Input, FF } from "../../components/ui";
import { TypeBadge } from "../../student/components/TypeBadge";
import renderMarkdown from "../../student/components/renderMarkdown";
import TeacherGradingDashboard from "./TeacherGradingDashboard";

/** Dual-pane: left = instructions (+ edit mode), right = grading dashboard. */
export default function TeacherAssignmentDetailView({ material, courseId, courseUuid, allUsers, user, onUpdate, gradeEntries, onGradeUpdate, enrollments }) {
  const [editMode,    setEditMode]    = useState(false);
  const [editTitle,   setEditTitle]   = useState(material.title);
  const [editContent, setEditContent] = useState(material.content || "");
  const [editDue,     setEditDue]     = useState(material.dueDate ? material.dueDate.slice(0, 16) : "");
  const [editPoints,  setEditPoints]  = useState(material.points || "");
  const [uploadedFile,setUploadedFile]= useState(null);
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState("");
  const fileRef = useRef(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // Sync local edit-state whenever the material prop changes
  useEffect(() => {
    setEditTitle(material.title);
    setEditContent(material.content || "");
    setEditDue(material.dueDate ? material.dueDate.slice(0, 16) : "");
    setEditPoints(material.points || "");
    setUploadedFile(null);
  }, [material.id, material.attachment_url]);

  const [pendingAttachment, setPendingAttachment] = useState(null);

  const handleFileUpload = (file) => {
    if (!file) return;
    setPendingAttachment(file);
    setUploadedFile(file);
    showToast(`"${file.name}" staged — will upload on Save.`);
  };

  const saveChanges = async () => {
    setSaving(true);
    let attachmentUrl  = material.attachment_url  || null;
    let attachmentName = material.attachment_name || null;

    if (pendingAttachment instanceof File) {
      const storagePath = `${material.id}/${Date.now()}_${safeFileName(pendingAttachment.name)}`;
      try {
        showToast("Uploading attachment…");
        attachmentUrl  = await uploadFileToStorage("materials", storagePath, pendingAttachment);
        attachmentName = pendingAttachment.name;
      } catch (err) {
        showToast("Upload failed: " + err.message);
        setSaving(false);
        return;
      }
      setPendingAttachment(null);
    }

    await onUpdate({
      ...material,
      title:           editTitle,
      content:         editContent,
      dueDate:         editDue,
      points:          Number(editPoints) || material.points,
      attachment_name: attachmentName,
      attachmentName:  attachmentName,
      attachment_url:  attachmentUrl,
    });
    setSaving(false);
    setEditMode(false);
    showToast("Assignment updated!");
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const m = MAT_META[material.type] || MAT_META[MaterialType.ASSIGNMENT];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Banner */}
      <div style={{ background: `linear-gradient(135deg,${m.light} 0%,#fff 100%)`, borderBottom: "1px solid #334155", padding: "11px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{m.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <TypeBadge type={material.type} />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{material.date}</span>
              {material.points    && <span style={{ fontSize: 11, fontWeight: 800, color: m.color }}>· {material.points} pts</span>}
              {material.dueDate   && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>· Due {new Date(material.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-0.02em" }}>{material.title}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {toast && <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", background: "rgba(16,185,129,.15)", padding: "3px 8px", borderRadius: 5 }}>✓ {toast}</span>}
            <Btn variant={editMode ? "danger" : "secondary"} size="sm"
              onClick={() => { if (!saving) { setEditMode(e => !e); setToast(""); } }}>
              {editMode ? "✕ Cancel" : "✏ Edit"}
            </Btn>
            {editMode && <Btn size="sm" onClick={saveChanges} disabled={saving}>{saving ? "⏳ Saving…" : "💾 Save"}</Btn>}
          </div>
        </div>
      </div>

      {/* Dual pane */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* LEFT — instructions / edit form */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid #334155" }}>
          <div style={{ padding: "8px 18px", borderBottom: "1px solid #1e293b", background: "#0f172a", flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {editMode ? "✏ Edit Assignment" : "📋 Instructions & Objectives"}
            </span>
          </div>

          {editMode ? (
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <FF label="Title" required><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></FF>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FF label="Due Date"><Input type="datetime-local" value={editDue} onChange={e => setEditDue(e.target.value)} min={todayStr} /></FF>
                <FF label="Total Points"><Input type="number" value={editPoints} onChange={e => setEditPoints(e.target.value)} placeholder="100" /></FF>
              </div>
              <FF label="Instructions (Markdown)">
                <textarea className="edit-textarea" rows={10} value={editContent} onChange={e => setEditContent(e.target.value)}
                  style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }} />
              </FF>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
                  Attach Supplementary File
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
                    onChange={e => handleFileUpload(e.target.files?.[0])} />
                  <Btn variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>📎 Attach File</Btn>
                  {uploadedFile
                    ? <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>✓ {uploadedFile.name}</span>
                    : material.attachment_name
                      ? <span style={{ fontSize: 12, color: "#64748b" }}>Current: <strong style={{ color: "#0369a1" }}>{material.attachment_name}</strong></span>
                      : <span style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>No attachment yet</span>
                  }
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 22px" }}>
              <div className="md-body">
                {material.content
                  ? renderMarkdown(material.content)
                  : <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No instructions yet. Click "Edit" to add content.</p>
                }
              </div>
              {(material.attachment_url || material.attachment_name) && (
                <div style={{ marginTop: 18, padding: "11px 14px", background: "#1a2a3a", border: "1px solid #bae6fd", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{fileIcon(material.attachment_name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{material.attachment_name || "Attachment"}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>Attached file</div>
                  </div>
                  {material.attachment_url
                    ? <Btn variant="ghost" size="sm" style={{ border: "1px solid #7dd3fc" }}
                        onClick={() => window.open(material.attachment_url, "_blank", "noopener,noreferrer")}>
                        ⬇ Download
                      </Btn>
                    : <span style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>Staged — not yet saved</span>
                  }
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — grading dashboard */}
        <div style={{ width: 380, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, background: "#fdfdff" }}>
          <TeacherGradingDashboard
            material={material}
            courseId={courseId}
            courseUuid={courseUuid}
            allUsers={allUsers}
            user={user}
            gradeEntries={gradeEntries}
            onGradeUpdate={onGradeUpdate}
            enrollments={enrollments}
          />
        </div>
      </div>
    </div>
  );
}
