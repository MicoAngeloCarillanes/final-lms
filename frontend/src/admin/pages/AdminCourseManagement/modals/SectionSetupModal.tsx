import { useEffect, useState } from 'react';
import { Btn, FF, Input } from '../../../../components/ui';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { supabase } from '../../../../supabaseClient';
import { useReferenceData } from '../hooks/useReferenceData';

interface SectionSetupModalProps {
    initialData?: any | null;
    courseId: string;
    onClose: () => void;
    onSave: () => void;
}

/**
 * SectionSetupModal
 * * Logic: Handles creation/editing of course sections.
 * * Integrated Course Logic: If a LEC or LAB course is selected, it automatically creates both sections
 * to maintain structural parity in the offerings list.
 *
 * FIX: Removed the teacher_course_assignments delete-then-insert sync block.
 * That block deleted ALL teacher assignments for a course_id before inserting the new one,
 * which erased Pansit Kanton's assignment the moment Teacher 123's section was saved for
 * the same course concept (both CS101_LAB sections share the same course_id in that table).
 *
 * App.jsx now reads the assigned teacher directly from course_sections.teacher_id, so
 * teacher_course_assignments no longer drives the teacher→course relationship on the
 * teacher or student dashboards. The sync block is therefore both unnecessary and harmful.
 */
