// ─── Grade Helpers ────────────────────────────────────────────────────────────
export const letterGrade = (g) =>
  g >= 93 ? "A" : g >= 90 ? "A-" : g >= 87 ? "B+" : g >= 83 ? "B" :
  g >= 80 ? "B-" : g >= 77 ? "C+" : g >= 73 ? "C" : g >= 70 ? "C-" : "D";

export const gradeColor = (g) =>
  g >= 90 ? "#10b981" : g >= 75 ? "#f59e0b" : "#ef4444";

/**
 * Grade formula (fixed weights — missing components count as 0):
 *   Course Work  (Lab/Assignment submissions) = 30%
 *   Class Standing (Project + Recitation + Attendance) = 30%
 *   Exam scores  = 40%
 *
 * If a component has no data it contributes 0% to the grade rather than
 * having its weight redistributed. This prevents inflated grades when only
 * some components have been graded.
 *
 * Returns null only when ALL components are null (nothing graded yet for the term).
 *
 * Params:
 *   quiz  – average % of Quiz-type exams for the term (or null)
 *   cw    – average % of Lab/Assignment submissions   (or null)
 *   cs    – Class Standing %                          (or null)
 *   exam  – average % of Exam-type exams              (or null)
 */
export const computeTermGrade = ({ cw, cs, exam, quiz }) => {
  // CW and Quiz share the 30% coursework bucket — average them when both exist
  const cwCombined = (cw != null && quiz != null)
    ? Math.round((cw + quiz) / 2)
    : (cw ?? quiz ?? null);

  // Return null only if the term is entirely untouched
  const hasAny = cwCombined != null || cs != null || exam != null;
  if (!hasAny) return null;

  // Fixed weights — null components default to 0 so the denominator is always 100%
  return Math.round(
    (cwCombined ?? 0) * 0.30 +
    (cs         ?? 0) * 0.30 +
    (exam       ?? 0) * 0.40
  );
};

/**
 * Class Standing % = average of Project, Recitation, Attendance (each /100)
 * If the entry exists but some components are missing, they count as 0.
 * Returns null only when there is no CS entry at all.
 */
export const csGradePct = (entry) => {
  if (!entry) return null;
  const hasAny = entry.project != null || entry.recitation != null || entry.attendance != null;
  if (!hasAny) return null;
  // Missing components count as 0 — denominator is always 3
  return Math.round(((entry.project ?? 0) + (entry.recitation ?? 0) + (entry.attendance ?? 0)) / 3);
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
