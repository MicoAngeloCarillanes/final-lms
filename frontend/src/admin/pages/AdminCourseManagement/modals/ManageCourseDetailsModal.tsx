import { useCallback, useEffect, useState } from 'react';
import LMSGrid from '../../../../components/LMSGrid';
import { Btn, FF, Input } from '../../../../components/ui';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { supabase } from '../../../../supabaseClient';
import { useReferenceData } from '../hooks/useReferenceData';
import SectionDetailsModal from './SectionDetailsModal';

interface ManageCourseDetailsModalProps {
    course: any;
    onClose: () => void;
}

/**
 * ManageCourseDetailsModal
 * * logic: Unified workspace for Course Offerings and Curricular Mapping.
 * * filters: Primary search (Section Label) on Enter. Advanced filters (Block/Prof) via Modal.
 * * sorting: Full server-side sorting for both Offerings and Program Eligibility tables.
 */
export default function ManageCourseDetailsModal({ course, onClose }: ManageCourseDetailsModalProps) {
    const { academicBlocks, faculty } = useReferenceData();
    
    // Data States
    const [sections, setSections] = useState<any[]>([]);
    const [mappings, setMappings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Selection States
    const [selSections, setSelSections] = useState<string[]>([]);
    const [selMappings, setSelMappings] = useState<string[]>([]);
    
    // Search & Filter States
    const [sectionDraft, setSectionDraft] = useState("");
    const [committedSearch, setCommittedSearch] = useState("");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    const initialFilters = { blockId: "", teacherId: "" };
    const [filtersDraft, setFiltersDraft] = useState(initialFilters);
    const [filters, setFilters] = useState(initialFilters);

    // Grid Configuration States
    const [offSort, setOffSort] = useState({ dir: "asc" as const, field: "section_label" });
    const [mapSort, setMapSort] = useState({ dir: "asc" as const, field: "code" });
    const [viewingSection, setViewingSection] = useState<any | null>(null);

    /**
     * fetchData
     * logic: Fetches offerings and mappings with full server-side sort/filter support.
     * standard: Uses relational sorting for program code/name.
     */
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        
        // --- Logic: Prepare Offering Query ---
        const offSortMap: Record<string, string> = {
            "section_label": "section_label",
            "block_name": "academic_blocks(block_name)",
            "teacher_name": "users(full_name)",
            "capacity": "max_capacity"
        };
        const dbOffSort = offSortMap[offSort.field] || "section_label";

        let secQ = supabase
            .from("course_sections")
            .select(`
                *, 
                rooms(room_name), 
                program(code), 
                academic_blocks(block_name), 
                users!teacher_id(full_name), 
                student_section_assignments(count)
            `)
            .eq("course_id", course._uuid);

        if (committedSearch) secQ = secQ.ilike("section_label", `%${committedSearch}%`);
        if (filters.blockId) secQ = secQ.eq("block_id", filters.blockId);
        if (filters.teacherId) secQ = secQ.eq("teacher_id", filters.teacherId);

        secQ = secQ.order(dbOffSort, { ascending: offSort.dir === "asc" });

        // --- Logic: Prepare Mapping Query ---
        const mapSortMap: Record<string, string> = {
            "code": "program(code)",
            "name": "program(name)"
        };
        const dbMapSort = mapSortMap[mapSort.field] || "program(code)";

        const mapQ = supabase
            .from('course_program_map')
            .select('program_id, program(code, name)')
            .eq('course_id', course._uuid)
            .order(dbMapSort, { ascending: mapSort.dir === "asc" });

        const [secRes, mapRes] = await Promise.all([secQ, mapQ]);

        if (!secRes.error) {
            setSections(secRes.data.map(s => ({
                ...s,
                block_name: s.academic_blocks?.block_name || "Unassigned",
                teacher_name: s.users?.full_name || "Unassigned",
                enrolled_count: s.student_section_assignments?.[0]?.count || 0
            })));
        }

        if (!mapRes.error) {
            setMappings(mapRes.data.map(m => ({
                id: m.program_id,
                code: m.program?.code,
                name: m.program?.name
            })));
        }
        setIsLoading(false);
    }, [course._uuid, committedSearch, filters, offSort, mapSort]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    /**
     * handleSearchKeyDown
     * logic: Primary filter triggers only on Enter.
     */
    function handleSearchKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') {
            setCommittedSearch(sectionDraft);
        }
    }

    /**
     * handleApplyFilters
     * logic: Explicitly commits modal filters to state.
     */
    function handleApplyFilters() {
        setFilters(filtersDraft);
        setIsFilterOpen(false);
    }

    /**
     * handleClearFilters
     * logic: Resets both drafting and committed filter states.
     */
    function handleClearFilters() {
        setFiltersDraft(initialFilters);
        setFilters(initialFilters);
        setIsFilterOpen(false);
    }

    async function handleBulkDeleteSections() {
        if (!confirm(`Delete ${selSections.length} selected sections?`)) return;
        const { error } = await supabase.from('course_sections').delete().in('section_id', selSections);
        if (!error) {
            setSelSections([]);
            void fetchData();
        }
    }

    async function handleBulkDeleteMappings() {
        if (!confirm(`Remove access for ${selMappings.length} programs?`)) return;
        const { error } = await supabase.from('course_program_map').delete().in('program_id', selMappings).eq('course_id', course._uuid);
        if (!error) {
            setSelMappings([]);
            void fetchData();
        }
    }

    const sectionCols = [
        {
            headerRenderer: () => (
                <input type="checkbox" checked={sections.length > 0 && selSections.length === sections.length} 
                    onChange={e => setSelSections(e.target.checked ? sections.map(s => s.section_id) : [])} />
            ),
            cellRenderer: (_: any, row: any) => (
                <input type="checkbox" checked={selSections.includes(row.section_id)} 
                    onChange={() => setSelSections(p => p.includes(row.section_id) ? p.filter(id => id !== row.section_id) : [...p, row.section_id])} />
            ),
            width: 40, sortable: false
        },
        { field: "section_label", header: "Section", width: 130, sortable: true },
        { field: "block_name", header: "Block", width: 110, sortable: true },
        { field: "teacher_name", header: "Professor", flex: 1, sortable: true },
        { 
            cellRenderer: (_: any, row: any) => <span>{row.enrolled_count} / {row.max_capacity ?? "∞"}</span>, 
            field: "capacity",
            header: "Capacity", 
            width: 100, sortable: true 
        },
        { 
            cellRenderer: (_: any, row: any) => (
                <Btn size="sm" variant="secondary" onClick={() => setViewingSection(row)}>Details</Btn>
            ), 
            header: "Action", width: 90, sortable: false 
        }
    ];

    const mappingCols = [
        {
            headerRenderer: () => (
                <input type="checkbox" checked={mappings.length > 0 && selMappings.length === mappings.length} 
                    onChange={e => setSelMappings(e.target.checked ? mappings.map(m => m.id) : [])} />
            ),
            cellRenderer: (_: any, row: any) => (
                <input type="checkbox" checked={selMappings.includes(row.id)} 
                    onChange={() => setSelMappings(p => p.includes(row.id) ? p.filter(id => id !== row.id) : [...p, row.id])} />
            ),
            width: 40, sortable: false
        },
        { field: "code", header: "Prog. Code", width: 120, sortable: true },
        { field: "name", header: "Program Name", flex: 1, sortable: true }
    ];

    const facultyOptions = faculty.map(f => ({ label: f.full_name, value: f.user_id }));
    const blockOptions = academicBlocks.map(b => ({ label: b.block_name, value: b.block_id }));

    return (
        <div style={{ alignItems: "center", background: "rgba(0,0,0,0.8)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "12px", display: "flex", flexDirection: "column", height: "90vh", padding: "24px", width: "1150px", maxWidth: "95%" }}>
                
                <div style={{ borderBottom: "1px solid #334155", marginBottom: "20px", paddingBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <h2 style={{ color: "#f1f5f9", margin: "0 0 4px 0" }}>Manage Course Details</h2>
                            <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>{course.code}: {course.name}</p>
                        </div>
                        <Btn variant="secondary" onClick={onClose}>Close Workspace</Btn>
                    </div>
                </div>

                <div style={{ display: "flex", flex: 1, gap: "24px", overflow: "hidden" }}>
                    {/* LEFT: COURSE OFFERINGS */}
                    <div style={{ display: "flex", flex: 2, flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <h4 style={{ color: "#f1f5f9", margin: 0 }}>Active Offerings</h4>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                {selSections.length > 0 && <Btn variant="danger" size="sm" onClick={handleBulkDeleteSections}>Delete Selected</Btn>}
                                
                                <div style={{ position: "relative", width: "230px" }}>
                                    <Input 
                                        placeholder="Search Label (Enter)..." 
                                        size="sm" 
                                        style={{ width: "100%", paddingRight: "35px" }} 
                                        value={sectionDraft} 
                                        onChange={e => setSectionDraft(e.target.value)} 
                                        onKeyDown={handleSearchKeyDown}
                                    />
                                    <button 
                                        onClick={() => setIsFilterOpen(true)}
                                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)" }}
                                    >⚙️</button>
                                </div>
                            </div>
                        </div>
                        <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", flex: 1, overflow: "hidden" }}>
                            <LMSGrid 
                                columns={sectionCols} 
                                rowData={sections} 
                                height="100%" 
                                onSortChange={(f, d) => setOffSort({ field: f, dir: d as any })}
                                sortField={offSort.field}
                                sortDir={offSort.dir}
                            />
                        </div>
                    </div>

                    {/* RIGHT: PROGRAM MAPPINGS */}
                    <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <h4 style={{ color: "#f1f5f9", margin: 0 }}>Program Eligibility</h4>
                            {selMappings.length > 0 && <Btn variant="danger" size="sm" onClick={handleBulkDeleteMappings}>Remove</Btn>}
                        </div>
                        <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", flex: 1, overflow: "hidden" }}>
                            <LMSGrid 
                                columns={mappingCols} 
                                rowData={mappings} 
                                height="100%" 
                                onSortChange={(f, d) => setMapSort({ field: f, dir: d as any })}
                                sortField={mapSort.field}
                                sortDir={mapSort.dir}
                            />
                        </div>
                    </div>
                </div>

                {/* ADVANCED FILTER MODAL */}
                {isFilterOpen && (
                    <div style={{ alignItems: "center", background: "rgba(0,0,0,0.6)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1100 }}>
                        <div style={{ background: "#1e293b", borderRadius: "12px", padding: "28px", width: "400px", border: "1px solid #334155", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                                <h3 style={{ color: "#f1f5f9", margin: 0 }}>Advanced Filters</h3>
                                <Btn variant="secondary" size="sm" onClick={handleClearFilters}>Clear All</Btn>
                            </div>
                            
                            <FF label="Academic Block" style={{ marginBottom: "16px" }}>
                                <SearchableSelect 
                                    options={blockOptions} 
                                    value={filtersDraft.blockId} 
                                    onChange={(v: any) => setFiltersDraft({ ...filtersDraft, blockId: v })} 
                                    placeholder="Filter by Block..."
                                />
                            </FF>

                            <FF label="Professor" style={{ marginBottom: "28px" }}>
                                <SearchableSelect 
                                    options={facultyOptions} 
                                    value={filtersDraft.teacherId} 
                                    onChange={(v: any) => setFiltersDraft({ ...filtersDraft, teacherId: v })} 
                                    placeholder="Filter by Professor..."
                                />
                            </FF>

                            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                                <Btn variant="secondary" onClick={() => setIsFilterOpen(false)}>Cancel</Btn>
                                <Btn onClick={handleApplyFilters}>Apply Filters</Btn>
                            </div>
                        </div>
                    </div>
                )}

                {viewingSection && (
                    <SectionDetailsModal 
                        sectionData={{ ...viewingSection, course_code: course.code, course_name: course.name }} 
                        onClose={() => setViewingSection(null)} 
                        onRefresh={fetchData} 
                    />
                )}
            </div>
        </div>
    );
}