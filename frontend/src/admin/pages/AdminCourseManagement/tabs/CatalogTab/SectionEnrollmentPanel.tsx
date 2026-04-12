import { useState } from 'react';
import LMSGrid from '../../../../../components/LMSGrid';
import { Btn, Input } from '../../../../../components/ui';
import { useEnrollmentEngine } from '../../hooks/useEnrollmentEngine';

interface SectionEnrollmentPanelProps {
  // Master list of sections for the selected course
  sections: any[];

  // Metadata for the currently selected course
  selCourse: any;

  // Callback to trigger a refresh of the parent's section data
  onRefreshSections: () => Promise<void>;
}

/**
 * SectionEnrollmentPanel
 *
 * A specialized sub-view for managing student enrollment within a specific course.
 * Splits the screen into an "Eligibility Sidebar" and a "Section/Roster Workspace."
 */
export default function SectionEnrollmentPanel({
  sections,
  selCourse,
  onRefreshSections
}: SectionEnrollmentPanelProps) {
  // State for filtering and selection
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [strictBlockFilter, setStrictBlockFilter] = useState(true);
  
  // Roster view state
  const [enrolledSearch, setEnrolledSearch] = useState("");
  const [enrolledFilter, setEnrolledFilter] = useState("");
  const [enrolledSort, setEnrolledSort] = useState({ dir: "asc" as const, field: "studentName" });

  // Initialize the enrollment engine with our state
  const {
    eligibleStudents,
    forceEnroll,
    isLoading,
    selStudents,
    setForceEnroll,
    setSelStudents,
    processEnrollmentBatch
  } = useEnrollmentEngine(
    sections,
    selectedSectionIds,
    selCourse,
    strictBlockFilter,
    studentSearch
  );

  /**
   * Helper: Toggles a student's selection for batch enrollment.
   */
  function toggleStudentSelection(studentId: string) {
    setSelStudents(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  }

  /**
   * Action: Executes the enrollment for all selected students.
   */
  async function handleEnrollClick() {
    if (selectedSectionIds.length === 0 || selStudents.length === 0) return;
    
    // For this UI, we default to the first selected section if a batch isn't specified
    const result = await processEnrollmentBatch(
      selStudents, 
      [], 
      selCourse._uuid, 
      selectedSectionIds[0], 
      selectedSectionIds
    );

    if (result) {
      await onRefreshSections();
    }
  }

  /**
   * Grid Definitions: Sections List
   */
  const sectionCols = [
    { 
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
      field: "select", 
      header: "", 
      width: 50 
    },
    { field: "section_label", header: "Section", sortable: true, width: 90 },
    { field: "program_code", header: "Program", width: 100 },
    { field: "teacher_name", header: "Professor", width: 150 }, // NEW FIELD INTEGRATED
    { field: "schedule_label", header: "Schedule", width: 180 },
    { field: "room_name", header: "Room", width: 100 },
    { 
      cellRenderer: (_: any, row: any) => <span>{row.max_capacity ?? "∞"}</span>, 
      field: "max_capacity", 
      header: "Capacity", 
      width: 80 
    },
  ];

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      
      {/* 1. LEFT SIDEBAR: ENROLLMENT PANEL */}
      <div style={{ background: "#1e293b", borderRight: "1px solid #334155", display: "flex", flexDirection: "column", padding: "16px", width: "350px" }}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
          <span style={{ color: "#f1f5f9", fontSize: "14px", fontWeight: 800 }}>Enrollment Panel</span>
        </div>
        
        {/* Panel Filters */}
        <div style={{ alignItems: "center", borderBottom: "1px solid #334155", display: "flex", gap: "8px", marginBottom: "8px", paddingBottom: "8px" }}>
          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>Eligible Students ({eligibleStudents.length})</span>
          <label style={{ alignItems: "center", color: "#a5b4fc", cursor: "pointer", display: "flex", fontSize: "11px", fontWeight: 700, gap: "4px", marginLeft: "auto" }}>
            <input type="checkbox" checked={strictBlockFilter} onChange={(e) => setStrictBlockFilter(e.target.checked)} /> Strict Block
          </label>
        </div>

        <Input 
          placeholder="Filter students..." 
          value={studentSearch} 
          onChange={(e) => setStudentSearch(e.target.value)} 
          style={{ marginBottom: "12px" }}
        />

        {/* Eligible Students Table */}
        <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", flex: 1, marginBottom: "16px", overflowY: "auto" }}>
          <table style={{ borderCollapse: "collapse", color: "#f1f5f9", fontSize: "12px", width: "100%" }}>
            <thead style={{ background: "#1e293b", position: "sticky", top: 0 }}>
              <tr>
                <th style={{ padding: "8px", width: "40px" }}>
                  <input 
                    type="checkbox" 
                    checked={eligibleStudents.length > 0 && selStudents.length === eligibleStudents.length}
                    onChange={(e) => setSelStudents(e.target.checked ? eligibleStudents.map(s => s._uuid) : [])}
                  />
                </th>
                <th style={{ padding: "8px", textAlign: "left" }}>ID</th>
                <th style={{ padding: "8px", textAlign: "left" }}>Name</th>
              </tr>
            </thead>
            <tbody>
              {eligibleStudents.map((s) => (
                <tr key={s._uuid} onClick={() => toggleStudentSelection(s._uuid)} style={{ cursor: "pointer", borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <input type="checkbox" checked={selStudents.includes(s._uuid)} readOnly />
                  </td>
                  <td style={{ padding: "8px" }}>{s.displayId}</td>
                  <td style={{ padding: "8px" }}>{s.fullName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Btn disabled={isLoading || selStudents.length === 0 || selectedSectionIds.length === 0} onClick={handleEnrollClick}>
          {isLoading ? "Enrolling..." : `Enroll ${selStudents.length} Students`}
        </Btn>
      </div>

      {/* 2. MAIN AREA: SECTIONS & ROSTER */}
      <div style={{ background: "#0f172a", display: "flex", flex: 1, flexDirection: "column" }}>
        
        {/* Top: Sections Grid */}
        <div style={{ borderBottom: "1px solid #334155", flex: "0 0 40%", padding: "16px" }}>
          <LMSGrid columns={sectionCols} height="100%" rowData={sections} />
        </div>

        {/* Bottom: Roster View */}
        <div style={{ background: "#0a0f1a", display: "flex", flex: 1, flexDirection: "column", padding: "16px" }}>
          <div style={{ alignItems: "center", display: "flex", gap: "10px", marginBottom: "12px" }}>
            <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>Course Roster ({selCourse.code})</span>
            <Input 
              placeholder="Search roster..." 
              value={enrolledSearch} 
              onChange={(e) => setEnrolledSearch(e.target.value)} 
              style={{ marginLeft: "auto", width: 200 }} 
            />
          </div>
          
          <div style={{ flex: 1, color: "#475569", textAlign: "center", paddingTop: "40px" }}>
            {/* Roster Grid Logic will follow the same pattern as the Sections Grid */}
            Select a section to view enrolled students.
          </div>
        </div>
      </div>
    </div>
  );
}