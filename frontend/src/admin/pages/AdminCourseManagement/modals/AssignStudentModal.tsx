import React, { useEffect, useRef, useState } from 'react';
import { Btn, FF } from '../../../../components/ui';
import SearchableSelect from '../../../../components/ui/SearchableSelect';

interface AssignStudentModalProps {
  blocks: any[];
  onClose: () => void;
  onAssign: (blockId: string, studentIds: string[]) => Promise<{ error: any }>;
  fetchAllStudents: () => Promise<any[]>;
}

export default function AssignStudentModal({ blocks, onClose, onAssign, fetchAllStudents }: AssignStudentModalProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAllStudents().then(setStudents);
  }, []);

  const blockOptions = blocks.map(b => ({
    label: `${b.block_name}`,
    value: b.block_id
  }));

  const studentOptions = students.map(s => ({
    label: `${s.student_id || 'No ID'} - ${s.full_name}`,
    value: s.user_id
  }));

  async function handleManualAssign() {
    if (!selectedBlockId || !selectedStudentId) {
      alert("Please select both a block and a student.");
      return;
    }
    
    const targetStudent = students.find(s => s.user_id === selectedStudentId);
    if (targetStudent?.block_id && targetStudent.block_id !== selectedBlockId) {
      const proceed = window.confirm(`This student already belongs to another block. Proceeding will remove them from their current block and reassign them to the new one. Continue?`);
      if (!proceed) return;
    }

    setIsProcessing(true);
    const { error } = await onAssign(selectedBlockId, [selectedStudentId]);
    setIsProcessing(false);
    
    if (error) alert("Assignment failed: " + error.message);
    else {
      alert("Student successfully assigned to block!");
      onClose();
    }
  }

  function downloadTemplate() {
    const headers = "student_id,academic_block\n2024-0001,BSCS-1-B1\n2024-0002,BSBA-2-B1";
    const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "Bulk_Block_Assignment_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        const lines = csvData.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        if (lines.length < 2) {
          alert("The CSV file appears to be empty.");
          setIsProcessing(false);
          return;
        }

        const assignmentsByBlock = new Map<string, string[]>();
        const notFoundStudents: string[] = [];
        const notFoundBlocks: string[] = [];
        let reassignedCount = 0; // Tracks students moved from an old block

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ''));
          if (values.length < 2) continue;

          // Safe parsing
          const inputStudentId = String(values[0]).toLowerCase().trim();
          const inputBlock = String(values[1]).toLowerCase().trim();

          const targetStudent = students.find(s => String(s.student_id).toLowerCase().trim() === inputStudentId);
          const targetBlock = blocks.find(b => String(b.block_name).toLowerCase().trim() === inputBlock);

          if (!targetStudent) { notFoundStudents.push(values[0]); continue; }
          if (!targetBlock) { notFoundBlocks.push(values[1]); continue; }

          // Enforce 1-Block strictness by tracking reassignment
          if (targetStudent.block_id && targetStudent.block_id !== targetBlock.block_id) {
            reassignedCount++;
          }

          const blockId = targetBlock.block_id;
          if (!assignmentsByBlock.has(blockId)) assignmentsByBlock.set(blockId, []);
          assignmentsByBlock.get(blockId)!.push(targetStudent.user_id);
        }

        if (assignmentsByBlock.size > 0) {
          let hasError = false;
          
          for (const [blockId, studentIds] of assignmentsByBlock.entries()) {
            const { error } = await onAssign(blockId, studentIds);
            if (error) hasError = true;
          }

          if (hasError) {
            alert("Some assignments failed due to database errors.");
          } else {
            let msg = `Successfully processed assignments.`;
            if (reassignedCount > 0) msg += `\n* Note: ${reassignedCount} student(s) were automatically reassigned from their old block to their new one.`;
            if (notFoundStudents.length > 0) msg += `\n* Warning: Could not find ${notFoundStudents.length} Student IDs.`;
            if (notFoundBlocks.length > 0) msg += `\n* Warning: Could not find ${notFoundBlocks.length} Academic Blocks.`;
            alert(msg);
            onClose();
          }
        } else {
          alert("No valid assignments found. Please check your Student IDs and ensure Block Names exactly match the system labels (e.g. BSCS-1-B1).");
        }
      } catch (err) {
        console.error("CSV Parse Error:", err);
        alert("An error occurred while reading the CSV file.");
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      alert("Failed to read the file.");
      setIsProcessing(false);
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1200 }}>
      <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "500px" }}>
        <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>Assign Student to Block</h3>
        
        <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700, marginBottom: "12px" }}>OPTION 1: MANUAL ASSIGNMENT</div>
        <FF label="Target Academic Block">
          <SearchableSelect 
            options={blockOptions}
            value={selectedBlockId}
            onChange={(val: any) => setSelectedBlockId(val)}
            placeholder="Search for a Block..."
          />
        </FF>
        <div style={{ marginTop: "12px" }}>
          <FF label="Select Student">
            <SearchableSelect 
              options={studentOptions}
              value={selectedStudentId}
              onChange={(val: any) => setSelectedStudentId(val)}
              placeholder="Search by ID or Name..."
            />
          </FF>
        </div>
        <Btn onClick={handleManualAssign} disabled={isProcessing} style={{ marginTop: "12px", width: "100%" }}>
          {isProcessing ? "Assigning..." : "Assign Single Student"}
        </Btn>

        <div style={{ borderTop: "1px solid #334155", margin: "20px 0", paddingTop: "20px" }}>
          <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700, marginBottom: "12px" }}>OPTION 2: BULK CSV UPLOAD</div>
          <p style={{ color: "#cbd5e1", fontSize: "13px", marginBottom: "12px" }}>
            Upload a CSV mapping <strong>Student IDs</strong> directly to their <strong>Academic Blocks</strong> (e.g. BSCS-1-B1). 
            <br/><span style={{ fontSize: "11px", color: "#64748b" }}>* Students already in a block will be moved.</span>
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <Btn size="sm" variant="secondary" onClick={downloadTemplate}>Download Template</Btn>
            <input type="file" accept=".csv" ref={fileInputRef} style={{ display: "none" }} onChange={handleCsvUpload} />
            <Btn size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Upload CSV"}
            </Btn>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "24px" }}>
          <Btn onClick={onClose} variant="secondary" disabled={isProcessing}>Close</Btn>
        </div>
      </div>
    </div>
  );
}