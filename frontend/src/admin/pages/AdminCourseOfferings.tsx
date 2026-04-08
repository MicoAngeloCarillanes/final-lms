/**
 * AdminCourseSections
 *
 * Manages course sections and program mappings. Allows administrators to create
 * class sections with specific capacities, schedules, and teacher assignments.
 *
 * @example
 * <AdminCourseSections />
 */
import { useCallback, useEffect, useState } from 'react';
import TopBar from '../../components/TopBar';
import { Badge, Btn, FF, Input, Sel } from '../../components/ui';
import { supabase } from '../../supabaseClient';

interface SectionFormState {
  // The selected course ID.
  courseId: string;

  // The school year ID.
  syId: string;

  // The academic term (e.g., Prelim, Midterm).
  term: string;

  // The section identifier (e.g., A, B, C).
  sectionCode: string;

  // The assigned teacher's name.
  teacherName: string;

  // The chronological schedule string.
  schedule: string;

  // The room assignment.
  room: string;

  // The maximum number of students allowed to enroll.
  maxCapacity: number;
}

interface MappingFormState {
  // The ID of the course being mapped.
  courseId: string;

  // The ID of the target program.
  programId: string;

  // The applicable year level.
  yearLevel: string;

  // The applicable semester.
  semester: string;
}

const TERMS = ["Prelim", "Midterm", "Semi-Final", "Finals"]; // Academic terms.
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"]; // Year levels.
const SEMESTERS = ["1st Semester", "2nd Semester", "Summer"]; // Semesters.

const emptySection: SectionFormState = {
  courseId: "",
  syId: "",
  term: "Prelim",
  sectionCode: "A",
  teacherName: "",
  schedule: "",
  room: "",
  maxCapacity: 30,
}; // Default section form state.

const emptyMapping: MappingFormState = {
  courseId: "",
  programId: "",
  yearLevel: "",
  semester: "",
}; // Default mapping form state.

