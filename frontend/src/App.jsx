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

    // ── Load courses ──────────────────────────────────────────────────────────────
    // FIX: Read from course_sections so each section is its own isolated room.
    // Using section_id as the identity key (id + _uuid) means:
    //   • exams / materials created by a teacher are stored against section_id → not shared
    //   • enrollment matching uses section_id → students only see their section's content
    //   • two CS101_LAB sections (different blocks/teachers) are fully independent
    useEffect(() => {
        async function loadCourses() {
            const { data: sections, error } = await supabase
                .from('course_sections')
                .select('section_id, course_id, section_label, teacher_id, schedule_label, semester, year_level, sy_id, block_id, program_id, room_id, max_capacity');

            if (error || !sections) return;

            // Fetch course metadata (code, name, units) for the underlying course concepts
            const courseIds = [...new Set(sections.map((s) => s.course_id).filter(Boolean))];
            const courseMap = {};
            if (courseIds.length) {
                const { data: coursesData } = await supabase
                    .from('courses')
                    .select('course_id, course_code, course_name, units');
                (coursesData ?? []).forEach((c) => { courseMap[c.course_id] = c; });
            }

            // Fetch teacher display info directly from course_sections.teacher_id
            // (No longer reading from teacher_course_assignments — that table is course-scoped
            //  and caused the "last writer wins" erasure bug in SectionSetupModal.)
            const teacherIds = [...new Set(sections.map((s) => s.teacher_id).filter(Boolean))];
            const teacherMap = {};
            if (teacherIds.length) {
                const { data: tUsers } = await supabase
                    .from('users')
                    .select('user_id, display_id, full_name')
                    .in('user_id', teacherIds);
                (tUsers ?? []).forEach((u) => { teacherMap[u.user_id] = u; });
            }

            setCourses(
                sections.map((sec) => {
                    const c       = courseMap[sec.course_id] ?? {};
                    const teacher = sec.teacher_id ? (teacherMap[sec.teacher_id] ?? null) : null;
                    return {
                        // KEY: section_id is the isolation key — every downstream consumer
                        // (TeacherCourses, StudentCourses) uses course.id / course._uuid to
                        // query exams, materials, announcements, class_standing.  Pointing both
                        // at section_id means content created in one section stays in that section.
                        id:           sec.section_id,
                        _uuid:        sec.section_id,

                        // Keep the original course_id available for admin lookups / display
                        _courseId:    sec.course_id,
                        _sectionId:   sec.section_id,

                        code:         c.course_code    ?? '',
                        name:         c.course_name    ?? '',
                        units:        c.units          ?? 0,

                        // Teacher filtered in TeacherCourses via: courses.filter(c => c.teacher === user.id)
                        teacher:      teacher?.display_id  || '',
                        teacherName:  teacher?.full_name   || 'Unassigned',

                        schedule:     sec.schedule_label   || '',
                        yearLevel:    sec.year_level       || '',
                        semester:     sec.semester         || '',
                        room:         sec.room_id          || '',
                        status:       'Ongoing',

                        // Legacy field kept so any remaining callers don't break
                        _scheduleId:  null,
                    };
                })
            );
        }
        loadCourses();
    }, []);

    // ── Load enrollments ──────────────────────────────────────────────────────────
    // FIX: Use section_id directly as courseId instead of resolving it back to
    // the shared course_id.  Matches the new courses[].id = section_id above.
    useEffect(() => {
        async function loadEnrollments() {
            const { data: uRes } = await supabase
                .from('users')
                .select('user_id, display_id')
                .eq('role', 'student');

            const uMap = {};
            (uRes || []).forEach((u) => { uMap[u.user_id] = u.display_id; });

            const { data: sseData } = await supabase
                .from('student_section_assignments')
                .select('student_id, section_id, final_grade, enrollment_status');

            if (sseData) {
                // section_id IS the course identity now — no extra lookup needed.
                const merged = sseData
                    .map((row) => ({
                        studentId: uMap[row.student_id] || String(row.student_id),
                        courseId:  row.section_id,   // section-scoped, not shared course_id
                        grade:     row.final_grade   ?? null,
                        status:    row.enrollment_status || 'Enrolled',
                    }))
                    .filter((r) => r.courseId);

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
