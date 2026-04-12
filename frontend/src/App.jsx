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

export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
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

    // ── Load courses ───────────────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        async function loadCourses() {
            const { data: rawCourses, error } = await supabase
                .from('courses')
                .select('course_id, course_code, course_name, units');

            if (error || !rawCourses) return;
            const courseIds = rawCourses.map((c) => c.course_id);

            const schMap = {};
            if (courseIds.length) {
                const { data: schData } = await supabase
                    .from('schedules')
                    .select('schedule_id, course_id, schedule_label, year_level, semester, academic_year, room')
                    .in('course_id', courseIds);
                (schData ?? []).forEach((row) => { schMap[row.course_id] = row; });
            }

            const { data: tcaData } = await supabase
                .from('teacher_course_assignments')
                .select('course_id, teacher_id, assigned_at')
                .in('course_id', courseIds)
                .order('assigned_at', { ascending: false });

            const tcaMap = {};
            (tcaData ?? []).forEach((row) => {
                if (!tcaMap[row.course_id]) tcaMap[row.course_id] = row.teacher_id;
            });

            const teacherIds = [...new Set(Object.values(tcaMap).filter(Boolean))];
            let teacherMap = {};
            if (teacherIds.length) {
                const { data: tUsers } = await supabase
                    .from('users')
                    .select('user_id, display_id, full_name')
                    .in('user_id', teacherIds);
                (tUsers || []).forEach((u) => { teacherMap[u.user_id] = u; });
            }

            setCourses(rawCourses.map((c) => {
                const sch = schMap[c.course_id] ?? null;
                const tId = tcaMap[c.course_id] ?? null;
                const teacher = tId ? teacherMap[tId] ?? null : null;
                return {
                    id: c.course_code,
                    code: c.course_code,
                    name: c.course_name,
                    teacher: teacher?.display_id || '',
                    teacherName: teacher?.full_name || 'Unassigned',
                    schedule: sch?.schedule_label || '',
                    units: c.units,
                    yearLevel: sch?.year_level || '',
                    semester: sch?.semester || '',
                    room: sch?.room || '',
                    status: 'Ongoing',
                    _uuid: c.course_id,
                    _scheduleId: sch?.schedule_id ?? null
                };
            }));
        }
        loadCourses();
    }, []);

    // ── Load enrollments ──
    useEffect(() => {
        async function loadEnrollments() {
            const [uRes, cRes] = await Promise.all([
                supabase.from('users').select('user_id, display_id').eq('role', 'student'),
                supabase.from('courses').select('course_id, course_code'),
            ]);
            const uMap = {}; const cMap = {};
            (uRes.data || []).forEach((u) => { uMap[u.user_id] = u.display_id; });
            (cRes.data || []).forEach((c) => { cMap[c.course_id] = c.course_code; });

            const { data: sseData } = await supabase
                .from('student_section_assignments')
                .select('student_id, section_id, final_grade, enrollment_status');

            if (sseData) {
                const sectionIds = [...new Set(sseData.map((r) => r.section_id))];
                const { data: sectData } = await supabase.from('course_sections').select('section_id, course_id').in('section_id', sectionIds);
                const sectCourseMap = {};
                (sectData || []).forEach((s) => { sectCourseMap[s.section_id] = s.course_id; });

                const merged = sseData.map(row => ({
                    studentId: uMap[row.student_id] || String(row.student_id),
                    courseId: cMap[sectCourseMap[row.section_id]] || null,
                    grade: row.final_grade ?? null,
                    status: row.enrollment_status || 'Enrolled'
                })).filter(r => r.courseId);

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
        if (normalizedUser.role === 'sub_admin') {
            const { data: saRow } = await supabase.from('sub_admins').select('scope, scope_ref').eq('user_id', normalizedUser._uuid).maybeSingle();
            setCurrentUser({ ...normalizedUser, subAdminScope: saRow?.scope || 'other', subAdminScopeRef: saRow?.scope_ref || '' });
        } else {
            setCurrentUser(normalizedUser);
        }
    };

    // ── Final Render Switch Logic ───────────────────────────────────────────────
    // This is where your SPA-style logic remains unchanged. 
    // The Router only manages getting the user TO this component.
    if (!currentUser) return <LoginPage onLogin={handleLogin} />;

    if (currentUser.role === 'admin') {
        return (
            <AdminDashboard
                user={currentUser} onLogout={() => setCurrentUser(null)}
                users={users} setUsers={setUsers}
                courses={courses} setCourses={setCourses}
                enrollments={enrollments} setEnrollments={setEnrollments}
            />
        );
    }

    if (currentUser.role === 'sub_admin') {
        return <SubAdminDashboard user={currentUser} users={users} onLogout={() => setCurrentUser(null)} />;
    }

    if (currentUser.role === 'student') {
        return (
            <StudentDashboard
                user={currentUser} onLogout={() => setCurrentUser(null)}
                courses={courses} enrollments={enrollments}
                examSubmissions={examSubmissions} onSubmitExam={handleSubmitExam}
                onUpdateUser={setCurrentUser}
            />
        );
    }

    return (
        <TeacherDashboard
            user={currentUser} onLogout={() => setCurrentUser(null)}
            courses={courses} setCourses={setCourses} allUsers={users}
            enrollments={enrollments} examSubmissions={examSubmissions}
            onUpdateUser={setCurrentUser}
        />
    );
}