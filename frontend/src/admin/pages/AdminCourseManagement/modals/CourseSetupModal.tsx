import { useEffect, useState } from 'react';
import { Btn, FF, Input } from '../../../../components/ui';
import { supabase } from '../../../../supabaseClient';

interface CourseSetupModalProps {
    initialData?: any | null;
    onClose: () => void;
    onSave: () => void;
    prefilledPrefix?: string | null;
    onError?: (msg: string) => void;
    allCourses?: any[];
    globalPrereqs?: Record<string, string[]>;
}

/**
 * CourseSetupModal
 * * Logic: Either a standalone course OR an integrated (Lec + Lab) pair.
 * * Immutable Structure Rule: If editing, structural toggles (Integrated/Manual) are disabled.
 * * Smart Validation: Secure in-memory filtering to prevent base name collisions.
 * * Prerequisite Support: Includes a searchable checklist for selecting prerequisites.
 */
export function CourseSetupModal({ initialData, onClose, onSave, prefilledPrefix, onError, allCourses = [], globalPrereqs = {} }: CourseSetupModalProps) {
    const [isSaving, setIsSaving] = useState(false);
    
    // If editing, lock down structural changes.
    const [isManual, setIsManual] = useState(false);
    const [isFetchingNext, setIsFetchingNext] = useState(false);

    const [form, setForm] = useState({
        prefix: prefilledPrefix || initialData?.code?.match(/^[A-Za-z]+/)?.[0] || "",
        number: initialData?.code?.match(/\d+/)?.[0] || "",
        isIntegrated: initialData?.code?.endsWith("_LEC") || initialData?.code?.endsWith("_LAB") || false,
        lecUnits: (initialData?.code?.endsWith("_LEC") || !initialData?.code?.includes("_")) ? (initialData?.units || 3) : 3,
        labUnits: initialData?.code?.endsWith("_LAB") ? (initialData?.units || 1) : 1,
        customCode: initialData?.code || "",
        name: initialData?.name?.replace(/\s*\((LEC|LAB)\)$/i, "") || "",
        isActive: initialData?.isActive ?? true
    });

    // Prerequisite States
    const [prereqSearch, setPrereqSearch] = useState("");
    const [selectedPrereqs, setSelectedPrereqs] = useState<string[]>(() => {
        if (initialData?._uuid && globalPrereqs[initialData._uuid]) {
            const prereqCodes = globalPrereqs[initialData._uuid];
            return allCourses.filter(c => prereqCodes.includes(c.code)).map(c => c._uuid);
        }
        return [];
    });

    // Filter courses for the prerequisite selector (excluding self)
    const filteredCourses = allCourses.filter(c => {
        if (initialData && c._uuid === initialData._uuid) return false; // Prevent self-requisite
        const search = prereqSearch.toLowerCase();
        return c.code.toLowerCase().includes(search) || c.name.toLowerCase().includes(search);
    });

    function throwError(msg: string) {
        if (onError) onError(msg);
        else alert(msg);
    }

    async function suggestNextNumber(p: string) {
        if (!p || initialData) return;
        setIsFetchingNext(true);
        const { data, error } = await supabase
            .from('courses')
            .select('course_code')
            .ilike('course_code', `${p}%`);

        if (!error && data && data.length > 0) {
            const numbers = data.map(c => {
                const match = c.course_code.match(/\d+/);
                return match ? parseInt(match[0], 10) : 0;
            });
            const maxNum = Math.max(...numbers, 100);
            setForm(prev => ({ ...prev, number: (maxNum + 1).toString() }));
        } else {
            setForm(prev => ({ ...prev, number: "101" }));
        }
        setIsFetchingNext(false);
    }

    useEffect(() => {
        if (!initialData && form.prefix) {
            void suggestNextNumber(form.prefix);
        }
    }, [form.prefix]);

    async function checkNameConflict(baseName: string): Promise<boolean> {
        const cleanName = baseName.trim().toLowerCase();
        
        const { data, error } = await supabase
            .from('courses')
            .select('course_id, course_name, course_code')
            .ilike('course_name', `${baseName.trim()}%`);

        if (error || !data) return false;

        const conflictingData = data.filter(course => {
            const dbBaseName = course.course_name.replace(/\s*\((LEC|LAB)\)$/i, "").trim().toLowerCase();
            if (dbBaseName !== cleanName) return false;

            if (initialData) {
                const currentBaseCode = initialData.code.replace(/_(LEC|LAB)$/i, '');
                const dbBaseCode = course.course_code.replace(/_(LEC|LAB)$/i, '');
                return currentBaseCode !== dbBaseCode; 
            }
            return true;
        });

        return conflictingData.length > 0;
    }

    async function handleSave() {
        if (!form.name || (!isManual && (!form.prefix || !form.number))) return;

        setIsSaving(true);

        const hasNameConflict = await checkNameConflict(form.name);
        if (hasNameConflict) {
            throwError(`Validation Error: The base course name "${form.name.trim()}" is already in use (either as a standalone or integrated course).`);
            setIsSaving(false);
            return;
        }

        const payload: any[] = [];

        if (isManual && !initialData) {
            payload.push({
                course_code: form.customCode.trim().toUpperCase(),
                course_name: form.name,
                units: form.lecUnits,
                is_active: form.isActive
            });
        } else if (form.isIntegrated && !initialData) {
            payload.push({
                course_code: `${form.prefix.toUpperCase()}${form.number}_LEC`,
                course_name: `${form.name} (LEC)`,
                units: form.lecUnits,
                is_active: form.isActive
            });
            payload.push({
                course_code: `${form.prefix.toUpperCase()}${form.number}_LAB`,
                course_name: `${form.name} (LAB)`,
                units: form.labUnits,
                is_active: form.isActive
            });
        } else if (!initialData) {
            payload.push({
                course_code: `${form.prefix.toUpperCase()}${form.number}`,
                course_name: form.name,
                units: form.lecUnits,
                is_active: form.isActive
            });
        }

        let error;
        let newCourseIds: string[] = [];

        if (initialData?._uuid) {
            let finalName = form.name;
            if (initialData.code.endsWith("_LEC")) finalName = `${form.name} (LEC)`;
            if (initialData.code.endsWith("_LAB")) finalName = `${form.name} (LAB)`;

            const updatePayload = {
                course_name: finalName,
                units: initialData.code.endsWith("_LAB") ? form.labUnits : form.lecUnits,
                is_active: form.isActive
            };

            const res = await supabase.from("courses").update(updatePayload).eq("course_id", initialData._uuid).select('course_id');
            error = res.error;
            if (res.data) newCourseIds = res.data.map(d => d.course_id);
        } else {
            const res = await supabase.from("courses").insert(payload).select('course_id');
            error = res.error;
            if (res.data) newCourseIds = res.data.map(d => d.course_id);
        }

        if (!error) {
            // Handle Prerequisites (Delete existing for this course and re-insert)
            if (initialData?._uuid) {
                await supabase.from("course_prerequisites").delete().eq("course_id", initialData._uuid);
            }
            if (selectedPrereqs.length > 0 && newCourseIds.length > 0) {
                const prereqPayload = [];
                for (const cid of newCourseIds) {
                    for (const pid of selectedPrereqs) {
                        prereqPayload.push({ course_id: cid, prereq_course_id: pid });
                    }
                }
                await supabase.from("course_prerequisites").insert(prereqPayload);
            }

            onSave();
            onClose();
        } else {
            if (error.code === '23514') {
                throwError("Validation Error: Units must be a positive number.");
            } else if (error.code === '23505') {
                if (error.message?.includes('unique_course_name')) {
                    throwError("Validation Error: This Course Name is already in use by another record.");
                } else {
                    throwError("Validation Error: This Course Code already exists.");
                }
            } else {
                throwError("Database Error: " + error.message);
            }
        }
        setIsSaving(false);
    }

    return (
        <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "480px" }}>
                <h3 style={{ color: "#f1f5f9", margin: "0 0 20px 0" }}>
                    {initialData ? "Edit Course Details" : "Create New Course"}
                </h3>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <label style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px" }}>COURSE IDENTIFIER</label>
                    {!initialData && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <input type="checkbox" checked={isManual} onChange={(e) => setIsManual(e.target.checked)} />
                            <span style={{ color: "#64748b", fontSize: "11px" }}>Manual Code</span>
                        </div>
                    )}
                </div>

                {!isManual ? (
                    <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr", marginBottom: "20px" }}>
                        <FF label="Prefix">
                            <Input placeholder="e.g. CS" value={form.prefix} onChange={e => setForm({...form, prefix: e.target.value.toUpperCase()})} disabled={!!initialData} />
                        </FF>
                        <FF label="Sequence Number">
                            <Input placeholder="..." value={form.number} onChange={e => setForm({...form, number: e.target.value})} disabled={isFetchingNext || !!initialData} />
                        </FF>
                    </div>
                ) : (
                    <div style={{ marginBottom: "20px" }}>
                        <Input placeholder="Enter full custom code..." value={form.customCode} onChange={e => setForm({...form, customCode: e.target.value})} disabled={!!initialData} />
                    </div>
                )}

                <div style={{ background: "#0f172a", borderRadius: "8px", padding: "16px", marginBottom: "20px", border: "1px solid #334155" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <input 
                                    type="checkbox" 
                                    checked={form.isIntegrated} 
                                    onChange={e => setForm({...form, isIntegrated: e.target.checked})} 
                                    disabled={!!initialData}
                                    style={{ cursor: initialData ? 'not-allowed' : 'pointer' }}
                                />
                                <span style={{ color: initialData ? "#64748b" : "#e2e8f0", fontSize: "13px" }}>Integrated Lec & Lab</span>
                            </div>
                        </div>
                        <span style={{ color: "#64748b", fontSize: "11px" }}>COURSE TYPE</span>
                    </div>

                    <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }}>
                        <FF label={form.isIntegrated ? "Lecture Units" : "Course Units"}>
                            <Input 
                                type="number" 
                                value={form.lecUnits} 
                                onChange={e => setForm({...form, lecUnits: Number(e.target.value)})} 
                                disabled={!!initialData && form.isIntegrated && initialData.code.endsWith("_LAB")}
                            />
                        </FF>
                        <FF label="Laboratory Units">
                            <Input 
                                type="number" 
                                value={form.labUnits} 
                                onChange={e => setForm({...form, labUnits: Number(e.target.value)})} 
                                disabled={!form.isIntegrated || (!!initialData && form.isIntegrated && initialData.code.endsWith("_LEC"))} 
                                placeholder={form.isIntegrated ? "" : "N/A"}
                            />
                        </FF>
                    </div>
                </div>

                <FF label="Descriptive Course Name">
                    <Input placeholder="e.g. Object Oriented Programming" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </FF>

                <div style={{ marginTop: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <label style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px" }}>PREREQUISITES (OPTIONAL)</label>
                        <input 
                            type="text" 
                            placeholder="Search existing courses..." 
                            value={prereqSearch}
                            onChange={(e) => setPrereqSearch(e.target.value)}
                            style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "4px", color: "#e2e8f0", fontSize: "12px", padding: "4px 8px", width: "160px" }}
                        />
                    </div>
                    <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "8px", maxHeight: "120px", overflowY: "auto" }}>
                        {filteredCourses.map(c => (
                            <label key={c._uuid} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={selectedPrereqs.includes(c._uuid)}
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedPrereqs(prev => [...prev, c._uuid]);
                                        else setSelectedPrereqs(prev => prev.filter(id => id !== c._uuid));
                                    }}
                                />
                                <span style={{ color: "#e2e8f0", fontSize: "13px" }}>{c.code} - {c.name}</span>
                            </label>
                        ))}
                        {filteredCourses.length === 0 && <div style={{ color: "#64748b", fontSize: "13px", padding: "4px 0" }}>No matching courses found.</div>}
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
                    <Btn onClick={onClose} variant="secondary">Cancel</Btn>
                    <Btn onClick={handleSave} disabled={isSaving || isFetchingNext}>
                        {isSaving ? "Saving..." : (initialData ? "Update Record" : "Create Course(s)")}
                    </Btn>
                </div>
            </div>
        </div>
    );
}