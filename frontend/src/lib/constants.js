// ─── Material Types ───────────────────────────────────────────────────────────
export const MaterialType = Object.freeze({
  LECTURE:    "Lecture",
  READING:    "Reading",
  LAB:        "Lab",
  ASSIGNMENT: "Assignment",
  PROJECT:    "Project",
});

export const isSubmittable = (type) =>
  type === MaterialType.LAB || type === MaterialType.ASSIGNMENT || type === MaterialType.PROJECT;

export const MAT_META = {
  [MaterialType.LECTURE]:    { icon: "🎙", color: "#a5b4fc", bg: "rgba(99,102,241,.2)",  light: "rgba(99,102,241,.1)",  label: "Lecture" },
  [MaterialType.READING]:    { icon: "📖", color: "#60a5fa", bg: "rgba(59,130,246,.2)",  light: "rgba(59,130,246,.1)",  label: "Reading" },
  [MaterialType.LAB]:        { icon: "🧪", color: "#34d399", bg: "rgba(16,185,129,.2)",  light: "rgba(16,185,129,.1)",  label: "Lab" },
  [MaterialType.ASSIGNMENT]: { icon: "📝", color: "#fbbf24", bg: "rgba(245,158,11,.2)",  light: "rgba(245,158,11,.1)",  label: "Assignment" },
  [MaterialType.PROJECT]:    { icon: "🗂", color: "#c084fc", bg: "rgba(192,132,252,.2)",  light: "rgba(192,132,252,.1)",  label: "Project" },
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
  "Midterm":    { color: "#60a5fa", bg: "rgba(59,130,246,.2)" },
  "Semi-Final": { color: "#fbbf24", bg: "rgba(245,158,11,.2)" },
  "Finals":     { color: "#f87171", bg: "rgba(239,68,68,.2)"  },
};

/**
 * Auto-detect term from a Date (or today if none given).
 * School year mapping:
 *   Aug–Oct  → Prelim
 *   Nov–Dec  → Midterm
 *   Jan–Feb  → Semi-Final
 *   Mar–May  → Finals
 *   Jun–Jul  → Prelim (summer)
 */
export const termFromDate = (date) => {
  const m = (date ? new Date(date) : new Date()).getMonth() + 1; // 1-based
  if (m >= 8 && m <= 10) return "Prelim";
  if (m >= 11 && m <= 12) return "Midterm";
  if (m >= 1 && m <= 2)  return "Semi-Final";
  if (m >= 3 && m <= 5)  return "Finals";
  return "Prelim"; // Jun–Jul → summer, treat as Prelim
};

// ─── Question Types ───────────────────────────────────────────────────────────
export const QT_META = {
  MCQ:            { label: "Multiple Choice", icon: "⊙", color: "#a5b4fc", bg: "rgba(99,102,241,.2)" },
  TF:             { label: "True / False",    icon: "⇌", color: "#34d399", bg: "rgba(16,185,129,.2)" },
  Identification: { label: "Identification",  icon: "✎", color: "#fbbf24", bg: "rgba(245,158,11,.2)" },
};

// ─── Allowed file types ───────────────────────────────────────────────────────
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// ─── Grade weights ────────────────────────────────────────────────────────────
// Quizzes (Lab/Assignment) = 30%, Class Standing = 30%, Exams = 40%
// Within Exams: Quiz-type exams = 30% weight, Exam-type = 40% weight
export const GRADE_WEIGHTS = { quiz: 0.30, classStanding: 0.30, exam: 0.40 };
