import React, { useEffect, useMemo, useRef, useState } from 'react';
import LMSGrid from '../../components/LMSGrid';
import TopBar from '../../components/TopBar';
import { Badge, Btn, FF, Input, Sel } from '../../components/ui';
import { useCourseStore } from '../../store/useCourseStore';
import { supabase } from '../../supabaseClient';

interface AdminCourseManagementProps {
  courses: any[];
  enrollments: any[];
  setCourses: (courses: any[]) => void;
  setEnrollments: (enrollments: any[]) => void;
  users: any[];
}

interface ToastState {
  msg: string;
  type: "success" | "warning" | "error";
}

interface SortState {
  field: string;
  dir: "asc" | "desc";
}

const SearchableSelect = ({ options, value, onChange, placeholder, emptyMessage, onAdd, disabled = false }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((o: any) => o.label.toLowerCase().includes(search.toLowerCase()));
  const selectedOption = options.find((o: any) => String(o.value) === String(value));
  const isEmpty = options.length === 0;

  return (
    <div style={{ alignItems: "center", display: "flex", gap: "8px", width: "100%" }}>
      <div ref={containerRef} style={{ flex: 1, position: "relative" }}>
        <div
          onClick={() => { if (!isEmpty && !disabled) setIsOpen(!isOpen); }}
          style={{
            alignItems: "center",
            background: disabled ? "#1e293b" : "#0f172a",
            border: "1px solid #334155",
            borderRadius: "6px",
            color: isEmpty || disabled ? "#64748b" : "#f1f5f9",
            cursor: isEmpty || disabled ? "not-allowed" : "pointer",
            display: "flex",
            fontSize: "13px",
            height: "38px",
            justifyContent: "space-between",
            padding: "8px 12px"
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isEmpty ? emptyMessage : (selectedOption ? selectedOption.label : placeholder)}
          </span>
          <span style={{ color: "#64748b", fontSize: "10px" }}>▼</span>
        </div>

        {isOpen && !isEmpty && !disabled && (
          <div style={{
            background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            display: "flex", flexDirection: "column", left: 0, maxHeight: "250px", marginTop: "4px", position: "absolute", right: 0, top: "100%", zIndex: 9999
          }}>
            <div style={{ borderBottom: "1px solid #334155", padding: "8px" }}>
              <input
                autoFocus
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Search..."
                style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "4px", color: "#f1f5f9", fontSize: "13px", outline: "none", padding: "6px 8px", width: "100%" }}
                value={search}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
              {filteredOptions.length > 0 ? filteredOptions.map((o: any) => (
                <div
                  key={o.value}
                  onClick={() => { onChange(o.value); setIsOpen(false); setSearch(""); }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#334155"}
                  onMouseLeave={(e) => e.currentTarget.style.background = String(value) === String(o.value) ? "#334155" : "transparent"}
                  style={{ background: String(value) === String(o.value) ? "#334155" : "transparent", color: "#e2e8f0", cursor: "pointer", fontSize: "13px", padding: "8px 12px" }}
                >
                  {o.label}
                </div>
              )) : (
                <div style={{ color: "#64748b", fontSize: "13px", padding: "8px 12px" }}>No matches found</div>
              )}
            </div>
          </div>
        )}
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          style={{ alignItems: "center", background: "#3b82f6", border: "none", borderRadius: "6px", color: "white", cursor: "pointer", display: "flex", flexShrink: 0, fontSize: "18px", fontWeight: "bold", height: "38px", justifyContent: "center", width: "38px" }}
          title="Add New"
          type="button"
        >
          +
        </button>
      )}
    </div>
  );
};

const SEMESTERS = ["1st Semester", "2nd Semester", "Summer"];
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

const DAYS_OF_WEEK = [
  { label: "M", value: "M" },
  { label: "T", value: "T" },
  { label: "W", value: "W" },
  { label: "Th", value: "Th" },
  { label: "F", value: "F" },
  { label: "S", value: "Sat" },
  { label: "Su", value: "Sun" }
];

const TIME_SLOTS = [
  "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", 
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", 
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", 
  "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"
];

const CSV_TEMPLATES = {
  courses: "Course Code,Course Name,Units,Lec Hours,Lab Hours,Prerequisite Codes (comma separated)\nCS101LEC,Intro to Computing (Lec),2,\nCS101LAB,Intro to Computing (Lab),1,CS101LEC",
  sections: "Course Code,Section Label,Semester,Year Level,Program Code,Room Name,Schedule Label,Max Capacity,Teacher Display ID\nCS101LEC,A,1st Semester,1st Year,BSCS,Rm 201,MWF 7:30 AM - 8:30 AM,40,TCH001",
  mappings: "Course Code,Program Code,Year Level,Semester\nCS101LEC,BSCS,1st Year,1st Semester",
  rooms: "Room Name,Capacity\nRm 201,40\nLab 1,30",
  students_to_section: "Student ID\nSTU23-00001\nSTU23-00002",
  global_enrollment: "Student ID,Course Code,Section Label\nSTU23-00001,CS101LEC,A\nSTU23-00001,CS101LAB,A"
};

