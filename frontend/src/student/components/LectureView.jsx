import React from "react";
import { MAT_META, MaterialType } from "../../lib/constants";
import { fileIcon } from "../../lib/helpers";
import { TypeBadge } from "./TypeBadge";
import { Btn } from "../../components/ui";
import renderMarkdown from "./renderMarkdown";

export default function LectureView({ material }) {
  const m = MAT_META[material.type] || MAT_META[MaterialType.LECTURE];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Banner */}
      <div style={{ background: `linear-gradient(135deg,${m.light} 0%,#fff 100%)`, borderBottom: "1px solid #334155", padding: "14px 22px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
            {m.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <TypeBadge type={material.type} />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{material.date}</span>
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-0.02em", marginBottom: 3 }}>{material.title}</h1>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{material.description}</p>
          </div>
          {/* Read-only lock badge */}
          <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 14, marginBottom: 2 }}>🔒</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Read Only</div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px 28px" }}>
        <div className="md-body">
          {material.content
            ? renderMarkdown(material.content)
            : <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No content available.</p>
          }
        </div>

        {/* Teacher attachment download */}
        {material.attachment_url && (
          <div style={{ marginTop: 18, padding: "11px 14px", background: "#1a2a3a", border: "1px solid #bae6fd", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{fileIcon(material.attachment_name)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{material.attachment_name || "Attachment"}</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>Attached file</div>
            </div>
            <Btn variant="ghost" size="sm" style={{ border: "1px solid #7dd3fc" }}
              onClick={() => window.open(material.attachment_url, "_blank", "noopener,noreferrer")}>
              ⬇ Download
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
