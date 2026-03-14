/**
 * App.jsx — Root component
 * FOLDER: src/App.jsx  (replace existing)
 *
 * Changes:
 *  - After sub_admin login, fetches their scope from the sub_admins table
 *    and attaches it as user.subAdminScope before rendering SubAdminDashboard.
 *    scope === "department" → full access (accounts, password reset, announcements, chat)
 *    any other scope       → restricted access (announcements + chat only)
 */
import React, { useState, useEffect } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";
import { normalizeUser, normalizeMaterial, normalizeExam } from "./lib/normalizers";

import LoginPage         from "./LoginPage";
import AdminDashboard    from "./admin/AdminDashboard";
import SubAdminDashboard from "./sub-admin/SubAdminDashboard";
import StudentDashboard  from "./student/StudentDashboard";
import TeacherDashboard  from "./teacher/TeacherDashboard";

export default function App() {
  const [currentUser,     setCurrentUser]     = useState(null);
  const [users,           setUsers]           = useState([]);
  const [courses,         setCourses]         = useState([]);
  const [enrollments,     setEnrollments]     = useState([]);
  const [examSubmissions, setExamSubmissions] = useState([]);

  // ── Load users ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadUsers() {
      const [userRes, stuRes, tchRes] = await Promise.all([
        supabase.from("users").select("*").eq("is_active", true),
        supabase.from("students").select("*"),
        supabase.from("teachers").select("*"),
      ]);
      if (!userRes.data) return;
      const stuMap = {};
      const tchMap = {};
      (stuRes.data || []).forEach(s => { stuMap[s.user_id] = s; });
      (tchRes.data || []).forEach(t => { tchMap[t.user_id] = t; });
      setUsers(userRes.data.map(u => normalizeUser({
        ...u,
        students: stuMap[u.user_id] ? [stuMap[u.user_id]] : [],
        teachers: tchMap[u.user_id] ? [tchMap[u.user_id]] : [],
      })));
    }
    loadUsers();
  }, []);

  // ── Load courses ───────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadCourses() {
      // Fetch courses + schedules (no teacher join here)
      const { data: rawCourses, error } = await supabase
        .from("courses")
        .select(`
          course_id, course_code, course_name, units, status, program_id,
          schedules ( schedule_id, schedule_label, year_level, semester )
        `)
        .eq("is_active", true);

      if (error || !rawCourses) return;

      // Fetch teacher assignments separately with explicit ORDER BY assigned_at DESC.
      // Supabase embedded select does NOT sort nested arrays reliably — only a
      // top-level query with .order() guarantees the latest assignment per course.
      const courseIds = rawCourses.map(c => c.course_id);
      const { data: tcaData } = await supabase
        .from("teacher_course_assignments")
        .select("course_id, teacher_id, assigned_at")
        .in("course_id", courseIds)
        .order("assigned_at", { ascending: false });

      // Build map: course_id → latest teacher_id (first row after ORDER BY DESC)
      const tcaMap = {};
      (tcaData ?? []).forEach(row => {
        if (!tcaMap[row.course_id]) tcaMap[row.course_id] = row.teacher_id;
      });

      // Bulk fetch all assigned teacher user records
      const teacherIds = [...new Set(Object.values(tcaMap).filter(Boolean))];
      let teacherMap = {};
      if (teacherIds.length) {
        const { data: tUsers } = await supabase
          .from("users")
          .select("user_id, display_id, full_name")
          .in("user_id", teacherIds);
        (tUsers || []).forEach(u => { teacherMap[u.user_id] = u; });
      }

      setCourses(rawCourses.map(c => {
        const sch     = c.schedules?.[0] ?? null;
        const tId     = tcaMap[c.course_id] ?? null;
        const teacher = tId ? teacherMap[tId] ?? null : null;
        return {
          id:          c.course_code,
          code:        c.course_code,
          name:        c.course_name,
          teacher:     teacher?.display_id || "",
          teacherName: teacher?.full_name  || "Unassigned",
          schedule:    sch?.schedule_label || "",
          units:       c.units,
          yearLevel:   sch?.year_level     || "",
          semester:    sch?.semester       || "",
          status:      c.status            || "Ongoing",
          programId:   c.program_id        ?? null,
          _uuid:       c.course_id,
          _scheduleId: sch?.schedule_id    ?? null,
        };
      }));
    }
    loadCourses();
  }, []);

    // ── Load enrollments ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadEnrollments() {
      const { data } = await supabase
        .from("student_course_assignments")
        .select("student_id, course_id, final_grade, enrollment_status");
      if (!data) return;

      const [uRes, cRes] = await Promise.all([
        supabase.from("users").select("user_id, display_id").eq("role", "student"),
        supabase.from("courses").select("course_id, course_code"),
      ]);
      const uMap = {};
      const cMap = {};
      (uRes.data || []).forEach(u => { uMap[u.user_id] = u.display_id; });
      (cRes.data || []).forEach(c => { cMap[c.course_id] = c.course_code; });

      setEnrollments(data.map(row => ({
        studentId: uMap[row.student_id] || row.student_id,
        courseId:  cMap[row.course_id]  || row.course_id,
        grade:     row.final_grade      ?? null,
        status:    row.enrollment_status || "Enrolled",
      })));
    }
    loadEnrollments();
  }, []);

  // ── Load exam submissions ────────────────────────────────────────────────────
  useEffect(() => {
    async function loadExamSubmissions() {
      const { data: subs } = await supabase
        .from("exam_submissions")
        .select("exam_submission_id, exam_id, student_id, score, total_points, submitted_at");
      if (!subs?.length) return;

      const examIds = [...new Set(subs.map(s => s.exam_id))];
      const { data: examRows } = await supabase
        .from("exams").select("exam_id, course_id").in("exam_id", examIds);
      const courseIds = [...new Set((examRows || []).map(e => e.course_id))];
      const { data: courseRows } = await supabase
        .from("courses").select("course_id, course_code").in("course_id", courseIds);

      const courseCodeMap = {};
      (courseRows || []).forEach(c => { courseCodeMap[c.course_id] = c.course_code; });
      const examCourseMap = {};
      (examRows   || []).forEach(e => { examCourseMap[e.exam_id] = courseCodeMap[e.course_id] || ""; });

      const studentIds = [...new Set(subs.map(s => s.student_id))];
      const { data: userRows } = await supabase
        .from("users").select("user_id, display_id").in("user_id", studentIds);
      const userMap = {};
      (userRows || []).forEach(u => { userMap[u.user_id] = u.display_id; });

      setExamSubmissions(subs.map(s => ({
        id:          s.exam_submission_id,
        examId:      s.exam_id,
        courseId:    examCourseMap[s.exam_id] || "",
        studentId:   userMap[s.student_id]    || s.student_id,
        answers:     {},
        score:       s.score,
        totalPoints: s.total_points,
        submittedAt: s.submitted_at,
        graded:      true,
      })));
    }
    loadExamSubmissions();
  }, []);

  // ── Exam submit handler ──────────────────────────────────────────────────────
  const handleSubmitExam = async (submission) => {
    const { data: savedSub, error: subErr } = await supabase
      .from("exam_submissions")
      .upsert({
        exam_id:      submission.examId,
        student_id:   submission.studentUuid,
        score:        submission.score,
        total_points: submission.totalPoints,
      }, { onConflict: "exam_id,student_id" })
      .select("exam_submission_id")
      .single();

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!subErr && savedSub && isUUID.test(submission.examId) && submission.questionResults?.length) {
      const answerRows = submission.questionResults
        .filter(qr => isUUID.test(qr.questionId))
        .map(qr => ({
          exam_submission_id: savedSub.exam_submission_id,
          question_id:        qr.questionId,
          given_answer:       qr.givenAnswer   ?? null,
          is_correct:         qr.isCorrect     ?? false,
          points_awarded:     qr.pointsAwarded ?? 0,
        }));
      if (answerRows.length) {
        await supabase.from("exam_question_answers").upsert(
          answerRows, { onConflict: "exam_submission_id,question_id" }
        );
      }
    }

    setExamSubmissions(prev => {
      const idx = prev.findIndex(s => s.examId === submission.examId && s.studentId === submission.studentId);
      if (idx >= 0) { const n = [...prev]; n[idx] = submission; return n; }
      return [...prev, submission];
    });
  };

  // ── Handle login — enrich sub_admin with scope from sub_admins table ─────────
  const handleLogin = async (normalizedUser) => {
    if (normalizedUser.role === "sub_admin") {
      const { data: saRow } = await supabase
        .from("sub_admins")
        .select("scope, scope_ref")
        .eq("user_id", normalizedUser._uuid)
        .maybeSingle();

      setCurrentUser({
        ...normalizedUser,
        subAdminScope:    saRow?.scope     || "other",
        subAdminScopeRef: saRow?.scope_ref || "",
      });
    } else {
      setCurrentUser(normalizedUser);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  if (currentUser.role === "admin") {
    return (
      <AdminDashboard
        user={currentUser} onLogout={() => setCurrentUser(null)}
        users={users} setUsers={setUsers}
        courses={courses} setCourses={setCourses}
        enrollments={enrollments} setEnrollments={setEnrollments}
      />
    );
  }

  // ── Sub-admin: scope-aware dashboard ────────────────────────────────────────
  if (currentUser.role === "sub_admin") {
    return (
      <SubAdminDashboard
        user={currentUser} onLogout={() => setCurrentUser(null)}
        users={users}
      />
    );
  }

  if (currentUser.role === "student") {
    return (
      <StudentDashboard
        user={currentUser} onLogout={() => setCurrentUser(null)}
        onUpdateUser={setCurrentUser}
        courses={courses}
        examSubmissions={examSubmissions}
        onSubmitExam={handleSubmitExam}
        enrollments={enrollments}
      />
    );
  }

  // teacher (default)
  return (
    <TeacherDashboard
      user={currentUser} onLogout={() => setCurrentUser(null)}
      onUpdateUser={setCurrentUser}
      courses={courses} setCourses={setCourses}
      allUsers={users}
      examSubmissions={examSubmissions}
      enrollments={enrollments}
    />
  );
}
