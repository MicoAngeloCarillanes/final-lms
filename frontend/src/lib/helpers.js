// ─── Grade Helpers ────────────────────────────────────────────────────────────
export const letterGrade = (g) =>
  g >= 93 ? "A" : g >= 90 ? "A-" : g >= 87 ? "B+" : g >= 83 ? "B" :
  g >= 80 ? "B-" : g >= 77 ? "C+" : g >= 73 ? "C" : g >= 70 ? "C-" : "D";

export const gradeColor = (g) =>
  g >= 90 ? "#10b981" : g >= 75 ? "#f59e0b" : "#ef4444";

/**
 * Grade formula:
 *   Quiz scores  (Lab/Assignment submissions) = 30%
 *   Class Standing (Project + Recitation + Attendance) = 30%
 *   Exam scores  = 40%
 *
 * When a component has no data yet its weight is redistributed proportionally
 * among components that do have data so partial grades remain meaningful.
 *
 * Params:
 *   quiz  – average % of Quiz-type exams for the term (or null)
 *   cw    – average % of Lab/Assignment submissions   (or null)
 *   cs    – Class Standing %                          (or null)
 *   exam  – average % of Exam-type exams              (or null)
 *
 * Note: for backward compat, if quiz is null and exam has data, exam covers
 * the full 40% weight. If both quiz and exam have data each takes its own weight.
 */
export const computeTermGrade = ({ cw, cs, exam, quiz }) => {
  const parts = [
    { val: cw,   w: 0.30 },
    { val: cs,   w: 0.30 },
    { val: exam, w: 0.40 },
    { val: quiz, w: 0.30 },  // quizzes replace cw weight when present
  ];
  // If both cw and quiz exist, quiz takes the cw slot (they share the same 30% bucket)
  // Combine: average of cw and quiz scores for the 30% coursework bucket
  const cwCombined = (cw != null && quiz != null)
    ? Math.round((cw + quiz) / 2)
    : (cw ?? quiz ?? null);

  const finalParts = [
    { val: cwCombined, w: 0.30 },
    { val: cs,         w: 0.30 },
    { val: exam,       w: 0.40 },
  ].filter(p => p.val != null);
  if (!finalParts.length) return null;
  const totalW = finalParts.reduce((s, p) => s + p.w, 0);
  return Math.round(finalParts.reduce((s, p) => s + p.val * (p.w / totalW), 0));
};

/**
 * Class Standing % = average of Project, Recitation, Attendance (each /100)
 */
export const csGradePct = (entry) => {
  if (!entry) return null;
  const nums = [entry.project, entry.recitation, entry.attendance].filter(x => x != null);
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
};

// ─── Date / Time ──────────────────────────────────────────────────────────────
export const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

// ─── File Helpers ─────────────────────────────────────────────────────────────
export const fmtSize  = (b) => b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
export const fileIcon = (name) => name?.endsWith(".pdf") ? "📄" : "📝";

/** Sanitise a filename so it is safe as a Supabase Storage object key */
export const safeFileName = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");
