import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useState } from 'react';
import { Btn } from '../../../../components/ui';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { useCurriculumData } from '../hooks/useCurriculumData';
import { useReferenceData } from '../hooks/useReferenceData';

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

export default function CurriculumTab() {
    const { programs, schoolYears } = useReferenceData();

    const [draftProg, setDraftProg] = useState("");
    const [draftSy, setDraftSy] = useState("");
    const [activeProg, setActiveProg] = useState("");
    const [activeSy, setActiveSy] = useState("");

    const { groupedCurriculum, globalPrereqs, isLoading } = useCurriculumData(activeProg, activeSy);

    const isSearchDisabled = !draftProg || !draftSy;

    function executeSearch() {
        if (!isSearchDisabled) {
            setActiveProg(draftProg);
            setActiveSy(draftSy);
        }
    }

    function calculateGrandTotal() {
        return Object.values(groupedCurriculum).reduce((accYear: number, year: any) =>
            accYear + Object.values(year).reduce((accSem: number, sem: any) =>
                accSem + sem.reduce((accCourse: number, m: any) => accCourse + (m.units || 0), 0)
            , 0)
        , 0);
    }

    function handleExportPDF() {
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

        const programName = programs.find(p => String(p.program_id) === String(activeProg))?.name ?? "";
        const syLabel = schoolYears.find(s => String(s.sy_id) === String(activeSy))?.label ?? "";
        const pageWidth = doc.internal.pageSize.getWidth();

        // ── Header ──────────────────────────────────────────────────────────
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(programName, pageWidth / 2, 40, { align: "center" });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Effective School Year: ${syLabel}`, pageWidth / 2, 58, { align: "center" });

        let cursorY = 80;

        // ── Year / Semester blocks ───────────────────────────────────────────
        YEAR_LEVELS.forEach(year => {
            if (!groupedCurriculum[year]) return;

            const s1: any[] = groupedCurriculum[year]["1st Semester"] || [];
            const s2: any[] = groupedCurriculum[year]["2nd Semester"] || [];
            if (s1.length === 0 && s2.length === 0) return;

            // Year label
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(year.toUpperCase(), pageWidth / 2, cursorY, { align: "center" });
            cursorY += 14;

            const semesterColumns = [
                { header: "Code",        dataKey: "code"  },
                { header: "Description", dataKey: "desc"  },
                { header: "Units",       dataKey: "units" },
                { header: "Pre-req.",    dataKey: "pre"   },
            ];

            const buildRows = (courses: any[]) =>
                courses.map(m => ({
                    code:  m.course_code,
                    desc:  m.course_name,
                    units: m.units ?? 0,
                    pre:   (globalPrereqs[m.course_id] || []).join(", ") || "None",
                }));

            const totalRow = (courses: any[]) => [{
                code:  "",
                desc:  "Total Units",
                units: courses.reduce((a: number, c: any) => a + (c.units ?? 0), 0),
                pre:   "",
            }];

            const halfWidth = (pageWidth - 60) / 2; // 30pt margin each side

            // ── 1st Semester ────────────────────────────────────────────────
            const s1StartY = cursorY;
            if (s1.length > 0) {
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.text("1ST SEMESTER", 30 + halfWidth / 2, cursorY, { align: "center" });
                cursorY += 10;

                autoTable(doc, {
                    startY: cursorY,
                    margin: { left: 30, right: pageWidth / 2 + 5 },
                    columns: semesterColumns,
                    body: buildRows(s1),
                    foot: totalRow(s1),
                    showFoot: "lastPage",
                    styles: {
                        fontSize: 8,
                        cellPadding: 3,
                        lineColor: [0, 0, 0],
                        lineWidth: 0.5,
                        textColor: [0, 0, 0],
                    },
                    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" },
                    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
                    columnStyles: {
                        code:  { cellWidth: 65,  halign: "center" },
                        desc:  { cellWidth: "auto", halign: "left" },
                        units: { cellWidth: 35,  halign: "center" },
                        pre:   { cellWidth: 70,  halign: "center" },
                    },
                });
            }

            const s1EndY: number = (doc as any).lastAutoTable?.finalY ?? s1StartY;

            // ── 2nd Semester ────────────────────────────────────────────────
            const s2StartY = s1StartY; // start at the same Y as s1
            if (s2.length > 0) {
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.text("2ND SEMESTER", 30 + halfWidth + halfWidth / 2, s2StartY, { align: "center" });

                autoTable(doc, {
                    startY: s2StartY + 10,
                    margin: { left: pageWidth / 2 + 5, right: 30 },
                    columns: semesterColumns,
                    body: buildRows(s2),
                    foot: totalRow(s2),
                    showFoot: "lastPage",
                    styles: {
                        fontSize: 8,
                        cellPadding: 3,
                        lineColor: [0, 0, 0],
                        lineWidth: 0.5,
                        textColor: [0, 0, 0],
                    },
                    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" },
                    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
                    columnStyles: {
                        code:  { cellWidth: 65,  halign: "center" },
                        desc:  { cellWidth: "auto", halign: "left" },
                        units: { cellWidth: 35,  halign: "center" },
                        pre:   { cellWidth: 70,  halign: "center" },
                    },
                });
            }

            const s2EndY: number = (doc as any).lastAutoTable?.finalY ?? s2StartY;

            // Advance cursor past whichever table was taller
            cursorY = Math.max(s1EndY, s2EndY) + 24;

            // Divider between year blocks
            doc.setDrawColor(180, 180, 180);
            doc.setLineDashPattern([4, 3], 0);
            doc.line(30, cursorY - 12, pageWidth - 30, cursorY - 12);
            doc.setLineDashPattern([], 0);
        });

        // ── Grand Total ──────────────────────────────────────────────────────
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Curriculum Grand Total: ${calculateGrandTotal()} Units`, pageWidth - 30, cursorY + 4, { align: "right" });

        // ── Save ─────────────────────────────────────────────────────────────
        const safeName = programName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        doc.save(`curriculum_${safeName}_${syLabel}.pdf`);
    }

    const programOptions = programs.map(p => ({
        label: `${p.code} — ${p.name}`,
        value: p.program_id,
    }));

    const syOptions = schoolYears.map(s => ({
        label: s.label,
        value: s.sy_id,
    }));

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <style>{`
                .au-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; color: #f1f5f9; }
                .au-table th, .au-table td { border: 1px solid #334155; padding: 6px; text-align: center; }
                .au-table th { background: #1e293b; color: #94a3b8; font-weight: bold; }
                .au-table td:nth-child(2) { text-align: left; }
            `}</style>

            {/* Toolbar */}
            <div style={{ alignItems: "center", background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", gap: "16px", padding: "10px 16px" }}>
                <div style={{ width: "300px" }}>
                    <SearchableSelect
                        options={programOptions}
                        value={draftProg}
                        onChange={setDraftProg}
                        placeholder="— Select Program —"
                    />
                </div>
                <div style={{ width: "200px" }}>
                    <SearchableSelect
                        options={syOptions}
                        value={draftSy}
                        onChange={setDraftSy}
                        placeholder="— Effective SY —"
                    />
                </div>
                <Btn
                    onClick={executeSearch}
                    disabled={isSearchDisabled || isLoading}
                    size="sm"
                >
                    {isLoading ? "Loading..." : "Search"}
                </Btn>

                {activeProg && activeSy && !isLoading && (
                    <button
                        type="button"
                        onClick={handleExportPDF}
                        style={{
                            background: "transparent",
                            border: "1px solid #3b82f6",
                            borderRadius: "4px",
                            color: "#3b82f6",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: 600,
                            marginLeft: "auto",
                            padding: "6px 12px",
                            transition: "all 0.2s",
                        }}
                    >
                        Export PDF
                    </button>
                )}
            </div>

            {/* Display Area */}
            <div style={{ background: "#0f172a", flex: 1, overflowY: "auto", padding: "20px" }}>
                {!activeProg || !activeSy ? (
                    <div style={{ color: "#475569", fontSize: 14, marginTop: 60, textAlign: "center" }}>
                        Select a program and school year above, then click Search to view the curriculum.
                    </div>
                ) : isLoading ? (
                    <div style={{ color: "#475569", fontSize: 14, marginTop: 60, textAlign: "center" }}>
                        Loading curriculum data...
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px", margin: "0 auto", maxWidth: 1000 }}>
                        <div style={{ marginBottom: "20px", textAlign: "center" }}>
                            <h2 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>
                                {programs.find(p => String(p.program_id) === String(activeProg))?.name}
                            </h2>
                            <div style={{ color: "#94a3b8", fontSize: "14px" }}>
                                Effective School Year: {schoolYears.find(s => String(s.sy_id) === String(activeSy))?.label || "Unknown"}
                            </div>
                        </div>

                        {YEAR_LEVELS.map(year => {
                            if (!groupedCurriculum[year]) return null;
                            const s1 = groupedCurriculum[year]["1st Semester"] || [];
                            const s2 = groupedCurriculum[year]["2nd Semester"] || [];
                            if (s1.length === 0 && s2.length === 0) return null;

                            return (
                                <div key={year} style={{ borderBottom: "2px dashed #475569", paddingBottom: "24px" }}>
                                    <div style={{ color: "#a5b4fc", fontSize: "16px", fontWeight: 800, marginBottom: "12px", textAlign: "center", textTransform: "uppercase" }}>
                                        {year}
                                    </div>
                                    <div style={{ display: "flex", gap: "20px" }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>1ST SEMESTER</div>
                                            {s1.length > 0 ? (
                                                <table className="au-table">
                                                    <thead><tr><th>Code</th><th>Description</th><th>Units</th><th>Pre-req.</th></tr></thead>
                                                    <tbody>
                                                        {s1.map((m: any) => (
                                                            <tr key={m.id}>
                                                                <td>{m.course_code}</td>
                                                                <td>{m.course_name}</td>
                                                                <td>{m.units || 0}</td>
                                                                <td>{(globalPrereqs[m.course_id] || []).join(", ") || "None"}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr>
                                                            <td colSpan={2} style={{ fontWeight: "bold", textAlign: "right" }}>Total Units</td>
                                                            <td colSpan={2} style={{ fontWeight: "bold", textAlign: "left" }}>
                                                                {s1.reduce((acc: number, cur: any) => acc + (cur.units || 0), 0)}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            ) : (
                                                <div style={{ color: "#475569", fontSize: "12px", textAlign: "center", fontStyle: "italic", padding: "20px", border: "1px solid #334155", background: "#1e293b" }}>
                                                    No courses mapped for this semester.
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>2ND SEMESTER</div>
                                            {s2.length > 0 ? (
                                                <table className="au-table">
                                                    <thead><tr><th>Code</th><th>Description</th><th>Units</th><th>Pre-req.</th></tr></thead>
                                                    <tbody>
                                                        {s2.map((m: any) => (
                                                            <tr key={m.id}>
                                                                <td>{m.course_code}</td>
                                                                <td>{m.course_name}</td>
                                                                <td>{m.units || 0}</td>
                                                                <td>{(globalPrereqs[m.course_id] || []).join(", ") || "None"}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr>
                                                            <td colSpan={2} style={{ fontWeight: "bold", textAlign: "right" }}>Total Units</td>
                                                            <td colSpan={2} style={{ fontWeight: "bold", textAlign: "left" }}>
                                                                {s2.reduce((acc: number, cur: any) => acc + (cur.units || 0), 0)}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            ) : (
                                                <div style={{ color: "#475569", fontSize: "12px", textAlign: "center", fontStyle: "italic", padding: "20px", border: "1px solid #334155", background: "#1e293b" }}>
                                                    No courses mapped for this semester.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9", fontSize: "16px", fontWeight: 800, padding: "16px", textAlign: "right" }}>
                            Curriculum Grand Total: {calculateGrandTotal()} Units
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}