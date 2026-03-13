import React from "react";
import { isSubmittable } from "../../lib/constants";
import { TypeBadge } from "./TypeBadge";
import LectureView from "./LectureView";
import AssignmentView from "./AssignmentView";

export default function MaterialDetailView({ material, onBack, course, user, existingSubmission, onSubmissionSaved }) {
  const showAssignmentLayout = isSubmittable(material.type);

  return (
    <div className="mat-detail-enter" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Breadcrumb top-bar */}
      <div style={{ height: 46, background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0 }}>
        <button onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", border: "1px solid #334155", borderRadius: 6, background: "#0f172a", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#94a3b8", fontFamily: "inherit" }}
          onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
          onMouseLeave={e => e.currentTarget.style.background = "#f8fafc"}
        >
          ← Back to Courses
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#94a3b8", flex: 1, minWidth: 0 }}>
          <span>My Courses</span>
          {course && <><span>›</span><span>{course.code}</span></>}
          <span>›</span>
          <span style={{ color: "#e2e8f0", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{material.title}</span>
        </div>
        <TypeBadge type={material.type} />
      </div>

      {/* Conditional layout */}
      {showAssignmentLayout
        ? <AssignmentView material={material} user={user} existingSubmission={existingSubmission} onSubmissionSaved={onSubmissionSaved} />
        : <LectureView material={material} />
      }
    </div>
  );
}
