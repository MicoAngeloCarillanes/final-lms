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

const TERMS = ["Prelim", "Midterm", "Semi-Final", "Finals"];
const SEMESTERS = ["1st Semester", "2nd Semester", "Summer"];
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
const SCHEDULE_BLOCKS = [
  "MWF 7:30 AM - 8:30 AM", "MWF 8:30 AM - 9:30 AM", "MWF 9:30 AM - 10:30 AM",
  "TTh 7:30 AM - 9:00 AM", "TTh 9:00 AM - 10:30 AM", "TTh 10:30 AM - 12:00 PM",
  "Sat 8:00 AM - 11:00 AM", "Sat 1:00 PM - 4:00 PM"
];

const CSV_TEMPLATES = {
  courses: "Course Code,Course Name,Units,Prerequisite Codes (comma separated)\nCS101,Intro to Computing,3,\nCS102,Data Structures,3,CS101\nCS103,Algorithms,3,\"CS101, CS102\"",
  sections: "Course Code,Section Label,Term,Room Name,Schedule Label,Max Capacity\nCS101,A,Prelim,Rm 201,MWF 7:30 AM - 8:30 AM,40",
  mappings: "Course Code,Program Code,Year Level,Semester\nCS101,BSCS,1st Year,1st Semester",
  rooms: "Room Name,Capacity\nRm 201,40\nLab 1,30"
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

  const [mainTab, setMainTab] = useState<"catalog" | "offerings" | "mappings" | "curriculum">("catalog");

  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);

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
  const [offFilterTerm, setOffFilterTerm] = useState("Prelim");
  const [offPage, setOffPage] = useState(0);
  const offPageSize = 20;

  const [mapFilterCourse, setMapFilterCourse] = useState("");
  const [mapFilterProg, setMapFilterProg] = useState("");
  const [mappings, setMappings] = useState<any[]>([]);

  const [selCurriculumProg, setSelCurriculumProg] = useState("");
  const [selCurriculumSy, setSelCurriculumSy] = useState("");

  const [selCodesForDelete, setSelCodesForDelete] = useState<string[]>([]);
  const [selCoursesForDelete, setSelCoursesForDelete] = useState<string[]>([]);
  const [selMappingsForDelete, setSelMappingsForDelete] = useState<number[]>([]);
  const [selSectionsForDelete, setSelSectionsForDelete] = useState<string[]>([]);
  const [selStudents, setSelStudents] = useState<string[]>([]);
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
  const [importType, setImportType] = useState<"courses" | "sections" | "mappings" | "rooms" | null>(null);

  const [codeSort, setCodeSort] = useState<SortState>({ field: "prefix", dir: "asc" });
  const [courseSort, setCourseSort] = useState<SortState>({ field: "course_code", dir: "asc" });
  const [sectionSort, setSectionSort] = useState<SortState>({ field: "section_label", dir: "asc" });
  const [offSort, setOffSort] = useState<SortState>({ field: "created_at", dir: "desc" });
  const [mapSort, setMapSort] = useState<SortState>({ field: "id", dir: "desc" });

  const [courseForm, setCourseForm] = useState<{code: string, name: string, units: number, prereqs: string[]}>({ code: "", name: "", units: 3, prereqs: [] });
  const [mappingForm, setMappingForm] = useState({ courseId: "", programId: "", yearLevel: "1st Year", semester: "1st Semester" });
  const [newRoomForm, setNewRoomForm] = useState({ name: "", capacity: 40 });
  const [sectionForm, setSectionForm] = useState({ courseId: "", maxCapacity: 30, roomId: "", scheduleLabel: "", sectionLabel: "A", syId: "", teacherId: "", term: "Prelim" });
  const [prereqFormCourseId, setPrereqFormCourseId] = useState("");
  const [prerequisites, setPrerequisites] = useState<any[]>([]);
  const [rolloverForm, setRolloverForm] = useState({ sourceSyId: "", sourceTerm: "Prelim", targetSyId: "", targetTerm: "Midterm" });
  const [auditMaterials, setAuditMaterials] = useState<any[]>([]);
  const [teacherWorkload, setTeacherWorkload] = useState<number | null>(null);

  const [viewOfferingSection, setViewOfferingSection] = useState<any>(null);
  const [offeringEnrollments, setOfferingEnrollments] = useState<any[]>([]);

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
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showOfferingDetailsModal, setShowOfferingDetailsModal] = useState(false);
  const [toast, setToast] = useState<ToastState>({ msg: "", type: "success" });

  useEffect(() => {
    void loadReferences();
    void loadAllCourses();
    void loadStudentsAPI("");
  }, []);

  useEffect(() => {
    if (mainTab === "catalog" && level === "codes") void loadCodesAPI();
  }, [codeSort]);

  useEffect(() => {
    if (mainTab === "catalog" && level === "course") void loadCoursesAPI();
  }, [courseSort, selCode]);

  useEffect(() => {
    if (mainTab === "catalog" && level === "section" && selCourse && offFilterSy && offFilterTerm) {
      void loadCatalogSectionsAPI();
    }
  }, [sectionSort, selCourse, offFilterSy, offFilterTerm]);

  useEffect(() => {
    if (mainTab === "offerings") void loadOfferingsAPI();
  }, [mainTab, offPage, offSort]);

  useEffect(() => {
    if (mainTab === "mappings" || mainTab === "curriculum") void loadMappingsAPI();
  }, [mainTab, mapSort, selCurriculumSy]);

  useEffect(() => {
    async function fetchNextCode() {
      if (!sectionForm.courseId || !sectionForm.syId || !sectionForm.term || showEditSectionModal) return;
      const { data } = await supabase.from("course_sections").select("section_label")
        .eq("course_id", sectionForm.courseId)
        .eq("sy_id", sectionForm.syId)
        .eq("term", sectionForm.term);
      
      const used = new Set((data || []).map(s => s.section_label));
      let next = "A";
      for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        if (!used.has(letter)) { next = letter; break; }
      }
      setSectionForm(prev => ({ ...prev, sectionLabel: next }));
    }
    void fetchNextCode();
  }, [sectionForm.courseId, sectionForm.syId, sectionForm.term, showEditSectionModal]);

  useEffect(() => {
    async function fetchWorkload() {
      if (!sectionForm.teacherId || !sectionForm.syId || !sectionForm.term) {
        setTeacherWorkload(null);
        return;
      }
      const { data } = await supabase.from("course_sections")
        .select("courses!inner(units)")
        .eq("teacher_id", sectionForm.teacherId)
        .eq("sy_id", sectionForm.syId)
        .eq("term", sectionForm.term);
      
      const totalUnits = (data || []).reduce((acc: number, curr: any) => acc + (curr.courses?.units || 0), 0);
      setTeacherWorkload(totalUnits);
    }
    void fetchWorkload();
  }, [sectionForm.teacherId, sectionForm.syId, sectionForm.term]);

  void globalCourses; void enrollments; void setGlobalCourses; void setEnrollments;

  function showToast(msg: string, type: "success" | "warning" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 5000);
  }

  function codePrefix(courseCode: string): string {
    return (courseCode || "").match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || "OTHER";
  }

  async function loadStudentsAPI(query: string) {
    setLoading(true);
    let q = supabase.from("students").select(`student_id, program_id, year_level, users!inner(user_id, full_name, display_id, is_active)`);
    if (query) q = q.ilike("users.full_name", `%${query}%`);
    const { data, error } = await q;

    if (!error && data) {
      const formatted = data.map((d: any) => ({
        _uuid: d.student_id,
        displayId: d.users?.display_id || "",
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
    const [syRes, roomRes, progRes] = await Promise.all([
      supabase.from("school_years").select("sy_id, label, is_active, is_locked").order("created_at", { ascending: false }),
      supabase.from("rooms").select("*").order("room_name"),
      supabase.from("program").select("program_id, name, code").eq("is_active", true)
    ]);

    const sys = syRes.data || [];
    setSchoolYears(sys);
    setRooms(roomRes.data || []);
    setPrograms(progRes.data || []);

    const activeSy = sys.find((s) => s.is_active);
    if (activeSy) {
      setOffFilterSy(activeSy.sy_id);
      setSelCurriculumSy(activeSy.sy_id);
      setRolloverForm(prev => ({ ...prev, sourceSyId: activeSy.sy_id, targetSyId: activeSy.sy_id }));
    } else if (sys.length > 0) {
      setOffFilterSy(sys[0].sy_id);
      setSelCurriculumSy(sys[0].sy_id);
      setRolloverForm(prev => ({ ...prev, sourceSyId: sys[0].sy_id, targetSyId: sys[0].sy_id }));
    }
  }

  async function loadAllCourses() {
    const { data: rawCourses, error } = await supabase.from("courses").select("course_id, course_code, course_name, units, is_active").order("course_code", { ascending: true });
    if (!error) {
      const normalized = (rawCourses || []).map((course) => ({
        _uuid: course.course_id, code: course.course_code, id: course.course_code,
        isActive: course.is_active, name: course.course_name, units: course.units,
      }));
      setAllCourses(normalized);
    }
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
        isActive: course.is_active, name: course.course_name, units: course.units,
      }));
      setCourses(normalized);
    }
    setLoading(false);
  }

  async function loadCatalogSectionsAPI() {
    if (!selCourse) return;
    setLoading(true);
    let q = supabase.from("course_sections").select(`*, rooms(room_name)`).eq("course_id", selCourse._uuid).eq("sy_id", offFilterSy).eq("term", offFilterTerm);
    if (sectionSearch) q = q.ilike("section_label", `%${sectionSearch}%`);
    q = q.order(sectionSort.field, { ascending: sectionSort.dir === "asc" });

    const { data: sectData, error } = await q;
    if (!error) {
      const formattedSections = (sectData || []).map((sec: any) => ({ ...sec, room_name: sec.rooms?.room_name || "Unassigned" }));
      setSections(formattedSections);
      
      const sectionIds = formattedSections.map((section) => section.section_id);
      if (sectionIds.length > 0) {
        const { data: enrollmentsData } = await supabase.from("student_course_assignments").select("assignment_id, section_id, student_id, enrollment_status, final_grade, completion_status").in("section_id", sectionIds);
        setSectionEnrollments(enrollmentsData || []);
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

    let q = supabase.from("course_sections")
      .select("*, courses!inner(course_code, course_name), rooms(room_name)", { count: "exact" });
    
    if (offFilterSy) q = q.eq("sy_id", offFilterSy);
    if (offFilterTerm) q = q.eq("term", offFilterTerm);
    if (offFilterCourse) q = q.eq("course_id", offFilterCourse);
    if (offeringSearch) q = q.ilike("courses.course_code", `%${offeringSearch}%`);

    const { data, count, error } = await q.order(offSort.field, { ascending: offSort.dir === "asc" }).range(from, to);

    if (error) {
      showToast(error.message, "error");
    } else if (data && data.length > 0) {
      const sectionIds = data.map(s => s.section_id);
      const { data: enData } = await supabase.from("student_course_assignments")
        .select("section_id, enrollment_status").in("section_id", sectionIds).eq("enrollment_status", "Enrolled");
      
      const counts: Record<string, number> = {};
      enData?.forEach(e => counts[e.section_id] = (counts[e.section_id] || 0) + 1);

      const enriched = data.map(s => ({
        ...s,
        course_code: s.courses?.course_code,
        course_name: s.courses?.course_name,
        enrolled_count: counts[s.section_id] || 0,
        room_name: s.rooms?.room_name || "Unassigned"
      }));

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
    let q = supabase.from("course_program_map").select("id, course_id, program_id, year_level, semester, effective_sy_id, courses!inner(course_code, course_name, units), program(name, code)");
    
    if (mapFilterCourse) q = q.eq("course_id", mapFilterCourse);
    if (mapFilterProg) q = q.eq("program_id", mapFilterProg);
    if (mainTab === "curriculum" && selCurriculumSy) q = q.eq("effective_sy_id", selCurriculumSy);
    if (mappingSearch) q = q.ilike("courses.course_name", `%${mappingSearch}%`);

    const { data, error } = await q.order(mapSort.field, { ascending: mapSort.dir === "asc" });
    
    if (!error && data) {
      const formatted = data.map((m: any) => ({
        ...m,
        course_code: m.courses?.course_code,
        course_name: m.courses?.course_name,
        units: m.courses?.units || 0,
        program_code: m.program?.code
      }));
      setMappings(formatted);
    }
    setLoading(false);
  }

  async function loadPrerequisites(courseId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("course_prerequisites")
      .select("id, courses!prerequisite_course_id(course_code, course_name)")
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

  async function checkScheduleConflict(syId: string, term: string, scheduleLabel: string, teacherId: string | null, roomId: string | null, excludeSectionId?: string): Promise<boolean> {
    if (!scheduleLabel || (!teacherId && !roomId)) return false;

    let q = supabase
      .from("course_sections")
      .select("section_id, section_label, teacher_id, room_id, courses!inner(course_code)")
      .eq("sy_id", syId)
      .eq("term", term)
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

  async function checkStudentConflicts(students: string[], syId: string, term: string, scheduleLabel: string): Promise<string[]> {
    if (!scheduleLabel) return [];
    
    const { data, error } = await supabase.from("student_course_assignments")
      .select("student_id, course_sections!inner(schedule_label, sy_id, term)")
      .in("student_id", students)
      .eq("course_sections.sy_id", syId)
      .eq("course_sections.term", term)
      .eq("course_sections.schedule_label", scheduleLabel);

    if (error || !data) return [];
    return data.map((d: any) => d.student_id);
  }

  function downloadCSVTemplate(type: "courses" | "sections" | "mappings" | "rooms") {
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
    const keys = Object.keys(data[0]).filter(k => k !== "_uuid" && k !== "id" && k !== "select");
    const headers = keys.join(",");
    const rows = data.map(row => keys.map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !importType) return;
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split("\n").map(r => r.split(","));
      
      try {
        if (importType === "courses") {
          const newCourses = [];
          const prereqMap: Record<string, string[]> = {};
          
          for (let i = 1; i < rows.length; i++) {
            if (rows[i].length >= 3 && rows[i][0].trim()) {
              const code = rows[i][0].trim().toUpperCase();
              newCourses.push({
                course_code: code,
                course_name: rows[i][1].trim(),
                units: Number(rows[i][2].trim()) || 3
              });
              if (rows[i][3]) prereqMap[code] = rows[i][3].replace(/"/g, "").split(";").map(s => s.trim().toUpperCase());
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
                  if (pid) prereqPayload.push({ course_id: cid, prerequisite_course_id: pid });
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
          for (let i = 1; i < rows.length; i++) {
            if (rows[i].length >= 2 && rows[i][0].trim()) {
              newRooms.push({ room_name: rows[i][0].trim(), capacity: Number(rows[i][1].trim()) || 40 });
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
          
          for (let i = 1; i < rows.length; i++) {
            if (rows[i].length >= 4 && rows[i][0].trim()) {
              const cId = courseDict[rows[i][0].trim().toUpperCase()];
              const pId = progDict[rows[i][1].trim().toUpperCase()];
              if (cId && pId) {
                newMaps.push({ course_id: cId, program_id: pId, year_level: rows[i][2].trim(), semester: rows[i][3].trim(), effective_sy_id: offFilterSy || null });
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
          const newSections = [];
          let skipped = 0;

          for (let i = 1; i < rows.length; i++) {
            if (rows[i].length >= 6 && rows[i][0].trim()) {
              const cId = courseDict[rows[i][0].trim().toUpperCase()];
              const term = rows[i][2].trim();
              const schedule = rows[i][4].trim();
              const rId = roomDict[rows[i][3].trim()] || null;
              
              if (cId && offFilterSy && term) {
                const hasConflict = await checkScheduleConflict(offFilterSy, term, schedule, null, rId);
                if (hasConflict) { skipped++; continue; }
                
                newSections.push({
                  course_id: cId, section_label: rows[i][1].trim(), term, room_id: rId,
                  schedule_label: schedule, max_capacity: Number(rows[i][5].trim()) || 30,
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
    
    const { data, error } = await supabase.from("courses").insert({ 
      course_code: courseForm.code.toUpperCase(), 
      course_name: courseForm.name, 
      units: courseForm.units 
    }).select("course_id").single();

    if (error) { showToast(error.message, "error"); return; }

    if (courseForm.prereqs.length > 0 && data) {
      const prereqPayload = courseForm.prereqs.map(pId => ({
        course_id: data.course_id,
        prerequisite_course_id: pId
      }));
      await supabase.from("course_prerequisites").insert(prereqPayload);
    }

    showToast("Course created successfully.", "success");
    setShowCreateCourseModal(false);
    setCourseForm({ code: "", name: "", units: 3, prereqs: [] });
    await loadAllCourses();
    if (selCode) void loadCoursesAPI();
  }

  async function handleCreateSection() {
    if (!sectionForm.courseId || !sectionForm.syId || !sectionForm.term || !sectionForm.sectionLabel) {
      showToast("Course, SY, Term, and Label are required.", "error"); return;
    }

    const hasConflict = await checkScheduleConflict(sectionForm.syId, sectionForm.term, sectionForm.scheduleLabel, sectionForm.teacherId || null, sectionForm.roomId || null);
    if (hasConflict) return;

    const { error } = await supabase.from("course_sections").insert({
      course_id: sectionForm.courseId, 
      max_capacity: sectionForm.maxCapacity,
      room_id: sectionForm.roomId || null, 
      schedule_label: sectionForm.scheduleLabel || null,
      section_label: sectionForm.sectionLabel, 
      sy_id: sectionForm.syId, 
      teacher_id: sectionForm.teacherId || null,
      term: sectionForm.term
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

    const hasConflict = await checkScheduleConflict(sectionForm.syId, sectionForm.term, sectionForm.scheduleLabel, sectionForm.teacherId || null, sectionForm.roomId || null, targetId);
    if (hasConflict) return;

    const { error } = await supabase.from("course_sections").update({
      max_capacity: sectionForm.maxCapacity,
      room_id: sectionForm.roomId || null,
      schedule_label: sectionForm.scheduleLabel || null,
      teacher_id: sectionForm.teacherId || null
    }).eq("section_id", targetId);

    if (error) { showToast(error.message, "error"); return; }

    showToast(`Section updated successfully.`, "success");
    setShowEditSectionModal(false);
    
    if (mainTab === "catalog" && selCourse) void loadCatalogSectionsAPI();
    if (mainTab === "offerings") void loadOfferingsAPI();
  }

  async function handleEditCourse() {
    if (!selCourse?._uuid) return;
    const { error } = await supabase.from("courses").update({ course_code: courseForm.code.toUpperCase(), course_name: courseForm.name, units: courseForm.units }).eq("course_id", selCourse._uuid);
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

  async function handleDeleteMapping(id: number) {
    if (!confirm("Remove this mapping?")) return;
    await supabase.from("course_program_map").delete().eq("id", id);
    showToast("Mapping removed.", "success");
    void loadMappingsAPI();
  }

  async function handleCreateRoom() {
    if (!newRoomForm.name) { showToast("Room name required.", "error"); return; }
    const { error } = await supabase.from("rooms").insert({ capacity: newRoomForm.capacity, room_name: newRoomForm.name });
    if (error) { showToast(error.message, "error"); return; }
    showToast("Room added.", "success");
    setNewRoomForm({ capacity: 40, name: "" });
    await loadReferences();
  }

  async function handleDeleteRoom(roomId: string) {
    const { error } = await supabase.from("rooms").delete().eq("room_id", roomId);
    if (error) { showToast("Cannot delete active room.", "error"); return; }
    showToast("Room deleted.", "success");
    await loadReferences();
  }

  async function handleAddPrerequisite() {
    if (!selCourse || !prereqFormCourseId) return;
    const { error } = await supabase.from("course_prerequisites").insert({
      course_id: selCourse._uuid,
      prerequisite_course_id: prereqFormCourseId
    });
    if (error) { showToast(error.message, "error"); return; }
    showToast("Prerequisite added.", "success");
    setPrereqFormCourseId("");
    void loadPrerequisites(selCourse._uuid);
  }

  async function handleRemovePrerequisite(id: string) {
    const { error } = await supabase.from("course_prerequisites").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    showToast("Prerequisite removed.", "success");
    void loadPrerequisites(selCourse._uuid);
  }

  async function handleRollover() {
    if (!rolloverForm.sourceSyId || !rolloverForm.targetSyId) { showToast("Source and Target School Years are required.", "error"); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc("rollover_sections", {
      p_source_sy_id: rolloverForm.sourceSyId,
      p_source_term: rolloverForm.sourceTerm,
      p_target_sy_id: rolloverForm.targetSyId,
      p_target_term: rolloverForm.targetTerm
    });
    setLoading(false);
    if (error) { showToast(error.message, "error"); return; }
    showToast(`Successfully rolled over ${data} sections.`, "success");
    setShowRolloverModal(false);
    if (mainTab === "offerings") void loadOfferingsAPI();
  }

  async function handleUnenrollStudent(assignmentId: string) {
    if (!confirm("Remove student from this section?")) return;
    const { error } = await supabase.from("student_course_assignments").delete().eq("assignment_id", assignmentId);
    if (error) { showToast(error.message, "error"); return; }
    
    setSectionEnrollments(prev => prev.filter(e => e.assignment_id !== assignmentId));
    setOfferingEnrollments(prev => prev.filter(e => e.assignment_id !== assignmentId));
    showToast("Student removed.", "success");
    
    if (mainTab === "offerings") void loadOfferingsAPI();
    if (mainTab === "catalog" && selCourse) void loadCatalogSectionsAPI();
  }

  async function promoteWaitlistStudent(assignmentId: string) {
    const { error } = await supabase.from("student_course_assignments").update({ enrollment_status: "Enrolled" }).eq("assignment_id", assignmentId);
    if (error) { showToast(error.message, "error"); return; }
    showToast("Student promoted to Enrolled.", "success");
    
    if (mainTab === "offerings" && viewOfferingSection) openOfferingDetailsModal(viewOfferingSection);
    if (mainTab === "catalog" && selCourse) void loadCatalogSectionsAPI();
  }

  async function deleteSelectedCodes() {
    if (selCodesForDelete.length === 0) return;
    const ids = allCourses.filter((c) => selCodesForDelete.includes(codePrefix(c.code))).map(c => c._uuid);
    if (ids.length === 0) return;
    const { error } = await supabase.from("courses").delete().in("course_id", ids);
    if (!error) { showToast("Code groups deleted.", "success"); setSelCodesForDelete([]); await loadAllCourses(); void loadCodesAPI(); }
  }

  async function deleteSelectedCourses() {
    if (selCoursesForDelete.length === 0) return;
    const { error } = await supabase.from("courses").delete().in("course_id", selCoursesForDelete);
    if (!error) { showToast("Courses deleted.", "success"); setSelCoursesForDelete([]); await loadAllCourses(); void loadCoursesAPI(); }
  }

  async function deleteSelectedSections() {
    if (selSectionsForDelete.length === 0) return;
    const { error } = await supabase.from("course_sections").delete().in("section_id", selSectionsForDelete);
    if (!error) { 
      showToast("Sections deleted.", "success"); 
      setSelSectionsForDelete([]); 
      if (mainTab === "catalog" && selCourse) void loadCatalogSectionsAPI();
      if (mainTab === "offerings") void loadOfferingsAPI();
    }
  }

  async function deleteSelectedMappings() {
    if (selMappingsForDelete.length === 0) return;
    const { error } = await supabase.from("course_program_map").delete().in("id", selMappingsForDelete);
    if (!error) {
      showToast("Mappings deleted.", "success");
      setSelMappingsForDelete([]);
      void loadMappingsAPI();
    }
  }

  async function enrollStudents() {
    if (!selSection || selStudents.length === 0 || !selCourse?._uuid) return;
    
    let toEnroll = selStudents;
    
    if (!forceEnroll) {
      const conflictedIds = await checkStudentConflicts(selStudents, selSection.sy_id, selSection.term, selSection.schedule_label);
      if (conflictedIds.length > 0) {
        showToast(`${conflictedIds.length} student(s) skipped due to schedule conflicts. Check 'Force Enroll' to bypass.`, "warning");
        toEnroll = selStudents.filter(id => !conflictedIds.includes(id));
      }
    }

    if (toEnroll.length === 0) {
      setSelStudents([]);
      return;
    }

    let enrolledCount = 0, waitlistedCount = 0;
    for (const studentId of toEnroll) {
      const status = await enrollStudent(studentId, selCourse._uuid, selSection.section_id);
      if (status === "Enrolled" || forceEnroll) enrolledCount++;
      if (status === "Waitlisted" && !forceEnroll) waitlistedCount++;
    }
    setSelStudents([]);
    await loadCatalogSectionsAPI();
    if (waitlistedCount > 0) showToast(`${enrolledCount} enrolled, ${waitlistedCount} waitlisted due to capacity.`, "warning");
    else showToast(`${enrolledCount} students enrolled.`, "success");
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
      maxCapacity: 30,
      roomId: "",
      scheduleLabel: "",
      syId: offFilterSy,
      teacherId: "",
      term: offFilterTerm
    });
    setTeacherWorkload(null);
    setShowCreateSectionModal(true);
  }

  function openEditSectionModal() {
    if (!selSection) return;
    setSectionForm({
      courseId: selSection.course_id,
      maxCapacity: selSection.max_capacity || 30,
      roomId: selSection.room_id || "",
      scheduleLabel: selSection.schedule_label || "",
      sectionLabel: selSection.section_label,
      syId: selSection.sy_id,
      teacherId: selSection.teacher_id || "",
      term: selSection.term
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
      .select("assignment_id, student_id, enrollment_status, final_grade, completion_status")
      .eq("section_id", section.section_id);
    setOfferingEnrollments(data || []);
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

  const teachersList = users.filter((u) => u.role === "teacher");
  const enrolledStudentIds = new Set(selSection ? sectionEnrollments.filter((e) => e.section_id === selSection.section_id).map((e) => String(e.student_id)) : []);
  
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
      studentId: e.student_id,
      studentName: users.find((s) => String(s._uuid) === String(e.student_id))?.fullName || "Unknown",
    }))
    .filter((row) => {
      if (enrolledSearch && !row.studentName.toLowerCase().includes(enrolledSearch.toLowerCase())) return false;
      if (enrolledFilter && row.status !== enrolledFilter) return false;
      return true;
    });

  const filteredOfferingEnrollments = offeringEnrollments
    .map((e) => ({
      completion: e.completion_status || "Ongoing",
      grade: e.final_grade,
      id: e.assignment_id,
      status: e.enrollment_status,
      studentId: e.student_id,
      studentName: users.find((s) => String(s._uuid) === String(e.student_id))?.fullName || "Unknown",
    }))
    .filter((row) => {
      if (enrolledSearch && !row.studentName.toLowerCase().includes(enrolledSearch.toLowerCase())) return false;
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
    { field: "schedule_label", header: "Schedule", width: 180, sortable: true },
    { field: "room_name", header: "Room", width: 100 },
    { field: "max_capacity", header: "Capacity", width: 100, sortable: true },
  ];

  const offeringsCols = [
    { cellRenderer: (_: any, row: any) => <input checked={selSectionsForDelete.includes(row.section_id)} onChange={() => toggleSelection(row.section_id, selSectionsForDelete, setSelSectionsForDelete)} onClick={(e) => e.stopPropagation()} type="checkbox" />, field: "select", header: <input checked={offerings.length > 0 && selSectionsForDelete.length === offerings.length} onChange={(e) => setSelSectionsForDelete(e.target.checked ? offerings.map(s=>s.section_id) : [])} type="checkbox" />, sortable: false, width: 50 },
    { field: "course_code", header: "Course Code", width: 120, sortable: false },
    { field: "course_name", header: "Course Name", flex: 1, sortable: false },
    { field: "section_label", header: "Section", width: 90, sortable: true },
    { field: "term", header: "Term", width: 100, sortable: true },
    { field: "schedule_label", header: "Schedule", width: 180, sortable: false },
    { field: "room_name", header: "Room", width: 100, sortable: false },
    { cellRenderer: (_: any, row: any) => <span>{row.enrolled_count} / {row.max_capacity || 30}</span>, field: "max_capacity", header: "Capacity", width: 100, sortable: true },
    { cellRenderer: (_: any, row: any) => <Btn onClick={(e: any) => { e.stopPropagation(); openOfferingDetailsModal(row); }} size="sm" variant="secondary">View Details</Btn>, field: "section_id", header: "Action", sortable: false, width: 120 },
  ];

  const mappingsCols = [
    { cellRenderer: (_: any, row: any) => <input checked={selMappingsForDelete.includes(row.id)} onChange={() => toggleSelection(row.id, selMappingsForDelete, setSelMappingsForDelete)} onClick={(e) => e.stopPropagation()} type="checkbox" />, field: "select", header: <input checked={mappings.length > 0 && selMappingsForDelete.length === mappings.length} onChange={(e) => setSelMappingsForDelete(e.target.checked ? mappings.map(m=>m.id) : [])} type="checkbox" />, sortable: false, width: 50 },
    { field: "course_code", header: "Course", width: 120 },
    { field: "course_name", header: "Course Name", flex: 1 },
    { field: "program_code", header: "Program", width: 120 },
    { field: "year_level", header: "Year Level", width: 120, sortable: true },
    { field: "semester", header: "Semester", width: 150, sortable: true },
    { cellRenderer: (_: any, row: any) => <Btn onClick={(e: any) => { e.stopPropagation(); handleDeleteMapping(row.id); }} size="sm" variant="danger">Remove</Btn>, field: "id", header: "Action", sortable: false, width: 90 },
  ];

  const enrolledCols = [
    { field: "studentName", header: "Student Name" },
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
          * { border-color: #ddd !important; }
        }
      `}</style>
      
      <div className="no-print">
        <TopBar title="Course Management" subtitle="Unified Catalog, Offerings, Mappings, and Curriculum" />

        <div style={{ display: "flex", gap: "8px", padding: "10px 16px", background: "#0f172a", borderBottom: "1px solid #334155" }}>
          <Btn variant={mainTab === "catalog" ? "primary" : "ghost"} onClick={() => setMainTab("catalog")}>📚 Catalog</Btn>
          <Btn variant={mainTab === "offerings" ? "primary" : "ghost"} onClick={() => { setMainTab("offerings"); setSelSectionsForDelete([]); }}>📅 Offerings</Btn>
          <Btn variant={mainTab === "mappings" ? "primary" : "ghost"} onClick={() => { setMainTab("mappings"); setSelMappingsForDelete([]); }}>🔗 Program Mappings</Btn>
          <Btn variant={mainTab === "curriculum" ? "primary" : "ghost"} onClick={() => setMainTab("curriculum")}>📜 Curriculum</Btn>
        </div>

        <div style={{ alignItems: "center", background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", gap: "10px", padding: "10px 16px", flexWrap: "wrap" }}>
          
          {mainTab === "catalog" && (
            <>
              <Btn onClick={() => { setLevel("codes"); setSelCode(null); setSelCourse(null); setSelSection(null); setSelCodesForDelete([]); }} size="sm" variant={level === "codes" ? "primary" : "secondary"}>Codes</Btn>
              {selCode && <Btn onClick={() => drillCode(selCode)} size="sm" variant={level === "course" ? "primary" : "secondary"}>{selCode}</Btn>}
              {selCourse && level === "section" && <Btn onClick={() => drillSections(selCourse)} size="sm" variant="primary">{selCourse.code}</Btn>}
            </>
          )}

          {(mainTab === "catalog" || mainTab === "offerings" || mainTab === "mappings") && (
            <div style={{ display: "flex", alignItems: "center", background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", overflow: "hidden" }}>
              {mainTab === "catalog" && level === "codes" && <Input value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)} onKeyDown={handleMainSearchKeyDown} placeholder="Search Code Prefix..." style={{ border: "none", background: "transparent", width: "180px", boxShadow: "none" }} />}
              {mainTab === "catalog" && level === "course" && <Input value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)} onKeyDown={handleMainSearchKeyDown} placeholder="Search Course Name..." style={{ border: "none", background: "transparent", width: "200px", boxShadow: "none" }} />}
              {mainTab === "catalog" && level === "section" && <Input value={sectionSearch} onChange={(e) => setSectionSearch(e.target.value)} onKeyDown={handleMainSearchKeyDown} placeholder="Search Section Code..." style={{ border: "none", background: "transparent", width: "180px", boxShadow: "none" }} />}
              {mainTab === "offerings" && <Input value={offeringSearch} onChange={(e) => setOfferingSearch(e.target.value)} onKeyDown={handleMainSearchKeyDown} placeholder="Search Course Code..." style={{ border: "none", background: "transparent", width: "200px", boxShadow: "none" }} />}
              {mainTab === "mappings" && <Input value={mappingSearch} onChange={(e) => setMappingSearch(e.target.value)} onKeyDown={handleMainSearchKeyDown} placeholder="Search Course Name..." style={{ border: "none", background: "transparent", width: "200px", boxShadow: "none" }} />}

              <button onClick={() => setShowFilterModal(true)} style={{ background: "#1e293b", border: "none", borderLeft: "1px solid #334155", padding: "8px 12px", cursor: "pointer", color: "#94a3b8" }}>
                ⚙️ Filters
              </button>
            </div>
          )}

          {mainTab === "curriculum" && (
            <>
              <Sel value={selCurriculumProg} onChange={(e) => setSelCurriculumProg(e.target.value)} style={{ width: 200 }}>
                <option value="">— Select Program —</option>
                {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.code} — {p.name}</option>)}
              </Sel>
              <Sel value={selCurriculumSy} onChange={(e) => setSelCurriculumSy(e.target.value)} style={{ width: 160 }}>
                <option value="">— Effective SY —</option>
                {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}</option>)}
              </Sel>
              {selCurriculumProg && <Btn onClick={() => window.print()} size="sm" variant="ghost">Print</Btn>}
            </>
          )}

          <div style={{ alignItems: "center", display: "flex", gap: "8px", marginLeft: "auto", flexWrap: "wrap" }}>
            <input type="file" accept=".csv" ref={fileInputRef} style={{ display: "none" }} onChange={handleCSVImport} />

            {mainTab === "offerings" && <Btn onClick={() => toggleTermLock()} size="sm" variant={isTermLocked ? "primary" : "secondary"}>{isTermLocked ? "Unlock Grades" : "Lock Grades"}</Btn>}
            {mainTab === "offerings" && <Btn onClick={() => downloadCSVExport(offerings, "Offerings_Export.csv")} size="sm" variant="ghost">Export CSV</Btn>}
            {mainTab === "offerings" && <Btn onClick={() => setShowRolloverModal(true)} size="sm" variant="secondary">Term Rollover</Btn>}
            
            <Btn onClick={() => setShowRoomModal(true)} size="sm" variant="ghost">Manage Rooms</Btn>

            {mainTab === "catalog" && level === "codes" && (
              <>
                <Btn onClick={() => downloadCSVExport(allCourses, "Courses_Export.csv")} size="sm" variant="ghost">Export Courses</Btn>
                <Btn onClick={() => { setImportType("courses"); fileInputRef.current?.click(); }} size="sm" variant="secondary">Import Courses</Btn>
                <Btn onClick={() => setShowCreateCodeModal(true)} size="sm">+ Create Code</Btn>
                {selCodesForDelete.length > 0 && <Btn onClick={deleteSelectedCodes} size="sm" variant="danger">Delete Selected ({selCodesForDelete.length})</Btn>}
              </>
            )}

            {mainTab === "catalog" && level === "course" && (
              <>
                <Btn onClick={() => downloadCSVExport(courses, "Courses_Filtered_Export.csv")} size="sm" variant="ghost">Export CSV</Btn>
                <Btn onClick={() => { setCourseForm({ code: selCode ? `${selCode} ` : "", name: "", units: 3, prereqs: [] }); setShowCreateCourseModal(true); }} size="sm">+ Create Course</Btn>
                {selCoursesForDelete.length > 0 && <Btn onClick={deleteSelectedCourses} size="sm" variant="danger">Delete Selected ({selCoursesForDelete.length})</Btn>}
              </>
            )}

            {mainTab === "catalog" && level === "section" && (
              <>
                <Btn onClick={() => downloadCSVExport(sections, "Sections_Export.csv")} size="sm" variant="ghost">Export Sections</Btn>
                <Btn onClick={() => { setImportType("sections"); fileInputRef.current?.click(); }} size="sm" variant="secondary">Import Sections</Btn>
                <Btn onClick={openPrereqModal} size="sm" variant="ghost">Manage Prerequisites</Btn>
                <Btn onClick={() => { setCourseForm({ code: selCourse.code, name: selCourse.name, units: selCourse.units, prereqs: [] }); setShowEditCourseModal(true); }} size="sm" variant="ghost">Edit Course</Btn>
                <Btn onClick={openCreateSectionModal} size="sm">+ Create Section</Btn>
                {selSection && <Btn onClick={openAuditModal} size="sm" variant="ghost">Audit Materials</Btn>}
                {selSection && <Btn onClick={openEditSectionModal} size="sm" variant="secondary">Edit Section Setup</Btn>}
                {selSectionsForDelete.length > 0 && <Btn onClick={deleteSelectedSections} size="sm" variant="danger">Delete Selected ({selSectionsForDelete.length})</Btn>}
              </>
            )}

            {mainTab === "mappings" && (
              <>
                <Btn onClick={() => downloadCSVExport(mappings, "Mappings_Export.csv")} size="sm" variant="ghost">Export CSV</Btn>
                <Btn onClick={() => { setImportType("mappings"); fileInputRef.current?.click(); }} size="sm" variant="secondary">Import Mappings</Btn>
                <Btn onClick={() => setShowMappingModal(true)} size="sm">+ Add Mapping</Btn>
                {selMappingsForDelete.length > 0 && <Btn onClick={deleteSelectedMappings} size="sm" variant="danger">Delete Selected ({selMappingsForDelete.length})</Btn>}
              </>
            )}
          </div>
        </div>

        {toast.msg && (
          <div style={{ padding: "10px 20px 0" }}>
            <div style={{ background: toast.type === "error" ? "rgba(239,68,68,.12)" : toast.type === "warning" ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.12)", border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : toast.type === "warning" ? "rgba(245,158,11,.3)" : "rgba(16,185,129,.3)"}`, borderRadius: "8px", color: toast.type === "error" ? "#f87171" : toast.type === "warning" ? "#fbbf24" : "#34d399", fontSize: "13px", fontWeight: 600, padding: "9px 14px" }}>
              {toast.msg}
            </div>
          </div>
        )}
      </div>

      <div className="no-print" style={{ display: mainTab === "curriculum" ? "none" : "flex", flex: 1, overflow: "hidden" }}>
        
        {mainTab === "catalog" && level === "codes" && (
          <div style={{ background: "#0f172a", flex: 1, padding: "20px" }}>
            {loading ? <div style={{ color: "#475569", paddingTop: 40, textAlign: "center" }}>Loading...</div> : <LMSGrid columns={codeCols} height="100%" onRowClick={(row) => toggleSelection(row.prefix, selCodesForDelete, setSelCodesForDelete)} onSortChange={(f, d) => setCodeSort({ field: f, dir: d as "asc"|"desc" })} sortField={codeSort.field} sortDir={codeSort.dir} rowData={codeGroups} />}
          </div>
        )}

        {mainTab === "catalog" && level === "course" && (
          <div style={{ background: "#0f172a", flex: 1, padding: "20px" }}>
            <LMSGrid columns={courseCols} height="100%" onRowClick={(row) => toggleSelection(row._uuid, selCoursesForDelete, setSelCoursesForDelete)} onSortChange={(f, d) => setCourseSort({ field: f, dir: d as "asc"|"desc" })} sortField={courseSort.field} sortDir={courseSort.dir} rowData={courses} />
          </div>
        )}

        {mainTab === "catalog" && level === "section" && (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <div style={{ background: "#1e293b", borderRight: "1px solid #334155", display: "flex", flexDirection: "column", padding: "16px", width: "350px" }}>
              <div style={{ color: "#f1f5f9", fontSize: "14px", fontWeight: 800, marginBottom: "16px" }}>Enrollment Panel</div>
              <Input onChange={(e) => setStudentSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void loadStudentsAPI(studentSearch); }} placeholder="Search student + Enter" style={{ marginBottom: "12px" }} value={studentSearch} />
              
              <div style={{ alignItems: "center", borderBottom: "1px solid #334155", display: "flex", gap: "8px", marginBottom: "8px", paddingBottom: "8px" }}>
                <input checked={studentsList.length > 0 && selStudents.length === studentsList.length} onChange={(e) => setSelStudents(e.target.checked ? studentsList.map(s=>String(s._uuid)) : [])} type="checkbox" />
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>Select All Eligible</span>
                
                <label style={{ alignItems: "center", color: "#f87171", display: "flex", fontSize: "11px", gap: "4px", marginLeft: "auto", fontWeight: 700, cursor: "pointer" }}>
                  <input checked={forceEnroll} onChange={(e) => setForceEnroll(e.target.checked)} type="checkbox" /> Force Enroll
                </label>
              </div>

              <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "8px", marginBottom: "16px", overflowY: "auto" }}>
                {studentsList.map((s) => (
                  <label key={s._uuid} style={{ alignItems: "center", color: "#e2e8f0", cursor: "pointer", display: "flex", fontSize: "12px", gap: "8px" }}>
                    <input checked={selStudents.includes(s._uuid)} onChange={(e) => setSelStudents((prev) => e.target.checked ? [...prev, s._uuid] : prev.filter((id) => id !== s._uuid))} type="checkbox" />
                    {s.fullName}
                  </label>
                ))}
              </div>
              <Btn disabled={isLoading || selStudents.length === 0 || !selSection} onClick={enrollStudents}>{isLoading ? "Processing..." : `Enroll ${selStudents.length} Students`}</Btn>
            </div>

            <div style={{ background: "#0f172a", display: "flex", flex: 1, flexDirection: "column" }}>
              <div style={{ borderBottom: "1px solid #334155", flex: "0 0 40%", padding: "16px" }}>
                <LMSGrid columns={sectionCols} height="100%" onRowClick={(row) => { setSelSection(row); setSelStudents([]); setEnrolledSearch(""); setEnrolledFilter(""); toggleSelection(row.section_id, selSectionsForDelete, setSelSectionsForDelete); }} onSortChange={(f, d) => setSectionSort({ field: f, dir: d as "asc"|"desc" })} sortField={sectionSort.field} sortDir={sectionSort.dir} rowData={sections} selectedId={selSection?.section_id} />
              </div>
              <div style={{ background: "#0a0f1a", flex: 1, padding: "16px", display: "flex", flexDirection: "column" }}>
                {selSection ? (
                  <>
                    <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                      <Input value={enrolledSearch} onChange={(e) => setEnrolledSearch(e.target.value)} placeholder="Search enrolled student..." style={{ width: 200 }} />
                      <Sel value={enrolledFilter} onChange={(e) => setEnrolledFilter(e.target.value)} style={{ width: 150 }}>
                        <option value="">All Statuses</option>
                        <option value="Enrolled">Enrolled</option>
                        <option value="Waitlisted">Waitlisted</option>
                      </Sel>
                      <Btn onClick={() => downloadCSVExport(catalogEnrolledRows, `Roster_${selSection.section_label}.csv`)} size="sm" variant="ghost" style={{ marginLeft: "auto" }}>Export CSV</Btn>
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
           <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#0f172a", padding: "20px" }}>
              <div style={{ flex: 1, overflow: "hidden" }}>
                 {loading ? <div style={{ color: "#475569", paddingTop: 40, textAlign: "center" }}>Loading...</div> : <LMSGrid columns={offeringsCols} height="100%" onRowClick={(row) => toggleSelection(row.section_id, selSectionsForDelete, setSelSectionsForDelete)} onSortChange={(f, d) => setOffSort({ field: f, dir: d as "asc"|"desc" })} sortField={offSort.field} sortDir={offSort.dir} rowData={offerings} />}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid #1e293b", marginTop: "12px" }}>
                 <div style={{ color: "#64748b", fontSize: "12px" }}>Showing {offPage * offPageSize + 1} to {Math.min((offPage + 1) * offPageSize, offeringCount)} of {offeringCount} sections</div>
                 <div style={{ display: "flex", gap: "8px" }}>
                    <Btn variant="secondary" size="sm" disabled={offPage === 0} onClick={() => setOffPage(p => p - 1)}>← Previous</Btn>
                    <Btn variant="secondary" size="sm" disabled={(offPage + 1) * offPageSize >= offeringCount} onClick={() => setOffPage(p => p + 1)}>Next →</Btn>
                 </div>
              </div>
           </div>
        )}

        {mainTab === "mappings" && (
           <div style={{ flex: 1, overflow: "hidden", padding: "20px", background: "#0f172a" }}>
             {loading ? <div style={{ color: "#475569", paddingTop: 40, textAlign: "center" }}>Loading...</div> : <LMSGrid columns={mappingsCols} height="100%" onRowClick={(row) => toggleSelection(row.id, selMappingsForDelete, setSelMappingsForDelete)} onSortChange={(f, d) => setMapSort({ field: f, dir: d as "asc"|"desc" })} sortField={mapSort.field} sortDir={mapSort.dir} rowData={mappings} />}
           </div>
        )}
      </div>

      <div className={mainTab === "curriculum" ? "print-area" : "no-print"} style={{ display: mainTab === "curriculum" ? "block" : "none", flex: 1, overflowY: "auto", padding: "20px", background: "#0f172a" }}>
        {!selCurriculumProg ? (
          <div style={{ color: "#475569", textAlign: "center", marginTop: 60, fontSize: 14 }}>Select a program above to view its curriculum.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <h2 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>{programs.find(p => p.program_id === Number(selCurriculumProg))?.name}</h2>
              <div style={{ color: "#94a3b8", fontSize: "14px" }}>Effective School Year: {schoolYears.find(s => s.sy_id === selCurriculumSy)?.label || "All Mappings"}</div>
            </div>
            
            {YEAR_LEVELS.map(year => {
              if (!groupedCurriculum[year]) return null;
              let yearTotalUnits = 0;
              
              return (
                <div key={year} style={{ background: "#1e293b", borderRadius: "8px", border: "1px solid #334155", overflow: "hidden" }}>
                  <div style={{ background: "rgba(99,102,241,.1)", color: "#a5b4fc", padding: "10px 16px", fontWeight: 800, fontSize: "14px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between" }}>
                    <span>{year}</span>
                  </div>
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    {SEMESTERS.map(sem => {
                      if (!groupedCurriculum[year][sem] || groupedCurriculum[year][sem].length === 0) return null;
                      
                      const semUnits = groupedCurriculum[year][sem].reduce((acc: number, m: any) => acc + (m.units || 0), 0);
                      yearTotalUnits += semUnits;
                      
                      return (
                        <div key={sem}>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px", borderBottom: "1px solid #334155", paddingBottom: "4px" }}>
                            <span>{sem}</span>
                            <span style={{ color: "#94a3b8" }}>{semUnits} Total Units</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "10px" }}>
                            {groupedCurriculum[year][sem].map((m: any) => (
                              <div key={m.id} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", padding: "10px" }}>
                                <div style={{ fontWeight: 800, color: "#f1f5f9", fontSize: "13px" }}>{m.course_code}</div>
                                <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "4px" }}>{m.course_name}</div>
                                <div style={{ color: "#475569", fontSize: "11px" }}>{m.units} Units</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ background: "#0f172a", padding: "10px 16px", borderTop: "1px solid #334155", textAlign: "right", color: "#a5b4fc", fontWeight: 700, fontSize: "13px" }}>
                    Year Total: {yearTotalUnits} Units
                  </div>
                </div>
              );
            })}
            <div style={{ background: "#1e293b", padding: "16px", borderRadius: "8px", border: "1px solid #334155", textAlign: "right", color: "#f1f5f9", fontSize: "16px", fontWeight: 800 }}>
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
        {showFilterModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "450px" }}>
              <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>Table Filters</h3>
              
              {(mainTab === "offerings" || (mainTab === "catalog" && level === "section")) && (
                <>
                  <FF label="School Year"><Sel value={offFilterSy} onChange={(e) => setOffFilterSy(e.target.value)} style={{ width: "100%", marginBottom: "12px" }}>
                    {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}{s.is_active ? " ★ Active" : ""}{s.is_locked ? " 🔒" : ""}</option>)}
                  </Sel></FF>
                  <FF label="Term"><Sel value={offFilterTerm} onChange={(e) => setOffFilterTerm(e.target.value)} style={{ width: "100%", marginBottom: "12px" }}>
                    {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </Sel></FF>
                </>
              )}

              {mainTab === "offerings" && (
                <FF label="Course"><Sel value={offFilterCourse} onChange={(e) => setOffFilterCourse(e.target.value)} style={{ width: "100%", marginBottom: "12px" }}>
                  <option value="">All Courses</option>
                  {allCourses.map(c => <option key={c._uuid} value={c._uuid}>{c.code} — {c.name}</option>)}
                </Sel></FF>
              )}

              {mainTab === "mappings" && (
                <>
                  <FF label="Course"><Sel value={mapFilterCourse} onChange={(e) => setMapFilterCourse(e.target.value)} style={{ width: "100%", marginBottom: "12px" }}>
                    <option value="">All Courses</option>
                    {allCourses.map(c => <option key={c._uuid} value={c._uuid}>{c.code}</option>)}
                  </Sel></FF>
                  <FF label="Program"><Sel value={mapFilterProg} onChange={(e) => setMapFilterProg(e.target.value)} style={{ width: "100%", marginBottom: "12px" }}>
                    <option value="">All Programs</option>
                    {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.code}</option>)}
                  </Sel></FF>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <Btn onClick={() => setShowFilterModal(false)} variant="secondary" style={{ marginRight: "8px" }}>Cancel</Btn>
                <Btn onClick={handleApplyFilters}>Apply Filters</Btn>
              </div>
            </div>
          </div>
        )}

        {showOfferingDetailsModal && viewOfferingSection && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "800px", display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
              <h3 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>Section Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px", background: "#0f172a", padding: "12px", borderRadius: "8px", border: "1px solid #334155" }}>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Course:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{viewOfferingSection.course_code} - {viewOfferingSection.course_name}</span></div>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Section:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{viewOfferingSection.section_label}</span></div>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Teacher:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{users.find(u => String(u._uuid) === String(viewOfferingSection.teacher_id))?.fullName || "Unassigned"}</span></div>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Schedule:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{viewOfferingSection.schedule_label}</span></div>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Room:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{viewOfferingSection.room_name}</span></div>
                <div><span style={{ color: "#64748b", fontSize: "12px" }}>Capacity:</span> <span style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700 }}>{viewOfferingSection.enrolled_count} / {viewOfferingSection.max_capacity}</span></div>
              </div>
              
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <Input value={enrolledSearch} onChange={(e) => setEnrolledSearch(e.target.value)} placeholder="Search enrolled student..." style={{ width: 200 }} />
                <Sel value={enrolledFilter} onChange={(e) => setEnrolledFilter(e.target.value)} style={{ width: 150 }}>
                  <option value="">All Statuses</option>
                  <option value="Enrolled">Enrolled</option>
                  <option value="Waitlisted">Waitlisted</option>
                </Sel>
                <Btn onClick={() => downloadCSVExport(filteredOfferingEnrollments, `Roster_${viewOfferingSection.section_label}.csv`)} size="sm" variant="ghost" style={{ marginLeft: "auto" }}>Export CSV</Btn>
              </div>

              <div style={{ flex: 1, minHeight: "300px", overflow: "hidden", border: "1px solid #334155", borderRadius: "8px", background: "#0a0f1a" }}>
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

              <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #334155", borderRadius: "8px", background: "#0f172a" }}>
                 {loading ? <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>Loading materials...</div> : null}
                 {!loading && auditMaterials.map(m => (
                    <div key={m.material_id} style={{ display: "flex", justifyContent: "space-between", padding: "12px", borderBottom: "1px solid #1e293b", color: "#e2e8f0", fontSize: "13px" }}>
                       <div>
                         <div style={{ fontWeight: 700, marginBottom: "4px" }}>{m.title}</div>
                         <div style={{ fontSize: "11px", color: "#64748b" }}>Type: <span style={{ color: "#a5b4fc" }}>{m.material_type}</span></div>
                       </div>
                       {m.file_url && <a href={m.file_url} target="_blank" rel="noreferrer" style={{ color: "#34d399", textDecoration: "none", alignSelf: "center", fontSize: "12px", fontWeight: 700 }}>Open File ↗</a>}
                    </div>
                 ))}
                 {!loading && auditMaterials.length === 0 && <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>No materials have been uploaded by the teacher yet.</div>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}><Btn onClick={() => setShowAuditModal(false)} variant="secondary">Close</Btn></div>
            </div>
          </div>
        )}

        {showRoomModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "500px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ color: "#f1f5f9", margin: 0 }}>Manage Rooms</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Btn onClick={() => downloadCSVTemplate("rooms")} size="sm" variant="ghost">Template</Btn>
                  <Btn onClick={() => { setImportType("rooms"); fileInputRef.current?.click(); }} size="sm" variant="ghost">Import CSV</Btn>
                  <Btn onClick={() => downloadCSVExport(rooms, "Rooms_Export.csv")} size="sm" variant="ghost">Export CSV</Btn>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                 <Input onChange={(e) => setNewRoomForm({...newRoomForm, name: e.target.value})} placeholder="Room Name (e.g. Rm 201)" value={newRoomForm.name} style={{ flex: 1 }} />
                 <Input type="number" onChange={(e) => setNewRoomForm({...newRoomForm, capacity: Number(e.target.value)})} placeholder="Cap" value={newRoomForm.capacity} style={{ width: "70px" }} />
                 <Btn onClick={handleCreateRoom}>Add Room</Btn>
              </div>
              <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #334155", borderRadius: "8px", background: "#0f172a" }}>
                 {rooms.map(r => (
                    <div key={r.room_id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #1e293b", color: "#e2e8f0", fontSize: "13px" }}>
                       <span>{r.room_name} (Max {r.capacity})</span>
                       <button onClick={() => handleDeleteRoom(r.room_id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button>
                    </div>
                 ))}
                 {rooms.length === 0 && <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>No rooms added yet.</div>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}><Btn onClick={() => setShowRoomModal(false)} variant="secondary">Close</Btn></div>
            </div>
          </div>
        )}

        {showCreateCodeModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ color: "#f1f5f9", margin: 0 }}>Create Code Group</h3>
                <Btn onClick={() => downloadCSVTemplate("courses")} size="sm" variant="ghost">Download Courses Template</Btn>
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
              <Input onChange={(e) => setCourseForm({ ...courseForm, units: Number(e.target.value) })} placeholder="Units" style={{ marginBottom: "16px" }} type="number" value={courseForm.units} />
              
              <div style={{ borderTop: "1px solid #334155", paddingTop: "12px", marginBottom: "16px" }}>
                 <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Prerequisites</div>
                 <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                   <Sel value="" onChange={(e) => { if(e.target.value && !courseForm.prereqs.includes(e.target.value)) setCourseForm({...courseForm, prereqs: [...courseForm.prereqs, e.target.value]}) }} style={{ flex: 1 }}>
                      <option value="">— Select to Add —</option>
                      {allCourses.map(c => <option key={c._uuid} value={c._uuid}>{c.code}</option>)}
                   </Sel>
                 </div>
                 <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                   {courseForm.prereqs.map(pId => (
                     <span key={pId} style={{ background: "rgba(99,102,241,.12)", color: "#a5b4fc", padding: "4px 8px", borderRadius: 4, fontSize: 11, display: "flex", alignItems: "center", gap: "6px" }}>
                       {allCourses.find(c => c._uuid === pId)?.code}
                       <span onClick={() => setCourseForm({...courseForm, prereqs: courseForm.prereqs.filter(id => id !== pId)})} style={{ cursor: "pointer", color: "#f87171" }}>✕</span>
                     </span>
                   ))}
                   {courseForm.prereqs.length === 0 && <span style={{ fontSize: "11px", color: "#64748b" }}>None added.</span>}
                 </div>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><Btn onClick={() => setShowCreateCourseModal(false)} variant="secondary">Cancel</Btn><Btn onClick={handleCreateCourse}>Save Course</Btn></div>
            </div>
          </div>
        )}

        {showEditCourseModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
              <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>Edit Course</h3>
              <Input onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="Course Code" style={{ marginBottom: "12px" }} value={courseForm.code} />
              <Input onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="Course Name" style={{ marginBottom: "12px" }} value={courseForm.name} />
              <Input onChange={(e) => setCourseForm({ ...courseForm, units: Number(e.target.value) })} placeholder="Units" style={{ marginBottom: "16px" }} type="number" value={courseForm.units} />
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
                 <Sel value={prereqFormCourseId} onChange={(e) => setPrereqFormCourseId(e.target.value)} style={{ flex: 1 }}>
                    <option value="">— Select Course to Add —</option>
                    {allCourses.filter(c => c._uuid !== selCourse?._uuid).map(c => <option key={c._uuid} value={c._uuid}>{c.code} — {c.name}</option>)}
                 </Sel>
                 <Btn onClick={handleAddPrerequisite}>Add</Btn>
              </div>

              <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #334155", borderRadius: "8px", background: "#0f172a" }}>
                 {prerequisites.map(p => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #1e293b", color: "#e2e8f0", fontSize: "13px" }}>
                       <span>{p.courses?.course_code} - {p.courses?.course_name}</span>
                       <button onClick={() => handleRemovePrerequisite(p.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button>
                    </div>
                 ))}
                 {prerequisites.length === 0 && <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>No prerequisites defined.</div>}
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

              <div style={{ marginBottom: "16px", padding: "12px", background: "#0f172a", borderRadius: "8px", border: "1px solid #334155" }}>
                <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "13px", marginBottom: "8px" }}>Source (Copy From)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <Sel value={rolloverForm.sourceSyId} onChange={(e) => setRolloverForm({...rolloverForm, sourceSyId: e.target.value})} style={{ width: "100%" }}>
                      <option value="">— Source SY —</option>
                      {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}</option>)}
                  </Sel>
                  <Sel value={rolloverForm.sourceTerm} onChange={(e) => setRolloverForm({...rolloverForm, sourceTerm: e.target.value})} style={{ width: "100%" }}>
                      {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </Sel>
                </div>
              </div>

              <div style={{ marginBottom: "16px", padding: "12px", background: "#0f172a", borderRadius: "8px", border: "1px solid #334155" }}>
                <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "13px", marginBottom: "8px" }}>Target (Paste Into)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <Sel value={rolloverForm.targetSyId} onChange={(e) => setRolloverForm({...rolloverForm, targetSyId: e.target.value})} style={{ width: "100%" }}>
                      <option value="">— Target SY —</option>
                      {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}</option>)}
                  </Sel>
                  <Sel value={rolloverForm.targetTerm} onChange={(e) => setRolloverForm({...rolloverForm, targetTerm: e.target.value})} style={{ width: "100%" }}>
                      {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </Sel>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <Btn onClick={() => setShowRolloverModal(false)} variant="secondary">Cancel</Btn>
                <Btn onClick={handleRollover} disabled={loading}>{loading ? "Processing..." : "Execute Rollover"}</Btn>
              </div>
            </div>
          </div>
        )}

        {showMappingModal && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ color: "#f1f5f9", margin: 0 }}>Create Program Mapping</h3>
                <Btn onClick={() => downloadCSVTemplate("mappings")} size="sm" variant="ghost">Template</Btn>
              </div>
              <FF label="Course"><Sel value={mappingForm.courseId} onChange={e => setMappingForm({...mappingForm, courseId: e.target.value})} style={{ marginBottom: "12px", width: "100%" }}><option value="">— Select Course —</option>{allCourses.map(c => <option key={c._uuid} value={c._uuid}>{c.code} - {c.name}</option>)}</Sel></FF>
              <FF label="Program"><Sel value={mappingForm.programId} onChange={e => setMappingForm({...mappingForm, programId: e.target.value})} style={{ marginBottom: "12px", width: "100%" }}><option value="">— Select Program —</option>{programs.map(p => <option key={p.program_id} value={p.program_id}>{p.code}</option>)}</Sel></FF>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                <FF label="Year"><Sel value={mappingForm.yearLevel} onChange={e => setMappingForm({...mappingForm, yearLevel: e.target.value})} style={{ width: "100%" }}>{YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}</Sel></FF>
                <FF label="Sem"><Sel value={mappingForm.semester} onChange={e => setMappingForm({...mappingForm, semester: e.target.value})} style={{ width: "100%" }}>{SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}</Sel></FF>
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><Btn onClick={() => setShowMappingModal(false)} variant="secondary">Cancel</Btn><Btn onClick={handleCreateMapping}>Save Mapping</Btn></div>
            </div>
          </div>
        )}

        {(showCreateSectionModal || showEditSectionModal) && (
          <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "450px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ color: "#f1f5f9", margin: 0 }}>{showEditSectionModal ? "Edit Section Setup" : "Create Section"}</h3>
                {!showEditSectionModal && <Btn onClick={() => downloadCSVTemplate("sections")} size="sm" variant="ghost">Template</Btn>}
              </div>
              
              {!selCourse && mainTab === "offerings" && !showEditSectionModal && (
                <Sel value={sectionForm.courseId} onChange={(e) => setSectionForm({...sectionForm, courseId: e.target.value})} style={{ marginBottom: "12px", width: "100%" }}>
                   <option value="">— Select Course —</option>
                   {allCourses.map(c => <option key={c._uuid} value={c._uuid}>{c.code} — {c.name}</option>)}
                </Sel>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                 <Sel value={sectionForm.syId} onChange={(e) => setSectionForm({...sectionForm, syId: e.target.value})} disabled={showEditSectionModal} style={{ width: "100%", opacity: showEditSectionModal ? 0.6 : 1 }}>
                    <option value="">— Select SY —</option>
                    {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}</option>)}
                 </Sel>
                 <Sel value={sectionForm.term} onChange={(e) => setSectionForm({...sectionForm, term: e.target.value})} disabled={showEditSectionModal} style={{ width: "100%", opacity: showEditSectionModal ? 0.6 : 1 }}>
                    {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                 </Sel>
              </div>

              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                 <Input value={sectionForm.sectionLabel} onChange={(e) => setSectionForm({...sectionForm, sectionLabel: e.target.value.toUpperCase()})} disabled={showEditSectionModal} placeholder="Label" style={{ width: "80px", opacity: showEditSectionModal ? 0.6 : 1 }} />
                 <div style={{ fontSize: "11px", color: "#64748b", alignSelf: "center", lineHeight: "1.2" }}>
                   {showEditSectionModal ? "Course identifiers cannot be changed after creation." : "Auto-generates next available code. Edit to override."}
                 </div>
              </div>

              <Sel value={sectionForm.teacherId} onChange={(e) => setSectionForm({...sectionForm, teacherId: e.target.value})} style={{ marginBottom: "4px", width: "100%" }}>
                 <option value="">— Select Teacher —</option>
                 {users.filter(u => u.role === "teacher").map(t => <option key={t._uuid} value={t._uuid}>{t.fullName}</option>)}
              </Sel>
              {teacherWorkload !== null && <div style={{ fontSize: "11px", color: "#fbbf24", marginBottom: "12px", fontWeight: 700 }}>Active Workload This Term: {teacherWorkload} Units</div>}

              <Sel value={sectionForm.roomId} onChange={(e) => setSectionForm({...sectionForm, roomId: e.target.value})} style={{ marginBottom: "12px", width: "100%" }}>
                 <option value="">— Select Room —</option>
                 {rooms.map(r => <option key={r.room_id} value={r.room_id}>{r.room_name} (Max {r.capacity})</option>)}
              </Sel>

              <Sel value={sectionForm.scheduleLabel} onChange={(e) => setSectionForm({...sectionForm, scheduleLabel: e.target.value})} style={{ marginBottom: "12px", width: "100%" }}>
                 <option value="">— Select Schedule Block —</option>
                 {SCHEDULE_BLOCKS.map(block => <option key={block} value={block}>{block}</option>)}
              </Sel>

              <Input type="number" value={sectionForm.maxCapacity} onChange={(e) => setSectionForm({...sectionForm, maxCapacity: Number(e.target.value)})} placeholder="Max Capacity" style={{ marginBottom: "16px" }} />

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