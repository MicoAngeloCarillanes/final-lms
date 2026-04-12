import { useEffect, useState } from 'react';
import LMSGrid from '../../../../components/LMSGrid';
import { Btn } from '../../../../components/ui';

interface BlockDetailsModalProps {
  block: any;
  onClose: () => void;
  fetchStudentsByBlock: (blockId: string) => Promise<any[]>;
  unassignStudents: (studentUserIds: string[]) => Promise<{ error: any }>;
}

export default function BlockDetailsModal({ 
  block, 
  onClose, 
  fetchStudentsByBlock, 
  unassignStudents 
}: BlockDetailsModalProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  async function loadStudents() {
    setIsLoading(true);
    const data = await fetchStudentsByBlock(block.block_id);
    setStudents(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadStudents();
  }, [block.block_id]);

  function handleSelectAll() {
    if (selectedIds.length === students.length) setSelectedIds([]);
    else setSelectedIds(students.map(s => s.user_id));
  }

  function toggleSelection(id: string) {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }

  async function handleBulkUnassign() {
    const { error } = await unassignStudents(selectedIds);
    if (!error) {
      setSelectedIds([]);
      setShowConfirm(false);
      await loadStudents();
    } else {
      alert("Error unassigning students: " + error.message);
    }
  }

  const columns = [
    {
      headerRenderer: () => (
        <input 
          type="checkbox" 
          checked={students.length > 0 && selectedIds.length === students.length} 
          onChange={handleSelectAll} 
        />
      ),
      cellRenderer: (_: any, row: any) => (
        <input 
          type="checkbox" 
          checked={selectedIds.includes(row.user_id)} 
          onChange={() => toggleSelection(row.user_id)} 
        />
      ),
      field: "selection",
      width: 50,
      sortable: false
    },
    { field: "student_id", header: "Student ID", width: 150 },
    { field: "full_name", header: "Student Name", flex: 1 },
    { field: "email", header: "Email Address", flex: 1 },
  ];

  return (
    <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
      <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "750px", display: "flex", flexDirection: "column", maxHeight: "80vh", position: "relative" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ color: "#f1f5f9", margin: 0 }}>
              Students in {block.block_name}
            </h3>
            <span style={{ color: "#94a3b8", fontSize: "12px" }}>{block.program_name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
             {selectedIds.length > 0 && (
                <Btn size="sm" variant="danger" onClick={() => setShowConfirm(true)}>
                  Unassign Selected ({selectedIds.length})
                </Btn>
             )}
             <span style={{ color: "#94a3b8", fontSize: "14px", fontWeight: "bold" }}>
                Total: {students.length}
             </span>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: "300px", overflow: "hidden", background: "#0f172a", borderRadius: "6px" }}>
          {isLoading ? (
            <div style={{ padding: "20px", color: "#94a3b8", textAlign: "center" }}>Loading students...</div>
          ) : (
            <LMSGrid columns={columns} height="100%" rowData={students} />
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
          <Btn onClick={onClose} variant="secondary">Close</Btn>
        </div>

        {/* Unassign Confirmation Overlay */}
        {showConfirm && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.95)", borderRadius: "8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center", zIndex: 10 }}>
            <h4 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>Unassign Students</h4>
            <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "20px" }}>
              Are you sure you want to remove <strong>{selectedIds.length}</strong> students from this academic block?
              <br />They will become unassigned and available for other cohorts.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <Btn onClick={() => setShowConfirm(false)} variant="secondary" size="sm">Cancel</Btn>
              <Btn onClick={handleBulkUnassign} variant="danger" size="sm">Yes, Unassign</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}