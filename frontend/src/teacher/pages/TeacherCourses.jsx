import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { MAT_META, MaterialType, isSubmittable, EXAM_TERMS, TERM_META, QT_META } from "../../lib/constants";
import { safeFileName } from "../../lib/helpers";
import { normalizeMaterial, normalizeExam } from "../../lib/normalizers";
import { uploadFileToStorage } from "../../lib/storageHelpers";
import { Badge, Btn, Input, Sel, Toast } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";
import { TypeBadge } from "../../student/components/TypeBadge";
import ExamBuilder              from "../components/ExamBuilder";
import TeacherMaterialDetailView from "../components/TeacherMaterialDetailView";

export default function TeacherCourses({ user, courses, setCourses, allUsers, enrollments }) {
  const myCourses = courses.filter(c => c.teacher === user.id);

  // ── Course list state ────────────────────────────────────────────────────────
  const [sel,   setSel]  = useState(null);
  const [tab,   setTab]  = useState("materials");
  const [mats,  setMats] = useState([]);
  const [exams, setExams]= useState([]);
  const [matF,  setMatF] = useState({ title: "", type: "Lecture", term: "", description: "" });
  const [exF,   setExF]  = useState({ title: "", date: "", duration: "", totalPoints: "100" });
  const [toast, setToast]= useState("");
  const fileRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // ── Load materials + exams from Supabase ────────────────────────────────────
  useEffect(() => {
    async function loadTeacherData() {
      const uuidToCode = {};
      courses.forEach(c => { if (c._uuid) uuidToCode[c._uuid] = c.id; });
      const courseUuids = myCourses.map(c => c._uuid).filter(Boolean);
      if (!courseUuids.length) return;

      const [matRes, examRes, qRes] = await Promise.all([
        supabase.from("materials").select("*").in("course_id", courseUuids),
        supabase.from("exams").select("*").in("course_id", courseUuids),
        supabase.from("exam_questions").select("*"),
      ]);
      if (matRes.data) setMats(matRes.data.map(r => normalizeMaterial({
        ...r, courses: { course_code: uuidToCode[r.course_id] || r.course_id },
      })));
      if (examRes.data) setExams(examRes.data.map(r => normalizeExam({
        ...r,
        courses:        { course_code: uuidToCode[r.course_id] || r.course_id },
        exam_questions: (qRes.data || []).filter(q => q.exam_id === r.exam_id),
      })));
    }
    loadTeacherData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  // ── Detail / builder state ───────────────────────────────────────────────────
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [buildingExam,     setBuildingExam]     = useState(null);
  const [gradeEntries,     setGradeEntries]     = useState([]);

  // Holds staged File before addMat() uploads it
  const [pendingFile, setPendingFile] = useState(null);

  const handleFileUpload = (file) => {
    if (!file) return;
    const allowed = [".pdf", ".doc", ".docx"];
    if (!allowed.some(ext => file.name.toLowerCase().endsWith(ext))) {
      showToast("Only PDF/DOCX accepted."); return;
    }
    setPendingFile(file);
    setMatF(f => ({ ...f, attachmentName: file.name }));
    showToast(`"${file.name}" staged — will upload when you click Add Material.`);
  };

  const addMat = async () => {
    if (!matF.title.trim() || !sel) return;
    if (!matF.term) { showToast("Please select a term before adding this material."); return; }
    const courseUuid  = sel._uuid;
    const teacherUuid = user._uuid;
    if (!courseUuid)  { showToast("Course UUID missing — reload the page."); return; }
    if (!teacherUuid) { showToast("Teacher UUID missing — reload the page."); return; }

    const matPayload = {
      course_id:       courseUuid,
      created_by:      teacherUuid,
      title:           matF.title.trim(),
      material_type:   matF.type,
      description:     matF.description?.trim() || null,
      attachment_name: matF.attachmentName || null,
      is_published:    true,
    };
    if (matF.term) matPayload.term = matF.term;

    const { data: newMat, error } = await supabase
      .from("materials").insert(matPayload).select().single();
    if (error) { showToast("Error saving material: " + error.message); return; }

    let attachmentUrl = null;
    if (pendingFile instanceof File) {
      const storagePath = `${courseUuid}/${newMat.material_id}/${Date.now()}_${safeFileName(pendingFile.name)}`;
      try {
        showToast("Uploading attachment…");
        attachmentUrl = await uploadFileToStorage("materials", storagePath, pendingFile);
        await supabase.from("materials")
          .update({ attachment_url: attachmentUrl })
          .eq("material_id", newMat.material_id);
      } catch (uploadErr) {
        showToast("Material saved but attachment upload failed: " + uploadErr.message);
      }
      setPendingFile(null);
    }

    setMats(prev => [...prev, normalizeMaterial({
      ...newMat, attachment_url: attachmentUrl,
      courses: { course_code: sel.id },
    })]);
    setMatF({ title: "", type: "Lecture", term: "", description: "" });
    showToast("Material added!");
  };

  const addExam = () => {
    if (!exF.title.trim() || !sel) return;
    setExams(prev => [...prev, { id: `EX${Date.now()}`, courseId: sel.id, ...exF }]);
    setExF({ title: "", date: "", duration: "", totalPoints: "100" });
    showToast("Exam created!");
  };

  const toggleCourseStatus = async (course) => {
    const newStatus = course.status === "Finished" ? "Ongoing" : "Finished";
    const { error } = await supabase.from("courses")
      .update({ status: newStatus }).eq("course_id", course._uuid);
    if (error) { showToast("Error updating status: " + error.message); return; }
    setCourses(prev => prev.map(c => c._uuid === course._uuid ? { ...c, status: newStatus } : c));
    setSel(prev => prev?._uuid === course._uuid ? { ...prev, status: newStatus } : prev);
    showToast(`Course marked as ${newStatus}.`);
  };

  const handleMaterialUpdate = async (updated) => {
    const { error } = await supabase.from("materials").update({
      title:           updated.title,
      description:     updated.description || null,
      content:         updated.content     || null,
      due_date:        updated.dueDate     || null,
      total_points:    updated.points      || null,
      attachment_name: updated.attachment_name || updated.attachmentName || null,
      attachment_url:  updated.attachment_url || null,
    }).eq("material_id", updated.id);
    if (error) { showToast("Error saving changes: " + error.message); return; }
    setMats(prev => prev.map(m => m.id === updated.id ? updated : m));
    if (selectedMaterial?.id === updated.id) setSelectedMaterial(updated);
  };

  const handleGradeUpdate = (entry) => {
    setGradeEntries(prev => {
      const exists = prev.findIndex(g => g.studentId === entry.studentId && g.materialId === entry.materialId);
      if (exists >= 0) { const n = [...prev]; n[exists] = entry; return n; }
      return [...prev, entry];
    });
  };

  // ── Course grid columns ──────────────────────────────────────────────────────
  const cols = [
    { field: "code",      header: "Code",     width: 80 },
    { field: "name",      header: "Course Name" },
    { field: "schedule",  header: "Schedule", width: 155 },
    { field: "units",     header: "Units",    width: 55 },
    { field: "yearLevel", header: "Year",     width: 90 },
    { field: "semester",  header: "Semester", width: 110 },
    { field: "id", header: "Students", width: 75,
      cellRenderer: (_, row) => <Badge color="info">{enrollments.filter(e => e.courseId === row.id).length}</Badge> },
    { field: "status", header: "Status", width: 85,
      cellRenderer: v => (
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
          background: v === "Finished" ? "#fef3c7" : "#dcfce7",
          color:      v === "Finished" ? "#92400e" : "#166534" }}>
          {v === "Finished" ? "✅ Finished" : "🟢 Ongoing"}
        </span>
      )},
  ];

  // ── Default course list view ─────────────────────────────────────────────────
  const DefaultCourseView = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="My Courses" subtitle={`${myCourses.length} assigned course${myCourses.length !== 1 ? "s" : ""}`} />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Course grid */}
        <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a" }}>
          <LMSGrid columns={cols} rowData={myCourses}
            onRowClick={c => { setSel(c); setTab("materials"); }}
            selectedId={sel?.id} height="100%"
          />
        </div>

        {/* Course detail sidebar */}
        {sel && (
          <div style={{ width: 320, borderLeft: "1px solid #334155", background: "#1e293b", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
            {/* Sidebar header */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{sel.code}: {sel.name}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{sel.schedule}</div>
                {/* Status badge + toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
                    background: sel.status === "Finished" ? "#fef3c7" : "#dcfce7",
                    color:      sel.status === "Finished" ? "#92400e" : "#166634" }}>
                    {sel.status === "Finished" ? "✅ Finished" : "🟢 Ongoing"}
                  </span>
                  <button
                    onClick={() => toggleCourseStatus(sel)}
                    style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 9999, border: "1px solid #334155",
                      background: sel.status === "Finished" ? "#dcfce7" : "#fef3c7",
                      color:      sel.status === "Finished" ? "#166534" : "#92400e",
                      cursor: "pointer", fontFamily: "inherit" }}>
                    {sel.status === "Finished" ? "↩ Mark Ongoing" : "✓ Mark as Finished"}
                  </button>
                </div>
              </div>
              <button onClick={() => setSel(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#475569", fontSize: 18, marginLeft: 8 }}>×</button>
            </div>

            {/* Tab bar */}
            <div style={{ display: "flex", borderBottom: "1px solid #334155" }}>
              {["materials", "exams"].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ flex: 1, padding: "9px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: tab === t ? "#4f46e5" : "#94a3b8", borderBottom: `2px solid ${tab === t ? "#4f46e5" : "transparent"}`, textTransform: "capitalize" }}>
                  {t === "materials" ? "📄 Materials" : "📝 Exams"}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {toast && <Toast msg={toast} />}

              {/* ── Materials tab ── */}
              {tab === "materials" && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Add Material</div>
                  <Input value={matF.title} onChange={e => setMatF(f => ({ ...f, title: e.target.value }))} placeholder="Material title" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <Sel value={matF.type} onChange={e => setMatF(f => ({ ...f, type: e.target.value }))} style={{ flex: 1 }}>
                      {["Lecture", "Reading", "Lab", "Assignment"].map(t => <option key={t}>{t}</option>)}
                    </Sel>
                    <div style={{ flex: 1, position: "relative" }}>
                      <Sel value={matF.term} onChange={e => setMatF(f => ({ ...f, term: e.target.value }))}
                        style={{ width: "100%", borderColor: matF.term ? "#334155" : "#ef4444", color: matF.term ? "inherit" : "#94a3b8" }}>
                        <option value="" disabled>— Term (required) —</option>
                        {EXAM_TERMS.map(t => <option key={t}>{t}</option>)}
                      </Sel>
                      {!matF.term && <span style={{ position: "absolute", top: -6, right: 6, fontSize: 10, fontWeight: 800, color: "#ef4444", background: "#1e293b", padding: "0 3px" }}>required</span>}
                    </div>
                  </div>
                  <textarea value={matF.description} onChange={e => setMatF(f => ({ ...f, description: e.target.value }))}
                    className="edit-textarea" rows={2} placeholder="Description (optional)" style={{ resize: "none" }} />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
                      onChange={e => handleFileUpload(e.target.files?.[0])} />
                    <Btn variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>📎 Attach</Btn>
                    {matF.attachmentName && <span style={{ fontSize: 11, color: "#34d399", fontWeight: 600 }}>✓ {matF.attachmentName}</span>}
                  </div>
                  <Btn size="sm" onClick={addMat}>+ Add Material</Btn>

                  {/* Material list */}
                  <div style={{ borderTop: "1px solid #1e293b", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {mats.filter(m => m.courseId === sel.id).length === 0
                      ? <div style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: "10px 0" }}>No materials yet</div>
                      : mats.filter(m => m.courseId === sel.id).map(m => {
                          const meta = MAT_META[m.type] || MAT_META[MaterialType.LECTURE];
                          return (
                            <div key={m.id} className="mat-item"
                              onClick={() => setSelectedMaterial(m)}
                              style={{ padding: "9px 10px", background: "#0f172a", borderRadius: 6, border: "1px solid #334155", cursor: "pointer" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                                <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>{meta.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <TypeBadge type={m.type} />
                                    {m.term && (
                                      <span style={{ fontSize: 9, background: TERM_META[m.term]?.bg || "rgba(100,116,139,.2)", color: TERM_META[m.term]?.color || "#94a3b8", padding: "1px 5px", borderRadius: 9999, fontWeight: 700 }}>{m.term}</span>
                                    )}
                                    <span style={{ fontSize: 10, color: "#475569" }}>{m.date}</span>
                                    {isSubmittable(m.type) && (
                                      <span style={{ fontSize: 9, background: "rgba(99,102,241,.15)", color: "#6366f1", padding: "1px 5px", borderRadius: 9999, fontWeight: 700 }}>Gradable</span>
                                    )}
                                  </div>
                                </div>
                                <span style={{ color: "#cbd5e1", fontSize: 13, flexShrink: 0, marginTop: 2 }}>›</span>
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                </>
              )}

              {/* ── Exams tab ── */}
              {tab === "exams" && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Create Exam</div>
                  <Input value={exF.title} onChange={e => setExF(f => ({ ...f, title: e.target.value }))} placeholder="Exam title" />
                  <Input type="date" value={exF.date} onChange={e => setExF(f => ({ ...f, date: e.target.value }))} />
                  <Input value={exF.duration} onChange={e => setExF(f => ({ ...f, duration: e.target.value }))} placeholder="Duration (e.g. 2 hours)" />
                  <Input type="number" value={exF.totalPoints} onChange={e => setExF(f => ({ ...f, totalPoints: e.target.value }))} placeholder="Total points" />

                  {/* ★ Launch ExamBuilder */}
                  <Btn onClick={() => {
                    if (!exF.title.trim()) { showToast("Enter a title first."); return; }
                    setBuildingExam({ title: exF.title, date: exF.date, duration: exF.duration, questions: [] });
                    setExF({ title: "", date: "", duration: "", totalPoints: "100" });
                  }}>
                    <span style={{ fontSize: 15 }}>✦</span> + Create Exam &amp; Build Questions
                  </Btn>

                  <div style={{ borderTop: "1px solid #1e293b", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {exams.filter(e => e.courseId === sel.id).map(e => (
                      <div key={e.id} style={{ padding: "9px 11px", background: "#0f172a", borderRadius: 7, border: "1px solid #334155" }}>
                        <div style={{ fontWeight: 800, fontSize: 12, color: "#e2e8f0", marginBottom: 3 }}>{e.title}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>📅 {e.date} · {e.totalPoints} pts · {e.duration}</div>
                        {e.questions?.length > 0 && (
                          <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {Object.entries(
                              e.questions.reduce((acc, q) => ({ ...acc, [q.type]: (acc[q.type] || 0) + 1 }), {})
                            ).map(([type, count]) => {
                              const qm = QT_META[type];
                              return qm ? (
                                <span key={type} style={{ fontSize: 9, fontWeight: 800, color: qm.color, background: qm.bg, padding: "1px 6px", borderRadius: 9999 }}>{count} {type}</span>
                              ) : null;
                            })}
                            <span style={{ fontSize: 9, color: "#475569" }}>· {e.questions.length} question{e.questions.length !== 1 ? "s" : ""}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {exams.filter(e => e.courseId === sel.id).length === 0 && (
                      <div style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: "10px 0" }}>No exams yet</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Root ternary: ExamBuilder > MaterialDetail > DefaultCourseView ───────────
  if (buildingExam) {
    return (
      <ExamBuilder
        course={myCourses.find(c => c.id === sel?.id) || sel}
        initialExam={buildingExam}
        onBack={() => setBuildingExam(null)}
        onSave={async (savedExam) => {
          const courseUuid  = sel?._uuid;
          const teacherUuid = user._uuid;
          if (!courseUuid || !teacherUuid) {
            showToast("UUID missing — reload the page."); return;
          }

          const parseDuration = (s) => {
            if (!s) return 60;
            const h = s.match(/(\d+)\s*hour/i);
            const m = s.match(/(\d+)\s*min/i);
            return ((h ? parseInt(h[1]) : 0) * 60) + (m ? parseInt(m[1]) : 0) || 60;
          };

          const examPayload = {
            course_id:        courseUuid,
            created_by:       teacherUuid,
            title:            savedExam.title,
            exam_date:        savedExam.date,
            duration_minutes: parseDuration(savedExam.duration),
            total_points:     savedExam.totalPoints,
            instant_feedback: true,
            is_published:     true,
          };
          if (savedExam.term) examPayload.term = savedExam.term;

          const { data: newExam, error: examErr } = await supabase
            .from("exams").insert(examPayload).select().single();
          if (examErr) { showToast("Error saving exam: " + examErr.message); return; }

          if (savedExam.questions.length > 0) {
            const questionRows = savedExam.questions.map((q, i) => ({
              exam_id:        newExam.exam_id,
              question_type:  q.type,
              question_text:  q.questionText,
              options:        q.type === "MCQ" ? q.options : null,
              correct_answer: q.correctAnswer,
              points:         q.points,
              sort_order:     i,
            }));
            const { error: qErr } = await supabase.from("exam_questions").insert(questionRows);
            if (qErr) { showToast("Exam saved but questions failed: " + qErr.message); return; }
          }

          setExams(prev => [...prev, { ...savedExam, id: newExam.exam_id, courseId: sel.id }]);
          setBuildingExam(null);
          showToast(`"${savedExam.title}" saved with ${savedExam.questions.length} question${savedExam.questions.length !== 1 ? "s" : ""}!`);
        }}
      />
    );
  }

  return selectedMaterial
    ? <TeacherMaterialDetailView
        material={selectedMaterial}
        course={myCourses.find(c => c.id === selectedMaterial.courseId)}
        allUsers={allUsers}
        user={user}
        onBack={() => setSelectedMaterial(null)}
        onUpdate={handleMaterialUpdate}
        gradeEntries={gradeEntries}
        onGradeUpdate={handleGradeUpdate}
        enrollments={enrollments}
      />
    : DefaultCourseView;
}
