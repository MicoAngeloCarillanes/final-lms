import React, { useEffect, useRef, useState } from 'react';
import LMSGrid from '../../../../components/LMSGrid';
import { Btn, FF, Input, Sel } from '../../../../components/ui';
import { supabase } from '../../../../supabaseClient';
import { useOfferingsData } from '../hooks/useOfferingsData';
import { useReferenceData } from '../hooks/useReferenceData';
import BulkEnrollmentModal from '../modals/BulkEnrollmentModal';
import RolloverTermModal from '../modals/RolloverTermModal';
import SectionDetailsModal from '../modals/SectionDetailsModal';
import SectionSetupModal from '../modals/SectionSetupModal';

/**
 * OfferingsTab
 * * Displays and manages Course Sections.
 * * Updated: Includes triggers for Bulk Enrollment and Export tools.
 */
export default function OfferingsTab() {
    const { academicBlocks, programs, schoolYears, courses, teachers, sectionLabels } = useReferenceData();
    
    const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
    const [searchDraft, setSearchDraft] = useState("");
    const [committedSearch, setCommittedSearch] = useState("");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isBulkEnrollOpen, setIsBulkEnrollOpen] = useState(false);
    const [draftSy, setDraftSy] = useState("");
    const [draftSemester, setDraftSemester] = useState("");
    
    const [filterSy, setFilterSy] = useState(""); 
    const [filterSemester, setFilterSemester] = useState(""); 

    const initialFilters = {
        blockId: "",
        days: [] as string[],
        endTime: "",
        programId: "",
        sectionLabel: "",
        startTime: ""
    };
    
    const [filtersDraft, setFiltersDraft] = useState(initialFilters);
    const [filters, setFilters] = useState(initialFilters);

    const [offPage, setOffPage] = useState(0);
    const [offSort, setOffSort] = useState({ dir: "desc" as const, field: "created_at" });
    const offPageSize = 20;

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isRolloverOpen, setIsRolloverOpen] = useState(false);
    
    const [editingSection, setEditingSection] = useState<any | null>(null);
    const [viewingSection, setViewingSection] = useState<any | null>(null);
    
    const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
    
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const [isBulkLoading, setIsBulkLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { isLoading, offeringCount, offerings, refreshOfferings, getExportData } = useOfferingsData(
        committedSearch,
        filterSy, 
        filterSemester, 
        filters,
        offPage,
        offPageSize,
        offSort
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
            setOffPage(0);
        }
    }

    function handleApplyFilters() {
        setFilterSy(draftSy);
        setFilterSemester(draftSemester);
        setFilters(filtersDraft);
        setOffPage(0);
        setIsFilterOpen(false);
    }

    function handleResetFilters() {
        setFiltersDraft(initialFilters);
        setDraftSy("");
        setDraftSemester("");
        setFilters(initialFilters);
        setFilterSy("");
        setFilterSemester("");
        setOffPage(0);
    }

    async function handleConfirmDelete() {
        if (selectedSectionIds.length === 0) return;
        setIsBulkLoading(true);
        try {
            await supabase.from("student_section_assignments").delete().in("section_id", selectedSectionIds);
            const { error } = await supabase.from("course_sections").delete().in("section_id", selectedSectionIds);
            
            if (error) {
                showAlert("Error deleting sections: " + error.message);
            } else {
                setSelectedSectionIds([]);
                setIsDeleteModalOpen(false);
                showAlert("Sections deleted.", "success");
                refreshOfferings();
            }
        } catch (err: any) {
            showAlert("Action failed. Check database constraints.");
        } finally {
            setIsBulkLoading(false);
        }
    }

    async function handleCsvExport() {
        const exportData = await getExportData(); 
        if (exportData.length === 0) {
            showAlert("No data available to export.");
            return;
        }
        const headers = ["Course Code", "Course Name", "Section Label", "Block Name", "Professor", "Schedule", "Capacity", "Enrolled", "Semester"];
        const csvContent = exportData.map((row: any) => [
            row.courses?.course_code || "",
            row.courses?.course_name || "",
            row.section_label || "",
            row.academic_blocks?.block_name || "",
            row.users?.full_name || "",
            row.schedule_label || "",
            row.max_capacity || "∞",
            row.enrolled_count || "0",
            row.semester || ""
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
        const csvString = [headers.join(","), ...csvContent].join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", `Sections_Export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function downloadCsvTemplate() {
        const headers = "course_code,school_year,semester,max_capacity,professor_emp_id,academic_block,days,start_time,end_time\nCS,2025-2026,1st Semester,∞,EMP-TCH001,ABCOMM-1-B1,MTWTh,7:30 AM,9:00 AM";
        const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", "Bulk_Section_Create_Template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsBulkLoading(true);
        const { data: freshSchedules, error: schedError } = await supabase.from("schedules").select("schedule_label");

        if (schedError) {
            showAlert("Verify schedules failed.");
            setIsBulkLoading(false);
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                let csvData = event.target?.result as string;
                csvData = csvData.replace(/^\ufeff/, '');

                const lines = csvData.split(/\r?\n/).map(l => l.trim()).filter(line => line.length > 0);
                if (lines.length < 2) { showAlert("Empty CSV."); setIsBulkLoading(false); return; }

                const payload: any[] = [];
                const processedPairs = new Set<string>(); // Tracks processed integrated courses per SY/Semester

                for (let i = 1; i < lines.length; i++) {
                    const rawValues = lines[i].split(",");
                    const values = rawValues.map(v => v.trim().replace(/^"|"$/g, ''));
                    if (values.length < 9) continue; 

                    const inputCode = values[0]?.toUpperCase().trim();
                    const inputSY = values[1]?.trim();
                    const inputSem = values[2]?.trim();

                    const targetCourse = courses.find(c => c.course_code?.toUpperCase().trim() === inputCode);
                    if (!targetCourse) { showAlert(`Row ${i + 1}: Course Code "${values[0]}" not found.`); setIsBulkLoading(false); return; }

                    const targetSY = schoolYears.find(s => s.label?.toLowerCase().trim() === inputSY.toLowerCase());
                    if (!targetSY) { showAlert(`Row ${i + 1}: SY "${values[1]}" not found.`); setIsBulkLoading(false); return; }

                    const baseCode = targetCourse.course_code.replace(/_(LEC|LAB)$/, '');
                    const pairKey = `${baseCode}-${inputSY}-${inputSem}`;

                    if (processedPairs.has(pairKey)) continue;

                    let resolvedTeacherId = null;
                    if (values[4] && values[4] !== "") {
                         const t = teachers.find(t => t.employee_number?.toLowerCase().trim() === values[4].toLowerCase());
                         if (t) resolvedTeacherId = t.user_id;
                         else { showAlert(`Row ${i+1}: Prof ID "${values[4]}" not found.`); setIsBulkLoading(false); return; }
                    }

                    let resolvedBlockId = null;
                    if (values[5] && values[5] !== "") {
                         const b = academicBlocks.find(b => b.csvMatch?.toLowerCase().trim() === values[5].toLowerCase());
                         if (b) resolvedBlockId = b.block_id;
                         else { showAlert(`Row ${i+1}: Block "${values[5]}" not found.`); setIsBulkLoading(false); return; }
                    }

                    let resolvedSchedule = null;
                    if (values[6] && values[7] && values[8]) {
                        const daysInput = values[6].trim();
                        const startInput = values[7].replace(/\s/g, '').toUpperCase().replace(/(AM|PM)$/, ' $1');
                        const endInput = values[8].replace(/\s/g, '').toUpperCase().replace(/(AM|PM)$/, ' $1');
                        const matchKey = (daysInput + startInput + endInput).replace(/[\s-–—]/g, '').toLowerCase();
                        
                        const matchedSched = freshSchedules?.find(s => s.schedule_label.replace(/[\s-–—]/g, '').toLowerCase() === matchKey);
                        if (matchedSched) resolvedSchedule = matchedSched.schedule_label;
                        else { showAlert(`Row ${i+1}: Schedule mismatch.`); setIsBulkLoading(false); return; }
                    }

                    const capInput = values[3].toLowerCase();
                    const maxCapacity = (capInput === "∞" || capInput === "no limit" || capInput === "") ? null : parseInt(capInput);

                    const { data: existing } = await supabase.from("course_sections").select("section_label").ilike("section_label", `${baseCode}%`).eq("sy_id", targetSY.sy_id).eq("semester", inputSem);
                    let nextNum = 1;
                    if (existing && existing.length > 0) {
                        const numbers = existing.map(e => {
                            const match = e.section_label?.match(/S(\d+)$/);
                            return match ? parseInt(match[1]) : 0;
                        });
                        nextNum = Math.max(...numbers, 0) + 1;
                    }

                    const yearShort = targetSY.label.split("-")[1]?.slice(-2) || "YY";
                    const semCode = inputSem === '1st Semester' ? '1' : (inputSem === '2nd Semester' ? '2' : 'S');

                    const isIntegrated = targetCourse.course_code.match(/_(LEC|LAB)$/);
                    const coursesToSection = isIntegrated 
                        ? courses.filter(c => c.course_code.startsWith(baseCode + "_"))
                        : [targetCourse];

                    coursesToSection.forEach(course => {
                        payload.push({
                            course_id: course.course_id,
                            sy_id: targetSY.sy_id,
                            semester: inputSem,
                            max_capacity: maxCapacity,
                            teacher_id: resolvedTeacherId,
                            block_id: resolvedBlockId,
                            schedule_label: resolvedSchedule,
                            section_label: `${course.course_code}-${yearShort}-${semCode}-S${nextNum}`
                        });
                    });

                    if (isIntegrated) processedPairs.add(pairKey);
                }

                if (payload.length > 0) {
                    setIsCsvModalOpen(false);
                    const { error: rpcError } = await supabase.rpc("bulk_insert_course_sections", { payload });
                    if (rpcError) showAlert("RPC Error: " + rpcError.message);
                    else { showAlert(`Success: ${payload.length} records processed.`, "success"); refreshOfferings(); }
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

    const offeringsCols = [
        {
            headerRenderer: () => (
                <input 
                    type="checkbox" 
                    checked={offerings.length > 0 && selectedSectionIds.length === offerings.length}
                    onChange={(e) => {
                        if (e.target.checked) setSelectedSectionIds(offerings.map(o => o.section_id));
                        else setSelectedSectionIds([]);
                    }}
                />
            ),
            cellRenderer: (_: any, row: any) => (
                <input 
                    type="checkbox" 
                    checked={selectedSectionIds.includes(row.section_id)}
                    onChange={() => {
                        setSelectedSectionIds(prev => 
                            prev.includes(row.section_id) ? prev.filter(id => id !== row.section_id) : [...prev, row.section_id]
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
        { field: "section_label", header: "Section", sortable: true, width: 130 }, 
        { field: "block_name", header: "Block", width: 120, sortable: true },
        { field: "teacher_name", header: "Professor", width: 160, sortable: true }, 
        { field: "schedule_label", header: "Schedule", width: 180, sortable: true },
        { 
            cellRenderer: (_: any, row: any) => <span>{row.enrolled_count} / {row.max_capacity ?? "∞"}</span>, 
            field: "max_capacity", 
            header: "Capacity", 
            sortable: true, 
            width: 100 
        },
        { 
            cellRenderer: (_: any, row: any) => (
                <div style={{ display: "flex", gap: "6px" }}>
                    <Btn size="sm" variant="secondary" onClick={() => setViewingSection(row)}>Details</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => setEditingSection(row)}>Edit</Btn>
                    <Btn size="sm" variant="danger" onClick={() => { setSelectedSectionIds([row.section_id]); setIsDeleteModalOpen(true); }} >Remove</Btn>
                </div>
            ), 
            field: "section_id", 
            header: "Action", 
            sortable: false,
            width: 160 
        },
    ];

    return (
        <div style={{ background: "#0f172a", display: "flex", flex: 1, flexDirection: "column", padding: "20px", position: "relative" }}>
            
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
                            setDraftSy(filterSy);
                            setDraftSemester(filterSemester);
                            setFiltersDraft(filters);
                            setIsFilterOpen(true);
                        }}
                        style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
                    >
                        ⚙️
                    </button>
                </div>

                <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                    {selectedSectionIds.length > 0 && (
                        <Btn size="sm" variant="danger" onClick={() => setIsDeleteModalOpen(true)} disabled={isBulkLoading}>
                            {isBulkLoading ? "Processing..." : `Delete Selected (${selectedSectionIds.length})`}
                        </Btn>
                    )}
                    <Btn size="sm" variant="secondary" onClick={handleCsvExport}>Export CSV</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => setIsCsvModalOpen(true)}>Upload Sections</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => setIsBulkEnrollOpen(true)}>Bulk Enroll Students</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => setIsRolloverOpen(true)}>Term Rollover</Btn>
                    <Btn size="sm" onClick={() => setIsCreateOpen(true)}>+ Create Section</Btn>
                </div>
            </div>

            <div style={{ flex: 1, overflow: "hidden" }}>
                <LMSGrid 
                    columns={offeringsCols} 
                    height="100%" 
                    rowData={offerings} 
                    onSortChange={(f, d) => setOffSort({ dir: d as any, field: f })} 
                    sortDir={offSort.dir} 
                    sortField={offSort.field} 
                />
            </div>

            <div style={{ alignItems: "center", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "space-between", marginTop: "12px", paddingTop: "12px" }}>
                 <div style={{ color: "#64748b", fontSize: "12px" }}>
                    Showing {offPage * offPageSize + (offeringCount > 0 ? 1 : 0)} to {Math.min((offPage + 1) * offPageSize, offeringCount)} of {offeringCount} offerings
                 </div>
                 <div style={{ display: "flex", gap: "8px" }}>
                        <Btn disabled={offPage === 0} onClick={() => setOffPage(p => p - 1)} size="sm" variant="secondary">← Previous</Btn>
                        <Btn disabled={(offPage + 1) * offPageSize >= offeringCount} onClick={() => setOffPage(p => p + 1)} size="sm" variant="secondary">Next →</Btn>
                 </div>
            </div>

            {isDeleteModalOpen && (
                <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1100 }}>
                    <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
                        <h3 style={{ color: "#ef4444", margin: "0 0 16px 0" }}>Confirm Deletion</h3>
                        <p style={{ color: "#f1f5f9", fontSize: "14px", marginBottom: "20px" }}>
                            Are you sure you want to permanently delete <strong>{selectedSectionIds.length}</strong> section(s)? This will unenroll all students.
                        </p>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <Btn onClick={() => {
                                setIsDeleteModalOpen(false);
                                setSelectedSectionIds([]);
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
                        <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>Bulk Create Sections</h3>
                        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "20px" }}>
                            Upload CSV. Integrated courses (LEC/LAB) will be created as pairs automatically.
                        </p>
                        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
                            <Btn size="sm" variant="secondary" onClick={downloadCsvTemplate}>Download Template</Btn>
                        </div>
                        <input type="file" accept=".csv" ref={fileInputRef} style={{ display: "none" }} onChange={handleCsvUpload} />
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <Btn onClick={() => setIsCsvModalOpen(false)} variant="secondary" disabled={isBulkLoading}>Cancel</Btn>
                            <Btn onClick={() => fileInputRef.current?.click()} disabled={isBulkLoading}>
                                {isBulkLoading ? "Checking DB..." : "Select File & Upload"}
                            </Btn>
                        </div>
                    </div>
                </div>
            )}

            {isFilterOpen && (
                <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1100 }}>
                    <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "500px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <h3 style={{ color: "#f1f5f9", margin: 0 }}>Advanced Filters</h3>
                            <Btn size="sm" variant="secondary" onClick={handleResetFilters}>Clear Filters</Btn>
                        </div>
                        
                        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr", marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #334155" }}>
                            <FF label="School Year">
                                <Sel value={draftSy} onChange={e => setDraftSy(e.target.value)}>
                                    <option value="">All School Years</option>
                                    {schoolYears.map(sy => <option key={sy.sy_id} value={sy.sy_id}>{sy.label}</option>)}
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

                        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr", marginBottom: "12px" }}>
                            <FF label="Section Label">
                                <Input 
                                    list="section-label-options"
                                    placeholder="Type to search..."
                                    value={filtersDraft.sectionLabel} 
                                    onChange={e => setFiltersDraft({...filtersDraft, sectionLabel: e.target.value})} 
                                />
                                <datalist id="section-label-options">
                                    {sectionLabels.map(label => <option key={label} value={label} />)}
                                </datalist>
                            </FF>
                            <FF label="Program">
                                <Sel value={filtersDraft.programId} onChange={e => setFiltersDraft({...filtersDraft, programId: e.target.value})}>
                                    <option value="">All Programs</option>
                                    {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.code}</option>)}
                                </Sel>
                            </FF>
                        </div>

                        <FF label="Academic Block">
                            <Sel value={filtersDraft.blockId} onChange={e => setFiltersDraft({...filtersDraft, blockId: e.target.value})}>
                                <option value="">All Blocks</option>
                                {academicBlocks.map(b => <option key={b.block_id} value={b.block_id}>{b.block_name}</option>)}
                            </Sel>
                        </FF>

                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
                            <Btn onClick={() => setIsFilterOpen(false)} variant="secondary">Cancel</Btn>
                            <Btn onClick={handleApplyFilters}>Apply Filters</Btn>
                        </div>
                    </div>
                </div>
            )}

            {isCreateOpen && <SectionSetupModal courseId="" onClose={() => setIsCreateOpen(false)} onSave={refreshOfferings} />}
            {isRolloverOpen && <RolloverTermModal onClose={() => setIsRolloverOpen(false)} onSave={refreshOfferings} />}
            {editingSection && <SectionSetupModal courseId={editingSection.course_id} initialData={editingSection} onClose={() => setEditingSection(null)} onSave={refreshOfferings} />}
            {viewingSection && <SectionDetailsModal sectionData={viewingSection} onClose={() => setViewingSection(null)} onRefresh={refreshOfferings} />}
            
            {isBulkEnrollOpen && (
                <BulkEnrollmentModal 
                    onClose={() => setIsBulkEnrollOpen(false)} 
                    onSave={() => {
                        refreshOfferings();
                        showAlert("Bulk enrollment completed.", "success");
                    }} 
                />
            )}
        </div>
    );
}