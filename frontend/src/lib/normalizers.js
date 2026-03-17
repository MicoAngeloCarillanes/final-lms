// ─── Supabase Data Normalizers ────────────────────────────────────────────────
// Convert PostgreSQL snake_case rows → app camelCase shape so all
// downstream components stay unchanged.

export const normalizeUser = (row) => ({
  id:            row.display_id,
  _uuid:         row.user_id,
  _passwordHash: row.password_hash || "",   // kept in memory only — never rendered
  username:      row.username,
  role:          row.role,
  fullName:      row.full_name,
  email:         row.email        || "",
  civilStatus:   row.civil_status || "",
  birthdate:     row.birthdate    || "",
  address:       row.address      || "",
  password:      "",
  ...(row.students?.[0] && {
    yearLevel: row.students[0].year_level,
    semester:  row.students[0].semester,
  }),
});

export const normalizeEnrollment = (row) => ({
  studentId: row.users?.display_id         || row.student_id,
  courseId:  row.courses?.course_code      || row.course_id,
  grade:     row.final_grade               ?? null,
  status:    row.enrollment_status         || "Enrolled",
});

export const normalizeMaterial = (row) => ({
  id:              row.material_id,
  courseId:        row.courses?.course_code || row.course_id,
  title:           row.title,
  type:            row.material_type,
  date:            row.created_at ? row.created_at.split("T")[0] : "",
  dueDate:         row.due_date      || null,
  points:          row.total_points  || null,
  description:     row.description   || "",
  content:         row.content       || "",
  attachment_name: row.attachment_name || null,
  attachment_url:  row.attachment_url  || null,   // Supabase Storage public URL
  term:            row.term          || null,
});

export const normalizeExam = (row) => ({
  id:              row.exam_id,
  courseId:        row.courses?.course_code || row.course_id,
  title:           row.title,
  date:            row.exam_date,
  duration:        row.duration_minutes >= 60
    ? `${Math.floor(row.duration_minutes / 60)} hour${Math.floor(row.duration_minutes / 60) > 1 ? "s" : ""}`
    : `${row.duration_minutes} min`,
  totalPoints:     row.total_points,
  instantFeedback: row.instant_feedback,
  term:            row.term       || null,
  startTime:       row.start_time || null,
  endTime:         row.end_time   || null,
  examType:        row.exam_type  || "Exam",
  qTimer:          row.q_timer_minutes || 3,
  randomize:       row.randomize  ?? true,
  noBacktrack:     row.no_backtrack ?? true,
  questions: (row.exam_questions || []).map(q => ({
    id:            q.question_id,
    type:          q.question_type,
    questionText:  q.question_text,
    points:        q.points,
    correctAnswer: q.correct_answer,
    options:       q.options || undefined,
  })).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
});

// Maps DB title-case enum values → app screaming-snake-case constants used by STATUS_META / StatusBadge.
export const DB_TO_STATUS = {
  "Not Submitted": "NOT_SUBMITTED",
  "Submitted":     "SUBMITTED",
  "Late":          "LATE",
  "Graded":        "GRADED",
};

export const normalizeWorkSub = (r) => ({
  materialId:   r.material_id,
  submissionId: r.submission_id,
  fileName:     r.file_name,
  fileUrl:      r.file_url     || null,
  fileSize:     r.file_size_kb ? r.file_size_kb * 1024 : 0,
  submittedAt:  r.submitted_at,
  isLate:       r.status === "Late",
  status:       DB_TO_STATUS[r.status] ?? "NOT_SUBMITTED",
  grade:        r.score ?? null,
  feedback:     r.feedback   || null,
  gradedAt:     r.graded_at  || null,
});
