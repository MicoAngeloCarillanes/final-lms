import React from "react";
import { MAT_META, MaterialType } from "../../lib/constants";
import { fileIcon } from "../../lib/helpers";
import { TypeBadge } from "./TypeBadge";
import { Btn } from "../../components/ui";
import renderMarkdown from "./renderMarkdown";
import SubmissionPortal from "./SubmissionPortal";

export default function AssignmentView({ material, user, existingSubmission, onSubmissionSaved }) {
  const m = MAT_META[material.type] || MAT_META[MaterialType.ASSIGNMENT];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Banner */}
      <div style={{ background: `linear-gradient(135deg,${m.light} 0%,#fff 100%)`, borderBottom: "1px solid #334155", padding: "12px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            {m.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <TypeBadge type={material.type} />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{material.date}</span>
              {material.points && <span style={{ fontSize: 11, fontWeight: 800, color: m.color }}>· {material.points} pts</span>}
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-0.02em" }}>{material.title}</div>
          </div>
        </div>
      </div>

      {/* Dual pane */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* LEFT — instructions */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid #334155" }}>
          <div style={{ padding: "8px 18px", borderBottom: "1px solid #1e293b", background: "#0f172a", flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>📋 Instructions & Objectives</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 22px" }}>
            <div className="md-body">
              {material.content
                ? renderMarkdown(material.content)
                : <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No instructions provided.</p>
              }
            </div>
            {/* Teacher attachment download */}
            {material.attachment_url && (
              <div style={{ marginTop: 14, padding: "10px 13px", background: "#1a2a3a", border: "1px solid #bae6fd", borderRadius: 8, display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 16 }}>{fileIcon(material.attachment_name)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{material.attachment_name || "Attachment"}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>Reference file</div>
                </div>
                <Btn variant="ghost" size="sm" style={{ border: "1px solid #7dd3fc" }}
                  onClick={() => window.open(material.attachment_url, "_blank", "noopener,noreferrer")}>
                  ⬇ Download
                </Btn>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — submission portal */}
        <div style={{ width: 300, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, background: "#fdfdff" }}>
          <div style={{ padding: "8px 15px", borderBottom: "1px solid #1e293b", background: "#0f172a", flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>📤 Submission Portal</span>
          </div>
          <div style={{ flex: 1, padding: "12px 14px", overflow: "hidden" }}>
            <SubmissionPortal
              material={material}
              user={user}
              existingSubmission={existingSubmission}
              onSubmissionSaved={onSubmissionSaved}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
