import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { EXAM_TERMS, TERM_META } from "../../lib/constants";
import { gradeColor, computeTermGrade, csGradePct } from "../../lib/helpers";
import { normalizeExam } from "../../lib/normalizers";
import { Badge, Btn, Sel, StatCard } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";
import ClassStandingModal from "../components/ClassStandingModal";

export default function TeacherGrades({ user, courses, allUsers, examSubmissions, enrollments }) {
  const myCourses = courses.filter(c => c.teacher === user.id);

  const [allExams,       setAllExams]       = useState([]);
  const [allMaterials,   setAllMaterials]   = useState([]);
  const [classStandings, setClassStandings] = useState([]);
  const [allWorkSubs,    setAllWorkSubs]    = useState([]);
  const [filterCourse,   setFilterCourse]   = useState("all");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [csModal,        setCsModal]        = useState(null);  // { student, course }
  const [detailRow,      setDetailRow]      = useState(null);
  const [toast,          setToast]          = useState("");
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    async function loadData() {
      const uuidToCode = {};
      courses.forEach(c => { if (c._uuid) uuidToCode[c._uuid] = c.id; });
      const courseUuids = myCourses.map(c => c._uuid).filter(Boolean);
      if (!courseUuids.length) return;

      const [examRes, qRes, matRes, csRes] = await Promise.all([
        supabase.from("exams").select("*").in("course_id", courseUuids),
        supabase.from("exam_questions").select("*"),
        supabase.from("materials")
          .select("material_id,course_id,material_type,term,total_points,title")
          .in("course_id", courseUuids),
        supabase.from("class_standing").select("*").in("course_id", courseUuids),
      ]);

      if (examRes.data) setAllExams(examRes.data.map(r => normalizeExam({
        ...r,
        courses:        { course_code: uuidToCode[r.course_id] || r.course_id },
        exam_questions: (qRes.data || []).filter(q => q.exam_id === r.exam_id),
      })));

      const matIds = (matRes.data || []).map(m => m.material_id);
      let wsCombined = [];
      if (matIds.length) {
        const { data: wsData } = await supabase
          .from("work_submissions")
          .select("material_id,student_id,score,status")
          .in("material_id", matIds)
          .eq("status", "Graded");
        wsCombined = wsData || [];
      }

      setAllMaterials(matRes.data || []);
      setAllWorkSubs(wsCombined);
      setClassStandings((csRes.data || []).map(r => ({
        studentUuid: r.student_id, courseUuid: r.course_id, term: r.term,
        project: r.project, recitation: r.recitation, attendance: r.attendance,
      })));
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  const getTermData = (studentDisplayId, studentUuid, courseId, courseUuid) => {
    const result = {};
    EXAM_TERMS.forEach(term => {
      // Course Work (30%)
      const cwMats = allMaterials.filter(m =>
        m.course_id === courseUuid && m.term === term &&
        (m.material_type === "Lab" || m.material_type === "Assignment")
      );
      const cwSubs = cwMats.map(m => {
        const ws = allWorkSubs.find(w => w.material_id === m.material_id && w.student_id === studentUuid);
        return ws ? ws.score : null;
      }).filter(x => x != null);
      const cw = cwSubs.length > 0 ? Math.round(cwSubs.reduce((a, b) => a + b, 0) / cwSubs.length) : null;

      // Class Standing (30%)
      const csEntry = classStandings.find(cs =>
        cs.studentUuid === studentUuid && cs.courseUuid === courseUuid && cs.term === term
      ) || null;
      const cs = csGradePct(csEntry);

      // Exams (40%) and Quizzes (30%) — separated by examType
      const termExams = allExams.filter(ex => ex.courseId === courseId && ex.term === term);
      const subs      = examSubmissions.filter(s => s.studentId === studentDisplayId && s.courseId === courseId);

      const examOnlyPcts  = termExams.filter(ex => (ex.examType || "Exam") === "Exam").map(ex => {
        const sub = subs.find(s => s.examId === ex.id);
        return sub ? Math.round((sub.score / sub.totalPoints) * 100) : null;
      }).filter(x => x != null);
      const quizOnlyPcts = termExams.filter(ex => ex.examType === "Quiz").map(ex => {
        const sub = subs.find(s => s.examId === ex.id);
        return sub ? Math.round((sub.score / sub.totalPoints) * 100) : null;
      }).filter(x => x != null);

      const exam = examOnlyPcts.length  > 0 ? Math.round(examOnlyPcts.reduce((a, b) => a + b, 0)  / examOnlyPcts.length)  : null;
      const quiz = quizOnlyPcts.length  > 0 ? Math.round(quizOnlyPcts.reduce((a, b) => a + b, 0) / quizOnlyPcts.length) : null;

      result[term] = { cw, cs, csEntry, exam, quiz, grade: computeTermGrade({ cw, cs, exam, quiz }) };
    });
    return result;
  };

  const cellGradeClass = (v) =>
    v == null ? "" : v >= 90 ? "grade-cell-high" : v >= 75 ? "grade-cell-pass" : v >= 60 ? "grade-cell-warn" : "grade-cell-fail";

  // Build master rows
  const masterRows = enrollments
    .filter(e => myCourses.some(c => c.id === e.courseId))
    .filter(e => filterCourse === "all" || e.courseId === filterCourse)
    .map(e => {
      const student  = allUsers.find(u => u.id === e.studentId || u._uuid === e.studentId) || {};
      const course   = myCourses.find(c => c.id === e.courseId) || {};
      const termData = getTermData(e.studentId, student._uuid, e.courseId, course._uuid);
      const termGrades = EXAM_TERMS.map(t => termData[t].grade).filter(x => x != null);
      const overall = termGrades.length > 0 ? Math.round(termGrades.reduce((a, b) => a + b, 0) / termGrades.length) : null;
      return {
        studentId: e.studentId, courseId: e.courseId,
        studentUuid: student._uuid, courseUuid: course._uuid,
        studentName: student.fullName || e.studentId,
        courseCode: course.code || e.courseId, courseName: course.name || "",
        termData, overall,
        status: overall == null ? "Pending" : overall >= 75 ? "Pass" : "Fail",
        _student: student, _course: course,
      };
    })
    .filter(r => r.studentUuid)   // drop rows where student UUID couldn't be resolved
    .filter(r => filterStatus === "all" || r.status === filterStatus);

  const totalStudents  = [...new Set(masterRows.map(r => r.studentId))].length;
  const passCount      = masterRows.filter(r => r.status === "Pass").length;
  const failCount      = masterRows.filter(r => r.status === "Fail").length;
  const validOveralls  = masterRows.filter(r => r.overall != null).map(r => r.overall);
  const classAvg       = validOveralls.length
    ? (validOveralls.reduce((a, b) => a + b, 0) / validOveralls.length).toFixed(1)
    : "—";

  const termGradeCell = (row, term) => {
    const g = row.termData[term]?.grade;
    return g != null
      ? <span className={cellGradeClass(g)} style={{ display: "block", textAlign: "center", fontWeight: 800, padding: "2px 6px", borderRadius: 5, fontSize: 12 }}>{g}%</span>
      : <span style={{ color: "#475569", fontSize: 11 }}>—</span>;
  };

  const cols = [
    { field: "studentName", header: "Student", width: 160,
      cellRenderer: (v, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(99,102,241,.15)", color: "#6366f1", fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{v?.charAt(0)}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0" }}>{v}</div>
            <div style={{ fontSize: 10, color: "#475569" }}>{row.studentId}</div>
          </div>
        </div>
      )},
    { field: "courseCode", header: "Course", width: 75,
      cellRenderer: v => <span style={{ fontWeight: 700, color: "#4f46e5" }}>{v}</span> },
    { field: "_prelim",    header: "Prelim",     width: 82, cellRenderer: (_, row) => termGradeCell(row, "Prelim") },
    { field: "_midterm",   header: "Midterm",    width: 82, cellRenderer: (_, row) => termGradeCell(row, "Midterm") },
    { field: "_semifinal", header: "Semi-Final", width: 90, cellRenderer: (_, row) => termGradeCell(row, "Semi-Final") },
    { field: "_finals",    header: "Finals",     width: 82, cellRenderer: (_, row) => termGradeCell(row, "Finals") },
    { field: "overall", header: "Overall", width: 88,
      cellRenderer: v => v != null
        ? <span className={cellGradeClass(v)} style={{ display: "block", textAlign: "center", fontWeight: 900, fontSize: 14, padding: "2px 6px", borderRadius: 5 }}>{v}%</span>
        : <span style={{ color: "#475569", fontSize: 11 }}>—</span> },
    { field: "status", header: "Status", width: 80,
      cellRenderer: v => <Badge color={v === "Pass" ? "success" : v === "Fail" ? "danger" : "default"}>{v}</Badge> },
    { field: "studentId", header: "Actions", width: 150, sortable: false,
      cellRenderer: (_, row) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Btn size="sm" variant="secondary"
            onClick={e => { e.stopPropagation(); setCsModal({ student: row._student, course: row._course }); }}
            style={{ fontSize: 11, padding: "3px 9px" }}>
            🏆 Set CS
          </Btn>
          <Btn size="sm" variant="ghost" style={{ border: "1px solid #334155", fontSize: 11, padding: "3px 9px" }}
            onClick={e => { e.stopPropagation(); setDetailRow(row); }}>
            View →
          </Btn>
        </div>
      )},
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Grade Students"
        subtitle="Quiz 30% · Course Work 30% · Class Standing 30% · Exam 40%"
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {toast && <span style={{ fontSize: 12, color: "#34d399", fontWeight: 700, background: "rgba(16,185,129,.15)", padding: "4px 10px", borderRadius: 6 }}>✓ {toast}</span>}
            <Sel value={filterCourse} onChange={e => setFilterCourse(e.target.value)} style={{ width: "auto", fontSize: 12 }}>
              <option value="all">All Courses</option>
              {myCourses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
            </Sel>
            <Sel value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: "auto", fontSize: 12 }}>
              <option value="all">All Status</option>
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
              <option value="Pending">Pending</option>
            </Sel>
          </div>
        }
      />

      <div style={{ flex: 1, padding: "14px 20px", display: "flex", flexDirection: "column", overflow: "hidden", gap: 12 }}>
        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, flexShrink: 0 }}>
          <StatCard icon="👥" label="Students"  value={totalStudents}                       color="#6366f1" bg="#ede9fe" />
          <StatCard icon="📊" label="Class Avg" value={classAvg + (classAvg !== "—" ? "%" : "")} color="#10b981" bg="#d1fae5" />
          <StatCard icon="✅" label="Passing"   value={passCount}                            color="#3b82f6" bg="#dbeafe" />
          <StatCard icon="❌" label="Failing"   value={failCount}                            color="#ef4444" bg="#fee2e2" />
          <StatCard icon="📝" label="Exams"     value={examSubmissions.filter(s => myCourses.some(c => c.id === s.courseId)).length} color="#f59e0b" bg="#fef3c7" />
        </div>

        {/* Formula legend */}
        <div style={{ display: "flex", gap: 16, padding: "6px 10px", background: "#1e293b", borderRadius: 7, border: "1px solid #334155", flexShrink: 0, alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Formula</span>
          {[["📚 Course Work", "30%", "#ede9fe", "#6366f1"], ["🏆 Class Standing", "30%", "#d1fae5", "#10b981"], ["📝 Exams", "40%", "#fef3c7", "#f59e0b"], ["✏ Quizzes", "30%", "#fce7f3", "#ec4899"]].map(([lbl, pct, bg, col]) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
              <span style={{ background: bg, color: col, fontWeight: 800, padding: "2px 8px", borderRadius: 9999 }}>{pct}</span>
              <span style={{ color: "#64748b" }}>{lbl}</span>
            </div>
          ))}
          <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>Click "🏆 Set CS" to enter Project / Recitation / Attendance grades</span>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <LMSGrid columns={cols} rowData={masterRows} height="100%"
            onRowClick={row => setDetailRow(row)}
            selectedId={detailRow?.studentId + detailRow?.courseId}
          />
        </div>
      </div>

      {/* Class Standing Modal */}
      {csModal && (
        <ClassStandingModal
          student={csModal.student}
          course={csModal.course}
          existing={classStandings.filter(cs =>
            cs.studentUuid === csModal.student._uuid && cs.courseUuid === csModal.course._uuid
          )}
          teacherUuid={user._uuid}
          onSave={(newRows) => {
            setClassStandings(prev => {
              const filtered = prev.filter(cs =>
                !(cs.studentUuid === csModal.student._uuid && cs.courseUuid === csModal.course._uuid &&
                  newRows.some(r => r.term === cs.term))
              );
              return [...filtered, ...newRows];
            });
            showToast(`Class Standing saved for ${csModal.student.fullName}`);
          }}
          onClose={() => setCsModal(null)}
        />
      )}

      {/* Student Detail Modal */}
      {detailRow && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetailRow(null)}>
          <div className="modal-box" style={{ background: "#1e293b", borderRadius: 14, width: 680, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.25)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #334155", background: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, color: "#f1f5f9" }}>{detailRow.studentName}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{detailRow.courseCode} · {detailRow.courseName}</div>
              </div>
              <button onClick={() => setDetailRow(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#475569", fontSize: 22 }}
                onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {/* Overall grade summary */}
              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <div style={{ flex: 1, background: detailRow.status === "Pass" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${detailRow.status === "Pass" ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, padding: "14px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: detailRow.status === "Pass" ? "#065f46" : "#dc2626" }}>{detailRow.overall ?? "—"}{detailRow.overall != null ? "%" : ""}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>Overall Grade</div>
                  <Badge color={detailRow.status === "Pass" ? "success" : detailRow.status === "Fail" ? "danger" : "default"} style={{ marginTop: 6, display: "inline-block" }}>{detailRow.status}</Badge>
                </div>
                <div style={{ flex: 3, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {EXAM_TERMS.map(term => {
                    const g  = detailRow.termData[term]?.grade;
                    const tm = TERM_META[term];
                    return (
                      <div key={term} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: tm.color, background: tm.bg, padding: "2px 7px", borderRadius: 9999, display: "inline-block", marginBottom: 6 }}>{term}</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: g != null ? gradeColor(g) : "#94a3b8" }}>{g != null ? `${g}%` : "—"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Per-term component breakdown */}
              {EXAM_TERMS.map(term => {
                const td = detailRow.termData[term];
                const tm = TERM_META[term];
                return (
                  <div key={term} style={{ marginBottom: 14, border: "1px solid #334155", borderRadius: 9, overflow: "hidden" }}>
                    <div style={{ background: "#0f172a", padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #334155" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: tm.color, background: tm.bg, padding: "2px 9px", borderRadius: 9999 }}>{term}</span>
                      {td.grade != null
                        ? <span className={cellGradeClass(td.grade)} style={{ fontWeight: 900, padding: "3px 10px", borderRadius: 6 }}>{td.grade}%</span>
                        : <span style={{ fontSize: 11, color: "#475569" }}>Pending</span>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0 }}>
                      {[
                        { label: "📚 Course Work",    pct: td.cw,   weight: "30%", color: "#6366f1", bg: "#ede9fe" },
                        { label: "✏ Quizzes",         pct: td.quiz, weight: "30%", color: "#ec4899", bg: "#fce7f3" },
                        { label: "🏆 Class Standing", pct: td.cs,   weight: "30%", color: "#10b981", bg: "#d1fae5" },
                        { label: "📝 Exams",          pct: td.exam, weight: "40%", color: "#f59e0b", bg: "#fef3c7" },
                      ].map(({ label, pct, weight, color, bg }, ci) => (
                        <div key={label} style={{ padding: "10px 14px", borderRight: ci < 3 ? "1px solid #1e293b" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>{label}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, color, background: bg, padding: "1px 6px", borderRadius: 9999 }}>{weight}</span>
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: pct != null ? gradeColor(pct) : "#94a3b8" }}>
                            {pct != null ? `${pct}%` : "—"}
                          </div>
                          {label.includes("Class") && td.csEntry && (
                            <div style={{ marginTop: 5 }}>
                              {[["Project", td.csEntry.project], ["Recitation", td.csEntry.recitation], ["Attendance", td.csEntry.attendance]].map(([lbl, v]) => (
                                <div key={lbl} style={{ fontSize: 10, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                                  <span>{lbl}</span><span style={{ fontWeight: 700 }}>{v != null ? `${v}/100` : "—"}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid #334155", background: "#0f172a", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => { setDetailRow(null); setCsModal({ student: detailRow._student, course: detailRow._course }); }}>
                🏆 Edit Class Standing
              </Btn>
              <Btn variant="secondary" onClick={() => setDetailRow(null)}>Close</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
