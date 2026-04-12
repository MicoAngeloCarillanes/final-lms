import React, { useRef, useState } from 'react';
import LMSGrid from '../../../../components/LMSGrid';
import { Btn } from '../../../../components/ui';
import { supabase } from '../../../../supabaseClient';

interface BulkEnrollmentModalProps {
    onClose: () => void;
    onSave: () => void;
}

/**
 * BulkEnrollmentModal
 * * Workflow: Download Template -> Upload CSV -> Validate -> Preview -> Confirm.
 * * Logic: Strictly enforces Program/Course mapping as a hard requirement.
 * * Cleaning: Automatically removes duplicate rows within the CSV to prevent DB unique constraint errors.
 */
export default function BulkEnrollmentModal({ onClose, onSave }: BulkEnrollmentModalProps) {
    const [step, setStep] = useState<'upload' | 'preview'>('upload');
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function downloadEnrollmentTemplate() {
        const headers = "student_id,section_label\nSTU26-00001,CS101_LAB-26-1-S1\nSTU26-00002,MATH102_LEC-26-1-S2";
        const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", "Strict_Enrollment_Template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function processCsv(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        const reader = new FileReader();

        reader.onload = async function (event) {
            try {
                const csvData = (event.target?.result as string).replace(/^\ufeff/, '');
                const rawLines = csvData.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                if (rawLines.length < 2) throw new Error("CSV is empty");

                // --- 1. CLEANING: De-duplicate CSV Entries to prevent 23505 Error ---
                const lines = [rawLines[0]]; // Keep Header
                const seenEntries = new Set<string>();
                for (let i = 1; i < rawLines.length; i++) {
                    const entryKey = rawLines[i].toLowerCase();
                    if (!seenEntries.has(entryKey)) {
                        lines.push(rawLines[i]);
                        seenEntries.add(entryKey);
                    }
                }

                // --- 2. PRE-FETCH REFERENCE DATA ---
                const { data: allSections } = await supabase
                    .from('course_sections')
                    .select('section_id, section_label, max_capacity, course_id, student_section_assignments(count)');
                
                const { data: allMapping } = await supabase
                    .from('course_program_map')
                    .select('course_id, program_id');

                const { data: allPrereqs } = await supabase
                    .from('course_prerequisites')
                    .select('course_id, prereq_course_id');
                
                const validationResults: any[] = [];

                // --- 3. VALIDATION LOOP ---
                for (let i = 1; i < lines.length; i++) {
                    const rowValues = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    const [studentId, sectionLabel] = rowValues;

                    if (!studentId || !sectionLabel) continue;

                    const { data: studentRecord } = await supabase
                        .from('students')
                        .select('program_id, user_id, users!students_user_id_fkey(full_name)')
                        .eq('student_id', studentId)
                        .maybeSingle();

                    const section = allSections?.find(s => s.section_label === sectionLabel);
                    const errorMsgs: string[] = [];
                    let isHardError = false;

                    if (!studentRecord) {
                        errorMsgs.push("Student ID not found");
                        isHardError = true;
                    }
                    if (!section) {
                        errorMsgs.push("Section invalid");
                        isHardError = true;
                    }

                    if (studentRecord && section) {
                        // A. Curriculum Mapping Check (HARD ERROR)
                        const isMapped = allMapping?.some(m => 
                            m.course_id === section.course_id && 
                            m.program_id === studentRecord.program_id
                        );
                        
                        if (!isMapped) {
                            errorMsgs.push("Program/Course Mismatch");
                            isHardError = true; // Cannot force if program doesn't have the course
                        }

                        // B. Prerequisite Check (SOFT ERROR)
                        const prereqs = allPrereqs?.filter(p => p.course_id === section.course_id);
                        if (prereqs && prereqs.length > 0) {
                            const { data: history } = await supabase
                                .from('student_section_assignments')
                                .select('final_grade, course_sections!inner(course_id)')
                                .eq('student_id', studentRecord.user_id);

                            for (const req of prereqs) {
                                const passed = history?.some(h => 
                                    h.course_sections.course_id === req.prereq_course_id && 
                                    h.final_grade && (h.final_grade <= 3.0 || h.final_grade >= 75)
                                );
                                if (!passed) errorMsgs.push("Missing Prereq");
                            }
                        }

                        // C. Capacity Check (SOFT ERROR)
                        const currentCount = section.student_section_assignments?.[0]?.count || 0;
                        if (section.max_capacity !== null && currentCount >= section.max_capacity) {
                            errorMsgs.push("Section Full");
                        }

                        // D. Duplicate Enrollment Check (HARD ERROR)
                        const { count: exists } = await supabase
                            .from('student_section_assignments')
                            .select('*', { count: 'exact', head: true })
                            .eq('student_id', studentRecord.user_id)
                            .eq('section_id', section.section_id);
                        
                        if (exists && exists > 0) {
                            errorMsgs.push("Already Enrolled");
                            isHardError = true;
                        }
                    }

                    validationResults.push({
                        id: i,
                        student_display: studentRecord ? `${studentRecord.users.full_name} (${studentId})` : studentId,
                        student_user_id: studentRecord?.user_id,
                        section_id: section?.section_id,
                        section_label: sectionLabel,
                        status: errorMsgs.length === 0 ? "Valid" : (isHardError ? "Blocked" : "Needs Force"),
                        errors: errorMsgs.join(", "),
                        isHardError,
                        forceEnroll: false
                    });
                }

                setResults(validationResults);
                setStep('preview');
            } catch (err) {
                alert("Processing failed. Please ensure the CSV follows the template.");
            } finally {
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    }

    async function handleConfirmEnrollment() {
        setIsProcessing(true);
        const toEnroll = results.filter(r => !r.isHardError && (r.status === 'Valid' || r.forceEnroll));

        if (toEnroll.length === 0) {
            alert("No valid rows selected for enrollment.");
            setIsProcessing(false);
            return;
        }

        const payload = toEnroll.map(r => ({
            student_id: r.student_user_id,
            section_id: r.section_id,
            enrollment_status: 'Enrolled'
        }));

        const { error } = await supabase.from('student_section_assignments').insert(payload);

        if (!error) {
            onSave();
            onClose();
        } else {
            alert("Enrollment Error: " + error.message);
            setIsProcessing(false);
        }
    }

    const columns = [
        { field: "student_display", header: "Student Identity", flex: 1 },
        { field: "section_label", header: "Target Section", width: 180 },
        { 
            field: "errors", 
            header: "Validation Results", 
            flex: 1, 
            cellRenderer: (_: any, row: any) => (
                <span style={{ color: row.isHardError ? "#f87171" : "#fbbf24", fontSize: '11px', fontWeight: 600 }}>
                    {row.errors || "Requirements Met"}
                </span>
            ) 
        },
        { 
            field: "forceEnroll", 
            header: "Force?", 
            width: 80,
            cellRenderer: (_: any, row: any) => (
                !row.isHardError && row.status === "Needs Force" ? (
                    <input 
                        type="checkbox" 
                        checked={row.forceEnroll} 
                        onChange={(e) => {
                            const updated = results.map(r => r.id === row.id ? { ...r, forceEnroll: e.target.checked } : r);
                            setResults(updated);
                        }} 
                    />
                ) : row.isHardError ? <span title="Curriculum mismatch or Duplicate - cannot force" style={{ color: '#475569', fontSize: '18px' }}>•</span> : <span>—</span>
            )
        }
    ];

    return (
        <div style={{ alignItems: "center", background: "rgba(0,0,0,0.8)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1200 }}>
            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "32px", width: step === 'upload' ? "450px" : "1100px", maxWidth: "95%", border: "1px solid #334155" }}>
                <h3 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>Strict Bulk Enrollment</h3>
                
                {step === 'upload' ? (
                    <>
                        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "24px" }}>
                            Process bulk student assignments. System will block curriculum mismatches.
                        </p>
                        
                        <div style={{ background: "#0f172a", border: "1px dashed #334155", borderRadius: "8px", padding: "20px", marginBottom: "24px", textAlign: "center" }}>
                            <Btn variant="secondary" size="sm" onClick={downloadEnrollmentTemplate}>
                                ⬇ Download Template
                            </Btn>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <Btn onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                                {isProcessing ? "Validating Logic..." : "Upload & Validate CSV"}
                            </Btn>
                            <Btn variant="secondary" onClick={onClose} disabled={isProcessing}>Cancel</Btn>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={processCsv} style={{ display: "none" }} accept=".csv" />
                    </>
                ) : (
                    <>
                        <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", height: "500px", marginBottom: "24px", overflow: "hidden" }}>
                            <LMSGrid columns={columns} rowData={results} height="100%" />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <p style={{ color: "#f87171", fontSize: "11px", margin: 0 }}><strong>Blocked:</strong> Mismatch program, invalid data, or duplicate (Force disabled).</p>
                                <p style={{ color: "#fbbf24", fontSize: "11px", margin: 0 }}><strong>Needs Force:</strong> Unmet prerequisites or section is full (Force enabled).</p>
                            </div>
                            <div style={{ display: "flex", gap: "12px" }}>
                                <Btn variant="secondary" onClick={() => setStep('upload')}>Back</Btn>
                                <Btn onClick={handleConfirmEnrollment} disabled={isProcessing}>
                                    {isProcessing ? "Saving Records..." : "Process Valid & Forced Rows"}
                                </Btn>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}