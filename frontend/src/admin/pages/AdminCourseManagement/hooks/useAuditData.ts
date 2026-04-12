import { useEffect, useState } from 'react';
import { supabase } from '../../../../supabaseClient';

/**
 * useAuditData
 *
 * Provides specialized data fetching for auditing teacher-uploaded materials.
 * Joins materials with courses, sections, and faculty profiles.
 */
export function useAuditData(
  searchQuery: string,
  syId: string,
  semester: string,
  typeFilter: string
) {
  const [isLoading, setIsLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);

  /**
   * Fetches the material audit log from Supabase.
   *
   * @returns
   */
  async function fetchAuditLog() {
    setIsLoading(true);

    let q = supabase
      .from("course_materials")
      .select(`
        *,
        course_sections!inner (
          section_label,
          sy_id,
          semester,
          courses (
            course_code,
            course_name
          ),
          users (
            full_name
          )
        )
      `)
      .order("created_at", { ascending: false });

    // Filter by term logistics
    if (syId) q = q.eq("course_sections.sy_id", syId);
    if (semester) q = q.eq("course_sections.semester", semester);
    
    // Filter by material type (Syllabus, Assignment, etc.)
    if (typeFilter) q = q.eq("material_type", typeFilter);

    // Search by title or course code
    if (searchQuery) {
      q = q.or(`title.ilike.%${searchQuery}%,course_sections.courses.course_code.ilike.%${searchQuery}%`);
    }

    const { data, error } = await q;

    if (!error && data) {
      setMaterials(data.map(m => ({
        ...m,
        courseCode: m.course_sections?.courses?.course_code,
        courseName: m.course_sections?.courses?.course_name,
        sectionLabel: m.course_sections?.section_label,
        teacherName: m.course_sections?.users?.full_name || "Unassigned"
      })));
    }

    setIsLoading(false);
  }

  useEffect(() => {
    void fetchAuditLog();
  }, [searchQuery, syId, semester, typeFilter]);

  return {
    isLoading,
    materials,
    refreshAudit: fetchAuditLog
  };
}