export default function AdminCourseManagement({
  courses: globalCourses,
  enrollments,
  setCourses: setGlobalCourses,
  setEnrollments,
  users,
}: AdminCourseManagementProps) {
  const { enrollStudent, isLoading, updateCompletionStatus } = useCourseStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentCsvRef = useRef<HTMLInputElement>(null);

  const [mainTab, setMainTab] = useState<"catalog" | "offerings" | "mappings" | "curriculum">("catalog");

  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [globalPrereqs, setGlobalPrereqs] = useState<Record<string, string[]>>({});

  const [codeGroups, setCodeGroups] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [level, setLevel] = useState<"codes" | "course" | "section">("codes");
  const [sectionEnrollments, setSectionEnrollments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [selCode, setSelCode] = useState<string | null>(null);
  const [selCourse, setSelCourse] = useState<any | null>(null);
  const [selSection, setSelSection] = useState<any | null>(null);

  const [offeringCount, setOfferingCount] = useState(0);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [offFilterCourse, setOffFilterCourse] = useState("");
  const [offFilterSy, setOffFilterSy] = useState("");
  const [offFilterSemester, setOffFilterSemester] = useState("1st Semester");
  const [offPage, setOffPage] = useState(0);
  const offPageSize = 20;

  const [mapFilterCourse, setMapFilterCourse] = useState("");
  const [mapFilterProg, setMapFilterProg] = useState("");
  const [mapFilterYear, setMapFilterYear] = useState("");
  const [mapFilterSemester, setMapFilterSemester] = useState("");
  const [mappings, setMappings] = useState<any[]>([]);

  const [selCurriculumProg, setSelCurriculumProg] = useState("");
  const [selCurriculumSy, setSelCurriculumSy] = useState("");

  const [selCodesForDelete, setSelCodesForDelete] = useState<string[]>([]);
  const [selCoursesForDelete, setSelCoursesForDelete] = useState<string[]>([]);
  const [selMappingsForDelete, setSelMappingsForDelete] = useState<number[]>([]);
  const [selSectionsForDelete, setSelSectionsForDelete] = useState<string[]>([]);
  const [selStudents, setSelStudents] = useState<string[]>([]);
  const [selEnrolledForDelete, setSelEnrolledForDelete] = useState<string[]>([]);
  const [forceEnroll, setForceEnroll] = useState(false);

  const [codeSearch, setCodeSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [sectionSearch, setSectionSearch] = useState("");
  const [offeringSearch, setOfferingSearch] = useState("");
  const [mappingSearch, setMappingSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [enrolledSearch, setEnrolledSearch] = useState("");
  const [enrolledFilter, setEnrolledFilter] = useState("");
  
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [importType, setImportType] = useState<"courses" | "sections" | "mappings" | "rooms" | "global_enrollments" | null>(null);

  const [codeSort, setCodeSort] = useState<SortState>({ field: "prefix", dir: "asc" });
  const [courseSort, setCourseSort] = useState<SortState>({ field: "course_code", dir: "asc" });
  const [sectionSort, setSectionSort] = useState<SortState>({ field: "section_label", dir: "asc" });
  const [offSort, setOffSort] = useState<SortState>({ field: "created_at", dir: "desc" });
  const [mapSort, setMapSort] = useState<SortState>({ field: "id", dir: "desc" });

  const [courseForm, setCourseForm] = useState<{code: string, name: string, units: number, types: string[], lecUnits: number, labUnits: number, prereqs: string[]}>({ code: "", name: "", units: 3, types: [], lecUnits: 2, labUnits: 1, prereqs: [] });
  const [mappingForm, setMappingForm] = useState({ courseId: "", programId: "", yearLevel: "1st Year", semester: "1st Semester" });
  const [newRoomForm, setNewRoomForm] = useState({ name: "", capacity: 40 });
  const [newSchedDays, setNewSchedDays] = useState<string[]>([]);
  const [newSchedStart, setNewSchedStart] = useState("");
  const [newSchedEnd, setNewSchedEnd] = useState("");
  
  const [sectionForm, setSectionForm] = useState({ courseId: "", maxCapacity: 30, roomId: "", scheduleLabel: "", sectionLabel: "A", syId: "", teacherId: "", semester: "1st Semester", isUnlimited: false, yearLevel: "1st Year", programId: "" });
  const [prereqFormCourseId, setPrereqFormCourseId] = useState("");
  const [prerequisites, setPrerequisites] = useState<any[]>([]);
  const [rolloverForm, setRolloverForm] = useState({ sourceSyId: "", sourceSemester: "1st Semester", targetSyId: "", targetSemester: "2nd Semester" });
  const [auditMaterials, setAuditMaterials] = useState<any[]>([]);
  const [teacherWorkload, setTeacherWorkload] = useState<number | null>(null);

  const [viewOfferingSection, setViewOfferingSection] = useState<any>(null);
  const [offeringEnrollments, setOfferingEnrollments] = useState<any[]>([]);

  const [showManualEnrollModal, setShowManualEnrollModal] = useState(false);
  const [manualEnrollStudentId, setManualEnrollStudentId] = useState<string>("");
  const [manualEnrollSections, setManualEnrollSections] = useState<string[]>([]);

  const [conflictModal, setConflictModal] = useState<{show: boolean, validIds: string[], conflicted: any[], forceIds: string[], courseId: string, sectionId: string}>({ show: false, validIds: [], conflicted: [], forceIds: [], courseId: "", sectionId: "" });
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const [loading, setLoading] = useState(false);
  const [newCodePrefix, setNewCodePrefix] = useState("");
  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false);
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [showCreateSectionModal, setShowCreateSectionModal] = useState(false);
  const [showEditCourseModal, setShowEditCourseModal] = useState(false);
  const [showEditSectionModal, setShowEditSectionModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showPrereqModal, setShowPrereqModal] = useState(false);
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showOfferingDetailsModal, setShowOfferingDetailsModal] = useState(false);
  const [toast, setToast] = useState<ToastState>({ msg: "", type: "success" });

  useEffect(() => {
    void loadReferences();
    void loadAllCourses();
    void loadStudentsAPI("");
  }, []);

  useEffect(() => {
    if (showRoomModal || showScheduleModal || showMappingModal) {
      void loadReferences();
    }
  }, [showRoomModal, showScheduleModal, showMappingModal]);

  useEffect(() => {
    if (mainTab === "catalog" && level === "codes") void loadCodesAPI();
  }, [codeSort]);

  useEffect(() => {
    if (mainTab === "catalog" && level === "course") void loadCoursesAPI();
  }, [courseSort, selCode]);

  useEffect(() => {
    if (mainTab === "catalog" && level === "section" && selCourse && offFilterSy && offFilterSemester) {
      void loadCatalogSectionsAPI();
    }
  }, [sectionSort, selCourse, offFilterSy, offFilterSemester]);

  useEffect(() => {
    if (mainTab === "offerings") void loadOfferingsAPI();
  }, [mainTab, offPage, offSort]);

  useEffect(() => {
    if (mainTab === "mappings" || mainTab === "curriculum") void loadMappingsAPI();
  }, [mainTab, mapSort, selCurriculumSy]);

  useEffect(() => {
    async function fetchNextCode() {
      if (!sectionForm.courseId || !sectionForm.syId || !sectionForm.semester || showEditSectionModal) return;
      const { data } = await supabase.from("course_sections").select("section_label")
        .eq("course_id", sectionForm.courseId)
        .eq("sy_id", sectionForm.syId)
        .eq("semester", sectionForm.semester);
      
      const used = new Set((data || []).map(s => s.section_label));
      let next = "A";
      for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        if (!used.has(letter)) { next = letter; break; }
      }
      setSectionForm(prev => ({ ...prev, sectionLabel: next }));
    }
    void fetchNextCode();
  }, [sectionForm.courseId, sectionForm.syId, sectionForm.semester, showEditSectionModal]);

  useEffect(() => {
    async function fetchWorkload() {
      if (!sectionForm.teacherId || !sectionForm.syId || !sectionForm.semester) {
        setTeacherWorkload(null);
        return;
      }
      const { data } = await supabase.from("course_sections")
        .select("courses!inner(units)")
        .eq("teacher_id", sectionForm.teacherId)
        .eq("sy_id", sectionForm.syId)
        .eq("semester", sectionForm.semester);
      
      const totalUnits = (data || []).reduce((acc: number, curr: any) => acc + (curr.courses?.units || 0), 0);
      setTeacherWorkload(totalUnits);
    }
    void fetchWorkload();
  }, [sectionForm.teacherId, sectionForm.syId, sectionForm.semester]);

  useEffect(() => {
    if (selSection && selSection.program_id && selSection.year_level) {
      const eligible = studentsList.filter(s => 
        s.programId === selSection.program_id && 
        s.yearLevel === selSection.year_level
      );
      const enrolledIds = new Set(sectionEnrollments.map(e => String(e.student_id)));
      const toSelect = eligible.filter(s => !enrolledIds.has(String(s._uuid))).map(s => s._uuid);
      setSelStudents(toSelect);
    } else {
      setSelStudents([]);
    }
  }, [selSection, studentsList, sectionEnrollments]);

  void globalCourses; void enrollments; void setGlobalCourses; void setEnrollments;

  function showToast(msg: string, type: "success" | "warning" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 5000);
  }

  function reqConfirm(title: string, message: string, action: () => void) {
    setConfirmDialog({ isOpen: true, title, message, onConfirm: action });
  }

  function codePrefix(courseCode: string): string {
    return (courseCode || "").match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || "OTHER";
  }

  async function loadStudentsAPI(query: string) {
    setLoading(true);
    let q = supabase.from("students").select(`student_id, program_id, year_level, users!inner(user_id, full_name, display_id, is_active)`);
    if (query) {
      q = q.or(`users.full_name.ilike.%${query}%,student_id.ilike.%${query}%,users.display_id.ilike.%${query}%`);
    }
    const { data, error } = await q;

    if (!error && data) {
      const formatted = data.map((d: any) => ({
        _uuid: d.users.user_id,
        displayId: d.student_id || d.users?.display_id || "",
        fullName: d.users?.full_name || "Unknown",
        isActive: d.users?.is_active,
        programId: d.program_id,
        yearLevel: d.year_level
      }));
      setStudentsList(formatted.filter(s => s.isActive));
    }
    setLoading(false);
  }

  async function loadReferences() {
    const [syRes, roomRes, progRes, schedRes] = await Promise.all([
      supabase.from("school_years").select("sy_id, label, is_active, is_locked").order("created_at", { ascending: false }),
      supabase.from("rooms").select("*").order("room_name"),
      supabase.from("program").select("program_id, name, code").eq("is_active", true),
      supabase.from("schedules").select("*").order("schedule_label")
    ]);

    const sys = syRes.data || [];
    setSchoolYears(sys);
    setRooms(roomRes.data || []);
    setPrograms(progRes.data || []);
    setSchedules(schedRes.data || []);

    const activeSy = sys.find((s) => s.is_active);
    if (activeSy) {
      if (!offFilterSy) setOffFilterSy(activeSy.sy_id);
      if (!selCurriculumSy) setSelCurriculumSy(activeSy.sy_id);
      setRolloverForm(prev => ({ ...prev, sourceSyId: activeSy.sy_id, targetSyId: activeSy.sy_id }));
    } else if (sys.length > 0) {
      if (!offFilterSy) setOffFilterSy(sys[0].sy_id);
      if (!selCurriculumSy) setSelCurriculumSy(sys[0].sy_id);
      setRolloverForm(prev => ({ ...prev, sourceSyId: sys[0].sy_id, targetSyId: sys[0].sy_id }));
    }
  }

  async function loadAllCourses() {
    const { data: rawCourses, error } = await supabase.from("courses").select("course_id, course_code, course_name, units, is_active").order("course_code", { ascending: true });
    const { data: preData } = await supabase.from("course_prerequisites").select("course_id, courses!prereq_course_id(course_code)");
    
    if (!error) {
      const normalized = (rawCourses || []).map((course) => ({
        _uuid: course.course_id, code: course.course_code, id: course.course_code,
        isActive: course.is_active, name: course.course_name, units: course.units
      }));
      setAllCourses(normalized);
    }
    
    const pMap: Record<string, string[]> = {};
    preData?.forEach((p: any) => {
       if (!pMap[p.course_id]) pMap[p.course_id] = [];
       if (p.courses?.course_code) pMap[p.course_id].push(p.courses.course_code);
    });
    setGlobalPrereqs(pMap);
  }

  async function loadCodesAPI() {
    setLoading(true);
    let q = supabase.from("courses").select("course_code");
    if (codeSearch) q = q.ilike("course_code", `${codeSearch}%`);
    const { data, error } = await q;

    if (!error && data) {
      const map: Record<string, number> = {};
      data.forEach((course) => {
        const prefix = codePrefix(course.course_code);
        map[prefix] = (map[prefix] || 0) + 1;
      });
      const grouped = Object.entries(map).map(([prefix, count]) => ({ id: prefix, prefix, count }));
      
      grouped.sort((a, b) => {
        if (codeSort.field === "count") {
           return codeSort.dir === "asc" ? a.count - b.count : b.count - a.count;
        }
        return codeSort.dir === "asc" ? a.prefix.localeCompare(b.prefix) : b.prefix.localeCompare(a.prefix);
      });
      setCodeGroups(grouped);
    }
    setLoading(false);
  }

  async function loadCoursesAPI() {
    if (!selCode) return;
    setLoading(true);
    let q = supabase.from("courses").select("course_id, course_code, course_name, units, is_active").ilike("course_code", `${selCode}%`);
    if (courseSearch) q = q.or(`course_name.ilike.%${courseSearch}%,course_code.ilike.%${courseSearch}%`);
    q = q.order(courseSort.field, { ascending: courseSort.dir === "asc" });
    
    const { data, error } = await q;
    if (!error && data) {
      const normalized = data.map((course) => ({
        _uuid: course.course_id, code: course.course_code, id: course.course_code,
        isActive: course.is_active, name: course.course_name, units: course.units
      }));
      setCourses(normalized);
    }
    setLoading(false);
  }

  async function loadCatalogSectionsAPI() {
    if (!selCourse) return;
    setLoading(true);
    setSelEnrolledForDelete([]);
    
    const isForeignSort = ["room_name", "program_code", "schedule_label"].includes(sectionSort.field);
    let q = supabase.from("course_sections").select(`*, rooms(room_name), program(code)`).eq("course_id", selCourse._uuid).eq("sy_id", offFilterSy).eq("semester", offFilterSemester);
    if (sectionSearch) q = q.ilike("section_label", `%${sectionSearch}%`);
    if (!isForeignSort) q = q.order(sectionSort.field, { ascending: sectionSort.dir === "asc" });

    const { data: sectData, error } = await q;
    if (!error) {
      let formattedSections = (sectData || []).map((sec: any) => ({ ...sec, room_name: sec.rooms?.room_name || "Unassigned", program_code: sec.program?.code || "All" }));
      
      if (isForeignSort) {
         formattedSections.sort((a, b) => {
            const valA = String(a[sectionSort.field] || "").toLowerCase();
            const valB = String(b[sectionSort.field] || "").toLowerCase();
            return sectionSort.dir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
         });
      }
      setSections(formattedSections);
      
      const sectionIds = formattedSections.map((section) => section.section_id);
      if (sectionIds.length > 0) {
        const { data: enrollmentsData } = await supabase.from("student_course_assignments")
          .select(`
            assignment_id, section_id, student_id, enrollment_status, final_grade, completion_status,
            students!inner(student_id, users!inner(full_name, display_id))
          `)
          .in("section_id", sectionIds);
          
        const enriched = (enrollmentsData || []).map((e: any) => ({
          ...e,
          studentDisplayId: e.students?.student_id || e.students?.users?.display_id || "Unknown ID",
          studentName: e.students?.users?.full_name || "Unknown Name"
        }));
        setSectionEnrollments(enriched);
      } else {
        setSectionEnrollments([]);
      }
    }
    setLoading(false);
  }

  async function loadOfferingsAPI() {
    setLoading(true);
    const from = offPage * offPageSize;
    const to = from + offPageSize - 1;

    const isForeignSort = ["program_code", "room_name", "course_code", "course_name"].includes(offSort.field);
    let q = supabase.from("course_sections")
      .select("*, courses!inner(course_code, course_name), rooms(room_name), program(code)", { count: "exact" });
    
    if (offFilterSy) q = q.eq("sy_id", offFilterSy);
    if (offFilterSemester) q = q.eq("semester", offFilterSemester);
    if (offFilterCourse) q = q.eq("course_id", offFilterCourse);
    if (offeringSearch) q = q.ilike("courses.course_code", `%${offeringSearch}%`);
    if (!isForeignSort) q = q.order(offSort.field, { ascending: offSort.dir === "asc" }).range(from, to);

    const { data, count, error } = await q;

    if (error) {
      showToast(error.message, "error");
    } else if (data && data.length > 0) {
      const sectionIds = data.map((s: any) => s.section_id);
      const { data: enData } = await supabase.from("student_course_assignments")
        .select("section_id, enrollment_status").in("section_id", sectionIds).eq("enrollment_status", "Enrolled");
      
      const counts: Record<string, number> = {};
      enData?.forEach((e: any) => counts[e.section_id] = (counts[e.section_id] || 0) + 1);

      let enriched = data.map((s: any) => ({
        ...s,
        course_code: s.courses?.course_code,
        course_name: s.courses?.course_name,
        enrolled_count: counts[s.section_id] || 0,
        room_name: s.rooms?.room_name || "Unassigned",
        program_code: s.program?.code || "All"
      }));

      if (isForeignSort) {
         enriched.sort((a, b) => {
            const valA = String(a[offSort.field] || "").toLowerCase();
            const valB = String(b[offSort.field] || "").toLowerCase();
            return offSort.dir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
         });
         if (enriched.length > offPageSize) {
           enriched = enriched.slice(from, to + 1);
         }
      }

      setOfferings(enriched);
      setOfferingCount(count || 0);
    } else {
      setOfferings([]);
      setOfferingCount(0);
    }
    setLoading(false);
  }

  async function loadMappingsAPI() {
    setLoading(true);
    const isForeignSort = ["course_code", "course_name", "program_code"].includes(mapSort.field);
    let q = supabase.from("course_program_map").select("id, course_id, program_id, year_level, semester, effective_sy_id, courses!inner(course_code, course_name, units), program(name, code)");
    
    if (mapFilterCourse) q = q.eq("course_id", mapFilterCourse);
    if (mapFilterProg) q = q.eq("program_id", mapFilterProg);
    if (mapFilterYear) q = q.eq("year_level", mapFilterYear);
    if (mapFilterSemester) q = q.eq("semester", mapFilterSemester);
    if (mainTab === "curriculum" && selCurriculumSy) q = q.eq("effective_sy_id", selCurriculumSy);
    if (mappingSearch) q = q.ilike("courses.course_name", `%${mappingSearch}%`);
    if (!isForeignSort) q = q.order(mapSort.field, { ascending: mapSort.dir === "asc" });

    const { data, error } = await q;
    
    if (!error && data) {
      let formatted = data.map((m: any) => ({
        ...m,
        course_id: m.course_id,
        course_code: m.courses?.course_code,
        course_name: m.courses?.course_name,
        units: m.courses?.units || 0,
        program_code: m.program?.code
      }));

      if (isForeignSort) {
         formatted.sort((a, b) => {
            const valA = String(a[mapSort.field] || "").toLowerCase();
            const valB = String(b[mapSort.field] || "").toLowerCase();
            return mapSort.dir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
         });
      }
      setMappings(formatted);
    }
    setLoading(false);
  }

  async function loadPrerequisites(courseId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("course_prerequisites")
      .select("id, courses!prereq_course_id(course_code, course_name)")
      .eq("course_id", courseId);
    if (!error) setPrerequisites(data || []);
    setLoading(false);
  }

  async function loadSectionMaterials(sectionId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("course_materials")
      .select("*")
      .eq("section_id", sectionId)
      .order("created_at", { ascending: false });
    if (!error) setAuditMaterials(data || []);
    setLoading(false);
  }

  async function toggleTermLock() {
    if (!offFilterSy) return;
    const sy = schoolYears.find(s => s.sy_id === offFilterSy);
    if (!sy) return;
    
    const newLockStatus = !sy.is_locked;
    const { error } = await supabase.from("school_years").update({ is_locked: newLockStatus }).eq("sy_id", offFilterSy);
    if (error) { showToast(error.message, "error"); return; }
    
    showToast(`Grades for this term have been ${newLockStatus ? 'LOCKED' : 'UNLOCKED'}.`, "success");
    await loadReferences();
  }

  async function checkScheduleConflict(syId: string, semester: string, scheduleLabel: string, teacherId: string | null, roomId: string | null, excludeSectionId?: string): Promise<boolean> {
    if (!scheduleLabel || (!teacherId && !roomId)) return false;

    let q = supabase
      .from("course_sections")
      .select("section_id, section_label, teacher_id, room_id, courses!inner(course_code)")
      .eq("sy_id", syId)
      .eq("semester", semester)
      .eq("schedule_label", scheduleLabel);

    if (excludeSectionId) q = q.neq("section_id", excludeSectionId);

    const { data, error } = await q;
    if (error || !data) return false;

    const conflict = data.find((s: any) => (teacherId && s.teacher_id === teacherId) || (roomId && s.room_id === roomId));
    if (conflict) {
      const type = conflict.teacher_id === teacherId ? "Teacher" : "Room";
      showToast(`Conflict detected: ${type} is booked for ${conflict.courses?.course_code} Section ${conflict.section_label} at this time.`, "error");
      return true;
    }

    return false;
  }

  async function checkStudentConflicts(students: string[], syId: string, semester: string, scheduleLabel: string): Promise<string[]> {
    if (!scheduleLabel) return [];
    
    const { data, error } = await supabase.from("student_course_assignments")
      .select("student_id, course_sections!inner(schedule_label, sy_id, semester)")
      .in("student_id", students)
      .eq("course_sections.sy_id", syId)
      .eq("course_sections.semester", semester)
      .eq("course_sections.schedule_label", scheduleLabel);

    if (error || !data) return [];
    return data.map((d: any) => d.student_id);
  }

  function downloadCSVTemplate(type: keyof typeof CSV_TEMPLATES) {
    const content = CSV_TEMPLATES[type];
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Template_${type}.csv`;
    a.click();
  }

  function downloadExportCSV(data: any[], filename: string) {
    if (data.length === 0) return;
    const keys = Object.keys(data[0]).filter(k => k !== "_uuid" && k !== "id" && k !== "select" && k !== "section_id" && k !== "course_id");
    const headers = keys.join(",");
    const rows = data.map(row => keys.map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  async function processEnrollmentBatch(validIds: string[], forceIds: string[], cId: string, sId: string) {
    setLoading(true);
    let enrolledCount = 0, waitlistedCount = 0;
    
    for (const studentId of validIds) {
      const status = await enrollStudent(studentId, cId, sId);
      if (status === "Enrolled") enrolledCount++;
      if (status === "Waitlisted") waitlistedCount++;
    }
    
    for (const studentId of forceIds) {
      await enrollStudent(studentId, cId, sId);
      enrolledCount++;
    }

    setConflictModal({ show: false, validIds: [], conflicted: [], forceIds: [], courseId: "", sectionId: "" });
    setSelStudents([]);
    await loadCatalogSectionsAPI();
    
    if (waitlistedCount > 0) showToast(`${enrolledCount} enrolled, ${waitlistedCount} waitlisted due to capacity.`, "warning");
    else showToast(`${enrolledCount} students successfully enrolled.`, "success");
    setLoading(false);
  }

  async function handleStudentCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selSection || !selCourse) return;
    
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const csvRows = text.split("\n").map(r => r.split(","));
      
      const importedIds = [];
      for (let i = 1; i < csvRows.length; i++) {
        if (csvRows[i][0]) importedIds.push(csvRows[i][0].trim());
      }

      if (importedIds.length === 0) {
        showToast("CSV is empty or improperly formatted.", "warning");
        setLoading(false);
        return;
      }

      const { data: matchedStudents } = await supabase.from("students")
        .select("user_id, student_id, users!inner(display_id, full_name)")
        .or(`student_id.in.(${importedIds.join(",")}),users.display_id.in.(${importedIds.join(",")})`);

      if (!matchedStudents || matchedStudents.length === 0) {
        showToast("No matching students found.", "error");
        setLoading(false);
        return;
      }

      const validUuids = matchedStudents.map((s: any) => s.user_id);
      
      const conflictedIds = await checkStudentConflicts(validUuids, selSection.sy_id, selSection.semester, selSection.schedule_label);
      if (conflictedIds.length > 0) {
         const valid = validUuids.filter((id: string) => !conflictedIds.includes(id));
         const confStudents = matchedStudents.filter((s: any) => conflictedIds.includes(s.user_id)).map((s: any) => ({
             id: s.user_id,
             display: s.student_id || s.users.display_id,
             name: s.users.full_name
         }));
         setConflictModal({ show: true, validIds: valid, conflicted: confStudents, forceIds: [], courseId: selCourse._uuid, sectionId: selSection.section_id });
      } else {
         await processEnrollmentBatch(validUuids, [], selCourse._uuid, selSection.section_id);
      }
      setLoading(false);
    };
    reader.readAsText(file);
    if (studentCsvRef.current) studentCsvRef.current.value = "";
  }

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !importType) return;
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const csvRows = text.split("\n").map(r => r.split(","));
      
      try {
        if (importType === "global_enrollments") {
          const validRows = csvRows.slice(1).filter(r => r.length >= 3 && r[0].trim() && r[1].trim() && r[2].trim());
          if (validRows.length === 0) throw new Error("CSV is empty or missing required columns.");

          const displayIds = Array.from(new Set(validRows.map(r => r[0].trim())));
          
          const { data: usersData } = await supabase.from("students").select("user_id, student_id, users!inner(display_id)").or(`student_id.in.(${displayIds.join(",")}),users.display_id.in.(${displayIds.join(",")})`);
          const userDict = (usersData || []).reduce((acc: any, u: any) => { 
             acc[u.student_id] = u.user_id; 
             acc[u.users.display_id] = u.user_id;
             return acc; 
          }, {});

          const courseCodes = Array.from(new Set(validRows.map(r => r[1].trim().toUpperCase())));
          const { data: sectionData } = await supabase.from("course_sections").select("section_id, section_label, course_id, courses!inner(course_code)").eq("sy_id", offFilterSy).eq("semester", offFilterSemester).in("courses.course_code", courseCodes);
          const sectionDict = (sectionData || []).reduce((acc: any, s: any) => { 
            const key = `${s.courses?.course_code}_${s.section_label}`.toUpperCase();
            acc[key] = { section_id: s.section_id, course_id: s.course_id }; 
            return acc; 
          }, {});

          let successCount = 0;
          for (const row of validRows) {
            const uId = userDict[row[0].trim()];
            const sKey = `${row[1].trim()}_${row[2].trim()}`.toUpperCase();
            const sData = sectionDict[sKey];

            if (uId && sData) {
              await enrollStudent(uId, sData.course_id, sData.section_id);
              successCount++;
            }
          }
          showToast(`Successfully processed ${successCount} global enrollments.`, "success");
          if (mainTab === "offerings") void loadOfferingsAPI();
        }

        else if (importType === "courses") {
          const newCourses = [];
          const prereqMap: Record<string, string[]> = {};
          
          for (let i = 1; i < csvRows.length; i++) {
            if (csvRows[i].length >= 3 && csvRows[i][0].trim()) {
              const code = csvRows[i][0].trim().toUpperCase();
              newCourses.push({
                course_code: code,
                course_name: csvRows[i][1].trim(),
                units: Number(csvRows[i][2].trim()) || 3
              });
              if (csvRows[i][5]) prereqMap[code] = csvRows[i][5].replace(/"/g, "").split(";").map(s => s.trim().toUpperCase());
            }
          }
          if (newCourses.length > 0) {
            const { error } = await supabase.from("courses").insert(newCourses);
            if (error) throw error;
            
            const { data: dbCourses } = await supabase.from("courses").select("course_id, course_code");
            const courseDict = (dbCourses || []).reduce((acc: any, c: any) => { acc[c.course_code] = c.course_id; return acc; }, {});
            
            const prereqPayload = [];
            for (const code in prereqMap) {
              const cid = courseDict[code];
              if (cid) {
                for (const pcode of prereqMap[code]) {
                  const pid = courseDict[pcode];
                  if (pid) prereqPayload.push({ course_id: cid, prereq_course_id: pid });
                }
              }
            }
            if (prereqPayload.length > 0) await supabase.from("course_prerequisites").insert(prereqPayload);
            showToast(`Imported ${newCourses.length} courses.`, "success");
            await loadAllCourses();
          }
        } 
        
        else if (importType === "rooms") {
          const newRooms = [];
          for (let i = 1; i < csvRows.length; i++) {
            if (csvRows[i].length >= 2 && csvRows[i][0].trim()) {
              newRooms.push({ room_name: csvRows[i][0].trim(), capacity: Number(csvRows[i][1].trim()) || 40 });
            }
          }
          if (newRooms.length > 0) {
            const { error } = await supabase.from("rooms").insert(newRooms);
            if (error) throw error;
            showToast(`Imported ${newRooms.length} rooms.`, "success");
            await loadReferences();
          }
        }

        else if (importType === "mappings") {
          const courseDict = allCourses.reduce((acc, c) => { acc[c.code] = c._uuid; return acc; }, {});
          const progDict = programs.reduce((acc, p) => { acc[p.code] = p.program_id; return acc; }, {});
          const newMaps = [];
          
          for (let i = 1; i < csvRows.length; i++) {
            if (csvRows[i].length >= 4 && csvRows[i][0].trim()) {
              const cId = courseDict[csvRows[i][0].trim().toUpperCase()];
              const pId = progDict[csvRows[i][1].trim().toUpperCase()];
              if (cId && pId) {
                newMaps.push({ course_id: cId, program_id: pId, year_level: csvRows[i][2].trim(), semester: csvRows[i][3].trim(), effective_sy_id: offFilterSy || null });
              }
            }
          }
          if (newMaps.length > 0) {
            const { error } = await supabase.from("course_program_map").insert(newMaps);
            if (error) throw error;
            showToast(`Imported ${newMaps.length} mappings.`, "success");
            void loadMappingsAPI();
          }
        }

        else if (importType === "sections") {
          const courseDict = allCourses.reduce((acc, c) => { acc[c.code] = c._uuid; return acc; }, {});
          const roomDict = rooms.reduce((acc, r) => { acc[r.room_name] = r.room_id; return acc; }, {});
          const progDict = programs.reduce((acc, p) => { acc[p.code] = p.program_id; return acc; }, {});
          
          const tDisplayIds = Array.from(new Set(csvRows.slice(1).map(r => r[8]?.trim()).filter(Boolean)));
          const { data: tData } = await supabase.from("users").select("user_id, display_id").in("display_id", tDisplayIds).eq("role", "teacher");
          const tDict = (tData || []).reduce((acc: any, t: any) => { acc[t.display_id] = t.user_id; return acc; }, {});

          const newSections = [];
          let skipped = 0;

          for (let i = 1; i < csvRows.length; i++) {
            if (csvRows[i].length >= 7 && csvRows[i][0].trim()) {
              const cId = courseDict[csvRows[i][0].trim().toUpperCase()];
              const semester = csvRows[i][2].trim();
              const yearLevel = csvRows[i][3].trim();
              const pId = progDict[csvRows[i][4].trim().toUpperCase()] || null;
              const rId = roomDict[csvRows[i][5].trim()] || null;
              const schedule = csvRows[i][6].trim();
              const tId = tDict[csvRows[i][8]?.trim()] || null;
              
              let capValue: number | null = Number(csvRows[i][7]?.trim());
              if (isNaN(capValue) || csvRows[i][7]?.trim().toLowerCase() === "unlimited") capValue = null;

              if (cId && offFilterSy && semester) {
                const hasConflict = await checkScheduleConflict(offFilterSy, semester, schedule, tId, rId);
                if (hasConflict) { skipped++; continue; }
                
                newSections.push({
                  course_id: cId, section_label: csvRows[i][1].trim(), semester, room_id: rId,
                  year_level: yearLevel || "1st Year",
                  program_id: pId,
                  teacher_id: tId,
                  schedule_label: schedule, max_capacity: capValue,
                  sy_id: offFilterSy
                });
              }
            }
          }
          if (newSections.length > 0) {
            const { error } = await supabase.from("course_sections").insert(newSections);
            if (error) throw error;
            showToast(`Imported ${newSections.length} sections. Skipped ${skipped} conflicts.`, "success");
            void loadCatalogSectionsAPI();
            void loadOfferingsAPI();
          }
        }

      } catch (err: any) {
        showToast("CSV Import Failed: " + err.message, "error");
      }
      setLoading(false);
      setImportType(null);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCreateCourse() {
    if (!courseForm.code || !courseForm.name) { showToast("Course Code and Name are required.", "error"); return; }
    
    const toInsert = [];
    if (courseForm.types.includes("LEC") && courseForm.types.includes("LAB")) {
       toInsert.push({ course_code: courseForm.code + "LEC", course_name: courseForm.name, units: courseForm.lecUnits });
       toInsert.push({ course_code: courseForm.code + "LAB", course_name: courseForm.name, units: courseForm.labUnits });
    } else if (courseForm.types.includes("LEC")) {
       toInsert.push({ course_code: courseForm.code + "LEC", course_name: courseForm.name, units: courseForm.lecUnits });
    } else if (courseForm.types.includes("LAB")) {
       toInsert.push({ course_code: courseForm.code + "LAB", course_name: courseForm.name, units: courseForm.labUnits });
    } else {
       toInsert.push({ course_code: courseForm.code, course_name: courseForm.name, units: courseForm.units });
    }

    const { data, error } = await supabase.from("courses").insert(toInsert).select("course_id");
    if (error) { showToast(error.message, "error"); return; }

    if (courseForm.prereqs.length > 0 && data) {
      const prereqPayload = [];
      for (const row of data) {
         for (const pId of courseForm.prereqs) {
            prereqPayload.push({ course_id: row.course_id, prereq_course_id: pId });
         }
      }
      if (prereqPayload.length > 0) {
         await supabase.from("course_prerequisites").insert(prereqPayload);
      }
    }

    showToast("Course(s) created successfully.", "success");
    setShowCreateCourseModal(false);
    setCourseForm({ code: "", name: "", units: 3, types: [], lecUnits: 2, labUnits: 1, prereqs: [] });
    await loadAllCourses();
    if (selCode) void loadCoursesAPI();
  }

  async function handleCreateSection() {
    if (!sectionForm.courseId || !sectionForm.syId || !sectionForm.semester || !sectionForm.sectionLabel) {
      showToast("Course, SY, Semester, and Label are required.", "error"); return;
    }

    const hasConflict = await checkScheduleConflict(sectionForm.syId, sectionForm.semester, sectionForm.scheduleLabel, sectionForm.teacherId || null, sectionForm.roomId || null);
    if (hasConflict) return;

    const { error } = await supabase.from("course_sections").insert({
      course_id: sectionForm.courseId, 
      max_capacity: sectionForm.isUnlimited ? null : sectionForm.maxCapacity,
      room_id: sectionForm.roomId || null, 
      schedule_label: sectionForm.scheduleLabel || null,
      section_label: sectionForm.sectionLabel, 
      sy_id: sectionForm.syId, 
      teacher_id: sectionForm.teacherId || null,
      semester: sectionForm.semester,
      year_level: sectionForm.yearLevel,
      program_id: sectionForm.programId || null
    });

    if (error) { showToast(error.message, "error"); return; }

    showToast(`Section ${sectionForm.sectionLabel} created successfully.`, "success");
    setShowCreateSectionModal(false);
    
    if (mainTab === "catalog" && selCourse) void loadCatalogSectionsAPI();
    if (mainTab === "offerings") void loadOfferingsAPI();
  }

  async function handleUpdateSection() {
    if (!selSection?._uuid && !selSection?.section_id) return;
    const targetId = selSection._uuid || selSection.section_id;

    const hasConflict = await checkScheduleConflict(sectionForm.syId, sectionForm.semester, sectionForm.scheduleLabel, sectionForm.teacherId || null, sectionForm.roomId || null, targetId);
    if (hasConflict) return;

    const { error } = await supabase.from("course_sections").update({
      max_capacity: sectionForm.isUnlimited ? null : sectionForm.maxCapacity,
      room_id: sectionForm.roomId || null,
      schedule_label: sectionForm.scheduleLabel || null,
      teacher_id: sectionForm.teacherId || null,
      year_level: sectionForm.yearLevel,
      program_id: sectionForm.programId || null
    }).eq("section_id", targetId);

    if (error) { showToast(error.message, "error"); return; }

    showToast(`Section updated successfully.`, "success");
    setShowEditSectionModal(false);
    
    if (mainTab === "catalog" && selCourse) void loadCatalogSectionsAPI();
    if (mainTab === "offerings") void loadOfferingsAPI();
  }

  async function handleEditCourse() {
    if (!selCourse?._uuid) return;
    const { error } = await supabase.from("courses").update({ 
      course_code: courseForm.code.toUpperCase(), 
      course_name: courseForm.name, 
      units: courseForm.units
    }).eq("course_id", selCourse._uuid);
    if (error) { showToast(error.message, "error"); return; }
    showToast("Course updated successfully.", "success");
    setShowEditCourseModal(false);
    setSelCourse({ ...selCourse, code: courseForm.code.toUpperCase(), name: courseForm.name, units: courseForm.units });
    await loadAllCourses();
    void loadCoursesAPI();
  }

  async function handleCreateMapping() {
    if (!mappingForm.courseId || !mappingForm.programId) { showToast("Course and Program required.", "error"); return; }
    const { error } = await supabase.from("course_program_map").insert({
      course_id: mappingForm.courseId, program_id: Number(mappingForm.programId),
      semester: mappingForm.semester, year_level: mappingForm.yearLevel, effective_sy_id: selCurriculumSy || null
    });
    if (error) { showToast(error.code === "23505" ? "Mapping already exists." : error.message, "error"); return; }
    showToast("Mapping added.", "success");
    setShowMappingModal(false);
    void loadMappingsAPI();
  }

  function handleDeleteMapping(id: number) {
    reqConfirm("Remove Mapping", "Are you sure you want to remove this mapping?", async () => {
      const { error } = await supabase.from("course_program_map").delete().eq("id", id);
      if (error) { showToast(error.message, "error"); return; }
      showToast("Mapping removed.", "success");
      void loadMappingsAPI();
    });
  }

  async function handleCreateRoom() {
    if (!newRoomForm.name) { showToast("Room name required.", "error"); return; }
    const { error } = await supabase.from("rooms").insert({ capacity: newRoomForm.capacity, room_name: newRoomForm.name });
    if (error) { showToast(error.message, "error"); return; }
    showToast("Room added.", "success");
    setNewRoomForm({ capacity: 40, name: "" });
    await loadReferences();
  }

  function handleDeleteRoom(roomId: string) {
    reqConfirm("Delete Room", "Are you sure you want to delete this room?", async () => {
      const { error } = await supabase.from("rooms").delete().eq("room_id", roomId);
      if (error) { showToast("Cannot delete active room.", "error"); return; }
      showToast("Room deleted.", "success");
      await loadReferences();
    });
  }

  async function handleCreateSchedule() {
    const daysStr = newSchedDays.join("");
    if (!daysStr || !newSchedStart || !newSchedEnd) { showToast("Days, Start Time, and End Time are required.", "error"); return; }
    const label = `${daysStr} ${newSchedStart} - ${newSchedEnd}`;
    const { error } = await supabase.from("schedules").insert({ schedule_label: label });
    if (error) { showToast(error.message, "error"); return; }
    showToast("Schedule added.", "success");
    setNewSchedDays([]);
    setNewSchedStart("");
    setNewSchedEnd("");
    await loadReferences();
  }

  function handleDeleteSchedule(id: string) {
    reqConfirm("Delete Schedule", "Are you sure you want to delete this schedule?", async () => {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) { showToast("Error deleting schedule.", "error"); return; }
      showToast("Schedule deleted.", "success");
      await loadReferences();
    });
  }

  async function handleAddPrerequisite() {
    if (!selCourse || !prereqFormCourseId) return;
    const { error } = await supabase.from("course_prerequisites").insert({
      course_id: selCourse._uuid,
      prereq_course_id: prereqFormCourseId
    });
    if (error) { showToast(error.message, "error"); return; }
    showToast("Prerequisite added.", "success");
    setPrereqFormCourseId("");
    void loadPrerequisites(selCourse._uuid);
    void loadAllCourses(); 
  }

  function handleRemovePrerequisite(id: string) {
    reqConfirm("Remove Prerequisite", "Are you sure you want to remove this prerequisite?", async () => {
      const { error } = await supabase.from("course_prerequisites").delete().eq("id", id);
      if (error) { showToast(error.message, "error"); return; }
      showToast("Prerequisite removed.", "success");
      void loadPrerequisites(selCourse._uuid);
      void loadAllCourses();
    });
  }

  async function handleRollover() {
    if (!rolloverForm.sourceSyId || !rolloverForm.targetSyId) { showToast("Source and Target School Years are required.", "error"); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc("rollover_sections", {
      p_source_sy_id: rolloverForm.sourceSyId,
      p_source_term: rolloverForm.sourceSemester,
      p_target_sy_id: rolloverForm.targetSyId,
      p_target_term: rolloverForm.targetSemester
    });
    setLoading(false);
    if (error) { showToast(error.message, "error"); return; }
    showToast(`Successfully rolled over ${data} sections.`, "success");
    setShowRolloverModal(false);
    if (mainTab === "offerings") void loadOfferingsAPI();
  }

  function handleUnenrollStudent(assignmentId: string) {
    reqConfirm("Remove Student", "Are you sure you want to unenroll this student?", async () => {
      const { error } = await supabase.from("student_course_assignments").delete().eq("assignment_id", assignmentId);
      if (error) { showToast(error.message, "error"); return; }
      
      setSectionEnrollments(prev => prev.filter(e => e.assignment_id !== assignmentId));
      setOfferingEnrollments(prev => prev.filter(e => e.assignment_id !== assignmentId));
      showToast("Student removed.", "success");
      
      if (mainTab === "offerings") void loadOfferingsAPI();
      if (mainTab === "catalog" && selCourse) void loadCatalogSectionsAPI();
    });
  }

  function handleBulkUnenroll() {
    if (selEnrolledForDelete.length === 0) return;
    reqConfirm("Bulk Remove Students", `Remove ${selEnrolledForDelete.length} selected students?`, async () => {
      const { error } = await supabase.from("student_course_assignments").delete().in("assignment_id", selEnrolledForDelete);
      if (error) { showToast(error.message, "error"); return; }
      
      setSectionEnrollments(prev => prev.filter(e => !selEnrolledForDelete.includes(e.assignment_id)));
      setSelEnrolledForDelete([]);
      showToast("Students removed.", "success");
      if (mainTab === "catalog" && selCourse) void loadCatalogSectionsAPI();
    });
  }

  async function promoteWaitlistStudent(assignmentId: string) {
    const { error } = await supabase.from("student_course_assignments").update({ enrollment_status: "Enrolled" }).eq("assignment_id", assignmentId);
    if (error) { showToast(error.message, "error"); return; }
    showToast("Student promoted to Enrolled.", "success");
    
    if (mainTab === "offerings" && viewOfferingSection) openOfferingDetailsModal(viewOfferingSection);
    if (mainTab === "catalog" && selCourse) void loadCatalogSectionsAPI();
  }

  function deleteSelectedCodes() {
    if (selCodesForDelete.length === 0) return;
    reqConfirm("Delete Code Groups", `Delete ${selCodesForDelete.length} code groups?`, async () => {
      const ids = allCourses.filter((c) => selCodesForDelete.includes(codePrefix(c.code))).map(c => c._uuid);
      if (ids.length === 0) return;
      const { error } = await supabase.from("courses").delete().in("course_id", ids);
      if (!error) { showToast("Code groups deleted.", "success"); setSelCodesForDelete([]); await loadAllCourses(); void loadCodesAPI(); }
    });
  }

  function deleteSelectedCourses() {
    if (selCoursesForDelete.length === 0) return;
    reqConfirm("Delete Courses", `Delete ${selCoursesForDelete.length} courses?`, async () => {
      const { error } = await supabase.from("courses").delete().in("course_id", selCoursesForDelete);
      if (!error) { showToast("Courses deleted.", "success"); setSelCoursesForDelete([]); await loadAllCourses(); void loadCoursesAPI(); }
    });
  }

  function deleteSelectedSections() {
    if (selSectionsForDelete.length === 0) return;
    reqConfirm("Delete Sections", `Delete ${selSectionsForDelete.length} sections?`, async () => {
      const { error } = await supabase.from("course_sections").delete().in("section_id", selSectionsForDelete);
      if (!error) { 
        showToast("Sections deleted.", "success"); 
        setSelSectionsForDelete([]); 
        if (mainTab === "catalog" && selCourse) void loadCatalogSectionsAPI();
        if (mainTab === "offerings") void loadOfferingsAPI();
      }
    });
  }

  function deleteSelectedMappings() {
    if (selMappingsForDelete.length === 0) return;
    reqConfirm("Delete Mappings", `Delete ${selMappingsForDelete.length} mappings?`, async () => {
      const { error } = await supabase.from("course_program_map").delete().in("id", selMappingsForDelete);
      if (!error) {
        showToast("Mappings deleted.", "success");
        setSelMappingsForDelete([]);
        void loadMappingsAPI();
      }
    });
  }

  async function enrollStudents() {
    if (!selSection || selStudents.length === 0 || !selCourse?._uuid) return;
    
    const conflictedIds = await checkStudentConflicts(selStudents, selSection.sy_id, selSection.semester, selSection.schedule_label);
    
    if (conflictedIds.length > 0) {
      const valid = selStudents.filter(id => !conflictedIds.includes(id));
      const confStudents = studentsList.filter(s => conflictedIds.includes(s._uuid)).map(s => ({
          id: s._uuid,
          display: s.displayId,
          name: s.fullName
      }));
      setConflictModal({ show: true, validIds: valid, conflicted: confStudents, forceIds: [], courseId: selCourse._uuid, sectionId: selSection.section_id });
    } else {
      await processEnrollmentBatch(selStudents, [], selCourse._uuid, selSection.section_id);
    }
  }

  async function executeManualMultiEnroll() {
    if (!manualEnrollStudentId || manualEnrollSections.length === 0) return;
    setLoading(true);

    let successCount = 0;
    for (const sectionId of manualEnrollSections) {
      const secData = offerings.find(o => o.section_id === sectionId);
      if (secData) {
        await enrollStudent(manualEnrollStudentId, secData.course_id, sectionId);
        successCount++;
      }
    }

    showToast(`Processed ${successCount} enrollments for student.`, "success");
    setManualEnrollStudentId("");
    setManualEnrollSections([]);
    setShowManualEnrollModal(false);
    if (mainTab === "offerings") void loadOfferingsAPI();
    setLoading(false);
  }

  function handleMainSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      setOffPage(0);
      if (mainTab === "catalog" && level === "codes") void loadCodesAPI();
      if (mainTab === "catalog" && level === "course") void loadCoursesAPI();
      if (mainTab === "catalog" && level === "section") void loadCatalogSectionsAPI();
      if (mainTab === "offerings") void loadOfferingsAPI();
      if (mainTab === "mappings") void loadMappingsAPI();
    }
  }

  function handleApplyFilters() {
    setShowFilterModal(false);
    setOffPage(0);
    if (mainTab === "offerings") void loadOfferingsAPI();
    if (mainTab === "mappings") void loadMappingsAPI();
    if (mainTab === "catalog" && selCourse) void loadCatalogSectionsAPI();
  }

  function openCreateSectionModal() {
    setSectionForm({
      ...sectionForm,
      courseId: mainTab === "catalog" && selCourse ? selCourse._uuid : offFilterCourse,
      isUnlimited: false,
      maxCapacity: 30,
      roomId: "",
      scheduleLabel: "",
      syId: offFilterSy,
      teacherId: "",
      semester: offFilterSemester,
      yearLevel: "1st Year",
      programId: ""
    });
    setTeacherWorkload(null);
    setShowCreateSectionModal(true);
  }

  function openEditSectionModal() {
    if (!selSection) return;
    setSectionForm({
      courseId: selSection.course_id,
      isUnlimited: selSection.max_capacity === null,
      maxCapacity: selSection.max_capacity || 30,
      roomId: selSection.room_id || "",
      scheduleLabel: selSection.schedule_label || "",
      sectionLabel: selSection.section_label,
      syId: selSection.sy_id,
      teacherId: selSection.teacher_id || "",
      semester: selSection.semester || "1st Semester",
      yearLevel: selSection.year_level || "1st Year",
      programId: selSection.program_id || ""
    });
    setTeacherWorkload(null);
    setShowEditSectionModal(true);
  }

  function openPrereqModal() {
    if (!selCourse) return;
    setShowPrereqModal(true);
    void loadPrerequisites(selCourse._uuid);
  }

  function openAuditModal() {
    if (!selSection) return;
    setShowAuditModal(true);
    void loadSectionMaterials(selSection.section_id);
  }

  async function openOfferingDetailsModal(section: any) {
    setViewOfferingSection(section);
    setShowOfferingDetailsModal(true);
    setEnrolledSearch("");
    setEnrolledFilter("");
    setLoading(true);
    const { data } = await supabase.from("student_course_assignments")
      .select(`
        assignment_id, student_id, enrollment_status, final_grade, completion_status,
        students!inner(student_id, users!inner(full_name, display_id))
      `)
      .eq("section_id", section.section_id);
    
    const enriched = (data || []).map((e: any) => ({
      ...e,
      studentDisplayId: e.students?.student_id || e.students?.users?.display_id || "Unknown ID",
      studentName: e.students?.users?.full_name || "Unknown Name"
    }));
    setOfferingEnrollments(enriched);
    setLoading(false);
  }

  function drillCode(prefix: string) {
    setSelCode(prefix); setLevel("course"); setSelCoursesForDelete([]);
    void loadCoursesAPI();
  }

  function drillSections(course: any) {
    setSelCourse(course); setLevel("section"); setSelSectionsForDelete([]); setSelSection(null);
  }

  function toggleSelection(item: any, list: any[], setter: (v: any[]) => void) {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  const validProgramIds = useMemo(() => {
    if (mainTab !== "catalog" || !selCourse) return programs.map(p => p.program_id);
    const m = mappings.filter(map => map.course_id === selCourse._uuid);
    if (m.length === 0) return [];
    return Array.from(new Set(m.map(map => map.program_id)));
  }, [mappings, selCourse, programs, mainTab]);

  const filteredPrograms = programs.filter(p => validProgramIds.includes(p.program_id));

  const programOptions = filteredPrograms.length > 0 
    ? [{ value: "", label: "— All Mapped Programs —" }, ...filteredPrograms.map(p => ({ value: p.program_id, label: p.code }))] 
    : [];

  const teacherList = users.filter(u => u.role === "teacher");
  const teacherOptions = teacherList.length > 0 
    ? [{ value: "", label: "— Select Teacher (Optional) —" }, ...teacherList.map(t => ({ value: t._uuid, label: t.fullName }))] 
    : [];

  const roomOptions = rooms.length > 0 
    ? [{ value: "", label: "— Select Room (Optional) —" }, ...rooms.map(r => ({ value: r.room_id, label: `${r.room_name} (Max ${r.capacity})` }))] 
    : [];

  const scheduleOptions = schedules.length > 0 
    ? [{ value: "", label: "— Select Schedule (Optional) —" }, ...schedules.map(s => ({ value: s.schedule_label, label: s.schedule_label }))] 
    : [];

  const studentOptions = studentsList.length > 0 
    ? studentsList.map(s => ({ value: s._uuid, label: `${s.displayId} - ${s.fullName} (${programs.find(p => p.program_id === s.programId)?.code || "No Program"})` })) 
    : [];

  const eligibleStudents = useMemo(() => {
    if (!selSection || !selSection.program_id) return [];
    return studentsList.filter(s => {
      if (s.programId !== selSection.program_id) return false;
      if (selSection.year_level && s.yearLevel !== selSection.year_level) return false;
      if (studentSearch && !s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) && !s.displayId.toLowerCase().includes(studentSearch.toLowerCase())) return false;
      return true;
    });
  }, [studentsList, selSection, studentSearch]);

  const groupedCurriculum = useMemo(() => {
    if (!selCurriculumProg) return {};
    const filtered = mappings.filter(m => String(m.program_id) === String(selCurriculumProg));
    const groups: any = {};
    filtered.forEach(m => {
      if (!groups[m.year_level]) groups[m.year_level] = {};
      if (!groups[m.year_level][m.semester]) groups[m.year_level][m.semester] = [];
      groups[m.year_level][m.semester].push(m);
    });
    return groups;
  }, [mappings, selCurriculumProg]);

  const isTermLocked = useMemo(() => {
     return schoolYears.find(sy => sy.sy_id === offFilterSy)?.is_locked || false;
  }, [schoolYears, offFilterSy]);

  const catalogEnrolledRows = sectionEnrollments
    .filter((e) => e.section_id === selSection?.section_id)
    .map((e) => ({
      completion: e.completion_status || "Ongoing",
      grade: e.final_grade,
      id: e.assignment_id,
      status: e.enrollment_status,
      studentId: e.studentDisplayId,
      studentName: e.studentName,
    }))
    .filter((row) => {
      if (enrolledSearch && !row.studentName.toLowerCase().includes(enrolledSearch.toLowerCase()) && !row.studentId.toLowerCase().includes(enrolledSearch.toLowerCase())) return false;
      if (enrolledFilter && row.status !== enrolledFilter) return false;
      return true;
    });

  const filteredOfferingEnrollments = offeringEnrollments
    .map((e) => ({
      completion: e.completion_status || "Ongoing",
      grade: e.final_grade,
      id: e.assignment_id,
      status: e.enrollment_status,
      studentId: e.studentDisplayId,
      studentName: e.studentName,
    }))
    .filter((row) => {
      if (enrolledSearch && !row.studentName.toLowerCase().includes(enrolledSearch.toLowerCase()) && !row.studentId.toLowerCase().includes(enrolledSearch.toLowerCase())) return false;
      if (enrolledFilter && row.status !== enrolledFilter) return false;
      return true;
    });

  const codeCols = [
    { cellRenderer: (_: any, row: any) => <input checked={selCodesForDelete.includes(row.prefix)} onChange={() => toggleSelection(row.prefix, selCodesForDelete, setSelCodesForDelete)} onClick={(e) => e.stopPropagation()} type="checkbox" />, field: "select", header: <input checked={codeGroups.length > 0 && selCodesForDelete.length === codeGroups.length} onChange={(e) => setSelCodesForDelete(e.target.checked ? codeGroups.map(c=>c.prefix) : [])} type="checkbox" />, sortable: false, width: 50 },
    { field: "prefix", header: "Code Group", width: 150, sortable: true },
    { field: "count", header: "Courses", width: 100, sortable: true },
    { cellRenderer: (_: any, row: any) => <Btn onClick={(e: any) => { e.stopPropagation(); drillCode(row.prefix); }} size="sm">Manage Courses</Btn>, field: "prefix", header: "Actions", sortable: false },
  ];

  const courseCols = [
    { cellRenderer: (_: any, row: any) => <input checked={selCoursesForDelete.includes(row._uuid)} onChange={() => toggleSelection(row._uuid, selCoursesForDelete, setSelCoursesForDelete)} onClick={(e) => e.stopPropagation()} type="checkbox" />, field: "select", header: <input checked={courses.length > 0 && selCoursesForDelete.length === courses.length} onChange={(e) => setSelCoursesForDelete(e.target.checked ? courses.map(c=>c._uuid) : [])} type="checkbox" />, sortable: false, width: 50 },
    { field: "code", header: "Course Code", width: 150, sortable: true },
    { field: "name", header: "Course Name", sortable: true },
    { field: "units", header: "Units", width: 80, sortable: true },
    { cellRenderer: (_: any, row: any) => <Btn onClick={(e: any) => { e.stopPropagation(); drillSections(row); }} size="sm">Manage Sections</Btn>, field: "_uuid", header: "Actions", sortable: false },
  ];

  const sectionCols = [
    { cellRenderer: (_: any, row: any) => <input checked={selSectionsForDelete.includes(row.section_id)} onChange={() => toggleSelection(row.section_id, selSectionsForDelete, setSelSectionsForDelete)} onClick={(e) => e.stopPropagation()} type="checkbox" />, field: "select", header: <input checked={sections.length > 0 && selSectionsForDelete.length === sections.length} onChange={(e) => setSelSectionsForDelete(e.target.checked ? sections.map(s=>s.section_id) : [])} type="checkbox" />, sortable: false, width: 50 },
    { field: "section_label", header: "Section", width: 100, sortable: true },
    { field: "program_code", header: "Program", width: 120, sortable: true },
    { field: "schedule_label", header: "Schedule", width: 180, sortable: true },
    { field: "room_name", header: "Room", width: 100, sortable: true },
    { cellRenderer: (_: any, row: any) => <span>{row.max_capacity === null ? "∞" : row.max_capacity}</span>, field: "max_capacity", header: "Capacity", width: 100, sortable: true },
  ];

  const offeringsCols = [
    { cellRenderer: (_: any, row: any) => <input checked={selSectionsForDelete.includes(row.section_id)} onChange={() => toggleSelection(row.section_id, selSectionsForDelete, setSelSectionsForDelete)} onClick={(e) => e.stopPropagation()} type="checkbox" />, field: "select", header: <input checked={offerings.length > 0 && selSectionsForDelete.length === offerings.length} onChange={(e) => setSelSectionsForDelete(e.target.checked ? offerings.map(s=>s.section_id) : [])} type="checkbox" />, sortable: false, width: 50 },
    { field: "course_code", header: "Course Code", width: 120, sortable: true },
    { field: "course_name", header: "Course Name", flex: 1, sortable: true },
    { field: "section_label", header: "Section", width: 90, sortable: true },
    { field: "program_code", header: "Program", width: 100, sortable: true },
    { field: "semester", header: "Semester", width: 100, sortable: true },
    { field: "schedule_label", header: "Schedule", width: 180, sortable: true },
    { field: "room_name", header: "Room", width: 100, sortable: true },
    { cellRenderer: (_: any, row: any) => <span>{row.enrolled_count} / {row.max_capacity === null ? "∞" : (row.max_capacity || 30)}</span>, field: "max_capacity", header: "Capacity", width: 100, sortable: true },
    { cellRenderer: (_: any, row: any) => <Btn onClick={(e: any) => { e.stopPropagation(); openOfferingDetailsModal(row); }} size="sm" variant="secondary">View Details</Btn>, field: "section_id", header: "Action", sortable: false, width: 120 },
  ];

  const mappingsCols = [
    { cellRenderer: (_: any, row: any) => <input checked={selMappingsForDelete.includes(row.id)} onChange={() => toggleSelection(row.id, selMappingsForDelete, setSelMappingsForDelete)} onClick={(e) => e.stopPropagation()} type="checkbox" />, field: "select", header: <input checked={mappings.length > 0 && selMappingsForDelete.length === mappings.length} onChange={(e) => setSelMappingsForDelete(e.target.checked ? mappings.map(m=>m.id) : [])} type="checkbox" />, sortable: false, width: 50 },
    { field: "course_code", header: "Course", width: 120, sortable: true },
    { field: "course_name", header: "Course Name", flex: 1, sortable: true },
    { field: "program_code", header: "Program", width: 120, sortable: true },
    { field: "year_level", header: "Year Level", width: 120, sortable: true },
    { field: "semester", header: "Semester", width: 150, sortable: true },
    { cellRenderer: (_: any, row: any) => <Btn onClick={(e: any) => { e.stopPropagation(); handleDeleteMapping(row.id); }} size="sm" variant="danger">Remove</Btn>, field: "id", header: "Action", sortable: false, width: 90 },
  ];

  const enrolledCols = [
    { cellRenderer: (_: any, row: any) => <input checked={selEnrolledForDelete.includes(row.id)} onChange={() => toggleSelection(row.id, selEnrolledForDelete, setSelEnrolledForDelete)} onClick={(e) => e.stopPropagation()} type="checkbox" />, field: "select", header: <input checked={catalogEnrolledRows.length > 0 && selEnrolledForDelete.length === catalogEnrolledRows.length} onChange={(e) => setSelEnrolledForDelete(e.target.checked ? catalogEnrolledRows.map(s=>s.id) : [])} type="checkbox" />, sortable: false, width: 50 },
    { field: "studentId", header: "Student ID", width: 150, sortable: true },
    { field: "studentName", header: "Student Name", sortable: true },
    { cellRenderer: (v: string) => <Badge color={v === "Waitlisted" ? "warning" : "success"}>{v}</Badge>, field: "status", header: "Logistics", width: 100 },
    { cellRenderer: (v: number | null) => (v != null ? `${v}%` : "—"), field: "grade", header: "Final Grade", width: 90 },
    { cellRenderer: (v: string, row: any) => isTermLocked ? (
        <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 700 }}>{v} 🔒</span>
      ) : (
        <Sel onChange={(e) => updateCompletionStatus(row.studentId, selCourse?._uuid || viewOfferingSection?.course_id, e.target.value as "Failed" | "Finished" | "INC" | "Ongoing")} style={{ background: "#0f172a", border: "1px solid #334155", color: "#f1f5f9", fontSize: "12px", padding: "4px", width: "100%" }} value={v}>
          <option value="Ongoing">Ongoing</option><option value="Finished">Finished</option><option value="INC">Incomplete (INC)</option><option value="Failed">Failed</option>
        </Sel>
      ), field: "completion", header: "Verdict", sortable: false, width: 120 },
    { cellRenderer: (_: any, row: any) => (
        <div style={{ display: "flex", gap: "6px" }}>
           {row.status === "Waitlisted" && !isTermLocked && <Btn onClick={() => promoteWaitlistStudent(row.id)} size="sm" variant="success">Promote</Btn>}
           {!isTermLocked && <Btn onClick={() => handleUnenrollStudent(row.id)} size="sm" variant="danger">Remove</Btn>}
        </div>
      ), field: "id", header: "Action", sortable: false, width: 140 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-area { display: block !important; padding: 20px; }
          .au-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
          .au-table th, .au-table td { border: 1px solid #000; padding: 4px; text-align: center; color: black; }
          .au-table th { background: #eee !important; -webkit-print-color-adjust: exact; font-weight: bold; }
          .au-table td:nth-child(2) { text-align: left; }
        }
        .au-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; color: #f1f5f9; }
        .au-table th, .au-table td { border: 1px solid #334155; padding: 6px; text-align: center; }
        .au-table th { background: #1e293b; color: #94a3b8; font-weight: bold; }
        .au-table td:nth-child(2) { text-align: left; }
      `}</style>
      
      <div style={{ pointerEvents: toast.msg ? "auto" : "none", position: "fixed", right: "20px", top: "20px", transform: toast.msg ? "translateY(0)" : "translateY(-20px)", transition: "all 0.3s ease", zIndex: 99999, opacity: toast.msg ? 1 : 0 }}>
        <div style={{ alignItems: "center", background: toast.type === "error" ? "#fef2f2" : toast.type === "warning" ? "#fffbeb" : "#f0fdf4", border: `1px solid ${toast.type === "error" ? "#f87171" : toast.type === "warning" ? "#fbbf24" : "#34d399"}`, borderRadius: "8px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", color: toast.type === "error" ? "#dc2626" : toast.type === "warning" ? "#d97706" : "#059669", display: "flex", fontSize: "14px", fontWeight: 600, gap: "10px", padding: "12px 20px" }}>
          {toast.msg}
        </div>
      </div>

      {confirmDialog.isOpen && (
        <div style={{ alignItems: "center", background: "rgba(0,0,0,0.6)", display: "flex", inset: 0, justifyContent: "center", position: "fixed", zIndex: 99999 }}>
          <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
            <h3 style={{ color: "#f1f5f9", margin: "0 0 12px 0" }}>{confirmDialog.title}</h3>
            <p style={{ color: "#cbd5e1", fontSize: "14px", margin: "0 0 24px 0" }}>{confirmDialog.message}</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <Btn onClick={() => setConfirmDialog({...confirmDialog, isOpen: false})} variant="secondary">Cancel</Btn>
              <Btn onClick={() => { confirmDialog.onConfirm(); setConfirmDialog({...confirmDialog, isOpen: false}); }} variant="danger">Confirm</Btn>
            </div>
          </div>
        </div>
      )}

      <div className="no-print">
        <TopBar subtitle="Unified Catalog, Offerings, Mappings, and Curriculum" title="Course Management" />

        <div style={{ background: "#0f172a", borderBottom: "1px solid #334155", display: "flex", gap: "8px", padding: "10px 16px" }}>
          <Btn onClick={() => setMainTab("catalog")} variant={mainTab === "catalog" ? "primary" : "ghost"}>📚 Catalog</Btn>
          <Btn onClick={() => { setMainTab("offerings"); setSelSectionsForDelete([]); }} variant={mainTab === "offerings" ? "primary" : "ghost"}>📅 Offerings</Btn>
          <Btn onClick={() => { setMainTab("mappings"); setSelMappingsForDelete([]); }} variant={mainTab === "mappings" ? "primary" : "ghost"}>🔗 Program Mappings</Btn>
          <Btn onClick={() => setMainTab("curriculum")} variant={mainTab === "curriculum" ? "primary" : "ghost"}>📜 Curriculum</Btn>
        </div>

        <div style={{ alignItems: "center", background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", flexWrap: "wrap", gap: "10px", padding: "10px 16px" }}>
          
          {mainTab === "catalog" && (
            <>
              <Btn onClick={() => { setLevel("codes"); setSelCode(null); setSelCourse(null); setSelSection(null); setSelCodesForDelete([]); }} size="sm" variant={level === "codes" ? "primary" : "secondary"}>Codes</Btn>
              {selCode && <Btn onClick={() => drillCode(selCode)} size="sm" variant={level === "course" ? "primary" : "secondary"}>{selCode}</Btn>}
              {selCourse && level === "section" && <Btn onClick={() => drillSections(selCourse)} size="sm" variant="primary">{selCourse.code}</Btn>}
            </>
          )}

          {(mainTab === "catalog" || mainTab === "offerings" || mainTab === "mappings") && (
            <div style={{ alignItems: "center", background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", display: "flex", overflow: "hidden" }}>
              {mainTab === "catalog" && level === "codes" && <Input onChange={(e) => setCodeSearch(e.target.value)} onKeyDown={handleMainSearchKeyDown} placeholder="Search Code Prefix..." style={{ background: "transparent", border: "none", boxShadow: "none", width: "180px" }} value={codeSearch} />}
              {mainTab === "catalog" && level === "course" && <Input onChange={(e) => setCourseSearch(e.target.value)} onKeyDown={handleMainSearchKeyDown} placeholder="Search Course Name..." style={{ background: "transparent", border: "none", boxShadow: "none", width: "200px" }} value={courseSearch} />}
              {mainTab === "catalog" && level === "section" && <Input onChange={(e) => setSectionSearch(e.target.value)} onKeyDown={handleMainSearchKeyDown} placeholder="Search Section Code..." style={{ background: "transparent", border: "none", boxShadow: "none", width: "180px" }} value={sectionSearch} />}
              {mainTab === "offerings" && <Input onChange={(e) => setOfferingSearch(e.target.value)} onKeyDown={handleMainSearchKeyDown} placeholder="Search Course Code..." style={{ background: "transparent", border: "none", boxShadow: "none", width: "200px" }} value={offeringSearch} />}
              {mainTab === "mappings" && <Input onChange={(e) => setMappingSearch(e.target.value)} onKeyDown={handleMainSearchKeyDown} placeholder="Search Course Name..." style={{ background: "transparent", border: "none", boxShadow: "none", width: "200px" }} value={mappingSearch} />}

              <button onClick={() => setShowFilterModal(true)} style={{ background: "#1e293b", border: "none", borderLeft: "1px solid #334155", color: "#94a3b8", cursor: "pointer", padding: "8px 12px" }}>
                ⚙️ Filters
              </button>
            </div>
          )}

          {mainTab === "curriculum" && (
            <>
              <Sel onChange={(e) => setSelCurriculumProg(e.target.value)} style={{ width: 200 }} value={selCurriculumProg}>
                <option value="">— Select Program —</option>
                {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.code} — {p.name}</option>)}
              </Sel>
              <Sel onChange={(e) => setSelCurriculumSy(e.target.value)} style={{ width: 160 }} value={selCurriculumSy}>
                <option value="">— Effective SY —</option>
                {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}</option>)}
              </Sel>
              {selCurriculumProg && <Btn onClick={() => window.print()} size="sm" variant="ghost">Print</Btn>}
            </>
          )}

          <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "8px", marginLeft: "auto" }}>
            <input accept=".csv" onChange={handleCSVImport} ref={fileInputRef} style={{ display: "none" }} type="file" />

            {mainTab === "offerings" && <Btn onClick={() => setShowManualEnrollModal(true)} size="sm" variant="success">Manual Multi-Enroll</Btn>}
            {mainTab === "offerings" && <Btn onClick={() => { setImportType("global_enrollments"); fileInputRef.current?.click(); }} size="sm" variant="secondary">Global Enroll (CSV)</Btn>}
            {mainTab === "offerings" && <Btn onClick={() => toggleTermLock()} size="sm" variant={isTermLocked ? "primary" : "secondary"}>{isTermLocked ? "Unlock Grades" : "Lock Grades"}</Btn>}
            {mainTab === "offerings" && <Btn onClick={() => downloadCSVTemplate("sections")} size="sm" variant="ghost">Template</Btn>}
            {mainTab === "offerings" && <Btn onClick={() => { setImportType("sections"); fileInputRef.current?.click(); }} size="sm" variant="secondary">Import Sections</Btn>}
            {mainTab === "offerings" && <Btn onClick={() => downloadExportCSV(offerings, "Offerings_Export.csv")} size="sm" variant="ghost">Export CSV</Btn>}
            {mainTab === "offerings" && <Btn onClick={() => setShowRolloverModal(true)} size="sm" variant="secondary">Term Rollover</Btn>}
            
            <Btn onClick={() => setShowRoomModal(true)} size="sm" variant="ghost">Manage Rooms</Btn>
            <Btn onClick={() => setShowScheduleModal(true)} size="sm" variant="ghost">Manage Schedules</Btn>

            {mainTab === "catalog" && level === "codes" && (
              <>
                <Btn onClick={() => downloadExportCSV(allCourses, "Courses_Export.csv")} size="sm" variant="ghost">Export CSV</Btn>
                <Btn onClick={() => { setImportType("courses"); fileInputRef.current?.click(); }} size="sm" variant="secondary">Import Courses</Btn>
                <Btn onClick={() => setShowCreateCodeModal(true)} size="sm">+ Create Code</Btn>
                {selCodesForDelete.length > 0 && <Btn onClick={deleteSelectedCodes} size="sm" variant="danger">Delete Selected ({selCodesForDelete.length})</Btn>}
              </>
            )}

            {mainTab === "catalog" && level === "course" && (
              <>
                <Btn onClick={() => downloadExportCSV(courses, "Courses_Filtered_Export.csv")} size="sm" variant="ghost">Export CSV</Btn>
                <Btn onClick={() => { setCourseForm({ code: selCode ? `${selCode} ` : "", labUnits: 1, lecUnits: 2, name: "", prereqs: [], types: [], units: 3 }); setShowCreateCourseModal(true); }} size="sm">+ Create Course</Btn>
                {selCoursesForDelete.length > 0 && <Btn onClick={deleteSelectedCourses} size="sm" variant="danger">Delete Selected ({selCoursesForDelete.length})</Btn>}
              </>
            )}

            {mainTab === "catalog" && level === "section" && (
              <>
                <Btn onClick={() => downloadExportCSV(sections, "Sections_Export.csv")} size="sm" variant="ghost">Export CSV</Btn>
                <Btn onClick={() => { setImportType("sections"); fileInputRef.current?.click(); }} size="sm" variant="secondary">Import Sections</Btn>
                <Btn onClick={openPrereqModal} size="sm" variant="ghost">Manage Prerequisites</Btn>
                <Btn onClick={() => { setCourseForm({ code: selCourse.code, labUnits: selCourse.lab_hours || 0, lecUnits: selCourse.lec_hours || 0, name: selCourse.name, prereqs: [], types: [], units: selCourse.units }); setShowEditCourseModal(true); }} size="sm" variant="ghost">Edit Course</Btn>
                <Btn onClick={openCreateSectionModal} size="sm">+ Create Section</Btn>
                {selSection && <Btn onClick={openAuditModal} size="sm" variant="ghost">Audit Materials</Btn>}
                {selSection && <Btn onClick={openEditSectionModal} size="sm" variant="secondary">Edit Section Setup</Btn>}
                {selSectionsForDelete.length > 0 && <Btn onClick={deleteSelectedSections} size="sm" variant="danger">Delete Selected ({selSectionsForDelete.length})</Btn>}
              </>
            )}

            {mainTab === "mappings" && (
              <>
                <Btn onClick={() => downloadExportCSV(mappings, "Mappings_Export.csv")} size="sm" variant="ghost">Export CSV</Btn>
                <Btn onClick={() => { setImportType("mappings"); fileInputRef.current?.click(); }} size="sm" variant="secondary">Import Mappings</Btn>
                <Btn onClick={() => setShowMappingModal(true)} size="sm">+ Add Mapping</Btn>
                {selMappingsForDelete.length > 0 && <Btn onClick={deleteSelectedMappings} size="sm" variant="danger">Delete Selected ({selMappingsForDelete.length})</Btn>}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="no-print" style={{ display: mainTab === "curriculum" ? "none" : "flex", flex: 1, overflow: "hidden" }}>
        
        {mainTab === "catalog" && level === "codes" && (
          <div style={{ background: "#0f172a", flex: 1, padding: "20px" }}>
            {loading ? <div style={{ color: "#475569", paddingTop: 40, textAlign: "center" }}>Loading...</div> : <LMSGrid columns={codeCols} height="100%" onRowClick={(row) => drillCode(row.prefix)} onSortChange={(f, d) => setCodeSort({ field: f, dir: d as "asc"|"desc" })} rowData={codeGroups} sortDir={codeSort.dir} sortField={codeSort.field} />}
          </div>
        )}

        {mainTab === "catalog" && level === "course" && (
          <div style={{ background: "#0f172a", flex: 1, padding: "20px" }}>
            <LMSGrid columns={courseCols} height="100%" onRowClick={(row) => toggleSelection(row._uuid, selCoursesForDelete, setSelCoursesForDelete)} onSortChange={(f, d) => setCourseSort({ field: f, dir: d as "asc"|"desc" })} rowData={courses} sortDir={courseSort.dir} sortField={courseSort.field} />
          </div>
        )}

        {mainTab === "catalog" && level === "section" && (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <div style={{ background: "#1e293b", borderRight: "1px solid #334155", display: "flex", flexDirection: "column", padding: "16px", width: "350px" }}>
              <div style={{ color: "#f1f5f9", fontSize: "14px", fontWeight: 800, marginBottom: "16px" }}>Enrollment Panel</div>
              <Input onChange={(e) => setStudentSearch(e.target.value)} placeholder="Filter eligible students..." style={{ marginBottom: "12px" }} value={studentSearch} />
              
              <div style={{ alignItems: "center", borderBottom: "1px solid #334155", display: "flex", gap: "8px", marginBottom: "8px", paddingBottom: "8px" }}>
                <input checked={eligibleStudents.length > 0 && selStudents.length === eligibleStudents.length} onChange={(e) => setSelStudents(e.target.checked ? eligibleStudents.map(s=>String(s._uuid)) : [])} type="checkbox" />
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>Select Eligible Students</span>
              </div>

              <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "8px", marginBottom: "16px", overflowY: "auto" }}>
                {!selSection ? (
                  <div style={{ color: "#64748b", fontSize: "12px", textAlign: "center", marginTop: "20px" }}>Select a section to load eligible students.</div>
                ) : !selSection.program_id ? (
                  <div style={{ color: "#fbbf24", fontSize: "12px", textAlign: "center", marginTop: "20px" }}>Assign a Program to this section to auto-load the eligible student block.</div>
                ) : eligibleStudents.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: "12px", textAlign: "center", marginTop: "20px" }}>No eligible students found for this block.</div>
                ) : (
                  eligibleStudents.map((s) => (
                    <label key={s._uuid} style={{ alignItems: "center", color: "#e2e8f0", cursor: "pointer", display: "flex", fontSize: "12px", gap: "8px" }}>
                      <input checked={selStudents.includes(s._uuid)} onChange={(e) => setSelStudents((prev) => e.target.checked ? [...prev, s._uuid] : prev.filter((id) => id !== s._uuid))} type="checkbox" />
                      {s.displayId} - {s.fullName}
                    </label>
                  ))
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input accept=".csv" onChange={handleStudentCSVImport} ref={studentCsvRef} style={{ display: "none" }} type="file" />
                <Btn disabled={!selSection} onClick={() => studentCsvRef.current?.click()} variant="secondary" style={{ flex: 1 }}>Bulk Enroll (CSV)</Btn>
                <Btn disabled={isLoading || selStudents.length === 0 || !selSection} onClick={enrollStudents} style={{ flex: 1 }}>{isLoading ? "Wait..." : `Enroll ${selStudents.length}`}</Btn>
              </div>
              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <a onClick={() => downloadCSVTemplate("students_to_section")} style={{ color: "#6366f1", cursor: "pointer", fontSize: "11px", textDecoration: "underline" }}>Download CSV Template</a>
              </div>
            </div>

            <div style={{ background: "#0f172a", display: "flex", flex: 1, flexDirection: "column" }}>
              <div style={{ borderBottom: "1px solid #334155", flex: "0 0 40%", padding: "16px" }}>
                <LMSGrid 
                  columns={sectionCols} 
                  height="100%" 
                  onRowClick={(row) => {
                    if (selSection?.section_id === row.section_id) {
                      setSelSection(null);
                      setSelStudents([]);
                      setEnrolledSearch("");
                      setEnrolledFilter("");
                    } else {
                      setSelSection(row);
                      setSelStudents([]);
                      setEnrolledSearch("");
                      setEnrolledFilter("");
                    }
                  }} 
                  onSortChange={(f, d) => setSectionSort({ field: f, dir: d as "asc"|"desc" })} 
                  rowData={sections} 
                  selectedId={selSection?.section_id} 
                  sortDir={sectionSort.dir} 
                  sortField={sectionSort.field} 
                />
              </div>
              <div style={{ background: "#0a0f1a", display: "flex", flex: 1, flexDirection: "column", padding: "16px" }}>
                {selSection ? (
                  <>
                    <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                      <Input onChange={(e) => setEnrolledSearch(e.target.value)} placeholder="Search ID or Name..." style={{ width: 200 }} value={enrolledSearch} />
                      <Sel onChange={(e) => setEnrolledFilter(e.target.value)} style={{ width: 150 }} value={enrolledFilter}>
                        <option value="">All Statuses</option>
                        <option value="Enrolled">Enrolled</option>
                        <option value="Waitlisted">Waitlisted</option>
                      </Sel>
                      {selEnrolledForDelete.length > 0 && <Btn onClick={handleBulkUnenroll} size="sm" variant="danger">Remove Selected ({selEnrolledForDelete.length})</Btn>}
                      <Btn onClick={() => downloadExportCSV(catalogEnrolledRows, `Roster_${selSection.section_label}.csv`)} size="sm" style={{ marginLeft: "auto" }} variant="ghost">Export CSV</Btn>
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <LMSGrid columns={enrolledCols} height="100%" rowData={catalogEnrolledRows} />
                    </div>
                  </>
                ) : <div style={{ alignItems: "center", color: "#475569", display: "flex", fontSize: "14px", height: "100%", justifyContent: "center" }}>Select a section above to view and manage its roster.</div>}
              </div>
            </div>
          </div>
        )}

        {mainTab === "offerings" && (
           <div style={{ background: "#0f172a", display: "flex", flexDirection: "column", flex: 1, padding: "20px" }}>
              <div style={{ flex: 1, overflow: "hidden" }}>
                 {loading ? <div style={{ color: "#475569", paddingTop: 40, textAlign: "center" }}>Loading...</div> : <LMSGrid columns={offeringsCols} height="100%" onRowClick={(row) => toggleSelection(row.section_id, selSectionsForDelete, setSelSectionsForDelete)} onSortChange={(f, d) => setOffSort({ field: f, dir: d as "asc"|"desc" })} rowData={offerings} sortDir={offSort.dir} sortField={offSort.field} />}
              </div>
              <div style={{ alignItems: "center", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "space-between", marginTop: "12px", paddingTop: "12px" }}>
                 <div style={{ color: "#64748b", fontSize: "12px" }}>Showing {offPage * offPageSize + 1} to {Math.min((offPage + 1) * offPageSize, offeringCount)} of {offeringCount} sections</div>
                 <div style={{ display: "flex", gap: "8px" }}>
                    <Btn disabled={offPage === 0} onClick={() => setOffPage(p => p - 1)} size="sm" variant="secondary">← Previous</Btn>
                    <Btn disabled={(offPage + 1) * offPageSize >= offeringCount} onClick={() => setOffPage(p => p + 1)} size="sm" variant="secondary">Next →</Btn>
                 </div>
              </div>
           </div>
        )}

        {mainTab === "mappings" && (
           <div style={{ background: "#0f172a", flex: 1, overflow: "hidden", padding: "20px" }}>
             {loading ? <div style={{ color: "#475569", paddingTop: 40, textAlign: "center" }}>Loading...</div> : <LMSGrid columns={mappingsCols} height="100%" onRowClick={(row) => toggleSelection(row.id, selMappingsForDelete, setSelMappingsForDelete)} onSortChange={(f, d) => setMapSort({ field: f, dir: d as "asc"|"desc" })} rowData={mappings} sortDir={mapSort.dir} sortField={mapSort.field} />}
           </div>
        )}
      </div>

      <div className={mainTab === "curriculum" ? "print-area" : "no-print"} style={{ background: "#0f172a", display: mainTab === "curriculum" ? "block" : "none", flex: 1, overflowY: "auto", padding: "20px" }}>
        {!selCurriculumProg ? (
          <div style={{ color: "#475569", fontSize: 14, marginTop: 60, textAlign: "center" }}>Select a program above to view its curriculum.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", margin: "0 auto", maxWidth: 1000 }}>
            <div style={{ marginBottom: "20px", textAlign: "center" }}>
              <h2 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>{programs.find(p => p.program_id === Number(selCurriculumProg))?.name}</h2>
              <div style={{ color: "#94a3b8", fontSize: "14px" }}>Effective School Year: {schoolYears.find(s => s.sy_id === selCurriculumSy)?.label || "All Mappings"}</div>
            </div>
            
            {YEAR_LEVELS.map(year => {
              if (!groupedCurriculum[year]) return null;
              
              const s1 = groupedCurriculum[year]["1st Semester"] || [];
              const s2 = groupedCurriculum[year]["2nd Semester"] || [];
              const summer = groupedCurriculum[year]["Summer"] || [];

              const s1Units = s1.reduce((acc: number, m: any) => acc + (m.units || 0), 0);
              const s2Units = s2.reduce((acc: number, m: any) => acc + (m.units || 0), 0);
              const sumUnits = summer.reduce((acc: number, m: any) => acc + (m.units || 0), 0);

              return (
                <div key={year} style={{ borderBottom: "2px dashed #475569", paddingBottom: "24px" }}>
                  <div style={{ color: "#a5b4fc", fontSize: "16px", fontWeight: 800, marginBottom: "12px", textAlign: "center", textTransform: "uppercase" }}>{year}</div>
                  
                  <div style={{ display: "flex", gap: "20px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>1ST SEMESTER</div>
                      <table className="au-table">
                        <thead>
                          <tr><th>Code</th><th>Description</th><th>Units</th><th>Pre-req.</th></tr>
                        </thead>
                        <tbody>
                          {s1.map((m: any) => (
                            <tr key={m.id}>
                              <td>{m.course_code}</td>
                              <td>{m.course_name}</td>
                              <td>{m.units || 0}</td>
                              <td>{(globalPrereqs[m.course_id] || []).join(", ") || "None"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2} style={{ fontWeight: "bold", textAlign: "right" }}>Total Units</td>
                            <td colSpan={2} style={{ fontWeight: "bold", textAlign: "left" }}>{s1Units}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>2ND SEMESTER</div>
                      <table className="au-table">
                        <thead>
                          <tr><th>Code</th><th>Description</th><th>Units</th><th>Pre-req.</th></tr>
                        </thead>
                        <tbody>
                          {s2.map((m: any) => (
                            <tr key={m.id}>
                              <td>{m.course_code}</td>
                              <td>{m.course_name}</td>
                              <td>{m.units || 0}</td>
                              <td>{(globalPrereqs[m.course_id] || []).join(", ") || "None"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2} style={{ fontWeight: "bold", textAlign: "right" }}>Total Units</td>
                            <td colSpan={2} style={{ fontWeight: "bold", textAlign: "left" }}>{s2Units}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {summer.length > 0 && (
                    <div style={{ margin: "20px auto 0", maxWidth: "50%" }}>
                      <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>SUMMER</div>
                      <table className="au-table">
                        <thead>
                          <tr><th>Code</th><th>Description</th><th>Units</th><th>Pre-req.</th></tr>
                        </thead>
                        <tbody>
                          {summer.map((m: any) => (
                            <tr key={m.id}>
                              <td>{m.course_code}</td>
                              <td>{m.course_name}</td>
                              <td>{m.units || 0}</td>
                              <td>{(globalPrereqs[m.course_id] || []).join(", ") || "None"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2} style={{ fontWeight: "bold", textAlign: "right" }}>Total Units</td>
                            <td colSpan={2} style={{ fontWeight: "bold", textAlign: "left" }}>{sumUnits}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9", fontSize: "16px", fontWeight: 800, padding: "16px", textAlign: "right" }}>
              Curriculum Grand Total: {
                Object.values(groupedCurriculum).reduce((accYear: number, year: any) => 
                  accYear + Object.values(year).reduce((accSem: number, sem: any) => 
                    accSem + sem.reduce((accCourse: number, m: any) => accCourse + (m.units || 0), 0)
                  , 0)
                , 0)
              } Units
            </div>
          </div>
        )}
      </div>

      <div className="no-print">
        {conflictModal.show && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.7)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", display: "flex", flexDirection: "column", maxHeight: "80vh", padding: "24px", width: "600px" }}>
              <h3 style={{ color: "#f87171", margin: "0 0 8px 0" }}>Schedule Conflicts Detected</h3>
              <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "16px" }}>
                The following students are already booked for a class at this time. Select any students below to <strong>Force Enroll</strong> them anyway.
              </p>
              
              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", flex: 1, overflowY: "auto", padding: "16px" }}>
                 <div style={{ borderBottom: "1px solid #334155", display: "flex", marginBottom: "8px", paddingBottom: "8px" }}>
                    <input 
                      checked={conflictModal.forceIds.length === conflictModal.conflicted.length && conflictModal.conflicted.length > 0}
                      onChange={(e) => setConflictModal(prev => ({ ...prev, forceIds: e.target.checked ? prev.conflicted.map(c => c.id) : [] }))} 
                      type="checkbox"
                    />
                    <span style={{ color: "#f1f5f9", fontSize: "12px", fontWeight: 700, marginLeft: "12px" }}>Select All Conflicted</span>
                 </div>
                 {conflictModal.conflicted.map(c => (
                   <label key={c.id} style={{ alignItems: "center", borderBottom: "1px solid #1e293b", cursor: "pointer", display: "flex", gap: "12px", padding: "8px 0" }}>
                     <input 
                       checked={conflictModal.forceIds.includes(c.id)}
                       onChange={(e) => setConflictModal(prev => ({
                         ...prev,
                         forceIds: e.target.checked ? [...prev.forceIds, c.id] : prev.forceIds.filter(id => id !== c.id)
                       }))}
                       type="checkbox"
                     />
                     <div style={{ color: "#e2e8f0", fontSize: "13px" }}>
                       <strong>{c.display}</strong> — {c.name}
                     </div>
                   </label>
                 ))}
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
                <Btn onClick={() => setConflictModal({ show: false, validIds: [], conflicted: [], forceIds: [], courseId: "", sectionId: "" })} variant="secondary">Cancel Entire Batch</Btn>
                <Btn onClick={() => processEnrollmentBatch(conflictModal.validIds, conflictModal.forceIds, conflictModal.courseId, conflictModal.sectionId)}>
                  Enroll {conflictModal.validIds.length} Valid + {conflictModal.forceIds.length} Forced
                </Btn>
              </div>
            </div>
          </div>
        )}

        {showFilterModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "450px" }}>
              <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>Table Filters</h3>
              
              {(mainTab === "offerings" || (mainTab === "catalog" && level === "section")) && (
                <>
                  <FF label="School Year"><Sel onChange={(e) => setOffFilterSy(e.target.value)} style={{ marginBottom: "12px", width: "100%" }} value={offFilterSy}>
                    {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}{s.is_active ? " ★ Active" : ""}{s.is_locked ? " 🔒" : ""}</option>)}
                  </Sel></FF>
                  <FF label="Semester"><Sel onChange={(e) => setOffFilterSemester(e.target.value)} style={{ marginBottom: "12px", width: "100%" }} value={offFilterSemester}>
                    {SEMESTERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </Sel></FF>
                </>
              )}

              {mainTab === "offerings" && (
                <FF label="Course"><Sel onChange={(e) => setOffFilterCourse(e.target.value)} style={{ marginBottom: "12px", width: "100%" }} value={offFilterCourse}>
                  <option value="">All Courses</option>
                  {allCourses.map(c => <option key={c._uuid} value={c._uuid}>{c.code} — {c.name}</option>)}
                </Sel></FF>
              )}

              {mainTab === "mappings" && (
                <>
                  <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr", marginBottom: "12px" }}>
                    <FF label="Year Level">
                      <Sel onChange={(e) => setMapFilterYear(e.target.value)} style={{ width: "100%" }} value={mapFilterYear}>
                        <option value="">All Years</option>
                        {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                      </Sel>
                    </FF>
                    <FF label="Semester">
                      <Sel onChange={(e) => setMapFilterSemester(e.target.value)} style={{ width: "100%" }} value={mapFilterSemester}>
                        <option value="">All Semesters</option>
                        {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                      </Sel>
                    </FF>
                  </div>
                  <FF label="Course"><Sel onChange={(e) => setMapFilterCourse(e.target.value)} style={{ marginBottom: "12px", width: "100%" }} value={mapFilterCourse}>
                    <option value="">All Courses</option>
                    {allCourses.map(c => <option key={c._uuid} value={c._uuid}>{c.code}</option>)}
                  </Sel></FF>
                  <FF label="Program"><Sel onChange={(e) => setMapFilterProg(e.target.value)} style={{ marginBottom: "12px", width: "100%" }} value={mapFilterProg}>
                    <option value="">All Programs</option>
                    {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.code}</option>)}
                  </Sel></FF>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <Btn onClick={() => setShowFilterModal(false)} style={{ marginRight: "8px" }} variant="secondary">Cancel</Btn>
                <Btn onClick={handleApplyFilters}>Apply Filters</Btn>
              </div>
            </div>
          </div>
        )}

        {showManualEnrollModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", display: "flex", flexDirection: "column", maxHeight: "90vh", padding: "24px", width: "700px" }}>
              <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ color: "#f1f5f9", margin: 0 }}>Manual Student Multi-Enrollment</h3>
                <Btn onClick={() => { setImportType("global_enrollments"); fileInputRef.current?.click(); }} size="sm" variant="secondary">Bulk Global Matrix CSV</Btn>
              </div>
              
              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", marginBottom: "16px", padding: "16px" }}>
                <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>STEP 1: Select Student</div>
                <SearchableSelect
                  emptyMessage="No students available."
                  onChange={setManualEnrollStudentId}
                  options={studentOptions}
                  placeholder="— Search and select a student —"
                  value={manualEnrollStudentId}
                />
              </div>

              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", display: "flex", flex: 1, flexDirection: "column", minHeight: "300px", padding: "16px" }}>
                <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>STEP 2: Select Sections ({offFilterSy ? schoolYears.find(s => s.sy_id === offFilterSy)?.label : ""} - {offFilterSemester})</div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                   {offerings.map(sec => (
                     <label key={sec.section_id} style={{ alignItems: "center", borderBottom: "1px solid #1e293b", cursor: "pointer", display: "flex", gap: "10px", padding: "8px 0" }}>
                        <input checked={manualEnrollSections.includes(sec.section_id)} onChange={(e) => setManualEnrollSections(prev => e.target.checked ? [...prev, sec.section_id] : prev.filter(id => id !== sec.section_id))} type="checkbox" />
                        <div style={{ flex: 1 }}>
                          <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{sec.course_code} - Section {sec.section_label}</div>
                          <div style={{ color: "#64748b", fontSize: "11px" }}>{sec.schedule_label} | {sec.room_name} | {sec.enrolled_count}/{sec.max_capacity === null ? "∞" : sec.max_capacity}</div>
                        </div>
                     </label>
                   ))}
                   {offerings.length === 0 && <div style={{ color: "#64748b", fontSize: "12px", textAlign: "center" }}>No offerings found. Adjust your filters on the main screen.</div>}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
                <Btn onClick={() => { setShowManualEnrollModal(false); setManualEnrollSections([]); }} variant="secondary">Cancel</Btn>
                <Btn disabled={loading || !manualEnrollStudentId || manualEnrollSections.length === 0} onClick={executeManualMultiEnroll}>{loading ? "Processing..." : `Enroll in ${manualEnrollSections.length} Sections`}</Btn>
              </div>
            </div>
          </div>
        )}

        {showOfferingDetailsModal && viewOfferingSection && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", display: "flex", flexDirection: "column", maxHeight: "85vh", padding: "24px", width: "800px" }}>
              <h3 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>Section Details</h3>
              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr", marginBottom: "16px", padding: "12px" }}>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Course:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{viewOfferingSection.course_code} - {viewOfferingSection.course_name}</span></div>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Section:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{viewOfferingSection.section_label}</span></div>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Teacher:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{users.find(u => String(u._uuid) === String(viewOfferingSection.teacher_id))?.fullName || "Unassigned"}</span></div>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Schedule:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{viewOfferingSection.schedule_label}</span></div>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Room:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{viewOfferingSection.room_name}</span></div>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Capacity:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{viewOfferingSection.enrolled_count} / {viewOfferingSection.max_capacity === null ? "∞" : viewOfferingSection.max_capacity}</span></div>
              </div>
              
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <Input onChange={(e) => setEnrolledSearch(e.target.value)} placeholder="Search ID or Name..." style={{ width: 200 }} value={enrolledSearch} />
                <Sel onChange={(e) => setEnrolledFilter(e.target.value)} style={{ width: 150 }} value={enrolledFilter}>
                  <option value="">All Statuses</option>
                  <option value="Enrolled">Enrolled</option>
                  <option value="Waitlisted">Waitlisted</option>
                </Sel>
                <Btn onClick={() => downloadExportCSV(filteredOfferingEnrollments, `Roster_${viewOfferingSection.section_label}.csv`)} size="sm" style={{ marginLeft: "auto" }} variant="ghost">Export CSV</Btn>
              </div>

              <div style={{ background: "#0a0f1a", border: "1px solid #334155", borderRadius: "8px", flex: 1, minHeight: "300px", overflow: "hidden" }}>
                <LMSGrid columns={enrolledCols} height="100%" rowData={filteredOfferingEnrollments} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}><Btn onClick={() => setShowOfferingDetailsModal(false)} variant="secondary">Close</Btn></div>
            </div>
          </div>
        )}

        {showAuditModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "550px" }}>
              <h3 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>Material Audit</h3>
              <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "16px" }}>Viewing files uploaded by the teacher for {selCourse?.code} - Section {selSection?.section_label}.</div>

              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", maxHeight: "300px", overflowY: "auto" }}>
                 {loading ? <div style={{ color: "#64748b", fontSize: "13px", padding: "20px", textAlign: "center" }}>Loading materials...</div> : null}
                 {!loading && auditMaterials.map(m => (
                    <div key={m.material_id} style={{ borderBottom: "1px solid #1e293b", color: "#e2e8f0", display: "flex", fontSize: "13px", justifyContent: "space-between", padding: "12px" }}>
                       <div>
                         <div style={{ fontWeight: 700, marginBottom: "4px" }}>{m.title}</div>
                         <div style={{ color: "#64748b", fontSize: "11px" }}>Type: <span style={{ color: "#a5b4fc" }}>{m.material_type}</span></div>
                       </div>
                       {m.file_url && <a href={m.file_url} rel="noreferrer" style={{ alignSelf: "center", color: "#34d399", fontSize: "12px", fontWeight: 700, textDecoration: "none" }} target="_blank">Open File ↗</a>}
                    </div>
                 ))}
                 {!loading && auditMaterials.length === 0 && <div style={{ color: "#64748b", fontSize: "13px", padding: "20px", textAlign: "center" }}>No materials have been uploaded by the teacher yet.</div>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}><Btn onClick={() => setShowAuditModal(false)} variant="secondary">Close</Btn></div>
            </div>
          </div>
        )}

        {showRoomModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1001 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "500px" }}>
              <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ color: "#f1f5f9", margin: 0 }}>Manage Rooms</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Btn onClick={() => downloadCSVTemplate("rooms")} size="sm" variant="ghost">Template</Btn>
                  <Btn onClick={() => { setImportType("rooms"); fileInputRef.current?.click(); }} size="sm" variant="ghost">Import CSV</Btn>
                  <Btn onClick={() => downloadExportCSV(rooms, "Rooms_Export.csv")} size="sm" variant="ghost">Export CSV</Btn>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                 <Input onChange={(e) => setNewRoomForm({...newRoomForm, name: e.target.value})} placeholder="Room Name (e.g. Rm 201)" style={{ flex: 1 }} value={newRoomForm.name} />
                 <Input onChange={(e) => setNewRoomForm({...newRoomForm, capacity: Number(e.target.value)})} placeholder="Cap" style={{ width: "70px" }} type="number" value={newRoomForm.capacity} />
                 <Btn onClick={handleCreateRoom}>Add Room</Btn>
              </div>
              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", maxHeight: "300px", overflowY: "auto" }}>
                 {rooms.map(r => (
                    <div key={r.room_id} style={{ borderBottom: "1px solid #1e293b", color: "#e2e8f0", display: "flex", fontSize: "13px", justifyContent: "space-between", padding: "10px" }}>
                       <span>{r.room_name} (Max {r.capacity})</span>
                       <button onClick={() => handleDeleteRoom(r.room_id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button>
                    </div>
                 ))}
                 {rooms.length === 0 && <div style={{ color: "#64748b", fontSize: "13px", padding: "20px", textAlign: "center" }}>No rooms added yet.</div>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}><Btn onClick={() => setShowRoomModal(false)} variant="secondary">Close</Btn></div>
            </div>
          </div>
        )}

        {showScheduleModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "500px" }}>
              <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>Manage Schedules</h3>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                 {DAYS_OF_WEEK.map(d => (
                   <label key={d.value} style={{ alignItems: "center", background: newSchedDays.includes(d.value) ? "#4f46e5" : "#0f172a", border: "1px solid #334155", borderRadius: "4px", color: "#f1f5f9", cursor: "pointer", display: "flex", fontSize: "12px", justifyContent: "center", padding: "6px 8px", width: "35px" }}>
                     <input checked={newSchedDays.includes(d.value)} onChange={(e) => setNewSchedDays(prev => e.target.checked ? [...prev, d.value] : prev.filter(x => x !== d.value))} style={{ display: "none" }} type="checkbox" />
                     {d.label}
                   </label>
                 ))}
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                 <div style={{ flex: 1 }}>
                   <SearchableSelect
                      emptyMessage="No time slots"
                      onChange={setNewSchedStart}
                      options={TIME_SLOTS.map(t => ({ label: t, value: t }))}
                      placeholder="Start Time"
                      value={newSchedStart}
                   />
                 </div>
                 <div style={{ alignSelf: "center", color: "#94a3b8" }}>to</div>
                 <div style={{ flex: 1 }}>
                   <SearchableSelect
                      emptyMessage="No time slots"
                      onChange={setNewSchedEnd}
                      options={TIME_SLOTS.map(t => ({ label: t, value: t }))}
                      placeholder="End Time"
                      value={newSchedEnd}
                   />
                 </div>
                 <Btn onClick={handleCreateSchedule}>Save</Btn>
              </div>
              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", maxHeight: "300px", overflowY: "auto" }}>
                 {schedules.map(s => (
                    <div key={s.id} style={{ borderBottom: "1px solid #1e293b", color: "#e2e8f0", display: "flex", fontSize: "13px", justifyContent: "space-between", padding: "10px" }}>
                       <span>{s.schedule_label}</span>
                       <button onClick={() => handleDeleteSchedule(s.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button>
                    </div>
                 ))}
                 {schedules.length === 0 && <div style={{ color: "#64748b", fontSize: "13px", padding: "20px", textAlign: "center" }}>No schedules added yet.</div>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}><Btn onClick={() => setShowScheduleModal(false)} variant="secondary">Close</Btn></div>
            </div>
          </div>
        )}

        {showCreateCodeModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
              <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ color: "#f1f5f9", margin: 0 }}>Create Code Group</h3>
                <Btn onClick={() => downloadCSVTemplate("courses")} size="sm" variant="ghost">Download Template</Btn>
              </div>
              <Input onChange={(e) => setNewCodePrefix(e.target.value.toUpperCase())} placeholder="Enter prefix (e.g. CS)" style={{ marginBottom: "16px" }} value={newCodePrefix} />
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><Btn onClick={() => setShowCreateCodeModal(false)} variant="secondary">Cancel</Btn><Btn onClick={() => { drillCode(newCodePrefix); setShowCreateCodeModal(false); setNewCodePrefix(""); }}>Create</Btn></div>
            </div>
          </div>
        )}

        {showCreateCourseModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "450px" }}>
              <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>Create Course</h3>
              <Input onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="Course Code (e.g. CS101)" style={{ marginBottom: "12px" }} value={courseForm.code} />
              <Input onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="Course Name" style={{ marginBottom: "12px" }} value={courseForm.name} />
              
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <label style={{ alignItems: "center", color: "#f1f5f9", cursor: "pointer", display: "flex", fontSize: "13px", gap: "6px" }}>
                  <input checked={courseForm.types.includes("LEC")} onChange={e => setCourseForm({...courseForm, types: e.target.checked ? [...courseForm.types, "LEC"] : courseForm.types.filter(t => t !== "LEC")})} type="checkbox" />
                  Course has LEC
                </label>
                <label style={{ alignItems: "center", color: "#f1f5f9", cursor: "pointer", display: "flex", fontSize: "13px", gap: "6px" }}>
                  <input checked={courseForm.types.includes("LAB")} onChange={e => setCourseForm({...courseForm, types: e.target.checked ? [...courseForm.types, "LAB"] : courseForm.types.filter(t => t !== "LAB")})} type="checkbox" />
                  Course has LAB
                </label>
              </div>

              {courseForm.types.length === 0 ? (
                <div style={{ marginBottom: "16px" }}>
                  <FF label="Total Units"><Input onChange={(e) => setCourseForm({ ...courseForm, units: Number(e.target.value) })} placeholder="Units" type="number" value={courseForm.units} /></FF>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr", marginBottom: "16px" }}>
                  {courseForm.types.includes("LEC") && <FF label="Lec Units"><Input onChange={(e) => setCourseForm({ ...courseForm, lecUnits: Number(e.target.value) })} placeholder="Lec Units" type="number" value={courseForm.lecUnits} /></FF>}
                  {courseForm.types.includes("LAB") && <FF label="Lab Units"><Input onChange={(e) => setCourseForm({ ...courseForm, labUnits: Number(e.target.value) })} placeholder="Lab Units" type="number" value={courseForm.labUnits} /></FF>}
                </div>
              )}
              
              <div style={{ borderTop: "1px solid #334155", marginBottom: "16px", paddingTop: "12px" }}>
                 <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Prerequisites</div>
                 <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                   <Sel onChange={(e) => { if(e.target.value && !courseForm.prereqs.includes(e.target.value)) setCourseForm({...courseForm, prereqs: [...courseForm.prereqs, e.target.value]}) }} style={{ flex: 1 }} value="">
                      <option value="">— Select to Add —</option>
                      {allCourses.map(c => <option key={c._uuid} value={c._uuid}>{c.code}</option>)}
                   </Sel>
                 </div>
                 <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                   {courseForm.prereqs.map(pId => (
                     <span key={pId} style={{ background: "rgba(99,102,241,.12)", borderRadius: 4, color: "#a5b4fc", display: "flex", fontSize: 11, gap: "6px", padding: "4px 8px" }}>
                       {allCourses.find(c => c._uuid === pId)?.code}
                       <span onClick={() => setCourseForm({...courseForm, prereqs: courseForm.prereqs.filter(id => id !== pId)})} style={{ color: "#f87171", cursor: "pointer" }}>✕</span>
                     </span>
                   ))}
                   {courseForm.prereqs.length === 0 && <span style={{ color: "#64748b", fontSize: "11px" }}>None added.</span>}
                 </div>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><Btn onClick={() => setShowCreateCourseModal(false)} variant="secondary">Cancel</Btn><Btn onClick={handleCreateCourse}>Save Course(s)</Btn></div>
            </div>
          </div>
        )}

        {showEditCourseModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
              <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>Edit Course</h3>
              <Input onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="Course Code" style={{ marginBottom: "12px" }} value={courseForm.code} />
              <Input onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="Course Name" style={{ marginBottom: "12px" }} value={courseForm.name} />
              <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr", marginBottom: "16px" }}>
                <FF label="Total Units"><Input onChange={(e) => setCourseForm({ ...courseForm, units: Number(e.target.value) })} placeholder="Units" type="number" value={courseForm.units} /></FF>
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><Btn onClick={() => setShowEditCourseModal(false)} variant="secondary">Cancel</Btn><Btn onClick={handleEditCourse}>Update Course</Btn></div>
            </div>
          </div>
        )}

        {showPrereqModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "500px" }}>
              <h3 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>Course Prerequisites</h3>
              <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "16px" }}>Students must pass the following courses to enroll in {selCourse?.code}.</div>
              
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                 <Sel onChange={(e) => setPrereqFormCourseId(e.target.value)} style={{ flex: 1 }} value={prereqFormCourseId}>
                    <option value="">— Select Course to Add —</option>
                    {allCourses.filter(c => c._uuid !== selCourse?._uuid).map(c => <option key={c._uuid} value={c._uuid}>{c.code} — {c.name}</option>)}
                 </Sel>
                 <Btn onClick={handleAddPrerequisite}>Add</Btn>
              </div>

              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", maxHeight: "300px", overflowY: "auto" }}>
                 {prerequisites.map(p => (
                    <div key={p.id} style={{ borderBottom: "1px solid #1e293b", color: "#e2e8f0", display: "flex", fontSize: "13px", justifyContent: "space-between", padding: "10px" }}>
                       <span>{p.courses?.course_code} - {p.courses?.course_name}</span>
                       <button onClick={() => handleRemovePrerequisite(p.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button>
                    </div>
                 ))}
                 {prerequisites.length === 0 && <div style={{ color: "#64748b", fontSize: "13px", padding: "20px", textAlign: "center" }}>No prerequisites defined.</div>}
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}><Btn onClick={() => setShowPrereqModal(false)} variant="secondary">Close</Btn></div>
            </div>
          </div>
        )}

        {showRolloverModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "450px" }}>
              <h3 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>Term Rollover Utility</h3>
              <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "16px", lineHeight: "1.4" }}>
                This tool duplicates all active Course Sections from a past term into an upcoming term. Student enrollments are not copied.
              </div>

              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", marginBottom: "16px", padding: "12px" }}>
                <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Source (Copy From)</div>
                <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr" }}>
                  <FF label="SY"><Sel onChange={(e) => setRolloverForm({...rolloverForm, sourceSyId: e.target.value})} style={{ width: "100%" }} value={rolloverForm.sourceSyId}>
                      <option value="">— Source SY —</option>
                      {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}</option>)}
                  </Sel></FF>
                  <FF label="Semester"><Sel onChange={(e) => setRolloverForm({...rolloverForm, sourceSemester: e.target.value})} style={{ width: "100%" }} value={rolloverForm.sourceSemester}>
                      {SEMESTERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </Sel></FF>
                </div>
              </div>

              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", marginBottom: "16px", padding: "12px" }}>
                <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Target (Paste Into)</div>
                <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr" }}>
                  <FF label="SY"><Sel onChange={(e) => setRolloverForm({...rolloverForm, targetSyId: e.target.value})} style={{ width: "100%" }} value={rolloverForm.targetSyId}>
                      <option value="">— Target SY —</option>
                      {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}</option>)}
                  </Sel></FF>
                  <FF label="Semester"><Sel onChange={(e) => setRolloverForm({...rolloverForm, targetSemester: e.target.value})} style={{ width: "100%" }} value={rolloverForm.targetSemester}>
                      {SEMESTERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </Sel></FF>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <Btn onClick={() => setShowRolloverModal(false)} variant="secondary">Cancel</Btn>
                <Btn disabled={loading} onClick={handleRollover}>{loading ? "Processing..." : "Execute Rollover"}</Btn>
              </div>
            </div>
          </div>
        )}

        {showMappingModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
              <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ color: "#f1f5f9", margin: 0 }}>Create Program Mapping</h3>
                <Btn onClick={() => downloadCSVTemplate("mappings")} size="sm" variant="ghost">Template</Btn>
              </div>
              <FF label="Course"><Sel onChange={e => setMappingForm({...mappingForm, courseId: e.target.value})} style={{ marginBottom: "12px", width: "100%" }} value={mappingForm.courseId}><option value="">— Select Course —</option>{allCourses.map(c => <option key={c._uuid} value={c._uuid}>{c.code} - {c.name}</option>)}</Sel></FF>
              <FF label="Program"><Sel onChange={e => setMappingForm({...mappingForm, programId: e.target.value})} style={{ marginBottom: "12px", width: "100%" }} value={mappingForm.programId}><option value="">— Select Program —</option>{programs.map(p => <option key={p.program_id} value={p.program_id}>{p.code}</option>)}</Sel></FF>
              <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr", marginBottom: "16px" }}>
                <FF label="Year"><Sel onChange={e => setMappingForm({...mappingForm, yearLevel: e.target.value})} style={{ width: "100%" }} value={mappingForm.yearLevel}>{YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}</Sel></FF>
                <FF label="Sem"><Sel onChange={e => setMappingForm({...mappingForm, semester: e.target.value})} style={{ width: "100%" }} value={mappingForm.semester}>{SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}</Sel></FF>
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><Btn onClick={() => setShowMappingModal(false)} variant="secondary">Cancel</Btn><Btn onClick={handleCreateMapping}>Save Mapping</Btn></div>
            </div>
          </div>
        )}

        {(showCreateSectionModal || showEditSectionModal) && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 999 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "450px" }}>
              <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ color: "#f1f5f9", margin: 0 }}>{showEditSectionModal ? "Edit Section Setup" : "Create Section"}</h3>
                {!showEditSectionModal && <Btn onClick={() => downloadCSVTemplate("sections")} size="sm" variant="ghost">Template</Btn>}
              </div>
              
              {!selCourse && mainTab === "offerings" && !showEditSectionModal && (
                <Sel onChange={(e) => setSectionForm({...sectionForm, courseId: e.target.value})} style={{ marginBottom: "12px", width: "100%" }} value={sectionForm.courseId}>
                   <option value="">— Select Course —</option>
                   {allCourses.map(c => <option key={c._uuid} value={c._uuid}>{c.code} — {c.name}</option>)}
                </Sel>
              )}

              <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr", marginBottom: "12px" }}>
                 <FF label="Program">
                   <SearchableSelect
                     emptyMessage="No mapped programs available."
                     onAdd={() => setShowMappingModal(true)}
                     onChange={(val: any) => setSectionForm({...sectionForm, programId: val})}
                     options={programOptions}
                     placeholder="— Mapped Programs —"
                     value={sectionForm.programId}
                   />
                 </FF>
                 <FF label="Year Level">
                   <Sel onChange={(e) => setSectionForm({...sectionForm, yearLevel: e.target.value})} style={{ height: "38px", width: "100%" }} value={sectionForm.yearLevel}>
                      {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                   </Sel>
                 </FF>
              </div>

              <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr", marginBottom: "12px" }}>
                 <FF label="School Year">
                   <Sel disabled={showEditSectionModal} onChange={(e) => setSectionForm({...sectionForm, syId: e.target.value})} style={{ height: "38px", opacity: showEditSectionModal ? 0.6 : 1, width: "100%" }} value={sectionForm.syId}>
                      <option value="">— Select SY —</option>
                      {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}</option>)}
                   </Sel>
                 </FF>
                 <FF label="Semester">
                   <Sel disabled={showEditSectionModal} onChange={(e) => setSectionForm({...sectionForm, semester: e.target.value})} style={{ height: "38px", opacity: showEditSectionModal ? 0.6 : 1, width: "100%" }} value={sectionForm.semester}>
                      {SEMESTERS.map(t => <option key={t} value={t}>{t}</option>)}
                   </Sel>
                 </FF>
              </div>

              <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr", marginBottom: "12px" }}>
                 <FF label="Section Code">
                    <div style={{ display: "flex", gap: "10px" }}>
                        <Input disabled={showEditSectionModal} onChange={(e) => setSectionForm({...sectionForm, sectionLabel: e.target.value.toUpperCase()})} placeholder="Label" style={{ height: "38px", opacity: showEditSectionModal ? 0.6 : 1, width: "120px" }} value={sectionForm.sectionLabel} />
                        <div style={{ alignSelf: "center", color: "#64748b", fontSize: "11px", lineHeight: "1.2" }}>
                        {showEditSectionModal ? "Course identifiers cannot be changed after creation." : "Auto-generates next available code. Edit to override."}
                        </div>
                    </div>
                 </FF>
              </div>
              

              <div style={{ marginBottom: "4px", width: "100%" }}>
                 <SearchableSelect
                   emptyMessage="No teachers available."
                   onChange={(val: any) => setSectionForm({...sectionForm, teacherId: val})}
                   options={teacherOptions}
                   placeholder="— Select Teacher —"
                   value={sectionForm.teacherId}
                 />
              </div>
              {teacherWorkload !== null && <div style={{ color: "#fbbf24", fontSize: "11px", fontWeight: 700, marginBottom: "12px", marginTop: "4px" }}>Active Workload This Term: {teacherWorkload} Units</div>}

              <div style={{ marginBottom: "12px", width: "100%" }}>
                 <SearchableSelect
                   emptyMessage="No rooms available."
                   onAdd={() => setShowRoomModal(true)}
                   onChange={(val: any) => setSectionForm({...sectionForm, roomId: val})}
                   options={roomOptions}
                   placeholder="— Select Room —"
                   value={sectionForm.roomId}
                 />
              </div>

              <div style={{ marginBottom: "12px" }}>
                 <SearchableSelect
                   emptyMessage="No schedules available."
                   onAdd={() => setShowScheduleModal(true)}
                   onChange={(val: any) => setSectionForm({...sectionForm, scheduleLabel: val})}
                   options={scheduleOptions}
                   placeholder="— Select Schedule Block —"
                   value={sectionForm.scheduleLabel}
                 />
              </div>

              <div style={{ alignItems: "center", display: "flex", gap: "10px", marginBottom: "16px" }}>
                <Input disabled={sectionForm.isUnlimited} onChange={(e) => setSectionForm({...sectionForm, maxCapacity: Number(e.target.value)})} placeholder="Max Capacity" style={{ height: "38px", width: "120px" }} type="number" value={sectionForm.maxCapacity} />
                <label style={{ alignItems: "center", color: "#f1f5f9", cursor: "pointer", display: "flex", fontSize: "13px", gap: "6px" }}>
                  <input checked={sectionForm.isUnlimited} onChange={e => setSectionForm({...sectionForm, isUnlimited: e.target.checked})} type="checkbox" />
                  No Limit
                </label>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <Btn onClick={() => { setShowCreateSectionModal(false); setShowEditSectionModal(false); }} variant="secondary">Cancel</Btn>
                <Btn onClick={showEditSectionModal ? handleUpdateSection : handleCreateSection}>{showEditSectionModal ? "Update Section" : "Create Section"}</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}