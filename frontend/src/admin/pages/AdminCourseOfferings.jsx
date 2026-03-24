/**
 * AdminCourseSections.jsx
 * FOLDER: src/admin/pages/AdminCourseSections.jsx
 *
 * Replaces AdminCourseOfferings.jsx
 *
 * Manages course SECTIONS — each section is one teacher + one schedule
 * for a course within a school year + term.
 * Multiple sections per course are fully supported (Section A, B, C…).
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { Badge, Btn, FF, Input, Sel, Toast } from "../../components/ui";
import TopBar from "../../components/TopBar";

const TERMS       = ["Prelim", "Midterm", "Semi-Final", "Finals"];
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
const SEMESTERS   = ["1st Semester", "2nd Semester", "Summer"];

const TERM_COLOR = {
  Prelim:        { bg: "rgba(99,102,241,.15)",  text: "#a5b4fc" },
  Midterm:       { bg: "rgba(59,130,246,.15)",  text: "#60a5fa" },
  "Semi-Final":  { bg: "rgba(245,158,11,.15)",  text: "#fbbf24" },
  Finals:        { bg: "rgba(239,68,68,.15)",   text: "#f87171" },
};

const emptySection = {
  courseId: "", syId: "", term: "Prelim",
  sectionCode: "A", teacherName: "", schedule: "", room: "", maxStudents: 40,
};

const emptyMapping = {
  courseId: "", programId: "", yearLevel: "", semester: "",
};

export default function AdminCourseSections() {
  // ── Reference data ───────────────────────────────────────────────────────
  const [schoolYears, setSchoolYears] = useState([]);
  const [programs,    setPrograms]    = useState([]);
  const [courses,     setCourses]     = useState([]);

  // ── Sections tab ─────────────────────────────────────────────────────────
  const [sections,    setSections]   = useState([]);
  const [filterSy,    setFilterSy]   = useState("");
  const [filterTerm,  setFilterTerm] = useState("");
  const [filterCourse,setFilterCourse] = useState("");
  const [sectionForm, setSectionForm] = useState(emptySection);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editingSection, setEditingSection] = useState(null); // section_id or null

  // ── Program map tab ───────────────────────────────────────────────────────
  const [activeTab,   setActiveTab]  = useState("sections"); // "sections" | "mappings"
  const [mappings,    setMappings]   = useState([]);
  const [mappingForm, setMappingForm] = useState(emptyMapping);
  const [showMappingForm, setShowMappingForm] = useState(false);
  const [mapFilter,   setMapFilter]  = useState({ courseId: "", programId: "" });

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState({ msg: "", err: false });

  const showOk  = (m) => { setToast({ msg: m, err: false });  setTimeout(() => setToast({ msg: "", err: false }), 3500); };
  const showErr = (m) => { setToast({ msg: m, err: true });   setTimeout(() => setToast({ msg: "", err: false }), 4500); };

  // ── Load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [syRes, progRes, courseRes] = await Promise.all([
        supabase.from("school_years").select("sy_id, label, is_active").order("created_at", { ascending: false }),
        supabase.from("program").select("program_id, name, code").eq("is_deleted", false).eq("is_active", true).order("name"),
        supabase.from("courses").select("course_id, course_code, course_name, units").eq("is_active", true).order("course_code"),
      ]);
      const sys = syRes.data || [];
      setSchoolYears(sys);
      setPrograms(progRes.data || []);
      setCourses(courseRes.data || []);
      const active = sys.find(s => s.is_active);
      if (active) {
        setFilterSy(active.sy_id);
        setSectionForm(p => ({ ...p, syId: active.sy_id }));
      }
    }
    load();
  }, []);

  // ── Load sections ─────────────────────────────────────────────────────────
  const loadSections = useCallback(async () => {
    if (!filterSy) return;
    setLoading(true);
    let q = supabase
      .from("v_course_sections")
      .select("*")
      .eq("sy_id", filterSy)
      .eq("is_active", true);
    if (filterTerm)   q = q.eq("term", filterTerm);
    if (filterCourse) q = q.eq("course_id", filterCourse);
    const { data, error } = await q.order("course_code").order("section_code");
    if (!error) setSections(data || []);
    setLoading(false);
  }, [filterSy, filterTerm, filterCourse]);

  useEffect(() => { loadSections(); }, [loadSections]);

  // ── Load program mappings ─────────────────────────────────────────────────
  const loadMappings = useCallback(async () => {
    let q = supabase
      .from("course_program_map")
      .select("id, course_id, program_id, year_level, semester, courses(course_code, course_name), program(name, code)");
    if (mapFilter.courseId)  q = q.eq("course_id", mapFilter.courseId);
    if (mapFilter.programId) q = q.eq("program_id", mapFilter.programId);
    const { data, error } = await q.order("id", { ascending: false });
    if (!error) setMappings(data || []);
  }, [mapFilter]);

  useEffect(() => { if (activeTab === "mappings") loadMappings(); }, [loadMappings, activeTab]);

  // ── Section: next available section code ─────────────────────────────────
  const nextSectionCode = (courseId, syId, term) => {
    const existing = sections.filter(
      s => s.course_id === courseId && s.sy_id === syId && s.term === term
    );
    const used = new Set(existing.map(s => s.section_code));
    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      if (!used.has(letter)) return letter;
    }
    return "";
  };

  // ── Section: save (create or update) ─────────────────────────────────────
  const handleSaveSection = async () => {
    const { courseId, syId, term, sectionCode, teacherName, schedule, room, maxStudents } = sectionForm;
    if (!courseId || !syId || !term || !sectionCode) {
      showErr("Course, School Year, Term and Section Code are required."); return;
    }
    setSaving(true);
    const payload = {
      course_id:    courseId,
      sy_id:        Number(syId),
      term,
      section_code: sectionCode.toUpperCase(),
      teacher_name: teacherName || null,
      schedule:     schedule || null,
      room:         room || null,
      max_students: Number(maxStudents) || 40,
    };

    let error;
    if (editingSection) {
      ({ error } = await supabase.from("course_sections").update(payload).eq("section_id", editingSection));
    } else {
      ({ error } = await supabase.from("course_sections").insert(payload));
    }
    setSaving(false);
    if (error) { showErr(error.message); return; }

    setSectionForm({ ...emptySection, syId: filterSy });
    setShowSectionForm(false);
    setEditingSection(null);
    await loadSections();
    showOk(editingSection ? "Section updated." : "Section created.");
  };

  const handleEditSection = (s) => {
    setSectionForm({
      courseId:    s.course_id,
      syId:        String(s.sy_id),
      term:        s.term,
      sectionCode: s.section_code,
      teacherName: s.teacher_name || "",
      schedule:    s.schedule || "",
      room:        s.room || "",
      maxStudents: s.max_students,
    });
    setEditingSection(s.section_id);
    setShowSectionForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteSection = async (sectionId) => {
    if (!confirm("Remove this section? Students currently enrolled will be unaffected but no new assignments can be made.")) return;
    await supabase.from("course_sections").update({ is_active: false }).eq("section_id", sectionId);
    await loadSections();
    showOk("Section removed.");
  };

  // ── Program mapping: save ─────────────────────────────────────────────────
  const handleSaveMapping = async () => {
    const { courseId, programId, yearLevel, semester } = mappingForm;
    if (!courseId || !programId || !yearLevel || !semester) {
      showErr("All mapping fields are required."); return;
    }
    setSaving(true);
    const { error } = await supabase.from("course_program_map").insert({
      course_id:  courseId,
      program_id: Number(programId),
      year_level: yearLevel,
      semester,
    });
    setSaving(false);
    if (error) {
      showErr(error.code === "23505" ? "This mapping already exists." : error.message);
      return;
    }
    setMappingForm(emptyMapping);
    setShowMappingForm(false);
    await loadMappings();
    showOk("Mapping added.");
  };

  const handleDeleteMapping = async (id) => {
    if (!confirm("Remove this program mapping?")) return;
    await supabase.from("course_program_map").delete().eq("id", id);
    await loadMappings();
    showOk("Mapping removed.");
  };

  // ── Group sections by course for display ──────────────────────────────────
  const sectionsByCourse = sections.reduce((acc, s) => {
    const key = s.course_id;
    if (!acc[key]) acc[key] = { course_code: s.course_code, course_name: s.course_name, units: s.units, sections: [] };
    acc[key].sections.push(s);
    return acc;
  }, {});

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar title="Course Sections & Program Maps" icon="📅"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant={activeTab === "sections" ? "primary" : "ghost"} onClick={() => setActiveTab("sections")}>Sections</Btn>
            <Btn variant={activeTab === "mappings" ? "primary" : "ghost"} onClick={() => setActiveTab("mappings")}>Program Maps</Btn>
          </div>
        }
      />

      {/* Toast */}
      {toast.msg && (
        <div style={{ padding: "10px 20px 0" }}>
          <div style={{
            background: toast.err ? "rgba(239,68,68,.12)" : "rgba(16,185,129,.12)",
            border: `1px solid ${toast.err ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`,
            borderRadius: 8, padding: "9px 14px",
            color: toast.err ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600,
          }}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TAB: SECTIONS
      ════════════════════════════════════════════════════════ */}
      {activeTab === "sections" && (
        <>
          {/* Add/Edit section form */}
          <div style={{ padding: "10px 20px 0", display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={() => {
              if (showSectionForm && editingSection) { setEditingSection(null); setSectionForm({ ...emptySection, syId: filterSy }); }
              setShowSectionForm(v => !v);
            }}>
              {showSectionForm ? "Cancel" : "+ Add Section"}
            </Btn>
          </div>

          {showSectionForm && (
            <div style={{ padding: "14px 20px", background: "#1e293b", borderBottom: "1px solid #334155" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9", marginBottom: 12 }}>
                {editingSection ? "Edit Section" : "New Section"}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <FF label="Course *" style={{ flex: "0 0 200px" }}>
                  <Sel value={sectionForm.courseId} onChange={e => {
                    const cid = e.target.value;
                    const code = nextSectionCode(cid, sectionForm.syId, sectionForm.term);
                    setSectionForm(p => ({ ...p, courseId: cid, sectionCode: code }));
                  }}>
                    <option value="">Select course…</option>
                    {courses.map(c => (
                      <option key={c.course_id} value={c.course_id}>{c.course_code} — {c.course_name}</option>
                    ))}
                  </Sel>
                </FF>
                <FF label="School Year *" style={{ flex: "0 0 150px" }}>
                  <Sel value={sectionForm.syId} onChange={e => setSectionForm(p => ({ ...p, syId: e.target.value }))}>
                    <option value="">Select SY…</option>
                    {schoolYears.map(s => (
                      <option key={s.sy_id} value={s.sy_id}>{s.label}{s.is_active ? " ★" : ""}</option>
                    ))}
                  </Sel>
                </FF>
                <FF label="Term *" style={{ flex: "0 0 130px" }}>
                  <Sel value={sectionForm.term} onChange={e => {
                    const term = e.target.value;
                    const code = nextSectionCode(sectionForm.courseId, sectionForm.syId, term);
                    setSectionForm(p => ({ ...p, term, sectionCode: code }));
                  }}>
                    {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </Sel>
                </FF>
                <FF label="Section Code *" style={{ flex: "0 0 100px" }}>
                  <Input value={sectionForm.sectionCode} maxLength={4}
                    onChange={e => setSectionForm(p => ({ ...p, sectionCode: e.target.value.toUpperCase() }))}
                    placeholder="A" />
                </FF>
                <FF label="Teacher" style={{ flex: "0 0 180px" }}>
                  <Input value={sectionForm.teacherName} placeholder="Prof. Juan dela Cruz"
                    onChange={e => setSectionForm(p => ({ ...p, teacherName: e.target.value }))} />
                </FF>
                <FF label="Schedule" style={{ flex: "0 0 170px" }}>
                  <Input value={sectionForm.schedule} placeholder="MWF 8:00–9:00AM"
                    onChange={e => setSectionForm(p => ({ ...p, schedule: e.target.value }))} />
                </FF>
                <FF label="Room" style={{ flex: "0 0 110px" }}>
                  <Input value={sectionForm.room} placeholder="CB305"
                    onChange={e => setSectionForm(p => ({ ...p, room: e.target.value }))} />
                </FF>
                <FF label="Max Students" style={{ flex: "0 0 110px" }}>
                  <Input type="number" min={1} value={sectionForm.maxStudents}
                    onChange={e => setSectionForm(p => ({ ...p, maxStudents: e.target.value }))} />
                </FF>
                <Btn onClick={handleSaveSection} disabled={saving} variant="success">
                  {saving ? "Saving…" : editingSection ? "Update" : "Add Section"}
                </Btn>
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ padding: "10px 20px", borderBottom: "1px solid #1e293b", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Sel value={filterSy} onChange={e => setFilterSy(e.target.value)} style={{ width: 180 }}>
              <option value="">All School Years</option>
              {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}{s.is_active ? " ★" : ""}</option>)}
            </Sel>
            <Sel value={filterTerm} onChange={e => setFilterTerm(e.target.value)} style={{ width: 140 }}>
              <option value="">All Terms</option>
              {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </Sel>
            <Sel value={filterCourse} onChange={e => setFilterCourse(e.target.value)} style={{ width: 200 }}>
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_code} — {c.course_name}</option>)}
            </Sel>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>
              {sections.length} section{sections.length !== 1 ? "s" : ""} across {Object.keys(sectionsByCourse).length} course{Object.keys(sectionsByCourse).length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Sections grouped by course */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {loading && <div style={{ color: "#475569", textAlign: "center", marginTop: 40 }}>Loading…</div>}
            {!loading && Object.keys(sectionsByCourse).length === 0 && (
              <div style={{ color: "#475569", textAlign: "center", marginTop: 60, fontSize: 14 }}>
                No sections found. Add one above.
              </div>
            )}

            {!loading && Object.entries(sectionsByCourse).map(([courseId, group]) => (
              <div key={courseId} style={{ marginBottom: 24 }}>
                {/* Course header */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #1e293b" }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>{group.course_code}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{group.course_name}</span>
                  <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>{group.units} units</span>
                  <Badge color="info">{group.sections.length} section{group.sections.length !== 1 ? "s" : ""}</Badge>
                </div>

                {/* Sections grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                  {group.sections.map(s => {
                    const pct = Math.round((s.enrolled_count / s.max_students) * 100);
                    const { bg, text: tcolor } = TERM_COLOR[s.term] || TERM_COLOR.Prelim;
                    const isFull = s.enrolled_count >= s.max_students;
                    return (
                      <div key={s.section_id} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px" }}>
                        {/* Section header row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 5, padding: "2px 8px", fontSize: 13, fontWeight: 800, color: "#f1f5f9" }}>
                              Section {s.section_code}
                            </span>
                            <span style={{ background: bg, color: tcolor, padding: "1px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{s.term}</span>
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => handleEditSection(s)}
                              style={{ background: "rgba(99,102,241,.15)", border: "none", color: "#a5b4fc", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>
                              Edit
                            </button>
                            <button onClick={() => handleDeleteSection(s.section_id)}
                              style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                          </div>
                        </div>

                        {/* Teacher & Schedule */}
                        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                          {s.teacher_name
                            ? <div>👤 {s.teacher_name}</div>
                            : <div style={{ color: "#475569", fontStyle: "italic" }}>No teacher assigned</div>}
                          {s.schedule && <div>🕐 {s.schedule}</div>}
                          {s.room    && <div>📍 {s.room}</div>}
                        </div>

                        {/* Enrollment bar */}
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginBottom: 3 }}>
                            <span>{s.enrolled_count} enrolled</span>
                            <span style={{ color: isFull ? "#f87171" : "#475569" }}>Max {s.max_students}</span>
                          </div>
                          <div style={{ height: 4, background: "#0f172a", borderRadius: 2 }}>
                            <div style={{
                              height: "100%", borderRadius: 2,
                              width: `${Math.min(pct, 100)}%`,
                              background: isFull ? "#f87171" : pct > 80 ? "#fbbf24" : "#34d399",
                            }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          TAB: PROGRAM MAPS
          Controls which course belongs to which program / year / semester.
          NSTP can map to BSCS 1st Year 1st Sem AND BSBA 1st Year 1st Sem, etc.
      ════════════════════════════════════════════════════════ */}
      {activeTab === "mappings" && (
        <>
          <div style={{ padding: "10px 20px 0", display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={() => setShowMappingForm(v => !v)}>
              {showMappingForm ? "Cancel" : "+ Add Mapping"}
            </Btn>
          </div>

          {showMappingForm && (
            <div style={{ padding: "14px 20px", background: "#1e293b", borderBottom: "1px solid #334155" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9", marginBottom: 10 }}>
                New Course → Program Mapping
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                Use this to assign a shared course (e.g. NSTP, PE) to multiple programs.
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <FF label="Course *" style={{ flex: "0 0 220px" }}>
                  <Sel value={mappingForm.courseId} onChange={e => setMappingForm(p => ({ ...p, courseId: e.target.value }))}>
                    <option value="">Select course…</option>
                    {courses.map(c => (
                      <option key={c.course_id} value={c.course_id}>{c.course_code} — {c.course_name}</option>
                    ))}
                  </Sel>
                </FF>
                <FF label="Program *" style={{ flex: "0 0 220px" }}>
                  <Sel value={mappingForm.programId} onChange={e => setMappingForm(p => ({ ...p, programId: e.target.value }))}>
                    <option value="">Select program…</option>
                    {programs.map(p => (
                      <option key={p.program_id} value={p.program_id}>{p.code} — {p.name}</option>
                    ))}
                  </Sel>
                </FF>
                <FF label="Year Level *" style={{ flex: "0 0 140px" }}>
                  <Sel value={mappingForm.yearLevel} onChange={e => setMappingForm(p => ({ ...p, yearLevel: e.target.value }))}>
                    <option value="">Select year…</option>
                    {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                  </Sel>
                </FF>
                <FF label="Semester *" style={{ flex: "0 0 150px" }}>
                  <Sel value={mappingForm.semester} onChange={e => setMappingForm(p => ({ ...p, semester: e.target.value }))}>
                    <option value="">Select semester…</option>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </Sel>
                </FF>
                <Btn onClick={handleSaveMapping} disabled={saving} variant="success">
                  {saving ? "Saving…" : "Add Mapping"}
                </Btn>
              </div>
            </div>
          )}

          {/* Mapping filters */}
          <div style={{ padding: "10px 20px", borderBottom: "1px solid #1e293b", display: "flex", gap: 12, alignItems: "center" }}>
            <Sel value={mapFilter.courseId} onChange={e => setMapFilter(p => ({ ...p, courseId: e.target.value }))} style={{ width: 220 }}>
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_code}</option>)}
            </Sel>
            <Sel value={mapFilter.programId} onChange={e => setMapFilter(p => ({ ...p, programId: e.target.value }))} style={{ width: 220 }}>
              <option value="">All Programs</option>
              {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.code} — {p.name}</option>)}
            </Sel>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>{mappings.length} mapping{mappings.length !== 1 ? "s" : ""}</div>
          </div>

          {/* Mappings list */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {mappings.length === 0 && (
              <div style={{ color: "#475569", textAlign: "center", marginTop: 60, fontSize: 14 }}>
                No mappings yet. Add one above to assign a course to a program.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 860 }}>
              {mappings.map(m => (
                <div key={m.id} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ minWidth: 80, fontWeight: 800, fontSize: 13, color: "#f1f5f9" }}>
                    {m.courses?.course_code}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>
                    {m.courses?.course_name}
                  </div>
                  <span style={{ background: "rgba(99,102,241,.12)", color: "#a5b4fc", padding: "2px 9px", borderRadius: 4, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {m.program?.code} — {m.program?.name}
                  </span>
                  <span style={{ background: "rgba(16,185,129,.1)", color: "#34d399", padding: "2px 9px", borderRadius: 4, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {m.year_level}
                  </span>
                  <span style={{ background: "rgba(59,130,246,.1)", color: "#60a5fa", padding: "2px 9px", borderRadius: 4, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {m.semester}
                  </span>
                  <button onClick={() => handleDeleteMapping(m.id)}
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, marginLeft: "auto" }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
