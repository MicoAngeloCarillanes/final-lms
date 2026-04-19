/**
 * App.jsx — Root component
 * FOLDER: src/App.jsx
 *
 * logic: Acts as the main state-based switcher for Dashboards.
 * No RouterProvider here! This component is rendered BY the Router at the top level.
 */
import { useEffect, useState } from "react";
import "./App.css";
import { normalizeUser } from "./lib/normalizers";
import { supabase } from "./supabaseClient";

import LoginPage from "./LoginPage";
import AdminDashboard from "./admin/AdminDashboard";
import StudentDashboard from "./student/StudentDashboard";
import SubAdminDashboard from "./sub-admin/SubAdminDashboard";
import TeacherDashboard from "./teacher/TeacherDashboard";

// ── Session persistence helpers ───────────────────────────────────────────────
const SESSION_KEY = "lms_user";

function saveSession(user) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch {}
}
function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
}
function loadSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) return JSON.parse(raw); // already normalized when saved — do NOT re-run normalizeUser
    } catch {}
    return null;
}

export default function App() {
    // Lazy initializer reads persisted session so a page reload keeps the user logged in
    const [currentUser, setCurrentUser] = useState(() => loadSession());
    const [users, setUsers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [examSubmissions, setExamSubmissions] = useState([]);

    // ── Load users ───────────────────────────────────────────────────────────────
    useEffect(() => {
        async function loadUsers() {
            const [userRes, stuRes, tchRes] = await Promise.all([
                supabase.from('users').select('*').eq('is_active', 1),
                supabase.from('students').select('*'),
                supabase.from('teachers').select('*'),
            ]);
            if (!userRes.data) return;

            const programIds = [...new Set((stuRes.data || []).map((s) => s.program_id).filter(Boolean))];
            const programMap = {};
            if (programIds.length) {
                const { data: progData, error: progErr } = await supabase
                    .from('program')
                    .select('program_id, code, name')
                    .in('program_id', programIds);
                if (progErr) console.warn('Program lookup failed:', progErr.message);
                (progData ?? []).forEach((p) => { programMap[p.program_id] = p; });
            }

            const stuMap = {};
            const tchMap = {};
            (stuRes.data || []).forEach((s) => {
                stuMap[s.user_id] = { ...s, program: programMap[s.program_id] || null };
            });
            (tchRes.data || []).forEach((t) => { tchMap[t.user_id] = t; });
            setUsers(userRes.data.map((u) => normalizeUser({
                ...u,
                students: stuMap[u.user_id] ? [stuMap[u.user_id]] : [],
                teachers: tchMap[u.user_id] ? [tchMap[u.user_id]] : []
            })));
        }
        loadUsers();
    }, []);

    // ── Load courses (section-scoped) ─────────────────────────────────────────
    //
    // ROOT CAUSE FIX (Bug 1):
    //   Previously read from `courses`, using course_id as id/_uuid.
    //   Both CS101_LAB sections shared one course_id → one content bucket.
    //
    //   Now reads from `course_sections`. Each section becomes its own course
    //   object where id = _uuid = section_id. Because every downstream consumer
    //   (materials, exams, attendance, announcements) keys on course._uuid, all
    //   content is now fully isolated per section automatically.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        async function loadCourses() {
            const { data: sections, error } = await supabase
                .from('course_sections')
                .select(`
                    section_id,
                    course_id,
                    teacher_id,
                    schedule_label,
                    year_level,
                    semester,
                    sy_id,
                    block_id,
                    section_label,
                    courses (course_code, course_name, units, status)
                `);

            if (error || !sections) return;

            // Resolve teacher display info from users table
            const teacherIds = [...new Set(sections.map(s => s.teacher_id).filter(Boolean))];
            let teacherMap = {};
            if (teacherIds.length) {
                const { data: tUsers } = await supabase
                    .from('users')
                    .select('user_id, display_id, full_name')
                    .in('user_id', teacherIds);
                (tUsers || []).forEach(u => { teacherMap[u.user_id] = u; });
            }

            setCourses(
                sections.map(s => {
                    const courseRow = s.courses ?? {};
                    const teacher   = s.teacher_id ? teacherMap[s.teacher_id] ?? null : null;
                    return {
                        // KEY FIX: id & _uuid = section_id, NOT course_id.
                        // All content (exams, materials, attendance) stored with
                        // course_id = section_id is now isolated per section.
                        id:           s.section_id,
                        _uuid:        s.section_id,
                        _courseId:    s.course_id,       // real courses.course_id (for status updates)
                        code:         courseRow.course_code  || '',
                        name:         courseRow.course_name  || '',
                        units:        courseRow.units         || 0,
                        teacher:      teacher?.display_id    || '',
                        teacherName:  teacher?.full_name     || 'Unassigned',
                        teacherUuid:  s.teacher_id           || null,
                        schedule:     s.schedule_label       || '',
                        yearLevel:    s.year_level           || '',
                        semester:     s.semester             || '',
                        sectionLabel: s.section_label        || '',
                        blockId:      s.block_id             || null,
                        status:       courseRow.status        || 'Ongoing',
                        _scheduleId:  null,
                    };
                })
            );
        }
        loadCourses();
    }, []);

    // ── Load enrollments ──────────────────────────────────────────────────────
    //
    // ROOT CAUSE FIX (Bug 2):
    //   Previously mapped section_id → course_id, collapsing both sections of
    //   CS101_LAB into the same courseId. Students in different blocks saw the
    //   same content because they landed in the same course room.
    //
    //   Now courseId = section_id directly, so each student sees only their
    //   specific section's materials, exams, and grades.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        async function loadEnrollments() {
            // Map student user_id → display_id
            const { data: uData } = await supabase
                .from('users')
                .select('user_id, display_id')
                .eq('role', 'student');
            const uMap = {};
            (uData || []).forEach(u => { uMap[u.user_id] = u.display_id; });

            // section_id IS the isolated course room — no further mapping needed
            const { data: sseData } = await supabase
                .from('student_section_assignments')
                .select('student_id, section_id, final_grade, enrollment_status');

            if (sseData) {
                const merged = sseData
                    .map(row => ({
                        studentId: uMap[row.student_id] || String(row.student_id),
                        courseId:  row.section_id,        // section_id = unique course room
                        grade:     row.final_grade ?? null,
                        status:    row.enrollment_status || 'Enrolled',
                    }))
                    .filter(r => r.courseId && r.studentId);
                setEnrollments(merged);
            }
        }
        loadEnrollments();
    }, []);

    const handleSubmitExam = async(submission) => {
        const { data: savedSub, error: subErr } = await supabase
            .from('exam_submissions')
            .upsert({
                exam_id: submission.examId,
                student_id: submission.studentUuid,
                score: submission.score,
                total_points: submission.totalPoints
            }, { onConflict: 'exam_id,student_id' })
            .select('exam_submission_id').single();

        if (!subErr && savedSub && submission.questionResults?.length) {
            const answerRows = submission.questionResults.map((qr) => ({
                exam_submission_id: savedSub.exam_submission_id,
                question_id: qr.questionId,
                given_answer: qr.givenAnswer ?? null,
                is_correct: qr.isCorrect ?? false,
                points_awarded: qr.pointsAwarded ?? 0
            }));
            await supabase.from('exam_question_answers').upsert(answerRows, { onConflict: 'exam_submission_id,question_id' });
        }
    };

    const handleLogin = async(normalizedUser) => {
        let enriched = normalizedUser;
        if (normalizedUser.role === 'sub_admin') {
            const { data: saRow } = await supabase.from('sub_admins').select('scope, scope_ref').eq('user_id', normalizedUser._uuid).maybeSingle();
            enriched = { ...normalizedUser, subAdminScope: saRow?.scope || 'other', subAdminScopeRef: saRow?.scope_ref || '' };
        }
        // Persist the fully-enriched user so reloads restore the correct session
        saveSession(enriched);
        setCurrentUser(enriched);
    };

    const handleLogout = () => {
        clearSession();
        setCurrentUser(null);
    };

    // ── Final Render Switch Logic ───────────────────────────────────────────────
    // This is where your SPA-style logic remains unchanged. 
    // The Router only manages getting the user TO this component.
    if (!currentUser) return <LoginPage onLogin={handleLogin} />;

    if (currentUser.role === 'admin') {
        return (
            <AdminDashboard
                user={currentUser} onLogout={handleLogout}
                users={users} setUsers={setUsers}
                courses={courses} setCourses={setCourses}
                enrollments={enrollments} setEnrollments={setEnrollments}
            />
        );
    }

    if (currentUser.role === 'sub_admin') {
        return <SubAdminDashboard user={currentUser} users={users} onLogout={handleLogout} />;
    }

    if (currentUser.role === 'student') {
        return (
            <StudentDashboard
                user={currentUser} onLogout={handleLogout}
                courses={courses} enrollments={enrollments}
                examSubmissions={examSubmissions} onSubmitExam={handleSubmitExam}
                onUpdateUser={setCurrentUser}
            />
        );
    }

    return (
        <TeacherDashboard
            user={currentUser} onLogout={handleLogout}
            courses={courses} setCourses={setCourses} allUsers={users}
            enrollments={enrollments} examSubmissions={examSubmissions}
            onUpdateUser={setCurrentUser}
        />
    );
}