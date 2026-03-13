import React from "react";
import { MAT_META, MaterialType, STATUS_META, SubmissionStatus } from "../../lib/constants";

export function TypeBadge({ type }) {
  const m = MAT_META[type] || MAT_META[MaterialType.LECTURE];
  return (
    <span style={{ background: m.bg, color: m.color, padding: "3px 9px", borderRadius: 9999, fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
      {m.icon} {m.label}
    </span>
  );
}

export function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META[SubmissionStatus.NOT_SUBMITTED];
  return (
    <span style={{ background: m.bg, color: m.color, padding: "4px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 10 }}>{m.icon}</span> {m.label}
    </span>
  );
}
