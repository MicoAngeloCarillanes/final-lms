import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../../supabaseClient';

export function useReferenceData() {
  const [academicBlocks, setAcademicBlocks] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [sectionLabels, setSectionLabels] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]); 

  const isFetching = useRef(false); 
  
  async function fetchReferences() {
    if (isFetching.current) return;
    isFetching.current = true;
    setIsLoading(true);
    
    const [syRes, roomRes, progRes, schedRes, blockRes, facRes, crsRes, tchRes, lblRes] = await Promise.all([
      supabase.from("school_years").select("*").order("created_at", { ascending: false }),
      supabase.from("rooms").select("*").order("room_name"),
      supabase.from("program").select("*").eq("is_active", true),
      supabase.from("schedules").select("*").order("schedule_label"),
      supabase.from("academic_blocks").select("*, program(code)"),
      supabase.from("users").select("user_id, full_name").eq("role", "teacher").order("full_name"),
      supabase.from("courses").select("course_id, course_code, course_name").order("course_code"),
      supabase.from("teachers").select("user_id, employee_number"),
      supabase.from("course_sections").select("section_label")
    ]);

    setSchoolYears(syRes.data || []);
    setRooms(roomRes.data || []);
    setPrograms(progRes.data || []);
    setSchedules(schedRes.data || []);
    setFaculty(facRes.data || []);
    setCourses(crsRes.data || []);
    setTeachers(tchRes.data || []);
    
    // Extract unique labels for searchable dropdown
    const uniqueLabels = Array.from(new Set((lblRes.data || []).map(l => l.section_label))).filter(Boolean).sort();
    setSectionLabels(uniqueLabels);

    setAcademicBlocks((blockRes.data || []).map(b => ({
      ...b,
      csvMatch: b.block_name, 
      label: `${b.program?.code || 'Gen'} - Block ${b.block_name} (${b.year_level})`
    })));

    setIsLoading(false);
    isFetching.current = false;
  }

  useEffect(() => {
    void fetchReferences();
  }, []);

  return { 
    academicBlocks, 
    courses, 
    faculty, 
    isLoading, 
    programs, 
    rooms, 
    schedules, 
    schoolYears, 
    sectionLabels,
    teachers 
  };
}