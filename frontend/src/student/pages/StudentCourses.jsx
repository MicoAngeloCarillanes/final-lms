import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { MAT_META, MaterialType, isSubmittable } from "../../lib/constants";
import { letterGrade, gradeColor } from "../../lib/helpers";
import { normalizeMaterial, normalizeExam, normalizeWorkSub } from "../../lib/normalizers";
import { Badge, Btn } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar from "../../components/TopBar";
import { TypeBadge } from "../components/TypeBadge";
import MaterialDetailView from "../components/MaterialDetailView";
import ExamTaker from "../components/ExamTaker";

export default function StudentCourses({ user, courses, onSubmitExam, examSubmissions, enrollments }) {
  const myEnrollments = enrollments.filter(e => e.studentId === user.id);
  const myCourses     = myEnrollments
    .map(e => ({ ...courses.find(c => c.id === e.courseId) || {}, ...e }))
    .filter(c => c.id);

  // ── Live materials and exams from Supabase ──────────────────────────────────
  const [allMaterials,    setAllMaterials]    = useState([]);
  const [allExams,        setAllExams]        = useState([]);
  const [workSubmissions, setWorkSubmissions] = useState([]);

  useEffect(() => {
    const uuidToCode = {};
    courses.forEach(c => { if (c._uuid) uuidToCode[c._uuid] = c.id; });

    async function loadMaterials() {
      const courseUuids = myCourses.map(c => c._uuid).filter(Boolean);
      if (!courseUuids.length) return;
      const { data } = await supabase.from("materials").select("*")
        .in("course_id", courseUuids).eq("is_published", true);
      if (data) setAllMaterials(data.map(r => normalizeMaterial({
        ...r, courses: { course_code: uuidToCode[r.course_id] || r.course_id },
      })));
    }

    async function loadExams() {
      const courseUuids = myCourses.map(c => c._uuid).filter(Boolean);
      if (!courseUuids.length) return;
      const [examRes, qRes] = await Promise.all([
        supabase.from("exams").select("*").in("course_id", courseUuids).eq("is_published", true),
        supabase.from("exam_questions").select("*"),
      ]);
      if (examRes.data) setAllExams(examRes.data.map(r => normalizeExam({
        ...r,
        courses:        { course_code: uuidToCode[r.course_id] || r.course_id },
        exam_questions: (qRes.data || []).filter(q => q.exam_id === r.exam_id),
      })));
    }

    loadMaterials();
    loadExams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, courses]);

  // ── Work submissions ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?._uuid) return;
    supabase.from("work_submissions").select("*").eq("student_id", user._uuid)
      .then(({ data }) => { if (data) setWorkSubmissions(data.map(r => normalizeWorkSub(r))); });
  }, [user?._uuid]);

  // Realtime: push grade updates to student as soon as teacher saves
  useEffect(() => {
    if (!user?._uuid) return;
    const channel = supabase
      .channel(`student_work_subs:${user._uuid}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "work_submissions",
        filter: `student_id=eq.${user._uuid}`,
      }, (payload) => {
        setWorkSubmissions(prev => prev.map(s =>
          s.materialId === payload.new.material_id ? normalizeWorkSub(payload.new) : s
        ));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?._uuid]);

  const handleWorkSubmissionSaved = (sub) => {
    setWorkSubmissions(prev => {
      const idx = prev.findIndex(s => s.materialId === sub.materialId);
      if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], ...sub }; return n; }
      return [...prev, sub];
    });
  };

  // ── UI state ──────────────────────────────────────────────────────────────────
  const [sel,              setSel]              = useState(null);
  const [tab,              setTab]              = useState("info");
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [selectedExam,     setSelectedExam]     = useState(null);

  const courseCols = [
    { field: "code",        header: "Code",     width: 80 },
    { field: "name",        header: "Course" },
    { field: "teacherName", header: "Teacher",  width: 170 },
    { field: "schedule",    header: "Schedule", width: 155 },
    { field: "units",       header: "Units",    width: 55 },
    { field: "grade",       header: "Grade",    width: 80,
      cellRenderer: v => v != null ? <span style={{ fontWeight: 800, color: gradeColor(v) }}>{v}%</span> : <Badge>TBA</Badge> },
    { field: "status",      header: "Status",   width: 90,
      cellRenderer: v => <Badge color="success">{v}</Badge> },
  ];

  const DefaultCourseView = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="My Courses" subtitle={`${myCourses.length} enrolled course${myCourses.length !== 1 ? "s" : ""}`} />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Course grid */}
        <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a" }}>
          <LMSGrid columns={courseCols} rowData={myCourses}
            onRowClick={r => { setSel(r); setTab("info"); }}
            selectedId={sel?.id} height="100%" />
        </div>

        {/* Course detail sidebar */}
        {sel && (
          <div style={{ width: 292, borderLeft: "1px solid #334155", background: "#1e293b", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
            {/* Sidebar header */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{sel.code}: {sel.name}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{sel.schedule}</div>
              </div>
              <button onClick={() => setSel(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#475569", fontSize: 18, marginLeft: 8, lineHeight: 1 }}>×</button>
            </div>

            {/* Tab bar */}
            <div style={{ display: "flex", borderBottom: "1px solid #334155" }}>
              {["info", "materials", "exams"].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ flex: 1, padding: "8px 4px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, color: tab === t ? "#4f46e5" : "#94a3b8", borderBottom: `2px solid ${tab === t ? "#4f46e5" : "transparent"}`, textTransform: "capitalize" }}>
                  {t}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              {/* Info tab */}
              {tab === "info" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[["Teacher", sel.teacherName], ["Schedule", sel.schedule], ["Units", String(sel.units) + " units"], ["Year", sel.yearLevel], ["Semester", sel.semester], ["Current Grade", sel.grade != null ? `${sel.grade}% (${letterGrade(sel.grade)})` : "Pending"]].map(([l, v]) => v && (
                    <div key={l}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{l}</div>
                      <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Materials tab */}
              {tab === "materials" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {allMaterials.filter(m => m.courseId === sel.id).length === 0
                    ? <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No materials yet</div>
                    : allMaterials.filter(m => m.courseId === sel.id).map(m => {
                        const meta = MAT_META[m.type] || MAT_META[MaterialType.LECTURE];
                        return (
                          <div key={m.id} className="mat-item"
                            onClick={() => setSelectedMaterial(m)}
                            style={{ padding: "10px 11px", background: "#0f172a", borderRadius: 6, border: "1px solid #334155", cursor: "pointer" }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                              <span style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>{meta.icon}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 3 }}>{m.title}</div>
                                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{m.description}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <TypeBadge type={m.type} />
                                  <span style={{ fontSize: 10, color: "#475569" }}>{m.date}</span>
                                  {isSubmittable(m.type) && (
                                    <span style={{ fontSize: 9, background: "rgba(16,185,129,.15)", color: "#34d399", padding: "1px 6px", borderRadius: 9999, fontWeight: 700 }}>Submit</span>
                                  )}
                                </div>
                              </div>
                              <span style={{ color: "#cbd5e1", fontSize: 14, flexShrink: 0, marginTop: 2 }}>›</span>
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              )}

              {/* Exams tab */}
              {tab === "exams" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {allExams.filter(e => e.courseId === sel.id).length === 0
                    ? <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No exams scheduled</div>
                    : allExams.filter(e => e.courseId === sel.id).map(exam => {
                        const taken = examSubmissions.find(s => s.examId === exam.id && s.studentId === user.id);
                        return (
                          <div key={exam.id} style={{ padding: "10px 11px", background: "#0f172a", borderRadius: 6, border: "1px solid #334155" }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 3 }}>{exam.title}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>📅 {exam.date} · ⏱ {exam.duration}</div>
                            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Total: {exam.totalPoints} pts</div>
                            {taken
                              ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <Badge color={taken.score / taken.totalPoints >= 0.75 ? "success" : "danger"}>
                                    {taken.score}/{taken.totalPoints} pts
                                  </Badge>
                                  <span style={{ fontSize: 10, color: "#475569" }}>Submitted</span>
                                </div>
                              )
                              : <Btn size="sm" onClick={() => setSelectedExam(exam)}>Take Exam →</Btn>
                            }
                          </div>
                        );
                      })
                  }
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Three-way priority: ExamTaker > MaterialDetail > DefaultCourseView
  if (selectedExam) {
    return (
      <ExamTaker
        exam={selectedExam}
        course={myCourses.find(c => c.id === selectedExam.courseId)}
        user={user}
        onBack={() => setSelectedExam(null)}
        onSubmit={(sub) => { onSubmitExam(sub); setSelectedExam(null); }}
      />
    );
  }

  return selectedMaterial
    ? <MaterialDetailView
        material={selectedMaterial}
        course={myCourses.find(c => c.id === selectedMaterial.courseId)}
        onBack={() => setSelectedMaterial(null)}
        user={user}
        existingSubmission={workSubmissions.find(s => s.materialId === selectedMaterial.id)}
        onSubmissionSaved={handleWorkSubmissionSaved}
      />
    : DefaultCourseView;
}