export default function SectionSetupModal({
    courseId,
    initialData,
    onClose,
    onSave
}: SectionSetupModalProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

    const { academicBlocks, courses, faculty, schedules, schoolYears } = useReferenceData();

    const [form, setForm] = useState({
        blockId: initialData?.block_id || "",
        maxCapacity: initialData?.max_capacity ?? null,
        programId: initialData?.program_id || "",
        roomId: initialData?.room_id || "",
        scheduleLabel: initialData?.schedule_label || "",
        sectionLabel: initialData?.section_label || "",
        selectedCourseId: courseId || initialData?.course_id || "",
        semester: initialData?.semester || "1st Semester",
        syId: initialData?.sy_id || "",
        teacherId: initialData?.teacher_id || "",
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

    async function handlePersist() {
        setIsSaving(true);

        const selectedCourse = courses.find(c => c.course_id === form.selectedCourseId);
        const selectedSY = schoolYears.find(s => s.sy_id === form.syId);

        if (!selectedCourse || !selectedSY) {
            showAlert("Course and School Year are required.");
            setIsSaving(false);
            return;
        }

        const isIntegrated = selectedCourse.course_code.endsWith("_LEC") || selectedCourse.course_code.endsWith("_LAB");
        const baseCode = selectedCourse.course_code.replace(/_(LEC|LAB)$/, '');

        // Identify if we need to create a pair
        const targetCourses = (!initialData && isIntegrated)
            ? courses.filter(c => c.course_code.startsWith(baseCode + "_"))
            : [selectedCourse];

        const payload = [];

        // Generate Section Label Sequence (S1, S2, etc.)
        let nextNum = 1;
        if (!initialData) {
            const { data: existing } = await supabase
                .from("course_sections")
                .select("section_label")
                .ilike("section_label", `${baseCode}%`)
                .eq("sy_id", form.syId)
                .eq("semester", form.semester);

            if (existing && existing.length > 0) {
                const numbers = existing.map(e => {
                    const match = e.section_label?.match(/S(\d+)$/);
                    return match ? parseInt(match[1]) : 0;
                });
                nextNum = Math.max(...numbers, 0) + 1;
            }
        }

        const yearShort = selectedSY.label.split("-")[1]?.slice(-2) || "YY";
        const semCode = form.semester === '1st Semester' ? '1' : (form.semester === '2nd Semester' ? '2' : 'S');

        for (const course of targetCourses) {
            const sectionLabel = initialData
                ? form.sectionLabel
                : `${course.course_code}-${yearShort}-${semCode}-S${nextNum}`;

            payload.push({
                block_id: form.blockId || null,
                course_id: course.course_id,
                max_capacity: form.maxCapacity,
                program_id: form.programId || null,
                room_id: form.roomId || null,
                schedule_label: form.scheduleLabel || null,
                section_label: sectionLabel,
                semester: form.semester,
                sy_id: form.syId,
                teacher_id: form.teacherId || null,
                year_level: form.yearLevel || null
            });
        }

        let res;
        if (initialData?.section_id) {
            res = await supabase.from("course_sections").update(payload[0]).eq("section_id", initialData.section_id);
        } else {
            res = await supabase.from("course_sections").insert(payload);
        }

        if (!res.error) {
            // ── Teacher assignment is now fully handled by course_sections.teacher_id ──
            // App.jsx reads teacher info directly from that column, so no additional sync
            // to teacher_course_assignments is required here.
            //
            // The previous sync block (delete all by course_id → insert new) was the root
            // cause of the isolation bug: creating a second CS101_LAB section for a different
            // teacher wiped the first teacher's assignment because both sections share the
            // same course_id in that table.  It has been intentionally removed.

            onSave();
            onClose();
        } else {
            showAlert("Database Error: " + res.error.message);
        }

        setIsSaving(false);
        setShowConfirm(false);
    }

    const facultyOptions = (faculty || []).map((f: any) => ({ label: f.full_name, value: f.user_id }));
    const scheduleOptions = (schedules || []).map((s: any) => ({ label: s.schedule_label, value: s.schedule_label }));
    const courseOptions = (courses || []).map((c: any) => ({ label: `${c.course_code} - ${c.course_name}`, value: c.course_id }));
    const syOptions = (schoolYears || []).map((sy: any) => ({ label: sy.label, value: sy.sy_id }));
    const blockOptions = (academicBlocks || []).map((b: any) => ({ label: b.label, value: b.block_id }));

    const semesterOptions = [
        { label: "1st Semester", value: "1st Semester" },
        { label: "2nd Semester", value: "2nd Semester" },
        { label: "Summer", value: "Summer" }
    ];

    const isIntegratedSelection = courses.find(c => c.course_id === form.selectedCourseId)?.course_code.match(/_(LEC|LAB)$/);

    return (
        <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>

            {alert && (
                <div style={{ left: "50%", padding: "12px 24px", position: "fixed", top: "40px", transform: "translateX(-50%)", zIndex: 9999, background: alert.type === 'error' ? "#ef4444" : "#10b981", borderRadius: "8px", color: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: 600 }}>
                    {alert.msg}
                </div>
            )}

            <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "500px", maxWidth: "90%", position: "relative" }}>

                <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>
                    {initialData ? 'Edit Section Setup' : 'Create New Section'}
                </h3>

                {isIntegratedSelection && !initialData && (
                    <div style={{ background: "#0f172a", border: "1px solid #1d4ed8", borderRadius: "6px", color: "#60a5fa", fontSize: "12px", marginBottom: "16px", padding: "10px" }}>
                        <strong>Note:</strong> This is an integrated course. Sections for both Lecture and Laboratory will be created simultaneously.
                    </div>
                )}

                {!courseId && (
                    <div style={{ marginBottom: "16px" }}>
                        <FF label="Select Course">
                            <SearchableSelect
                                options={courseOptions}
                                value={form.selectedCourseId}
                                onChange={(val: any) => setForm({ ...form, selectedCourseId: val })}
                                placeholder="Search Course..."
                            />
                        </FF>
                    </div>
                )}

                <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr", marginBottom: "16px" }}>
                    <FF label="Section Label">
                         <div style={{ padding: "10px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", color: "#64748b", fontSize: "13px" }}>
                            {initialData ? form.sectionLabel : "Auto-Generated"}
                         </div>
                    </FF>
                    <FF label="Max Capacity">
                        <Input
                            type="number"
                            placeholder="∞ (Blank = no limit)"
                            value={form.maxCapacity ?? ""}
                            onChange={(e) => setForm({ ...form, maxCapacity: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                    </FF>
                </div>

                <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr", marginBottom: "16px" }}>
                    <FF label="School Year">
                        <SearchableSelect
                            options={syOptions}
                            value={form.syId}
                            onChange={(val: any) => setForm({ ...form, syId: val })}
                            placeholder="Search School Year..."
                        />
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

                <FF label="Academic Block (Cohort)" style={{ marginBottom: "16px" }}>
                    <SearchableSelect
                        options={blockOptions}
                        value={form.blockId}
                        onChange={(val: any) => setForm({ ...form, blockId: val })}
                        placeholder="Search Academic Block..."
                    />
                </FF>

                <FF label="Assign Professor" style={{ marginBottom: "16px" }}>
                    <SearchableSelect options={facultyOptions} value={form.teacherId} onChange={(val: any) => setForm({ ...form, teacherId: val })} placeholder="Search Faculty..." />
                </FF>

                <FF label="Schedule Block" style={{ marginBottom: "16px" }}>
                    <SearchableSelect options={scheduleOptions} value={form.scheduleLabel} onChange={(val: any) => setForm({ ...form, scheduleLabel: val })} placeholder="Search Schedule..." />
                </FF>

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "24px" }}>
                    <Btn onClick={onClose} variant="secondary">Cancel</Btn>
                    <Btn onClick={() => setShowConfirm(true)} disabled={isSaving}>Save Changes</Btn>
                </div>

                {showConfirm && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.95)", borderRadius: "8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center", zIndex: 1100 }}>
                        <h4 style={{ color: "#f1f5f9" }}>Confirm Section Setup</h4>
                        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "20px" }}>Confirm database persistence for this section setup?</p>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <Btn onClick={() => setShowConfirm(false)} variant="secondary" size="sm">Go Back</Btn>
                            <Btn onClick={handlePersist} size="sm">Yes, Save</Btn>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
