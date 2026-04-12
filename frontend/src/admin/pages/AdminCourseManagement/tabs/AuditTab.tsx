import { useState } from 'react';
import LMSGrid from '../../../../components/LMSGrid';
import { Badge, Btn, Input, Sel } from '../../../../components/ui';
import { useAuditData } from '../hooks/useAuditData';
import { useReferenceData } from '../hooks/useReferenceData';

/**
 * AuditTab
 *
 * A centralized dashboard for administrators to review and verify 
 * all course materials uploaded by the faculty across all departments.
 */
export default function AuditTab() {
  const { schoolYears } = useReferenceData();
  
  const [search, setSearch] = useState("");
  const [selSy, setSelSy] = useState("");
  const [selSem, setSelSem] = useState("");
  const [selType, setSelType] = useState("");

  const { materials, isLoading } = useAuditData(search, selSy, selSem, selType);

  const columns = [
    { field: "courseCode", header: "Course", width: 120 },
    { field: "sectionLabel", header: "Sec", width: 70 },
    { field: "title", flex: 1, header: "Material Title" },
    { 
      cellRenderer: (v: string) => <Badge color="secondary">{v}</Badge>, 
      field: "material_type", 
      header: "Type", 
      width: 130 
    },
    { field: "teacherName", header: "Uploaded By", width: 180 },
    { 
      cellRenderer: (_: any, row: any) => (
        <Btn size="sm" variant="ghost" onClick={() => window.open(row.file_url, '_blank')}>
          View File ↗
        </Btn>
      ),
      field: "file_url",
      header: "Action",
      width: 120 
    }
  ];

  return (
    <div style={{ background: "#0f172a", display: "flex", flex: 1, flexDirection: "column", padding: "20px" }}>
      
      {/* 1. Filter Toolbar */}
      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
        <Input 
          placeholder="Search by title or code..." 
          style={{ width: 220 }}
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />

        <Sel value={selSy} onChange={(e) => setSelSy(e.target.value)} style={{ width: 160 }}>
          <option value="">All School Years</option>
          {schoolYears.map(sy => <option key={sy.sy_id} value={sy.sy_id}>{sy.label}</option>)}
        </Sel>

        <Sel value={selType} onChange={(e) => setSelType(e.target.value)} style={{ width: 150 }}>
          <option value="">All Types</option>
          <option value="Syllabus">Syllabus</option>
          <option value="Lecture Note">Lecture Note</option>
          <option value="Assignment">Assignment</option>
          <option value="Reference">Reference</option>
        </Sel>
      </div>

      {/* 2. Audit Table */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ color: "#475569", paddingTop: 40, textAlign: "center" }}>Scanning materials...</div>
        ) : (
          <LMSGrid columns={columns} height="100%" rowData={materials} />
        )}
      </div>
    </div>
  );
}