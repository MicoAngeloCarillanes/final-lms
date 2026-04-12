import React, { useEffect, useRef, useState } from 'react';
import LMSGrid from '../../../../components/LMSGrid';
import { Btn, FF, Input, Sel } from '../../../../components/ui';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { supabase } from '../../../../supabaseClient';
import { useAcademicBlockData } from '../hooks/useAcademicBlockData';
import { useReferenceData } from '../hooks/useReferenceData';
import AssignStudentModal from '../modals/AssignStudentModal';
import BlockDetailsModal from '../modals/BlockDetailsModal';
import BlockSetupModal from '../modals/BlockSetupModal';

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

function IndeterminateCheckbox({ indeterminate, checked, ...rest }: any) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input type="checkbox" ref={ref} checked={checked} {...rest} />;
}

export function BlocksTab() {
  const { programs } = useReferenceData();
  const programOptions = programs.map(p => ({ label: p.code, value: p.program_id.toString() }));

  // API Filter/Search State
  const [search, setSearch] = useState("");
  const [activeYear, setActiveYear] = useState("");
  const [activeProgram, setActiveProgram] = useState("");

  // Filter Modal Draft State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftYear, setDraftYear] = useState("");
  const [draftProgram, setDraftProgram] = useState("");

  // Sorting State (Controlled)
  const [sortConfig, setSortConfig] = useState({ field: "block_name", dir: "asc" as "asc" | "desc" });

  const [showModal, setShowModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<any | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [detailsBlock, setDetailsBlock] = useState<any | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'delete' | 'bulkDelete';
    id?: string;
  }>({ show: false, type: 'delete' });

  const { 
    blocks, isLoading, deleteBlock, bulkDeleteBlocks, refreshBlocks,
    fetchAllStudents, fetchStudentsByBlock, assignStudentsToBlock, unassignStudents
  } = useAcademicBlockData(search, activeProgram, activeYear, sortConfig.field, sortConfig.dir);

  function handleOpenModal(block?: any) {
    setEditingBlock(block || null);
    setShowModal(true);
  }

  function handleSelectAll() {
    if (selectedIds.length === blocks.length) setSelectedIds([]);
    else setSelectedIds(blocks.map(b => b.block_id));
  }

  async function handleConfirmAction() {
    const actionType = confirmModal.type;
    const targetId = confirmModal.id;

    if (actionType === 'delete' && targetId) {
      await deleteBlock(targetId);
    } else if (actionType === 'bulkDelete') {
      await bulkDeleteBlocks(selectedIds);
      setSelectedIds([]);
    }
    setConfirmModal({ show: false, type: 'delete' });
  }

  // --- Filter Actions ---
  function openFilterModal() {
    setDraftYear(activeYear);
    setDraftProgram(activeProgram);
    setIsFilterOpen(true);
  }

  function applyFilters() {
    setActiveYear(draftYear);
    setActiveProgram(draftProgram);
    setIsFilterOpen(false);
  }

  function resetFilters() {
    setDraftYear("");
    setDraftProgram("");
    setActiveYear("");
    setActiveProgram("");
    setIsFilterOpen(false);
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsBulkLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        const lines = csvData.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) { alert("Empty CSV."); setIsBulkLoading(false); return; }
        const payload = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ''));
          const targetProg = programs.find(p => p.code?.toLowerCase() === values[0].toLowerCase());
          if (!targetProg) { alert(`Row ${i+1}: Program "${values[0]}" not found.`); setIsBulkLoading(false); return; }
          payload.push({ program_id: targetProg.program_id, year_level: values[1], capacity: values[2] ? parseInt(values[2]) : null });
        }
        if (payload.length > 0) {
          setIsCsvModalOpen(false);
          const { error } = await supabase.rpc("bulk_insert_academic_blocks", { payload });
          if (error) alert("Error: " + error.message); else refreshBlocks();
        }
      } catch (err) { alert("Parsing Error."); } finally { setIsBulkLoading(false); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const columns = [
    {
      headerRenderer: () => (
        <IndeterminateCheckbox 
          indeterminate={selectedIds.length > 0 && selectedIds.length < blocks.length}
          checked={blocks.length > 0 && selectedIds.length === blocks.length} 
          onChange={handleSelectAll} 
        />
      ),
      cellRenderer: (_: any, row: any) => (
        <input 
          type="checkbox" 
          checked={selectedIds.includes(row.block_id)} 
          onChange={() => setSelectedIds(prev => prev.includes(row.block_id) ? prev.filter(i => i !== row.block_id) : [...prev, row.block_id])} 
        />
      ),
      field: "selection",
      width: 40,
      sortable: false
    },
    { field: "program_code", header: "Program", width: 120, sortable: true },
    { field: "year_level", header: "Year Level", width: 150, sortable: true },
    { field: "block_name", header: "Block Name", flex: 1, sortable: true },
    { 
      cellRenderer: (_: any, row: any) => (
        <span style={{ color: row.assigned_count >= (row.capacity || Infinity) ? "#ef4444" : "inherit" }}>
          {row.assigned_count} / {row.capacity ?? "∞"}
        </span>
      ), 
      field: "capacity", 
      header: "Capacity", 
      width: 120,
      sortable: true
    },
    { 
      cellRenderer: (_: any, row: any) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <Btn size="sm" variant="secondary" onClick={() => setDetailsBlock(row)}>Details</Btn>
          <Btn size="sm" variant="secondary" onClick={() => handleOpenModal(row)}>Edit</Btn>
          <Btn size="sm" variant="danger" onClick={() => setConfirmModal({ show: true, type: 'delete', id: row.block_id })}>Delete</Btn>
        </div>
      ),
      field: "block_id",
      header: "Actions",
      width: 200,
      sortable: false
    }
  ];

  return (
    <div style={{ background: "#0f172a", display: "flex", flex: 1, flexDirection: "column", padding: "20px" }}>
      
      <div style={{ alignItems: "center", display: "flex", gap: "10px", marginBottom: "16px" }}>
        
        <div style={{ position: "relative", width: "350px" }}>
          <Input 
            placeholder="Search Block Name..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            style={{ paddingRight: "40px", width: "100%" }}
          />
          <button 
            type="button"
            onClick={openFilterModal}
            style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
          >
            ⚙️
          </button>
        </div>
        
        <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
          {selectedIds.length > 0 && (
            <Btn variant="danger" onClick={() => setConfirmModal({ show: true, type: 'bulkDelete' })}>
              Delete Selected ({selectedIds.length})
            </Btn>
          )}
          <Btn variant="secondary" onClick={() => setIsCsvModalOpen(true)}>Bulk CSV Creation</Btn>
          <Btn variant="secondary" onClick={() => setIsAssignModalOpen(true)}>Assign Students</Btn>
          <Btn onClick={() => handleOpenModal()}>+ Create Block</Btn>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        <LMSGrid 
          columns={columns} 
          height="100%" 
          rowData={blocks} 
          onSortChange={(f, d) => setSortConfig({ field: f, dir: d as any })}
          sortField={sortConfig.field}
          sortDir={sortConfig.dir}
        />
      </div>

      {/* Filter Modal with Deferred Application */}
      {isFilterOpen && (
        <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1100 }}>
          <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
            <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>Filter Academic Blocks</h3>
            
            <FF label="Program">
              <SearchableSelect 
                options={programOptions}
                value={draftProgram}
                onChange={(val: any) => setDraftProgram(val)}
                placeholder="All Programs"
              />
            </FF>

            <div style={{ marginTop: "16px" }}>
              <FF label="Year Level">
                <Sel value={draftYear} onChange={e => setDraftYear(e.target.value)} style={{ width: "100%" }}>
                  <option value="">All Year Levels</option>
                  {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                </Sel>
              </FF>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "24px" }}>
              <Btn onClick={resetFilters} variant="secondary">Reset All</Btn>
              <Btn onClick={() => setIsFilterOpen(false)} variant="secondary">Close</Btn>
              <Btn onClick={applyFilters}>Apply Filters</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Other Modals (CSV, Assign, Details, Confirmation, Setup) */}
      {isCsvModalOpen && (
        <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1100 }}>
          <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "400px" }}>
            <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>Bulk Create Blocks</h3>
            <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "20px" }}>Upload CSV with Program Code and Year Level.</p>
            <Btn size="sm" variant="secondary" onClick={() => {}} style={{ marginBottom: "16px" }}>Download Template</Btn>
            <input type="file" accept=".csv" ref={fileInputRef} style={{ display: "none" }} onChange={handleCsvUpload} />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <Btn onClick={() => setIsCsvModalOpen(false)} variant="secondary">Cancel</Btn>
              <Btn onClick={() => fileInputRef.current?.click()} disabled={isBulkLoading}>Select & Upload</Btn>
            </div>
          </div>
        </div>
      )}

      {isAssignModalOpen && <AssignStudentModal blocks={blocks} onClose={() => setIsAssignModalOpen(false)} onAssign={assignStudentsToBlock} fetchAllStudents={fetchAllStudents} />}
      {detailsBlock && <BlockDetailsModal block={detailsBlock} onClose={() => setDetailsBlock(null)} fetchStudentsByBlock={fetchStudentsByBlock} unassignStudents={unassignStudents} />}
      {confirmModal.show && (
        <div style={{ alignItems: "center", background: "rgba(0,0,0,0.8)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1100 }}>
          <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "350px", textAlign: "center" }}>
            <h4 style={{ color: "#f1f5f9", marginBottom: "12px" }}>Confirm Deletion</h4>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}><Btn onClick={() => setConfirmModal({ show: false, type: 'delete' })} variant="secondary">Cancel</Btn><Btn onClick={handleConfirmAction} variant="danger">Delete</Btn></div>
          </div>
        </div>
      )}
      {showModal && <BlockSetupModal initialData={editingBlock} onClose={() => setShowModal(false)} onSave={refreshBlocks} />}
    </div>
  );
}

export default BlocksTab;