import { useEffect, useState } from 'react';
import { supabase } from '../../../../supabaseClient';

/**
 * Interface: FilterState
 */
interface FilterState {
    blockId: string;
    days: string[];
    endTime: string;
    programId: string;
    sectionLabel: string;
    startTime: string;
}

/**
 * Interface: SortState
 */
interface SortState {
    dir: "asc" | "desc";
    field: string;
}

/**
 * useOfferingsData
 * Fetches course sections and joins relation counts to accurately calculate current enrollment.
 */
export function useOfferingsData(
    searchName: string,
    filterSy: string,
    filterSemester: string,
    filters: FilterState,
    offPage: number,
    offPageSize: number,
    offSort: SortState
) {
    const [isLoading, setIsLoading] = useState(false);
    const [offeringCount, setOfferingCount] = useState(0);
    const [offerings, setOfferings] = useState<any[]>([]);

    async function fetchOfferings() {
        setIsLoading(true);

        // Added `student_section_assignments(count)` to dynamically pull the enrolled count
        let q = supabase
            .from("course_sections")
            .select("*, courses!inner(course_code, course_name), rooms(room_name), program(code), academic_blocks(block_name), users!teacher_id(full_name), student_section_assignments(count)", { count: "exact" });
        
        if (filterSy) q = q.eq("sy_id", filterSy);
        if (filterSemester) q = q.eq("semester", filterSemester);
        if (searchName) q = q.ilike("courses.course_name", `%${searchName}%`);
        if (filters.sectionLabel) q = q.eq("section_label", filters.sectionLabel);
        if (filters.blockId) q = q.eq("block_id", filters.blockId);
        if (filters.programId) q = q.eq("program_id", filters.programId);

        const sortFieldMap: Record<string, string> = {
            "course_code": "courses(course_code)",
            "course_name": "courses(course_name)",
            "section_label": "section_label",
            "block_name": "academic_blocks(block_name)",
            "teacher_name": "users(full_name)",
            "schedule_label": "schedule_label",
            "max_capacity": "max_capacity",
            "created_at": "created_at"
        };

        const orderCol = sortFieldMap[offSort.field] || "created_at";
        q = q.order(orderCol, { ascending: offSort.dir === "asc" });

        const from = offPage * offPageSize;
        const to = from + offPageSize - 1;
        q = q.range(from, to);

        const { data, count, error } = await q;

        if (error) {
            console.error("Supabase Offerings Fetch Error:", error.message);
            setOfferings([]);
            setOfferingCount(0);
        } else if (data) {
            const results = data.map((s: any) => ({
                ...s,
                block_name: s.academic_blocks?.block_name || "Unassigned",
                course_code: s.courses?.course_code,
                course_name: s.courses?.course_name,
                program_code: s.program?.code || "All",
                room_name: s.rooms?.room_name || "Unassigned",
                teacher_name: s.users?.full_name || "Unassigned",
                // Extract joined count
                enrolled_count: s.student_section_assignments?.[0]?.count || 0
            }));

            let filteredResults = results;
            if (filters.days.length > 0) {
                filteredResults = results.filter(s => filters.days.some(day => s.schedule_label?.includes(day)));
            }

            setOfferings(filteredResults);
            setOfferingCount(count || 0);
        }
        
        setIsLoading(false);
    }

    useEffect(() => {
        void fetchOfferings();
    }, [searchName, filterSy, filterSemester, filters, offPage, offSort]);

    const getExportData = async () => {
        let q = supabase
            .from("course_sections")
            .select("*, courses!inner(course_code, course_name), users!teacher_id(full_name), academic_blocks(block_name), student_section_assignments(count)");
        
        if (filterSy) q = q.eq("sy_id", filterSy);
        if (filterSemester) q = q.eq("semester", filterSemester);
        if (searchName) q = q.ilike("courses.course_name", `%${searchName}%`);
        
        const { data } = await q;
        
        // Map enrolled count into export data
        return data?.map((s: any) => ({
            ...s,
            enrolled_count: s.student_section_assignments?.[0]?.count || 0
        })) || [];
    };

    return { 
        isLoading, 
        offeringCount, 
        offerings, 
        refreshOfferings: fetchOfferings, 
        getExportData 
    };
}