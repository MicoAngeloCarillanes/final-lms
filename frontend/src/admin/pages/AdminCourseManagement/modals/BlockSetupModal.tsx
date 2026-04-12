import { useState } from 'react';
import { Btn, FF, Input, Sel } from '../../../../components/ui';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { supabase } from '../../../../supabaseClient';
import { useReferenceData } from '../hooks/useReferenceData';

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

interface BlockSetupModalProps {
  initialData?: any | null;
  onClose: () => void;
  onSave: () => void;
}

export default function BlockSetupModal({ initialData, onClose, onSave }: BlockSetupModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { programs } = useReferenceData();

  const [form, setForm] = useState({
    block_name: initialData?.block_name || "",
    program_id: initialData?.program_id?.toString() || "",
    year_level: initialData?.year_level || "1st Year",
    capacity: initialData?.capacity || 40,
    isUnlimited: initialData ? initialData.capacity === null : false
  });

  const programOptions = programs.map(p => ({ label: p.code, value: p.program_id.toString() }));

  async function handlePersist() {
    setIsSaving(true);
    let finalBlockName = form.block_name;

    // Generate Label if creating a new block (e.g. BSCS-1-B1)
    if (!initialData?.block_id) {
      const selectedProg = programs.find(p => p.program_id.toString() === form.program_id);
      if (selectedProg) {
        const yearNum = form.year_level.match(/^(\d+)/)?.[1] || "0";
        const prefix = `${selectedProg.code}-${yearNum}-B`;

        const { data: existing } = await supabase
          .from("academic_blocks")
          .select("block_name")
          .eq("program_id", form.program_id)
          .eq("year_level", form.year_level);

        let nextNum = 1;
        if (existing && existing.length > 0) {
          const numbers = existing.map(e => {
            const match = e.block_name?.match(/B(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          });
          nextNum = Math.max(...numbers, 0) + 1;
        }
        finalBlockName = `${prefix}${nextNum}`;
      }
    }

    const payload = {
      block_name: finalBlockName,
      program_id: form.program_id ? Number(form.program_id) : null,
      year_level: form.year_level,
      capacity: form.isUnlimited ? null : form.capacity
    };

    let error;
    if (initialData?.block_id) {
      const res = await supabase.from("academic_blocks").update(payload).eq("block_id", initialData.block_id);
      error = res.error;
    } else {
      const res = await supabase.from("academic_blocks").insert(payload);
      error = res.error;
    }

    if (!error) {
      onSave();
      onClose();
    } else {
      console.error("Save Error:", error.message);
      alert("Failed to save block: " + error.message);
    }
    
    setIsSaving(false);
    setShowConfirm(false);
  }

  return (
    <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
      <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "500px", position: "relative" }}>
        
        <h3 style={{ color: "#f1f5f9", margin: "0 0 16px 0" }}>
          {initialData ? "Edit Academic Block" : "Create Academic Block"}
        </h3>

        <div style={{ marginBottom: "16px" }}>
          <FF label="Program">
            <SearchableSelect 
              options={programOptions}
              value={form.program_id}
              onChange={(val: any) => setForm({ ...form, program_id: val })}
              placeholder="Search Program Code..."
            />
          </FF>
        </div>

        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr", marginBottom: "16px" }}>
          <FF label="Year Level">
            <Sel value={form.year_level} onChange={(e) => setForm({ ...form, year_level: e.target.value })} style={{ width: "100%" }}>
              {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
            </Sel>
          </FF>
          <FF label="Block Name">
            <div style={{ padding: "10px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", color: "#64748b", fontSize: "13px" }}>
                {initialData ? form.block_name : "Generated: [PROG]-[YR]-B[#]"}
            </div>
          </FF>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <FF label="Capacity Limit">
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Input 
                type="number" 
                disabled={form.isUnlimited}
                value={form.isUnlimited ? "" : form.capacity} 
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} 
              />
              <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "#e2e8f0", fontSize: "12px", cursor: "pointer" }}>
                <input 
                  type="checkbox" 
                  checked={form.isUnlimited} 
                  onChange={(e) => setForm({ ...form, isUnlimited: e.target.checked })} 
                />
                No limit
              </label>
            </div>
          </FF>
        </div>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "24px" }}>
          <Btn onClick={onClose} variant="secondary">Cancel</Btn>
          <Btn 
            onClick={() => {
              if (!form.program_id || !form.year_level) {
                alert("Program and Year Level are required."); return;
              }
              setShowConfirm(true);
            }} 
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Block"}
          </Btn>
        </div>

        {/* Safety Confirmation Overlay */}
        {showConfirm && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.9)", borderRadius: "8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center", zIndex: 10 }}>
            <h4 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>Confirm Operation</h4>
            <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "20px" }}>
              Are you sure you want to {initialData ? 'update this' : 'create this new'} block?
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <Btn onClick={() => setShowConfirm(false)} variant="secondary" size="sm">Go Back</Btn>
              <Btn onClick={handlePersist} size="sm">Yes, Proceed</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}