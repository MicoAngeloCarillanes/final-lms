import { useState } from 'react';
import { Btn, FF, Sel } from '../../../../components/ui';
import { useReferenceData } from '../hooks/useReferenceData';
import { useRolloverLogic } from '../hooks/useRolloverLogic';

interface RolloverTermModalProps {
  //
  onClose: () => void;

  //
  onSave: () => void;
}

const SEMESTERS = ["1st Semester", "2nd Semester", "Summer"];

/**
 * RolloverTermModal
 *
 * A specialized utility modal for duplicating course sections across terms.
 * Adheres to the enterprise aesthetic with clear source/target grouping.
 */
export default function RolloverTermModal({
  onClose,
  onSave
}: RolloverTermModalProps) {
  const { schoolYears } = useReferenceData();
  const { executeRollover, isProcessing } = useRolloverLogic();

  const [form, setForm] = useState({
    sourceSem: "1st Semester",
    sourceSyId: "",
    targetSem: "2nd Semester",
    targetSyId: ""
  });

  /**
   * Triggers the rollover execution logic.
   *
   * @returns
   */
  async function handleExecute() {
    if (!form.sourceSyId || !form.targetSyId) return;

    const { count, error } = await executeRollover(
      form.sourceSyId,
      form.sourceSem,
      form.targetSyId,
      form.targetSem
    );

    if (!error) {
      onSave();
      onClose();
    }
  }

  const isInvalid = !form.sourceSyId || !form.targetSyId || (form.sourceSyId === form.targetSyId && form.sourceSem === form.targetSem);

  return (
    <div style={{ alignItems: "center", background: "rgba(0,0,0,0.5)", bottom: 0, display: "flex", justifyContent: "center", left: 0, position: "fixed", right: 0, top: 0, zIndex: 1100 }}>
      <div style={{ background: "#1e293b", borderRadius: "8px", padding: "24px", width: "450px" }}>
        <h3 style={{ color: "#f1f5f9", margin: "0 0 8px 0" }}>Term Rollover Utility</h3>
        <p style={{ color: "#94a3b8", fontSize: "12px", lineHeight: "1.4", marginBottom: "16px" }}>
          This tool duplicates all Course Sections from a source term into an upcoming target term. 
          Student enrollments are <strong>not</strong> copied.
        </p>

        {/* Source Configuration */}
        <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", marginBottom: "16px", padding: "12px" }}>
          <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Source (Copy From)</div>
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr" }}>
            <FF label="SY">
              <Sel 
                value={form.sourceSyId} 
                onChange={(e) => setForm({ ...form, sourceSyId: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="">— Select SY —</option>
                {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}</option>)}
              </Sel>
            </FF>
            <FF label="Semester">
              <Sel 
                value={form.sourceSem} 
                onChange={(e) => setForm({ ...form, sourceSem: e.target.value })}
                style={{ width: "100%" }}
              >
                {SEMESTERS.map(t => <option key={t} value={t}>{t}</option>)}
              </Sel>
            </FF>
          </div>
        </div>

        {/* Target Configuration */}
        <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", marginBottom: "16px", padding: "12px" }}>
          <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Target (Paste Into)</div>
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr" }}>
            <FF label="SY">
              <Sel 
                value={form.targetSyId} 
                onChange={(e) => setForm({ ...form, targetSyId: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="">— Select SY —</option>
                {schoolYears.map(s => <option key={s.sy_id} value={s.sy_id}>{s.label}</option>)}
              </Sel>
            </FF>
            <FF label="Semester">
              <Sel 
                value={form.targetSem} 
                onChange={(e) => setForm({ ...form, targetSem: e.target.value })}
                style={{ width: "100%" }}
              >
                {SEMESTERS.map(t => <option key={t} value={t}>{t}</option>)}
              </Sel>
            </FF>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "24px" }}>
          <Btn onClick={onClose} variant="secondary">Cancel</Btn>
          <Btn disabled={isInvalid || isProcessing} onClick={handleExecute}>
            {isProcessing ? "Processing..." : "Execute Rollover"}
          </Btn>
        </div>
      </div>
    </div>
  );
}