import { useMemo } from 'react';
import { useCatalogData } from './useCatalogData';
import { useMappingsData } from './useMappingsData';

// Hoist these constants OUTSIDE the component so they retain a stable memory reference.
// This prevents the shallow-equality checks in useEffect from triggering an infinite loop.
const MAPPINGS_SORT = { dir: "asc" as const, field: "year_level" };
const CODE_SORT = { dir: "asc" as const, field: "prefix" };
const COURSE_SORT = { dir: "asc" as const, field: "course_code" };

/**
 * useCurriculumData
 * * Aggregates mapping and prerequisite data specifically for the Curriculum view.
 * Handles the complex grouping logic into Year Levels and Semesters.
 */
export function useCurriculumData(selectedProgramId: string, effectiveSyId: string) {
  // Reuse existing mapping hook with strict curriculum filters and stable sort objects
  const { mappings, isLoading: isMappingsLoading } = useMappingsData(
    "", 
    selectedProgramId, 
    "", 
    "", 
    "", 
    MAPPINGS_SORT,
    effectiveSyId
  );

  // Reuse catalog hook to get global prerequisite mappings with stable sort objects
  const { globalPrereqs, isLoading: isCatalogLoading } = useCatalogData(
    "", CODE_SORT, "", COURSE_SORT, null
  );

  /**
   * Transforms raw mapping data into a grouped structure:
   * Record<YearLevel, Record<Semester, Mapping[]>>
   */
  const groupedCurriculum = useMemo(() => {
    if (!selectedProgramId || mappings.length === 0) return {};
    
    const groups: any = {};
    mappings.forEach((m: any) => {
      if (!groups[m.year_level]) groups[m.year_level] = {};
      if (!groups[m.year_level][m.semester]) groups[m.year_level][m.semester] = [];
      groups[m.year_level][m.semester].push(m);
    });
    return groups;
  }, [mappings, selectedProgramId]);

  return {
    globalPrereqs,
    groupedCurriculum,
    isLoading: isMappingsLoading || isCatalogLoading,
    rawMappings: mappings
  };
}