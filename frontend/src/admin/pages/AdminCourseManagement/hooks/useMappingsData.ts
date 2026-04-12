import { useEffect, useState } from 'react';
import { supabase } from '../../../../supabaseClient';

interface SortState {
    dir: "asc" | "desc";
    field: string;
}

/**
 * useMappingsData
 * * Manages the state and Supabase logic for Course-to-Program mappings.
 * * Joins courses, programs, and school years for a complete record view.
 */
export function useMappingsData(
    filterCourse: string,
    filterProg: string,
    filterYear: string,
    filterSemester: string,
    mappingSearch: string,
    mapSort: SortState,
    curriculumSy?: string
) {
    const [isLoading, setIsLoading] = useState(false);
    const [mappings, setMappings] = useState<any[]>([]);

    /**
     * Fetches the program mappings with related metadata.
     */
    async function fetchMappings() {
        setIsLoading(true);
        
        // Determine if we need to sort on a foreign table column
        const isForeignSort = ["course_code", "course_name", "program_code", "school_year"].includes(mapSort.field);
        
        let q = supabase
            .from("course_program_map")
            .select(`
                id, course_id, program_id, year_level, semester, effective_sy_id,
                courses!inner(course_code, course_name, units),
                program!inner(name, code),
                school_years!effective_sy_id(label)
            `);
        
        // Apply filters
        if (filterCourse) q = q.eq("course_id", filterCourse);
        if (filterProg) q = q.eq("program_id", filterProg);
        if (filterYear) q = q.eq("year_level", filterYear);
        if (filterSemester) q = q.eq("semester", filterSemester);
        if (curriculumSy) q = q.eq("effective_sy_id", curriculumSy);
        if (mappingSearch) q = q.ilike("courses.course_name", `%${mappingSearch}%`);
        
        if (!isForeignSort) {
            q = q.order(mapSort.field, { ascending: mapSort.dir === "asc" });
        }

        const { data, error } = await q;
        
        if (!error && data) {
            let formatted = data.map((m: any) => ({
                ...m,
                course_code: m.courses?.course_code,
                course_name: m.courses?.course_name,
                program_code: m.program?.code,
                school_year: m.school_years?.label || "None",
                units: m.courses?.units || 0
            }));

            // Manual sort for foreign keys or joined labels
            if (isForeignSort) {
                 formatted.sort((a, b) => {
                    const valA = String(a[mapSort.field] || "").toLowerCase();
                    const valB = String(b[mapSort.field] || "").toLowerCase();
                    return mapSort.dir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
                 });
            }
            setMappings(formatted);
        }
        
        setIsLoading(false);
    }

    useEffect(() => {
        void fetchMappings();
    }, [filterCourse, filterProg, filterYear, filterSemester, mappingSearch, mapSort, curriculumSy]);

    return {
        isLoading,
        mappings,
        refreshMappings: fetchMappings
    };
}