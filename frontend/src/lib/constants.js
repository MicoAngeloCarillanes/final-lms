// ─── Material Types ───────────────────────────────────────────────────────────
export const MaterialType = Object.freeze({
  LECTURE:    "Lecture",
  READING:    "Reading",
  LAB:        "Lab",
  ASSIGNMENT: "Assignment",
});

// Type predicate — true for Lab and Assignment (submittable) types
export const isSubmittable = (type) =>
  type === MaterialType.LAB || type === MaterialType.ASSIGNMENT;

// Per-type display metadata
export const MAT_META = {
  [MaterialType.LECTURE]:    { icon: "🎙", color: "#a5b4fc", bg: "rgba(99,102,241,.2)", light: "rgba(99,102,241,.1)", label: "Lecture" },
  [MaterialType.READING]:    { icon: "📖", color: "#60a5fa", bg: "rgba(59,130,246,.2)",  light: "rgba(59,130,246,.1)",  label: "Reading" },
  [MaterialType.LAB]:        { icon: "🧪", color: "#34d399", bg: "rgba(16,185,129,.2)",  light: "rgba(16,185,129,.1)",  label: "Lab" },
  [MaterialType.ASSIGNMENT]: { icon: "📝", color: "#fbbf24", bg: "rgba(245,158,11,.2)",  light: "rgba(245,158,11,.1)",  label: "Assignment" },
};

// ─── Submission Status ────────────────────────────────────────────────────────
export const SubmissionStatus = Object.freeze({
  NOT_SUBMITTED: "NOT_SUBMITTED",
  SUBMITTED:     "SUBMITTED",
  LATE:          "LATE",
  GRADED:        "GRADED",
});

export const STATUS_META = {
  [SubmissionStatus.NOT_SUBMITTED]: { label: "Not Submitted", icon: "○", color: "#64748b", bg: "rgba(100,116,139,.2)" },
  [SubmissionStatus.SUBMITTED]:     { label: "Submitted",     icon: "✓", color: "#34d399", bg: "rgba(16,185,129,.2)"  },
  [SubmissionStatus.LATE]:          { label: "Late",          icon: "⚠", color: "#f87171", bg: "rgba(239,68,68,.2)"   },
  [SubmissionStatus.GRADED]:        { label: "Graded",        icon: "★", color: "#fbbf24", bg: "rgba(245,158,11,.2)"  },
};

// ─── Exam / Term ──────────────────────────────────────────────────────────────
export const EXAM_TERMS = ["Prelim", "Midterm", "Semi-Final", "Finals"];

export const TERM_META = {
  "Prelim":     { color: "#a5b4fc", bg: "rgba(99,102,241,.2)" },
  "Midterm":    { color: "#60a5fa", bg: "rgba(59,130,246,.2)"  },
  "Semi-Final": { color: "#fbbf24", bg: "rgba(245,158,11,.2)" },
  "Finals":     { color: "#f87171", bg: "rgba(239,68,68,.2)"  },
};

// ─── Question Types ───────────────────────────────────────────────────────────
export const QT_META = {
  MCQ:            { label: "Multiple Choice", icon: "⊙", color: "#a5b4fc", bg: "rgba(99,102,241,.2)" },
  TF:             { label: "True / False",    icon: "⇌", color: "#34d399", bg: "rgba(16,185,129,.2)"  },
  Identification: { label: "Identification",  icon: "✎", color: "#fbbf24", bg: "rgba(245,158,11,.2)" },
};

// ─── Allowed file types for uploads ──────────────────────────────────────────
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
