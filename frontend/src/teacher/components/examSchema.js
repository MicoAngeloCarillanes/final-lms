import { EXAM_TERMS } from "../../lib/constants";

// ── Runtime Zod-equivalent Schema (no external dependency) ────────────────────
export const ExamSchema = {
  validate(exam) {
    const errors = [];
    if (!exam.title || exam.title.trim().length < 3)
      errors.push("Exam title must be at least 3 characters.");
    if (!exam.term)
      errors.push("Term is required — select Prelim, Midterm, Semi-Final, or Finals.");
    if (!exam.date)
      errors.push("Exam date is required.");
    if (!exam.questions || exam.questions.length === 0)
      errors.push("Exam must have at least one question.");
    if (exam.questions) {
      exam.questions.forEach((q, i) => {
        if (!q.questionText || q.questionText.trim().length < 3)
          errors.push(`Question ${i + 1}: question text is too short (min 3 chars).`);
        if (!q.correctAnswer)
          errors.push(`Question ${i + 1}: correct answer is not set.`);
        if (q.type === "MCQ" && q.options?.some(o => !o.label.trim()))
          errors.push(`Question ${i + 1}: all MCQ options must have text.`);
        if (!q.points || q.points < 1)
          errors.push(`Question ${i + 1}: points must be at least 1.`);
      });
    }
    const totalPoints = (exam.questions || []).reduce((s, q) => s + (q.points || 0), 0);
    if (totalPoints === 0)
      errors.push("Total exam points must be greater than zero.");
    return { ok: errors.length === 0, errors, totalPoints };
  },
};

// ── Question factory helpers ───────────────────────────────────────────────────
export const makeId   = () => `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export const makeOpts = () => ["A", "B", "C", "D"].map(id => ({ id, label: "" }));
export const blankQ   = (type) => ({
  id: makeId(), type,
  questionText: "", points: 5, correctAnswer: "",
  ...(type === "MCQ" ? { options: makeOpts() } : {}),
});
