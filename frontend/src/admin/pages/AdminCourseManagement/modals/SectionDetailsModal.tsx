import { useEffect, useState } from 'react';
import LMSGrid from '../../../../components/LMSGrid';
import { Btn } from '../../../../components/ui';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { supabase } from '../../../../supabaseClient';

interface SectionDetailsModalProps {
    sectionData: any;
    onClose: () => void;
    onRefresh: () => void;
}

/**
 * Helper: Converts '07:30 AM' format into total minutes from midnight for easy comparison.
 */
function parseTime(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(' ');
    if (parts.length < 2) return 0;
    
    const time = parts[0];
    const modifier = parts[1].toUpperCase();
    let [hours, minutes] = time.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) return 0;
    if (hours === 12) hours = 0;
    if (modifier === 'PM') hours += 12;
    
    return hours * 60 + minutes;
}

/**
 * Helper: Checks if two day patterns intersect (handles 'Th' as a distinct day).
 */
function checkDayOverlap(days1: string, days2: string): boolean {
    if (!days1 || !days2) return false;
    const parseDays = (d: string) => d.replace(/Th/g, 'R').split('');
    const a1 = parseDays(days1);
    const a2 = parseDays(days2);
    return a1.some(day => a2.includes(day));
}

export default function SectionDetailsModal({ sectionData, onClose, onRefresh }: SectionDetailsModalProps) {
    const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    
    // Manual Enrollment States
    const [studentOptions, setStudentOptions] = useState<{label: string, value: string}[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string>("");
    const [isAssigning, setIsAssigning] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [validationWarning, setValidationWarning] = useState<string | null>(null);
    
    // Bulk Delete States
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<any[]>([]);
    const [deleteTargetIds, setDeleteTargetIds] = useState<any[] | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

    useEffect(() => {
        if (alert) {
            const timer = setTimeout(() => setAlert(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [alert]);

    async function fetchEnrolledStudents() {
        if (!sectionData?.section_id) return;
        setIsFetchingStudents(true);
        
        const { data, error } = await supabase
            .from("student_section_assignments")
            .select(`
                assignment_id, 
                student_id,
                users!inner(
                    full_name, 
                    user_id
                )
            `)
            .eq("section_id", sectionData.section_id);

        if (!error) {
            const mappedData = data?.map((item: any) => ({
                ...item,
                full_name: item.users?.full_name
            })) || [];
            setEnrolledStudents(mappedData);
        }
        setIsFetchingStudents(false);
    }

    /**
     * fetchEligibleStudents
     * FIXED: Changed 'student_profiles' to 'students' to match database schema and relationships.
     * Logic: Identifies valid programs for this course and filters students by their program assignment.
     */
    async function fetchEligibleStudents() {
        if (!sectionData?.course_id) return;
        setIsSearching(true);

        try {
            // 1. Identify which programs have this course in their curriculum mapping
            const { data: mappedPrograms, error: mapErr } = await supabase
                .from('course_program_map')
                .select('program_id')
                .eq('course_id', sectionData.course_id);

            if (mapErr) throw mapErr;

            if (!mappedPrograms || mappedPrograms.length === 0) {
                setStudentOptions([]);
                setIsSearching(false);
                return;
            }

            const allowedProgramIds = mappedPrograms.map(m => m.program_id);

            // 2. Fetch students who belong to these specific programs
            const { data, error } = await supabase
                .from("users")
                .select(`
                    user_id, 
                    full_name, 
                    email,
                    students!inner(program_id)
                `)
                .eq("role", "student")
                .in("students.program_id", allowedProgramIds)
                .order("full_name");

            if (!error && data) {
                const options = data.map((s: any) => ({
                    label: `${s.full_name} (${s.email})`,
                    value: s.user_id
                }));
                setStudentOptions(options);
            }
        } catch (err: any) {
            console.error("Error fetching eligible students:", err.message);
        } finally {
            setIsSearching(false);
        }
    }

    useEffect(() => {
        void fetchEnrolledStudents();
        void fetchEligibleStudents();
    }, [sectionData]);

    async function handleManualEnroll() {
        if (!selectedStudentId) {
            setAlert({ msg: "Please select a student first.", type: "error" });
            return;
        }

        setValidationWarning(null);

        if (sectionData.max_capacity !== null && enrolledStudents.length >= sectionData.max_capacity) {
            setAlert({ msg: "Section is at maximum capacity.", type: "error" });
            return;
        }

        setIsAssigning(true);

        const { data: history, error: historyErr } = await supabase
            .from('student_section_assignments')
            .select('final_grade, enrollment_status, course_sections!inner(course_id, sy_id, semester, day_pattern, time_start, time_end, courses!inner(course_code))')
            .eq('student_id', selectedStudentId);

        if (historyErr) {
            setAlert({ msg: "Failed to validate student records.", type: "error" });
            setIsAssigning(false);
            return;
        }

        // 1. Prerequisite Check
        const { data: prereqs } = await supabase
            .from('course_prerequisites')
            .select('prereq_course_id')
            .eq('course_id', sectionData.course_id);

        if (prereqs && prereqs.length > 0) {
            for (const req of prereqs) {
                const taken = history?.filter((h: any) => h.course_sections?.course_id === req.prereq_course_id);
                const passed = taken?.some((t: any) => t.final_grade && (t.final_grade <= 3.0 || t.final_grade >= 75));
                
                if (!passed) {
                    const { data: cData } = await supabase.from('courses').select('course_code').eq('course_id', req.prereq_course_id).single();
                    setValidationWarning(`Student has not passed prerequisite: ${cData?.course_code || "Required Course"}`);
                    setIsAssigning(false);
                    return;
                }
            }
        }

        // 2. Schedule Conflict Check
        const activeClasses = history?.filter((h: any) => h.course_sections?.sy_id === sectionData.sy_id && h.course_sections?.semester === sectionData.semester && h.enrollment_status === 'Enrolled');
        
        if (activeClasses && sectionData.day_pattern && sectionData.time_start && sectionData.time_end) {
            const targetStart = parseTime(sectionData.time_start);
            const targetEnd = parseTime(sectionData.time_end);

            for (const c of activeClasses) {
                const cs = c.course_sections;
                if (!cs.day_pattern || !cs.time_start || !cs.time_end) continue;
                
                if (checkDayOverlap(sectionData.day_pattern, cs.day_pattern)) {
                    const conflictStart = parseTime(cs.time_start);
                    const conflictEnd = parseTime(cs.time_end);
                    
                    if (targetStart < conflictEnd && conflictStart < targetEnd) {
                        setValidationWarning(`Schedule conflict with ${cs.courses?.course_code} (${cs.day_pattern} ${cs.time_start} - ${cs.time_end})`);
                        setIsAssigning(false);
                        return;
                    }
                }
            }
        }

        await executeEnrollment();
    }

    async function executeEnrollment() {
        setIsAssigning(true);
        
        const payload = {
            student_id: selectedStudentId,
            section_id: sectionData.section_id,
            enrollment_status: 'Enrolled'
        };

        const { error } = await supabase.from("student_section_assignments").insert(payload);

        if (error) {
            setAlert({ msg: "Enrollment failed: " + error.message, type: "error" });
        } else {
            setAlert({ msg: "Student successfully enrolled.", type: "success" });
            setSelectedStudentId(""); 
            setValidationWarning(null);
            await fetchEnrolledStudents(); 
            onRefresh(); // Refresh parent offerings table
        }
        
        setIsAssigning(false);
    }

    function promptRemoveStudents(ids: any[]) {
        if (ids.length === 0) return;
        setDeleteTargetIds(ids);
    }

    async function executeRemoveStudents() {
        if (!deleteTargetIds || deleteTargetIds.length === 0) return;
        setIsDeleting(true);
        
        const { error } = await supabase
            .from("student_section_assignments")
            .delete()
            .in("assignment_id", deleteTargetIds);

        if (error) {
            setAlert({ msg: "Failed to remove student(s): " + error.message, type: "error" });
        } else {
            setAlert({ msg: "Student(s) removed from section.", type: "success" });
            setSelectedAssignmentIds([]); 
            setDeleteTargetIds(null);
            await fetchEnrolledStudents();
            onRefresh(); // Refresh parent offerings table
        }
        setIsDeleting(false);
    }

    const availableStudents = studentOptions.filter(opt => !enrolledStudents.some(es => es.student_id === opt.value));

    const studentCols = [
        {
            headerRenderer: () => (
                <input 
                    type="checkbox" 
                    checked={enrolledStudents.length > 0 && selectedAssignmentIds.length === enrolledStudents.length}
                    onChange={(e) => {
                        if (e.target.checked) setSelectedAssignmentIds(enrolledStudents.map(s => s.assignment_id));
                        else setSelectedAssignmentIds([]);
                    }}
                />
            ),
            cellRenderer: (_: any, row: any) => (
                <input 
                    type="checkbox" 
                    checked={selectedAssignmentIds.includes(row.assignment_id)}
                    onChange={() => {
                        setSelectedAssignmentIds(prev => 
                            prev.includes(row.assignment_id) ? prev.filter(id => id !== row.assignment_id) : [...prev, row.assignment_id]
                        );
                    }}
                />
            ),
            field: "checkbox",
            width: 40,
            sortable: false
        },
        { field: "full_name", header: "Student Name", flex: 1, sortable: true },
        { 
            cellRenderer: (_: any, row: any) => (
                <Btn size="sm" variant="danger" onClick={() => promptRemoveStudents([row.assignment_id])}>Remove</Btn>
            ), 
            field: "assignment_id", 
            header: "Action", 
            sortable: false,
            width: 90 
        }
    ];

    return (
        <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            
            {alert && (
                <div style={{ left: "50%", padding: "10px 20px", position: "absolute", top: "20px", transform: "translateX(-50%)", zIndex: 1200, background: alert.type === 'error' ? "#ef4444" : "#10b981", borderRadius: "6px", color: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontSize: "14px", fontWeight: 600 }}>
                    {alert.msg}
                </div>
            )}

            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "800px", maxWidth: "95%", position: "relative" }}>
                
                <div style={{ borderBottom: "1px solid #334155", marginBottom: "20px", paddingBottom: "16px" }}>
                    <h3 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>{sectionData.course_code} - {sectionData.section_label}</h3>
                    <div style={{ color: "#94a3b8", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                        <div><strong>Course:</strong> {sectionData.course_name}</div>
                        <div><strong>Professor:</strong> {sectionData.teacher_name || 'Unassigned'}</div>
                        <div><strong>Schedule:</strong> {sectionData.schedule_label || 'Unassigned'}</div>
                        <div><strong>Capacity:</strong> {enrolledStudents.length} / {sectionData.max_capacity ?? '∞'}</div>
                    </div>
                </div>

                <div style={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: "8px", marginBottom: "20px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div>
                            <h4 style={{ color: "#60a5fa", margin: "0 0 4px 0", fontSize: "14px" }}>+ Manual Enrollment</h4>
                            <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>Only students whose programs map to this course are shown.</p>
                        </div>
                    </div>
                    
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                            <SearchableSelect 
                                options={availableStudents}
                                value={selectedStudentId}
                                onChange={(val: any) => {
                                    setSelectedStudentId(val);
                                    setValidationWarning(null);
                                }}
                                placeholder={isSearching ? "Loading eligible students..." : "Search eligible student..."}
                                emptyMessage={isSearching ? "Loading..." : "No eligible students found for this curriculum course."}
                            />
                        </div>
                        <Btn 
                            onClick={handleManualEnroll} 
                            disabled={isAssigning || !selectedStudentId}
                            style={{ height: "38px" }} 
                        >
                            {isAssigning ? "Validating..." : "Enroll"}
                        </Btn>
                    </div>

                    {validationWarning && (
                        <div style={{ background: "#451a03", border: "1px solid #b45309", borderRadius: "6px", padding: "12px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ color: "#fcd34d", fontSize: "13px" }}>
                                <strong>Validation Failed:</strong> {validationWarning}
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <Btn size="sm" variant="secondary" onClick={() => setValidationWarning(null)}>Cancel</Btn>
                                <Btn size="sm" variant="danger" onClick={executeEnrollment}>Force Enroll</Btn>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h4 style={{ color: "#f1f5f9", margin: 0 }}>Enrolled Students ({enrolledStudents.length})</h4>
                    {selectedAssignmentIds.length > 0 && (
                        <Btn size="sm" variant="danger" onClick={() => promptRemoveStudents(selectedAssignmentIds)}>
                            Bulk Remove ({selectedAssignmentIds.length})
                        </Btn>
                    )}
                </div>
                
                <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", height: "300px", overflow: "hidden" }}>
                    {isFetchingStudents ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>Fetching list...</div>
                    ) : enrolledStudents.length > 0 ? (
                        <LMSGrid columns={studentCols} rowData={enrolledStudents} height="100%" />
                    ) : (
                        <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>No students enrolled in this section yet.</div>
                    )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
                    <Btn onClick={onClose} variant="secondary">Close Window</Btn>
                </div>

                {/* Delete Confirmation Overlay */}
                {deleteTargetIds && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.95)", borderRadius: "8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center", zIndex: 1100 }}>
                        <h4 style={{ color: "#ef4444" }}>Confirm Unenrollment</h4>
                        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "20px" }}>
                            Are you sure you want to remove {deleteTargetIds.length} student(s) from this section?
                        </p>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <Btn onClick={() => setDeleteTargetIds(null)} variant="secondary" size="sm" disabled={isDeleting}>Cancel</Btn>
                            <Btn onClick={executeRemoveStudents} variant="danger" size="sm" disabled={isDeleting}>
                                {isDeleting ? "Removing..." : "Yes, Remove"}
                            </Btn>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}