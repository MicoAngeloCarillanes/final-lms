import React, { useState, useEffect, useRef } from "react";
import { MAT_META, MaterialType } from "../../lib/constants";
import { fileIcon, safeFileName } from "../../lib/helpers";
import { uploadFileToStorage } from "../../lib/storageHelpers";
import { Btn, Input, FF } from "../../components/ui";
import { TypeBadge } from "../../student/components/TypeBadge";
import renderMarkdown from "../../student/components/renderMarkdown";

/** Toggle between View Mode and Edit Mode for Lecture/Reading materials. */
export default function TeacherLectureDetailView({ material, onUpdate }) {
  const [editMode,    setEditMode]    = useState(false);
  const [editTitle,   setEditTitle]   = useState(material.title);
  const [editDesc,    setEditDesc]    = useState(material.description || "");
  const [editContent, setEditContent] = useState(material.content || "");
  const [uploadedFile,setUploadedFile]= useState(null);
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState("");
  const fileRef = useRef(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // Sync local edit-state whenever the material prop changes
  useEffect(() => {
    setEditTitle(material.title);
    setEditDesc(material.description || "");
    setEditContent(material.content || "");
    setUploadedFile(null);
  }, [material.id, material.attachment_url]);

  const [pendingAttachment, setPendingAttachment] = useState(null);

  const handleFileUpload = (file) => {
    if (!file) return;
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type) && ![".pdf", ".doc", ".docx"].some(e => file.name.toLowerCase().endsWith(e))) {
      showToast("Only PDF and Word files are accepted."); return;
    }
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

    const updated = {
      ...material,
      title:           editTitle,
      description:     editDesc,
      content:         editContent,
      attachment_name: attachmentName,
      attachmentName:  attachmentName,
      attachment_url:  attachmentUrl,
    };
    await onUpdate(updated);
    setSaving(false);
    setEditMode(false);
    showToast("Material updated successfully!");
  };

  const m = MAT_META[material.type] || MAT_META[MaterialType.LECTURE];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Banner */}
      <div style={{ background: `linear-gradient(135deg,${m.light} 0%,#fff 100%)`, borderBottom: "1px solid #334155", padding: "13px 22px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0 }}>{m.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <TypeBadge type={material.type} />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{material.date}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-0.02em" }}>{material.title}</div>
            {material.description && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{material.description}</div>}
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {toast && <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", background: "rgba(16,185,129,.15)", padding: "4px 9px", borderRadius: 5, alignSelf: "center" }}>✓ {toast}</span>}
            <Btn variant={editMode ? "danger" : "secondary"} size="sm"
              onClick={() => { if (!saving) { setEditMode(e => !e); setToast(""); } }}>
              {editMode ? "✕ Cancel" : "✏ Edit Material"}
            </Btn>
            {editMode && <Btn size="sm" onClick={saveChanges} disabled={saving}>{saving ? "⏳ Saving…" : "💾 Save Changes"}</Btn>}
          </div>
        </div>
      </div>

      {editMode ? (
        /* ── Edit Mode ── */
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <FF label="Material Title" required>
            <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
          </FF>
          <FF label="Description">
            <textarea className="edit-textarea" rows={2} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Short description shown in the sidebar…" />
          </FF>
          <FF label="Content (Markdown)">
            <textarea className="edit-textarea" rows={12} value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Write course content using Markdown formatting…" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }} />
          </FF>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
              Replace Attachment (PDF / DOCX)
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
                onChange={e => handleFileUpload(e.target.files?.[0])} />
              <Btn variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>📎 Choose File</Btn>
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
        /* ── View Mode ── */
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px 28px" }}>
          <div className="md-body">
            {material.content
              ? renderMarkdown(material.content)
              : <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No content yet. Click "Edit Material" to add content.</p>
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
  );
}
