import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { EXAM_TERMS, TERM_META } from "../../lib/constants";
import { letterGrade, gradeColor, computeTermGrade, csGradePct } from "../../lib/helpers";
import { normalizeExam } from "../../lib/normalizers";
import { Badge, StatCard } from "../../components/ui";
import TopBar from "../../components/TopBar";

export default function StudentGrades({ user, courses, examSubmissions, enrollments }) {
  const myEnrollments = enrollments.filter(e => e.studentId === user.id);

  const [expandedId,     setExpandedId]     = useState(null);
  const [allExams,       setAllExams]       = useState([]);
  const [allMaterials,   setAllMaterials]   = useState([]);
  const [classStandings, setClassStandings] = useState([]);
  const [workSubs,       setWorkSubs]       = useState([]);

  useEffect(() => {
    async function loadAll() {
      if (!user._uuid) return;
      const uuidToCode = {};
      courses.forEach(c => { if (c._uuid) uuidToCode[c._uuid] = c.id; });

      const courseUuids = myEnrollments.map(e => {
        const c = courses.find(x => x.id === e.courseId);
        return c?._uuid;
      }).filter(Boolean);
      if (!courseUuids.length) return;

      const [examRes, qRes, matRes, csRes, wsRes] = await Promise.all([
        supabase.from("exams").select("*").in("course_id", courseUuids),
        supabase.from("exam_questions").select("*"),
        supabase.from("materials")
          .select("material_id,course_id,material_type,term,total_points,title")
          .in("course_id", courseUuids),
        supabase.from("class_standing").select("*")
          .eq("student_id", user._uuid).in("course_id", courseUuids),
        supabase.from("work_submissions")
          .select("material_id,score,status")
          .eq("student_id", user._uuid)
          .eq("status", "Graded"),
      ]);

      if (examRes.data) setAllExams(examRes.data.map(r => normalizeExam({
        ...r,
        courses:        { course_code: uuidToCode[r.course_id] || r.course_id },
        exam_questions: (qRes.data || []).filter(q => q.exam_id === r.exam_id),
      })));
      setAllMaterials(matRes.data || []);
      setClassStandings((csRes.data || []).map(r => ({
        courseUuid: r.course_id, term: r.term,
        project: r.project, recitation: r.recitation, attendance: r.attendance,
      })));
      setWorkSubs(wsRes.data || []);
    }
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, user._uuid]);

  const cellGradeClass = (v) =>
    v == null ? "" : v >= 90 ? "grade-cell-high" : v >= 75 ? "grade-cell-pass" : v >= 60 ? "grade-cell-warn" : "grade-cell-fail";

  // Build one row per enrolled course
  const rows = myEnrollments.map(e => {
    const c     = courses.find(x => x.id === e.courseId) || {};
    const cuuid = c._uuid;

    const termData = {};
    EXAM_TERMS.forEach(term => {
      // Course Work (30%)
      const cwMats = allMaterials.filter(m =>
        m.course_id === cuuid && m.term === term &&
        (m.material_type === "Lab" || m.material_type === "Assignment")
      );
      const cwSubs = cwMats.map(m => {
        const ws = workSubs.find(w => w.material_id === m.material_id);
        return ws ? ws.score : null;
      }).filter(x => x != null);
      const cw = cwSubs.length > 0
        ? Math.round(cwSubs.reduce((a, b) => a + b, 0) / cwSubs.length)
        : null;
      const cwDetail = cwMats.map(m => ({
        title: m.title || m.material_id,
        score: workSubs.find(w => w.material_id === m.material_id)?.score ?? null,
      }));

      // Class Standing (30%)
      const csEntry = classStandings.find(cs => cs.courseUuid === cuuid && cs.term === term) || null;
      const cs = csGradePct(csEntry);

      // Exams (40%) and Quizzes (30%) — separated by examType
      const termExams = allExams.filter(ex => ex.courseId === e.courseId && ex.term === term);
      const examSubs  = examSubmissions.filter(s => s.studentId === user.id && s.courseId === e.courseId);

      const examOnlyItems  = termExams.filter(ex => (ex.examType || "Exam") === "Exam");
      const quizOnlyItems  = termExams.filter(ex => ex.examType === "Quiz");

      const examScoresPct = examOnlyItems.map(ex => {
        const sub = examSubs.find(s => s.examId === ex.id);
        return sub ? Math.round((sub.score / sub.totalPoints) * 100) : null;
      }).filter(x => x != null);
      const quizScoresPct = quizOnlyItems.map(ex => {
        const sub = examSubs.find(s => s.examId === ex.id);
        return sub ? Math.round((sub.score / sub.totalPoints) * 100) : null;
      }).filter(x => x != null);

      const exam = examScoresPct.length > 0
        ? Math.round(examScoresPct.reduce((a, b) => a + b, 0) / examScoresPct.length) : null;
      const quiz = quizScoresPct.length > 0
        ? Math.round(quizScoresPct.reduce((a, b) => a + b, 0) / quizScoresPct.length) : null;

      const examDetail = termExams.map(ex => {
        const sub = examSubs.find(s => s.examId === ex.id);
        return {
          title:    ex.title,
          examType: ex.examType || "Exam",
          score:    sub?.score ?? null,
          total:    ex.totalPoints,
          pct:      sub ? Math.round((sub.score / sub.totalPoints) * 100) : null,
        };
      });

      termData[term] = {
        cw, cwDetail, csEntry,
        cs, exam, quiz, examDetail,
        grade: computeTermGrade({ cw, cs, exam, quiz }),
      };
    });

    const termGrades = EXAM_TERMS.map(t => termData[t].grade).filter(x => x != null);
    const overall = termGrades.length > 0
      ? Math.round(termGrades.reduce((a, b) => a + b, 0) / termGrades.length)
      : null;

    return {
      courseId:    e.courseId,
      courseCode:  c.code,
      courseName:  c.name,
      teacherName: c.teacherName,
      termData,
      overall,
      status: overall == null ? "Pending" : overall >= 75 ? "Pass" : "Fail",
    };
  });

  const avg    = rows.filter(r => r.overall != null);
  const gwa    = avg.length ? (avg.reduce((s, r) => s + r.overall, 0) / avg.length).toFixed(1) : "—";
  const passed = rows.filter(r => r.status === "Pass").length;

  const termGradeCell = (v) => v != null
    ? <span className={cellGradeClass(v)} style={{ display: "block", textAlign: "center", fontWeight: 800, padding: "2px 6px", borderRadius: 5 }}>{v}%</span>
    : <span style={{ color: "#475569", fontSize: 11 }}>—</span>;

  const cols = [
    { field: "courseCode",  header: "Code",       width: 72 },
    { field: "courseName",  header: "Course Name" },
    { field: "teacherName", header: "Teacher",    width: 150 },
    { field: "Prelim",      header: "Prelim",     width: 82,  cellRenderer: (_, row) => termGradeCell(row.termData["Prelim"]?.grade) },
    { field: "Midterm",     header: "Midterm",    width: 82,  cellRenderer: (_, row) => termGradeCell(row.termData["Midterm"]?.grade) },
    { field: "Semi-Final",  header: "Semi-Final", width: 90,  cellRenderer: (_, row) => termGradeCell(row.termData["Semi-Final"]?.grade) },
    { field: "Finals",      header: "Finals",     width: 82,  cellRenderer: (_, row) => termGradeCell(row.termData["Finals"]?.grade) },
    { field: "overall",     header: "Overall",    width: 82,
      cellRenderer: (_, row) => row.overall != null
        ? <span className={cellGradeClass(row.overall)} style={{ display: "block", textAlign: "center", fontWeight: 900, fontSize: 14, padding: "2px 6px", borderRadius: 5 }}>{row.overall}%</span>
        : <span style={{ color: "#475569", fontSize: 11 }}>—</span> },
    { field: "status", header: "Status", width: 82,
      cellRenderer: (v) => <Badge color={v === "Pass" ? "success" : v === "Fail" ? "danger" : "default"}>{v}</Badge> },
    { field: "courseId", header: "Detail", width: 72, sortable: false,
      cellRenderer: (_, row) => (
        <button
          onClick={e => { e.stopPropagation(); setExpandedId(id => id === row.courseId ? null : row.courseId); }}
          style={{ background: "none", border: "1px solid #334155", borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#4f46e5", fontFamily: "inherit" }}>
          {expandedId === row.courseId ? "▲ Hide" : "▼ Details"}
        </button>
      )},
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar
        title="Grade Report"
        subtitle="Academic Performance Overview · Grade = CW 30% + Class Standing 30% + Exams 40%"
      />
      <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", overflow: "hidden", gap: 14 }}>
        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, flexShrink: 0 }}>
          <StatCard icon="📊" label="GWA"         value={gwa + (gwa !== "—" ? "%" : "")}              color="#4f46e5" bg="#ede9fe" />
          <StatCard icon="📚" label="Courses"     value={rows.length}                                  color="#10b981" bg="#d1fae5" />
          <StatCard icon="✅" label="Passing"     value={`${passed}/${rows.length}`}                   color="#3b82f6" bg="#dbeafe" />
          <StatCard icon="📝" label="Exams Taken" value={examSubmissions.filter(s => s.studentId === user.id).length} color="#f59e0b" bg="#fef3c7" />
        </div>

        {/* Grade table */}
        <div style={{ flex: 1, overflow: "hidden", border: "1px solid #334155", borderRadius: 8, background: "#1e293b", display: "flex", flexDirection: "column" }}>
          {/* Sticky header */}
          <div style={{ flexShrink: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1e293b" }}>
                  {cols.map(col => (
                    <th key={col.field + col.header}
                      style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "#475569", whiteSpace: "nowrap", width: col.width || "auto" }}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {rows.map((row, i) => (
                  <React.Fragment key={row.courseId}>
                    <tr style={{ background: i % 2 === 0 ? "#0f172a" : "#0f172a", borderBottom: "1px solid #1e293b" }}>
                      {cols.map(col => (
                        <td key={col.field + col.header}
                          style={{ padding: "9px 12px", verticalAlign: "middle", width: col.width || "auto" }}>
                          {col.cellRenderer ? col.cellRenderer(row[col.field], row) : (row[col.field] ?? "—")}
                        </td>
                      ))}
                    </tr>

                    {/* Drill-down: per-term breakdown */}
                    {expandedId === row.courseId && (
                      <tr className="drill-row">
                        <td colSpan={cols.length} style={{ padding: "0 12px 16px 28px" }}>
                          <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 10, overflow: "hidden" }}>
                            {/* Formula reminder strip */}
                            <div style={{ background: "#1e293b", padding: "8px 16px", display: "flex", gap: 20 }}>
                              {[["📚 Course Work", "30%", "#818cf8"], ["🏆 Class Standing", "30%", "#34d399"], ["📝 Exams", "40%", "#fb923c"]].map(([lbl, pct, col]) => (
                                <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: col, fontWeight: 700 }}>
                                  <span>{lbl}</span>
                                  <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 9999, padding: "1px 7px" }}>{pct}</span>
                                </div>
                              ))}
                            </div>

                            {/* Per-term sections */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0 }}>
                              {EXAM_TERMS.map((term, ti) => {
                                const td    = row.termData[term];
                                const tm    = TERM_META[term];
                                const hasCS = td.csEntry && csGradePct(td.csEntry) != null;
                                return (
                                  <div key={term} style={{ padding: "12px 14px", borderRight: ti < 3 ? "1px solid #334155" : "none", borderTop: "1px solid #334155" }}>
                                    {/* Term badge + computed grade */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                      <span style={{ fontSize: 10, fontWeight: 800, color: tm.color, background: tm.bg, padding: "2px 8px", borderRadius: 9999 }}>{term}</span>
                                      {td.grade != null
                                        ? <span className={cellGradeClass(td.grade)} style={{ fontSize: 15, fontWeight: 900, padding: "2px 8px", borderRadius: 6 }}>{td.grade}%</span>
                                        : <span style={{ fontSize: 11, color: "#475569" }}>Pending</span>}
                                    </div>

                                    {/* Component rows */}
                                    {[
                                      { label: "📚 Course Work",     pct: td.cw,   weight: "30%" },
                                      { label: "🏆 Class Standing",  pct: td.cs,   weight: "30%" },
                                      { label: "📝 Exams",           pct: td.exam, weight: "40%" },
                                    ].map(({ label, pct, weight }) => (
                                      <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{label}</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                          <span style={{ fontSize: 9, color: "#475569" }}>{weight}</span>
                                          {pct != null
                                            ? <span style={{ fontSize: 12, fontWeight: 800, color: gradeColor(pct) }}>{pct}%</span>
                                            : <span style={{ fontSize: 10, color: "#cbd5e1" }}>—</span>}
                                        </div>
                                      </div>
                                    ))}

                                    {/* Class Standing detail */}
                                    {hasCS && (
                                      <div style={{ marginTop: 6, background: "rgba(16,185,129,.12)", border: "1px solid #bbf7d0", borderRadius: 6, padding: "5px 8px" }}>
                                        {[["Project", td.csEntry?.project], ["Recitation", td.csEntry?.recitation], ["Attendance", td.csEntry?.attendance]].map(([lbl, v]) => (
                                          <div key={lbl} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#34d399", marginBottom: 2 }}>
                                            <span>{lbl}</span>
                                            <span style={{ fontWeight: 700 }}>{v != null ? `${v}/100` : "—"}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Exam list */}
                                    {td.examDetail.length > 0 && (
                                      <div style={{ marginTop: 6 }}>
                                        {td.examDetail.map((ex, j) => (
                                          <div key={j} style={{ fontSize: 10, color: "#64748b", display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }} title={ex.title}>{ex.title}</span>
                                            <span style={{ fontWeight: 700, color: ex.pct != null ? gradeColor(ex.pct) : "#94a3b8" }}>
                                              {ex.pct != null ? `${ex.pct}%` : "—"}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ padding: "7px 12px", borderTop: "1px solid #334155", background: "#0f172a", fontSize: 11, color: "#64748b", flexShrink: 0 }}>
            {rows.length} course{rows.length !== 1 ? "s" : ""} · Click "▼ Details" to see per-term grade breakdown
          </div>
        </div>
      </div>
    </div>
  );
}
