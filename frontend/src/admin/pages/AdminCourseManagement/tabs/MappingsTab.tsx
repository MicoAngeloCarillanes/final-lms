import React, { useEffect, useRef, useState } from 'react';
import LMSGrid from '../../../../components/LMSGrid';
import { Btn, FF, Input, Sel } from '../../../../components/ui';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { supabase } from '../../../../supabaseClient';
import { useMappingsData } from '../hooks/useMappingsData';
import { useReferenceData } from '../hooks/useReferenceData';
import MappingSetupModal from '../modals/MappingSetupModal';

/**
 * MappingsTab
 * * Orchestrates the view for Course-to-Program mappings with CSV upload, advanced filters, and bulk actions.
 */
export default function MappingsTab() {
    const { programs, courses, schoolYears } = useReferenceData();
    
    const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMapping, setEditingMapping] = useState<any | null>(null);
    
    // Strict Execution States
    const [searchDraft, setSearchDraft] = useState("");
    const [committedSearch, setCommittedSearch] = useState("");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [mapSort, setMapSort] = useState({ dir: "desc" as const, field: "id" });
    
    const [draftProg, setDraftProg] = useState("");
    const [draftYear, setDraftYear] = useState("");
    const [draftSemester, setDraftSemester] = useState("");
    const [draftSy, setDraftSy] = useState("");

    const [filterProg, setFilterProg] = useState("");
    const [filterYear, setFilterYear] = useState("");
    const [filterSemester, setFilterSemester] = useState("");
    const [filterSy, setFilterSy] = useState("");

    // Bulk Action States
    const [selectedMappingIds, setSelectedMappingIds] = useState<number[]>([]);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isBulkLoading, setIsBulkLoading] = useState(false);
    
    // CSV Upload States
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { isLoading, mappings, refreshMappings } = useMappingsData(
        "", 
        filterProg,
        filterYear,
        filterSemester,
        committedSearch,
        mapSort,
        filterSy
    );

    useEffect(() => {
        if (alert) {
            const timer = setTimeout(() => setAlert(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [alert]);

    function showAlert(msg: string, type: 'error' | 'success' = 'error') {
        setAlert({ msg, type });
    }

    function handleSearchKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') {
            setCommittedSearch(searchDraft);
        }
    }

    function handleApplyFilters() {
        setFilterProg(draftProg);
        setFilterYear(draftYear);
        setFilterSemester(draftSemester);
        setFilterSy(draftSy);
        setIsFilterOpen(false);
    }

    function handleResetFilters() {
        setDraftProg("");
        setDraftYear("");
        setDraftSemester("");
        setDraftSy("");
        setFilterProg("");
        setFilterYear("");
        setFilterSemester("");
        setFilterSy("");
    }

    async function handleConfirmDelete() {
        if (selectedMappingIds.length === 0) return;
        setIsBulkLoading(true);
        try {
            const { error } = await supabase.from("course_program_map").delete().in("id", selectedMappingIds);
            
            if (error) {
                showAlert("Error deleting mappings: " + error.message);
            } else {
                setSelectedMappingIds([]);
                setIsDeleteModalOpen(false);
                showAlert("Mappings deleted successfully.", "success");
                refreshMappings();
            }
        } catch (err: any) {
            showAlert("Action failed. Check database constraints.");
        } finally {
            setIsBulkLoading(false);
        }
    }

    function downloadCsvTemplate() {
        const headers = "course_code,program_code,school_year,year_level,semester\nCS101,BSCS,2025-2026,1st Year,1st Semester";
        const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", "Bulk_Program_Mappings_Template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsBulkLoading(true);
        const reader = new FileReader();
        reader.onerror = () => { setIsBulkLoading(false); showAlert("FileReader error."); };

        reader.onload = async (event) => {
            try {
                let csvData = event.target?.result as string;
                csvData = csvData.replace(/^\ufeff/, '');

                const lines = csvData.split(/\r?\n/).map(l => l.trim()).filter(line => line.length > 0);
                if (lines.length < 2) { showAlert("Empty CSV."); setIsBulkLoading(false); return; }

                const payload = [];
                for (let i = 1; i < lines.length; i++) {
                    const rawValues = lines[i].split(",");
                    const values = rawValues.map(v => v.trim().replace(/^"|"$/g, ''));
                    
                    if (values.length < 5) continue;

                    const targetCourse = courses.find(c => c.course_code?.toLowerCase().trim() === values[0]?.toLowerCase());
                    if (!targetCourse) { showAlert(`Row ${i + 1}: Course Code "${values[0]}" not found.`); setIsBulkLoading(false); return; }

                    const targetProg = programs.find(p => p.code?.toLowerCase().trim() === values[1]?.toLowerCase());
                    if (!targetProg) { showAlert(`Row ${i + 1}: Program Code "${values[1]}" not found.`); setIsBulkLoading(false); return; }

                    const targetSy = schoolYears.find(sy => sy.label?.toLowerCase().trim() === values[2]?.toLowerCase());
                    if (!targetSy) { showAlert(`Row ${i + 1}: School Year "${values[2]}" not found.`); setIsBulkLoading(false); return; }

                    payload.push({
                        course_id: targetCourse.course_id,
                        program_id: targetProg.program_id,
                        effective_sy_id: targetSy.sy_id,
                        year_level: values[3],
                        semester: values[4]
                    });
                }

                if (payload.length > 0) {
                    setIsCsvModalOpen(false);
                    const { error } = await supabase.from("course_program_map").insert(payload);
                    if (error) {
                        showAlert("Database Error: " + error.message);
                    } else {
                        showAlert(`Success: ${payload.length} mappings created.`, "success");
                        refreshMappings();
                    }
                }
            } catch (err) {
                showAlert("Processing Error.");
            } finally {
                setIsBulkLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    }

    /**
     * Grid column definitions
     */
    const mappingsCols = [
        {
            headerRenderer: () => (
                <input 
                    type="checkbox" 
                    checked={mappings.length > 0 && selectedMappingIds.length === mappings.length}
                    onChange={(e) => {
                        if (e.target.checked) setSelectedMappingIds(mappings.map(m => m.id));
                        else setSelectedMappingIds([]);
                    }}
                />
            ),
            cellRenderer: (_: any, row: any) => (
                <input 
                    type="checkbox" 
                    checked={selectedMappingIds.includes(row.id)}
                    onChange={() => {
                        setSelectedMappingIds(prev => 
                            prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id]
                        );
                    }}
                />
            ),
            field: "checkbox",
            width: 40,
            sortable: false
        },
        { field: "course_code", header: "Course Code", width: 120, sortable: true },
        { field: "course_name", flex: 1, header: "Course Name", sortable: true },
        { field: "program_code", header: "Program", width: 120, sortable: true },
        { field: "school_year", header: "School Year", width: 130, sortable: true },
        { field: "year_level", header: "Year Level", sortable: true, width: 120 },
        { field: "semester", header: "Semester", sortable: true, width: 150 },
        { 
            cellRenderer: (_: any, row: any) => (
                <div style={{ display: "flex", gap: "6px" }}>
                    <Btn size="sm" variant="secondary" onClick={() => setEditingMapping(row)}>Edit</Btn>
                    <Btn size="sm" variant="danger" onClick={() => { setSelectedMappingIds([row.id]); setIsDeleteModalOpen(true); }}>Remove</Btn>
                </div>
            ), 
            field: "id", 
            header: "Action", 
            width: 140,
            sortable: false
        },
    ];

    const programFilterOptions = [
        { label: "All Programs", value: "" },
        ...(programs || []).map((p: any) => ({ label: p.code, value: p.program_id }))
    ];

    const syFilterOptions = [
        { label: "All School Years", value: "" },
        ...(schoolYears || []).map((sy: any) => ({ label: sy.label, value: sy.sy_id }))
    ];

    return (
        <div style={{ background: "#0f172a", flex: 1, display: "flex", flexDirection: "column", padding: "20px", position: "relative" }}>
            
            {alert && (
                <div style={{ left: "50%", padding: "12px 24px", position: "fixed", top: "20px", transform: "translateX(-50%)", zIndex: 9999, background: alert.type === 'error' ? "#ef4444" : "#10b981", borderRadius: "8px", color: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: 600 }}>
                    {alert.msg}
                </div>
            )}

            <div style={{ alignItems: "center", display: "flex", gap: "10px", marginBottom: "16px" }}>
                <div style={{ position: "relative", width: "350px" }}>
                    <Input 
                        placeholder="Search Course Name (Enter)..." 
                        style={{ paddingRight: "40px", width: "100%" }}
                        value={searchDraft}
                        onChange={(e) => setSearchDraft(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                    />
                    <button 
                        type="button"
                        onClick={() => {
                            setDraftProg(filterProg);
                            setDraftYear(filterYear);
                            setDraftSemester(filterSemester);
                            setDraftSy(filterSy);
                            setIsFilterOpen(true);
                        }}
                        style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
                    >
                        ⚙️
                    </button>
                </div>

                <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                    {selectedMappingIds.length > 0 && (
                        <Btn size="sm" variant="danger" onClick={() => setIsDeleteModalOpen(true)} disabled={isBulkLoading}>
                            {isBulkLoading ? "Processing..." : `Delete Selected (${selectedMappingIds.length})`}
                        </Btn>
                    )}
                    <Btn size="sm" variant="secondary" onClick={() => setIsCsvModalOpen(true)}>Upload CSV</Btn>
                    <Btn size="sm" onClick={() => setIsModalOpen(true)}>+ Add Mapping</Btn>
                </div>
            </div>

            <div style={{ flex: 1, overflow: "hidden" }}>
                {isLoading ? (
                    <div style={{ color: "#475569", paddingTop: 40, textAlign: "center" }}>Loading Mappings...</div>
                ) : (
                    <LMSGrid 
                        columns={mappingsCols} 
                        height="100%" 
                        rowData={mappings} 
                        onSortChange={(f, d) => setMapSort({ dir: d as any, field: f })}
                        sortDir={mapSort.dir}
                        sortField={mapSort.field}
                    />
                )}
            </div>

            {isFilterOpen && (
                <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1100 }}>
                    <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <h3 style={{ color: "#f1f5f9", margin: 0 }}>Advanced Filters</h3>
                            <Btn size="sm" variant="secondary" onClick={handleResetFilters}>Clear Filters</Btn>
                        </div>
                        
                        <FF label="School Year" style={{ marginBottom: "16px" }}>
                            <SearchableSelect 
                                options={syFilterOptions}
                                value={draftSy}
                                onChange={(val: any) => setDraftSy(val || "")}
                                placeholder="Search School Year..."
                            />
                        </FF>

                        <FF label="Program" style={{ marginBottom: "16px" }}>
                            <SearchableSelect 
                                options={programFilterOptions}
                                value={draftProg}
                                onChange={(val: any) => setDraftProg(val || "")}
                                placeholder="Search Program..."
                            />
                        </FF>

                        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr", marginBottom: "20px" }}>
                            <FF label="Year Level">
                                <Sel value={draftYear} onChange={e => setDraftYear(e.target.value)}>
                                    <option value="">All Year Levels</option>
                                    <option value="1st Year">1st Year</option>
                                    <option value="2nd Year">2nd Year</option>
                                    <option value="3rd Year">3rd Year</option>
                                    <option value="4th Year">4th Year</option>
                                    <option value="5th Year">5th Year</option>
                                </Sel>
                            </FF>
                            <FF label="Semester">
                                <Sel value={draftSemester} onChange={e => setDraftSemester(e.target.value)}>
                                    <option value="">All Semesters</option>
                                    <option value="1st Semester">1st Semester</option>
                                    <option value="2nd Semester">2nd Semester</option>
                                    <option value="Summer">Summer</option>
                                </Sel>
                            </FF>
                        </div>

                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <Btn onClick={() => setIsFilterOpen(false)} variant="secondary">Cancel</Btn>
                            <Btn onClick={handleApplyFilters}>Apply Filters</Btn>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1100 }}>
                    <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
                        <h3 style={{ color: "#ef4444", margin: "0 0 16px 0" }}>Confirm Deletion</h3>
                        <p style={{ color: "#f1f5f9", fontSize: "14px", marginBottom: "20px" }}>
                            Are you sure you want to permanently delete <strong>{selectedMappingIds.length}</strong> mapping(s)?
                        </p>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <Btn onClick={() => {
                                setIsDeleteModalOpen(false);
                                setSelectedMappingIds([]);
                            }} variant="secondary" disabled={isBulkLoading}>Cancel</Btn>
                            <Btn onClick={handleConfirmDelete} variant="danger" disabled={isBulkLoading}>
                                {isBulkLoading ? "Deleting..." : "Yes, Delete"}
                            </Btn>
                        </div>
                    </div>
                </div>
            )}

            {isCsvModalOpen && (
                <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1100 }}>
                    <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
                        <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>Bulk Program Mappings</h3>
                        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "20px" }}>Upload a CSV file to map courses to programs.</p>
                        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
                            <Btn size="sm" variant="secondary" onClick={downloadCsvTemplate}>Download Template</Btn>
                        </div>
                        <input type="file" accept=".csv" ref={fileInputRef} style={{ display: "none" }} onChange={handleCsvUpload} />
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <Btn onClick={() => setIsCsvModalOpen(false)} variant="secondary" disabled={isBulkLoading}>Cancel</Btn>
                            <Btn onClick={() => fileInputRef.current?.click()} disabled={isBulkLoading}>
                                {isBulkLoading ? "Processing..." : "Select File & Upload"}
                            </Btn>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <MappingSetupModal onClose={() => setIsModalOpen(false)} onSave={refreshMappings} />
            )}
            {editingMapping && (
                <MappingSetupModal initialData={editingMapping} onClose={() => setEditingMapping(null)} onSave={refreshMappings} />
            )}
        </div>
    );
}