export default function AdminCourseSections() {
  const [schoolYears, setSchoolYears] = useState<any[]>([]); // School years list.
  const [programs, setPrograms] = useState<any[]>([]); // Programs list.
  const [courses, setCourses] = useState<any[]>([]); // Courses list.
  const [sections, setSections] = useState<any[]>([]); // Sections list.
  const [mappings, setMappings] = useState<any[]>([]); // Program mappings list.
  const [filterSy, setFilterSy] = useState<string>(""); // School year filter.
  const [filterTerm, setFilterTerm] = useState<string>(""); // Term filter.
  const [filterCourse, setFilterCourse] = useState<string>(""); // Course filter.
  const [mapFilter, setMapFilter] = useState({ courseId: "", programId: "" }); // Mapping filters.
  const [sectionForm, setSectionForm] = useState<SectionFormState>(emptySection); // Section form data.
  const [mappingForm, setMappingForm] = useState<MappingFormState>(emptyMapping); // Mapping form data.
  const [activeTab, setActiveTab] = useState<"sections" | "mappings">("sections"); // Current active UI tab.
  const [showSectionForm, setShowSectionForm] = useState<boolean>(false); // Section form visibility.
  const [showMappingForm, setShowMappingForm] = useState<boolean>(false); // Mapping form visibility.
  const [editingSection, setEditingSection] = useState<string | null>(null); // ID of section being edited.
  const [loading, setLoading] = useState<boolean>(false); // Data loading state.
  const [saving, setSaving] = useState<boolean>(false); // Form saving state.
  const [toast, setToast] = useState({ msg: "", err: false }); // Toast notification state.

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadSections();
  }, [filterSy, filterTerm, filterCourse]);

  useEffect(() => {
    if (activeTab === "mappings") {
      loadMappings();
    }
  }, [mapFilter, activeTab]);

  /**
   * Loads initial reference data including school years, programs, and courses.
   *
   * @returns
   */
  async function loadReferenceData() {
    const [syRes, progRes, courseRes] = await Promise.all([
      supabase.from("school_years").select("sy_id, label, is_active").order("created_at", { ascending: false }),
      supabase.from("program").select("program_id, name, code").eq("is_deleted", false).eq("is_active", true).order("name"),
      supabase.from("courses").select("course_id, course_code, course_name, units").eq("is_active", true).order("course_code"),
    ]);

    const sys = syRes.data || [];
    setSchoolYears(sys);
    setPrograms(progRes.data || []);
    setCourses(courseRes.data || []);

    const active = sys.find((s) => s.is_active);
    if (active) {
      setFilterSy(active.sy_id);
      setSectionForm((p) => ({ ...p, syId: active.sy_id }));
    }
  }

  /**
   * Loads sections based on current active filters.
   *
   * @returns
   */
  const loadSections = useCallback(async () => {
    if (!filterSy) return;
    setLoading(true);

    let q = supabase
      .from("course_sections")
      .select("*")
      .eq("sy_id", filterSy)
      .eq("is_active", true);

    if (filterTerm) q = q.eq("term", filterTerm);
    if (filterCourse) q = q.eq("course_id", filterCourse);

    const { data, error } = await q.order("course_code").order("section_code");
    if (!error) setSections(data || []);
    
    setLoading(false);
  }, [filterSy, filterTerm, filterCourse]);

  /**
   * Loads program mappings based on mapping filters.
   *
   * @returns
   */
  const loadMappings = useCallback(async () => {
    let q = supabase
      .from("course_program_map")
      .select("id, course_id, program_id, year_level, semester, courses(course_code, course_name), program(name, code)");

    if (mapFilter.courseId) q = q.eq("course_id", mapFilter.courseId);
    if (mapFilter.programId) q = q.eq("program_id", mapFilter.programId);

    const { data, error } = await q.order("id", { ascending: false });
    if (!error) setMappings(data || []);
  }, [mapFilter]);

  /**
   * Determines the next sequential alphabetical section code.
   *
   * @param courseId The target course ID.
   * @param syId The target school year ID.
   * @param term The target academic term.
   * @returns
   */
  function getNextSectionCode(courseId: string, syId: string, term: string): string {
    const existing = sections.filter(
      (s) => s.course_id === courseId && String(s.sy_id) === syId && s.term === term
    );
    const used = new Set(existing.map((s) => s.section_code));

    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      if (!used.has(letter)) return letter;
    }
    return "";
  }

  /**
   * Submits the section form to create or update a course section.
   *
   * @returns
   */
  async function handleSaveSection() {
    const { courseId, syId, term, sectionCode, teacherName, schedule, room, maxCapacity } = sectionForm;

    if (!courseId || !syId || !term || !sectionCode) {
      showError("Course, School Year, Term, and Section Code are required.");
      return;
    }

    setSaving(true);

    const payload = {
      course_id: courseId,
      sy_id: Number(syId),
      term,
      section_code: sectionCode.toUpperCase(),
      teacher_name: teacherName || null,
      schedule: schedule || null,
      room: room || null,
      max_capacity: Number(maxCapacity) || 30,
    };

    let error;

    if (editingSection) {
      const result = await supabase.from("course_sections").update(payload).eq("section_id", editingSection);
      error = result.error;
    } else {
      const result = await supabase.from("course_sections").insert(payload);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      showError(error.message);
      return;
    }

    setSectionForm({ ...emptySection, syId: filterSy });
    setShowSectionForm(false);
    setEditingSection(null);
    await loadSections();
    showSuccess(editingSection ? "Section updated." : "Section created.");
  }

  /**
   * Populates the form to edit an existing section.
   *
   * @param s The section data object.
   * @returns
   */
  function handleEditSection(s: any) {
    setSectionForm({
      courseId: s.course_id,
      syId: String(s.sy_id),
      term: s.term,
      sectionCode: s.section_code,
      teacherName: s.teacher_name || "",
      schedule: s.schedule || "",
      room: s.room || "",
      maxCapacity: s.max_capacity || 30,
    });
    setEditingSection(s.section_id);
    setShowSectionForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /**
   * Soft deletes a section by setting its active status to false.
   *
   * @param sectionId The UUID of the section to remove.
   * @returns
   */
  async function handleDeleteSection(sectionId: string) {
    if (!confirm("Remove this section? Students currently enrolled will be unaffected but no new assignments can be made.")) return;
    await supabase.from("course_sections").update({ is_active: false }).eq("section_id", sectionId);
    await loadSections();
    showSuccess("Section removed.");
  }

  /**
   * Submits the mapping form to link a course to a program.
   *
   * @returns
   */
  async function handleSaveMapping() {
    const { courseId, programId, yearLevel, semester } = mappingForm;

    if (!courseId || !programId || !yearLevel || !semester) {
      showError("All mapping fields are required.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("course_program_map").insert({
      course_id: courseId,
      program_id: Number(programId),
      year_level: yearLevel,
      semester,
    });

    setSaving(false);

    if (error) {
      showError(error.code === "23505" ? "This mapping already exists." : error.message);
      return;
    }

    setMappingForm(emptyMapping);
    setShowMappingForm(false);
    await loadMappings();
    showSuccess("Mapping added.");
  }

  /**
   * Deletes a program mapping.
   *
   * @param id The mapping ID to delete.
   * @returns
   */
  async function handleDeleteMapping(id: number) {
    if (!confirm("Remove this program mapping?")) return;
    await supabase.from("course_program_map").delete().eq("id", id);
    await loadMappings();
    showSuccess("Mapping removed.");
  }

  /**
   * Displays a temporary success toast notification.
   *
   * @param msg The message to display.
   * @returns
   */
  function showSuccess(msg: string) {
    setToast({ msg, err: false });
    setTimeout(() => setToast({ msg: "", err: false }), 3500);
  }

  /**
   * Displays a temporary error toast notification.
   *
   * @param msg The error message to display.
   * @returns
   */
  function showError(msg: string) {
    setToast({ msg, err: true });
    setTimeout(() => setToast({ msg: "", err: false }), 4500);
  }

  const sectionsByCourse = sections.reduce((acc: any, s: any) => {
    const key = s.course_id;
    if (!acc[key]) {
      acc[key] = { course_code: s.course_code, course_name: s.course_name, units: s.units, sections: [] };
    }
    acc[key].sections.push(s);
    return acc;
  }, {}); // Groups flattened section views into hierarchical course lists.

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

      {activeTab === "sections" && (
        <>
          <div style={{ padding: "10px 20px 0", display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={() => {
              if (showSectionForm && editingSection) { 
                setEditingSection(null); 
                setSectionForm({ ...emptySection, syId: filterSy }); 
              }
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
                    const code = getNextSectionCode(cid, sectionForm.syId, sectionForm.term);
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
                    const code = getNextSectionCode(sectionForm.courseId, sectionForm.syId, term);
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
                <FF label="Max Capacity" style={{ flex: "0 0 110px" }}>
                  <Input type="number" min={1} value={sectionForm.maxCapacity}
                    onChange={e => setSectionForm(p => ({ ...p, maxCapacity: Number(e.target.value) }))} />
                </FF>
                <Btn onClick={handleSaveSection} disabled={saving} variant="success">
                  {saving ? "Saving…" : editingSection ? "Update" : "Add Section"}
                </Btn>
              </div>
            </div>
          )}

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

          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {loading && <div style={{ color: "#475569", textAlign: "center", marginTop: 40 }}>Loading…</div>}
            {!loading && Object.keys(sectionsByCourse).length === 0 && (
              <div style={{ color: "#475569", textAlign: "center", marginTop: 60, fontSize: 14 }}>
                No sections found. Add one above.
              </div>
            )}

            {!loading && Object.entries(sectionsByCourse).map(([courseId, group]: any) => (
              <div key={courseId} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #1e293b" }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>{group.course_code}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{group.course_name}</span>
                  <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>{group.units} units</span>
                  <Badge color="info">{group.sections.length} section{group.sections.length !== 1 ? "s" : ""}</Badge>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                  {group.sections.map((s: any) => {
                    const capacityValue = s.max_capacity || 30;
                    const enrolledCount = s.enrolled_count || 0;
                    const pct = Math.round((enrolledCount / capacityValue) * 100);
                    const isFull = enrolledCount >= capacityValue;
                    
                    return (
                      <div key={s.section_id} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 5, padding: "2px 8px", fontSize: 13, fontWeight: 800, color: "#f1f5f9" }}>
                              Section {s.section_code}
                            </span>
                            <span style={{ background: "rgba(99,102,241,.15)", color: "#a5b4fc", padding: "1px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{s.term}</span>
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

                        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                          {s.teacher_name
                            ? <div>👤 {s.teacher_name}</div>
                            : <div style={{ color: "#475569", fontStyle: "italic" }}>No teacher assigned</div>}
                          {s.schedule && <div>🕐 {s.schedule}</div>}
                          {s.room && <div>📍 {s.room}</div>}
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginBottom: 3 }}>
                            <span>{enrolledCount} enrolled</span>
                            <span style={{ color: isFull ? "#f87171" : "#475569" }}>Max {capacityValue}</span>
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

          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {mappings.length === 0 && (
              <div style={{ color: "#475569", textAlign: "center", marginTop: 60, fontSize: 14 }}>
                No mappings yet. Add one above to assign a course to a program.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 860 }}>
              {mappings.map((m: any) => (
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