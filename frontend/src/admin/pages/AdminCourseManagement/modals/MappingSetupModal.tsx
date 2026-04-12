import { useEffect, useState } from 'react';
import { Btn, FF, Sel } from '../../../../components/ui';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { supabase } from '../../../../supabaseClient';
import { useCatalogData } from '../hooks/useCatalogData';
import { useReferenceData } from '../hooks/useReferenceData';

interface MappingSetupModalProps {
    initialData?: any | null;
    onClose: () => void;
    onSave: () => void;
}

/**
 * MappingSetupModal
 * * Handles the creation and modification of course-to-program mappings.
 * * Enforces School Year requirement to maintain versioned curriculums.
 */
export default function MappingSetupModal({ initialData, onClose, onSave }: MappingSetupModalProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

    const { programs, schoolYears } = useReferenceData();
    
    // Use a simplified version of catalog data for course selection
    const { allCourses } = useCatalogData("", { dir: "asc", field: "prefix" }, "", { dir: "asc", field: "course_code" }, null);

    const [form, setForm] = useState({
        courseId: initialData?.course_id || "",
        programId: initialData?.program_id || "",
        semester: initialData?.semester || "1st Semester",
        syId: initialData?.effective_sy_id || "",
        yearLevel: initialData?.year_level || "1st Year"
    });

    useEffect(() => {
        if (alert) {
            const timer = setTimeout(() => setAlert(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [alert]);

    function showAlert(msg: string, type: 'error' | 'success' = 'error') {
        setAlert({ msg, type });
    }

    /**
     * persists the mapping to the database.
     */
    async function handleSave() {
        // Phase 2: Enforce School Year Requirement
        if (!form.courseId || !form.programId || !form.syId) {
            showAlert("Please select a Course, Program, and School Year.");
            setShowConfirm(false);
            return;
        }
        
        setIsSaving(true);

        const payload = {
            course_id: form.courseId,
            effective_sy_id: form.syId,
            program_id: Number(form.programId),
            semester: form.semester,
            year_level: form.yearLevel
        };

        const res = initialData?.id
            ? await supabase.from("course_program_map").update(payload).eq("id", initialData.id)
            : await supabase.from("course_program_map").insert(payload);

        if (!res.error) {
            onSave();
            onClose();
        } else {
            showAlert("Database Error: " + res.error.message);
            setShowConfirm(false);
        }
        setIsSaving(false);
    }

    // Format options for SearchableSelect
    const courseOptions = (allCourses || []).map((c: any) => ({ label: `${c.code} - ${c.name}`, value: c._uuid }));
    const programOptions = (programs || []).map((p: any) => ({ label: p.code, value: p.program_id }));
    const syOptions = (schoolYears || []).map((sy: any) => ({ label: sy.label, value: sy.sy_id }));

    // Semester options (static)
    const semesterOptions = [
        { label: "1st Semester", value: "1st Semester" },
        { label: "2nd Semester", value: "2nd Semester" },
        { label: "Summer", value: "Summer" }
    ];

    return (
        <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            
            {alert && (
                <div style={{ left: "50%", padding: "12px 24px", position: "fixed", top: "40px", transform: "translateX(-50%)", zIndex: 9999, background: alert.type === 'error' ? "#ef4444" : "#10b981", borderRadius: "8px", color: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: 600 }}>
                    {alert.msg}
                </div>
            )}

            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "500px", maxWidth: "90%", position: "relative" }}>
                <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>
                    {initialData ? 'Edit Program Mapping' : 'Create Program Mapping'}
                </h3>
                
                <FF label="Select Course" style={{ marginBottom: "16px" }}>
                    <SearchableSelect 
                        options={courseOptions}
                        value={form.courseId}
                        onChange={(val: any) => setForm({ ...form, courseId: val })}
                        placeholder="Search by Course Code or Name..."
                    />
                </FF>

                <FF label="Target Program" style={{ marginBottom: "16px" }}>
                    <SearchableSelect 
                        options={programOptions}
                        value={form.programId}
                        onChange={(val: any) => setForm({ ...form, programId: val })}
                        placeholder="Search Program..."
                    />
                </FF>

                <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr", marginBottom: "16px" }}>
                    <FF label="Year Level">
                        <Sel value={form.yearLevel} onChange={e => setForm({...form, yearLevel: e.target.value})} style={{ width: "100%" }}>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                            <option value="5th Year">5th Year</option>
                        </Sel>
                    </FF>
                    <FF label="Semester">
                        <SearchableSelect 
                            options={semesterOptions} 
                            value={form.semester} 
                            onChange={(val: any) => setForm({ ...form, semester: val })}
                            placeholder="Search Semester..."
                        />
                    </FF>
                </div>

                <FF label="Effective School Year" style={{ marginBottom: "16px" }}>
                    <SearchableSelect 
                        options={syOptions} 
                        value={form.syId} 
                        onChange={(val: any) => setForm({ ...form, syId: val })}
                        placeholder="Search School Year..."
                    />
                </FF>

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "24px" }}>
                    <Btn onClick={onClose} variant="secondary">Cancel</Btn>
                    <Btn onClick={() => setShowConfirm(true)} disabled={isSaving}>
                        {initialData ? 'Update Mapping' : 'Save Mapping'}
                    </Btn>
                </div>

                {showConfirm && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.95)", borderRadius: "8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center", zIndex: 1100 }}>
                        <h4 style={{ color: "#f1f5f9" }}>Confirm Mapping Setup</h4>
                        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "20px" }}>Confirm database persistence for this mapping?</p>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <Btn onClick={() => setShowConfirm(false)} variant="secondary" size="sm">Go Back</Btn>
                            <Btn onClick={handleSave} size="sm">Yes, Save</Btn>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}