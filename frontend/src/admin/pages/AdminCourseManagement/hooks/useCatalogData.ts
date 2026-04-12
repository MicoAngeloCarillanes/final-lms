import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../supabaseClient';

interface SortState {
    dir: "asc" | "desc";
    field: string;
}

/**
 * useCatalogData
 * logic: Master hook for course catalog management.
 * fixes: Uses actual DB column names for sorting to prevent PGRST errors.
 */
export function useCatalogData(
    codeSearch: string,
    codeSort: SortState,
    courseSearch: string,
    courseSort: SortState,
    selCode: string | null
) {
    const [isLoading, setIsLoading] = useState(false);
    const [allCourses, setAllCourses] = useState<any[]>([]);
    const [codeGroups, setCodeGroups] = useState<any[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [globalPrereqs, setGlobalPrereqs] = useState<Record<string, string[]>>({});

    /**
     * getCodePrefix
     * logic: Extracts alphabetic prefix from course codes.
     */
    function getCodePrefix(courseCode: string): string {
        return (courseCode || "").match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || "OTHER";
    }

    /**
     * fetchAllCourses
     * logic: Loads master list and prerequisite maps.
     */
    const fetchAllCourses = useCallback(async () => {
        setIsLoading(true);
        const { data: rawCourses, error } = await supabase
            .from("courses")
            .select("course_id, course_code, course_name, units, is_active")
            .order("course_code", { ascending: true });
            
        const { data: preData } = await supabase
            .from("course_prerequisites")
            .select("course_id, courses!prereq_course_id(course_code)");
        
        if (!error) {
            const normalized = (rawCourses || []).map((course) => ({
                _uuid: course.course_id, 
                code: course.course_code, 
                id: course.course_code,
                isActive: course.is_active, 
                name: course.course_name, 
                units: course.units
            }));
            setAllCourses(normalized);
        }
        
        const pMap: Record<string, string[]> = {};
        preData?.forEach((p: any) => {
            if (!pMap[p.course_id]) pMap[p.course_id] = [];
            if (p.courses?.course_code) pMap[p.course_id].push(p.courses.course_code);
        });
        
        setGlobalPrereqs(pMap);
        setIsLoading(false);
    }, []);

    /**
     * fetchCodesAPI
     * logic: Fetches and groups course prefixes.
     */
    const fetchCodesAPI = useCallback(async () => {
        setIsLoading(true);
        let q = supabase.from("courses").select("course_code");
        if (codeSearch) q = q.ilike("course_code", `${codeSearch}%`);
        
        const { data, error } = await q;
        if (!error && data) {
            const map: Record<string, number> = {};
            data.forEach((course) => {
                const prefix = getCodePrefix(course.course_code);
                map[prefix] = (map[prefix] || 0) + 1;
            });
            const grouped = Object.entries(map).map(([prefix, count]) => ({ count, id: prefix, prefix }));
            grouped.sort((a, b) => {
                if (codeSort.field === "count") return codeSort.dir === "asc" ? a.count - b.count : b.count - a.count;
                return codeSort.dir === "asc" ? a.prefix.localeCompare(b.prefix) : b.prefix.localeCompare(a.prefix);
            });
            setCodeGroups(grouped);
        }
        setIsLoading(false);
    }, [codeSearch, codeSort]);

    /**
     * fetchCoursesAPI
     * logic: Server-side sort and filter for courses.
     * fix: Maps 'name' UI field to 'course_name' DB column.
     */
    const fetchCoursesAPI = useCallback(async () => {
        if (!selCode) return;
        setIsLoading(true);

        const sortMap: Record<string, string> = {
            "code": "course_code",
            "name": "course_name",
            "units": "units"
        };
        const dbSortField = sortMap[courseSort.field] || "course_code";

        let q = supabase
            .from("courses")
            .select("course_id, course_code, course_name, units, is_active")
            .ilike("course_code", `${selCode}%`);

        if (courseSearch) {
            q = q.or(`course_name.ilike.%${courseSearch}%,course_code.ilike.%${courseSearch}%`);
        }

        q = q.order(dbSortField, { ascending: courseSort.dir === "asc" });
        
        const { data, error } = await q;
        if (!error && data) {
            const normalized = data.map((course) => ({
                _uuid: course.course_id, 
                code: course.course_code, 
                id: course.course_code,
                isActive: course.is_active, 
                name: course.course_name, 
                units: course.units
            }));
            setCourses(normalized);
        }
        setIsLoading(false);
    }, [courseSearch, courseSort, selCode]);

    /**
     * bulkDeleteCourses
     * logic: Handles paired deletion for integrated LEC/LAB.
     */
    async function bulkDeleteCourses(ids: string[]) {
        if (ids.length === 0) return { error: null };
        const targets = courses.filter(c => ids.includes(c._uuid));
        const standaloneIds: string[] = [];
        const pairedBaseCodes: string[] = [];

        targets.forEach(target => {
            if (target.code.endsWith("_LEC") || target.code.endsWith("_LAB")) {
                const baseCode = target.code.replace(/_(LEC|LAB)$/, '');
                if (!pairedBaseCodes.includes(baseCode)) pairedBaseCodes.push(baseCode);
            } else {
                standaloneIds.push(target._uuid);
            }
        });

        const deletionPromises: Promise<any>[] = [];
        if (standaloneIds.length > 0) deletionPromises.push(supabase.from("courses").delete().in("course_id", standaloneIds));
        pairedBaseCodes.forEach(baseCode => deletionPromises.push(supabase.from("courses").delete().ilike("course_code", `${baseCode}_%`)));

        const results = await Promise.all(deletionPromises);
        const firstError = results.find(r => r.error)?.error;

        if (!firstError) {
            await Promise.all([fetchCoursesAPI(), fetchCodesAPI(), fetchAllCourses()]);
        }
        return { error: firstError || null };
    }

    /**
     * bulkDeletePrefixes
     * logic: Deletion by group prefix.
     */
    async function bulkDeletePrefixes(prefixes: string[]) {
        if (prefixes.length === 0) return { error: null };
        const promises = prefixes.map(p => supabase.from("courses").delete().ilike("course_code", `${p}%`));
        const results = await Promise.all(promises);
        const error = results.find(r => r.error)?.error;

        if (!error) await Promise.all([fetchCodesAPI(), fetchAllCourses()]);
        return { error };
    }

    useEffect(() => { void fetchAllCourses(); }, [fetchAllCourses]);
    useEffect(() => { void fetchCodesAPI(); }, [fetchCodesAPI]);
    useEffect(() => { void fetchCoursesAPI(); }, [fetchCoursesAPI]);

    return {
        allCourses,
        codeGroups,
        courses,
        globalPrereqs,
        isLoading,
        bulkDeleteCourses,
        bulkDeletePrefixes,
        refreshCodes: fetchCodesAPI,
        refreshCourses: fetchCoursesAPI,
        refreshAllCourses: fetchAllCourses
    };
}