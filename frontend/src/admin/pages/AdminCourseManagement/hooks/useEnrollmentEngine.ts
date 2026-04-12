import { useEffect, useState } from 'react';
import { supabase } from '../../../../supabaseClient';

interface ConflictModalState {
  //
  batchContext?: { sections: string[] };

  //
  conflicted: any[];

  //
  courseId: string;

  //
  forceIds: string[];

  //
  sectionId: string;

  //
  show: boolean;

  //
  validIds: string[];
}

/**
 * useEnrollmentEngine
 *
 * Handles all business logic for calculating student eligibility, checking schedule conflicts,
 * and executing batch enrollments into course sections.
 */
export function useEnrollmentEngine(
  sections: any[],
  selectedSectionIds: string[],
  selCourse: any | null,
  strictBlockFilter: boolean,
  studentSearch: string
) {
  const [isLoading, setIsLoading] = useState(false);
  
  const [conflictModal, setConflictModal] = useState<ConflictModalState>({ 
    conflicted: [], 
    courseId: "", 
    forceIds: [], 
    sectionId: "", 
    show: false, 
    validIds: [] 
  });
  
  const [eligibleStudents, setEligibleStudents] = useState<any[]>([]);
  const [forceEnroll, setForceEnroll] = useState(false);
  const [selStudents, setSelStudents] = useState<string[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);

  /**
   * Evaluates and fetches students who are eligible to join the selected sections,
   * applying strict block filtering if enabled.
   */
  async function fetchEligibleStudents() {
    if (selectedSectionIds.length === 0 || !selCourse) {
      setEligibleStudents([]);
      return;
    }

    setIsLoading(true);

    const { data: mappedPrograms } = await supabase
      .from("course_program_map")
      .select("program_id")
      .eq("course_id", selCourse._uuid);

    const validProgramIds = (mappedPrograms || []).map((p: any) => p.program_id);

    let studentQuery = supabase
      .from("students")
      .select(`
        user_id,
        student_id,
        program_id,
        year_level,
        block_id,
        users!inner (
          full_name,
          display_id,
          is_active
        )
      `);

    if (validProgramIds.length > 0) {
      studentQuery = studentQuery.in("program_id", validProgramIds);
    }

    const { data: studentsData, error: stuErr } = await studentQuery;

    if (!stuErr && studentsData) {
      const blockIds = Array.from(new Set(studentsData.map((d: any) => d.block_id).filter(Boolean)));
      const blockMap: Record<string, string> = {};
      
      if (blockIds.length > 0) {
        const { data: bsData } = await supabase
          .from("academic_blocks")
          .select("block_id, block_name")
          .in("block_id", blockIds);
        
        if (bsData) {
          bsData.forEach((bs: any) => {
            blockMap[bs.block_id] = bs.block_name;
          });
        }
      }

      const formatted = studentsData.map((d: any) => {
        const user = Array.isArray(d.users) ? d.users[0] : d.users;
        return {
          _uuid: d.user_id,
          blockLabel: d.block_id ? blockMap[d.block_id] : null,
          displayId: d.student_id || user?.display_id || "",
          fullName: user?.full_name || "Unknown",
          isActive: user?.is_active,
          programId: d.program_id,
          yearLevel: d.year_level
        };
      }).filter((s: any) => s.isActive);

      const uniqueStudents = Array.from(
        new Map(formatted.map((item: any) => [item._uuid, item])).values()
      );

      const selectedSectionsData = sections.filter(s => selectedSectionIds.includes(s.section_id));
      const selectedLabels = selectedSectionsData.map(s => s.section_label);

      const filteredByBlock = strictBlockFilter
        ? uniqueStudents.filter((s: any) => s.blockLabel && selectedLabels.includes(s.blockLabel))
        : uniqueStudents;

      const { data: enrolledData } = await supabase
        .from("student_section_assignments")
        .select("student_id")
        .in("section_id", selectedSectionIds);

      const enrolledIds = new Set((enrolledData || []).map((e: any) => String(e.student_id)));
      let finalEligible = filteredByBlock.filter((s: any) => !enrolledIds.has(String(s._uuid)));

      if (studentSearch) {
        const lowerSearch = studentSearch.toLowerCase();
        finalEligible = finalEligible.filter((s: any) => 
           s.fullName.toLowerCase().includes(lowerSearch) || 
           s.displayId.toLowerCase().includes(lowerSearch)
        );
      }

      setEligibleStudents(finalEligible);
    } else {
      setEligibleStudents([]);
    }

    setIsLoading(false);
  }

  useEffect(() => {
    void fetchEligibleStudents();
  }, [selectedSectionIds, studentSearch, selCourse, strictBlockFilter, sections]);

  /**
   * Checks if a list of students have a schedule conflict with a proposed class time.
   */
  async function checkStudentConflicts(students: string[], syId: string, semester: string, scheduleLabel: string): Promise<string[]> {
    if (!scheduleLabel) return [];
    
    const { data, error } = await supabase.from("student_section_assignments")
      .select("student_id, course_sections!inner(schedule_label, sy_id, semester)")
      .in("student_id", students)
      .eq("course_sections.sy_id", syId)
      .eq("course_sections.semester", semester)
      .eq("course_sections.schedule_label", scheduleLabel);

    if (error || !data) return [];
    return data.map((d: any) => d.student_id);
  }

  /**
   * Executes the batch enrollment transaction, handling capacities and waitlisting.
   */
  async function processEnrollmentBatch(
    validIds: string[], 
    forceIds: string[], 
    cId: string, 
    sId: string, 
    customSectionArray?: string[]
  ) {
    setIsLoading(true);
    let enrolledCount = 0;
    let waitlistedCount = 0;

    const targets = customSectionArray || [sId];

    for (const sectionId of targets) {
       const targetSec = sections.find(s => s.section_id === sectionId);
       const maxCap = targetSec?.max_capacity || Infinity;

       const { count } = await supabase
         .from("student_section_assignments")
         .select("*", { count: "exact", head: true })
         .eq("section_id", sectionId)
         .eq("enrollment_status", "Enrolled");

       let currentEnrolled = count || 0;
       const allToEnroll = [...validIds, ...forceIds];

       for (const studentId of allToEnroll) {
         const status = currentEnrolled < maxCap ? "Enrolled" : "Waitlisted";
         
         const { error } = await supabase.from("student_section_assignments").upsert({
           enrollment_status: status,
           section_id: sectionId,
           student_id: studentId
         }, { onConflict: "student_id, section_id" });

         if (!error) {
           if (status === "Enrolled") {
             enrolledCount++;
             currentEnrolled++;
           }
           if (status === "Waitlisted") {
             waitlistedCount++;
           }
         }
       }
    }

    const successfullyEnrolled = new Set([...validIds, ...forceIds]);
    setEligibleStudents(prev => prev.filter(s => !successfullyEnrolled.has(s._uuid)));

    setConflictModal({ conflicted: [], courseId: "", forceIds: [], sectionId: "", show: false, validIds: [] });
    setSelStudents([]);
    setIsLoading(false);

    return { enrolledCount, waitlistedCount };
  }

  return {
    checkStudentConflicts,
    conflictModal,
    eligibleStudents,
    forceEnroll,
    isLoading,
    processEnrollmentBatch,
    selStudents,
    setConflictModal,
    setForceEnroll,
    setSelStudents
  };
}