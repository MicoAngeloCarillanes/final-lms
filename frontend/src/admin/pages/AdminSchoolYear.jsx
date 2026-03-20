/**
 * AdminSchoolYear.jsx
 * FOLDER: src/admin/pages/AdminSchoolYear.jsx
 *
 * Admin sets up school years and configures which months/dates
 * correspond to each term (Prelim, Midterm, Semi-Final, Finals).
 * The active SY drives the dynamic termFromDate() replacement.
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { Badge, Btn, FF, Input, Toast } from "../../components/ui";
import TopBar from "../../components/TopBar";

const TERMS = ["Prelim", "Midterm", "Semi-Final", "Finals"];

const TERM_COLOR = {
  Prelim:      { bg: "rgba(99,102,241,.15)",  text: "#a5b4fc" },
  Midterm:     { bg: "rgba(59,130,246,.15)",  text: "#60a5fa" },
  "Semi-Final":{ bg: "rgba(245,158,11,.15)",  text: "#fbbf24" },
  Finals:      { bg: "rgba(239,68,68,.15)",   text: "#f87171" },
};

const emptyTerms = () =>
  Object.fromEntries(TERMS.map(t => [t, { startDate: "", endDate: "" }]));

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export default function AdminSchoolYear({ user }) {
  const [schoolYears,  setSchoolYears]  = useState([]);
  const [selSy,        setSelSy]        = useState(null);   // full SY object with terms[]
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState("");
  const [toastErr,     setToastErr]     = useState("");

  // New SY form
  const [newLabel,     setNewLabel]     = useState("");
  const [newStart,     setNewStart]     = useState("");
  const [newEnd,       setNewEnd]       = useState("");
  const [creating,     setCreating]     = useState(false);
  const [showNewForm,  setShowNewForm]  = useState(false);

  // Term form (for selected SY)
  const [termForm,     setTermForm]     = useState(emptyTerms());

  const showOk  = (m) => { setToast(m);    setTimeout(() => setToast(""),    3000); };
  const showErr = (m) => { setToastErr(m); setTimeout(() => setToastErr(""), 4000); };

  // ── Load school years ─────────────────────────────────────────────────────
  const loadSYs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("school_years")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setSchoolYears(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadSYs(); }, [loadSYs]);

  // ── Load a SY's term periods ──────────────────────────────────────────────
  const loadTerms = useCallback(async (syId) => {
    const { data } = await supabase
      .from("term_periods")
      .select("*")
      .eq("sy_id", syId);
    const init = emptyTerms();
    (data || []).forEach(r => {
      init[r.term] = { startDate: r.start_date, endDate: r.end_date };
    });
    setTermForm(init);
  }, []);

  const selectSy = useCallback(async (sy) => {
    setSelSy(sy);
    await loadTerms(sy.sy_id);
  }, [loadTerms]);

  // ── Create school year ────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newLabel.trim() || !newStart || !newEnd) {
      showErr("Please fill in all fields."); return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("school_years")
      .insert({ label: newLabel.trim(), start_date: newStart, end_date: newEnd })
      .select()
      .single();
    setCreating(false);
    if (error) { showErr(error.message); return; }
    setNewLabel(""); setNewStart(""); setNewEnd("");
    setShowNewForm(false);
    await loadSYs();
    selectSy(data);
    showOk(`School year "${data.label}" created.`);
  };

  // ── Set active SY ─────────────────────────────────────────────────────────
  const handleSetActive = async (syId, label) => {
    setSaving(true);
    // deactivate all, then activate chosen
    await supabase.from("school_years").update({ is_active: false }).neq("sy_id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("school_years").update({ is_active: true }).eq("sy_id", syId);
    setSaving(false);
    await loadSYs();
    showOk(`"${label}" is now the active school year.`);
  };

  // ── Save term periods ─────────────────────────────────────────────────────
  const handleSaveTerms = async () => {
    if (!selSy) return;
    // Validate all have start+end
    for (const t of TERMS) {
      const v = termForm[t];
      if ((v.startDate && !v.endDate) || (!v.startDate && v.endDate)) {
        showErr(`${t}: provide both start and end date, or leave both empty.`); return;
      }
      if (v.startDate && v.endDate && v.startDate > v.endDate) {
        showErr(`${t}: start date must be before end date.`); return;
      }
    }
    setSaving(true);
    const rows = TERMS
      .filter(t => termForm[t].startDate && termForm[t].endDate)
      .map(t => ({
        sy_id:      selSy.sy_id,
        term:       t,
        start_date: termForm[t].startDate,
        end_date:   termForm[t].endDate,
      }));

    // Upsert — delete existing for this SY then re-insert
    await supabase.from("term_periods").delete().eq("sy_id", selSy.sy_id);
    if (rows.length) {
      const { error } = await supabase.from("term_periods").insert(rows);
      if (error) { showErr(error.message); setSaving(false); return; }
    }
    setSaving(false);
    showOk("Term dates saved successfully.");
  };

  const activeSy = schoolYears.find(s => s.is_active);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar title="School Year & Term Configuration" icon="🗓️"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeSy && (
              <div style={{ fontSize: 12, color: "#34d399", background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.25)", borderRadius: 8, padding: "4px 10px", fontWeight: 700 }}>
                ✓ Active: {activeSy.label}
              </div>
            )}
            <Btn onClick={() => setShowNewForm(v => !v)}>
              {showNewForm ? "Cancel" : "+ New School Year"}
            </Btn>
          </div>
        }
      />

      {/* Toast */}
      {(toast || toastErr) && (
        <div style={{ padding: "0 20px 0" }}>
          <div style={{
            background: toast ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.12)",
            border: `1px solid ${toast ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.3)"}`,
            borderRadius: 8, padding: "9px 14px",
            color: toast ? "#34d399" : "#f87171",
            fontSize: 13, fontWeight: 600, margin: "12px 0 0"
          }}>
            {toast || toastErr}
          </div>
        </div>
      )}

      {/* New SY Form */}
      {showNewForm && (
        <div style={{ padding: "14px 20px", background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <FF label="Label (e.g. 2025-2026)" required style={{ flex: "0 0 170px" }}>
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="2025-2026" />
          </FF>
          <FF label="SY Start Date" required style={{ flex: "0 0 160px" }}>
            <Input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} />
          </FF>
          <FF label="SY End Date" required style={{ flex: "0 0 160px" }}>
            <Input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
          </FF>
          <Btn onClick={handleCreate} disabled={creating} variant="success">
            {creating ? "Creating…" : "Create"}
          </Btn>
        </div>
      )}

      {/* Main layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: SY list */}
        <div style={{ width: 260, borderRight: "1px solid #334155", overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>
            School Years
          </div>
          {loading && <div style={{ color: "#475569", fontSize: 13, textAlign: "center", marginTop: 20 }}>Loading…</div>}
          {!loading && schoolYears.length === 0 && (
            <div style={{ color: "#475569", fontSize: 13, textAlign: "center", marginTop: 20 }}>No school years yet.</div>
          )}
          {schoolYears.map(sy => (
            <div
              key={sy.sy_id}
              onClick={() => selectSy(sy)}
              style={{
                padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                border: selSy?.sy_id === sy.sy_id ? "1.5px solid #6366f1" : "1px solid #334155",
                background: selSy?.sy_id === sy.sy_id ? "rgba(99,102,241,.1)" : "#1e293b",
                transition: "all .15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>{sy.label}</span>
                {sy.is_active && <span style={{ fontSize: 10, fontWeight: 800, color: "#34d399", background: "rgba(16,185,129,.12)", padding: "1px 6px", borderRadius: 4 }}>ACTIVE</span>}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {sy.start_date} → {sy.end_date}
              </div>
              {!sy.is_active && (
                <Btn
                  size="sm"
                  variant="ghost"
                  style={{ marginTop: 6, fontSize: 11, padding: "3px 8px", border: "1px solid #334155", color: "#94a3b8" }}
                  onClick={e => { e.stopPropagation(); handleSetActive(sy.sy_id, sy.label); }}
                  disabled={saving}
                >
                  Set Active
                </Btn>
              )}
            </div>
          ))}
        </div>

        {/* Right: Term config */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {!selSy ? (
            <div style={{ color: "#475569", fontSize: 14, textAlign: "center", marginTop: 60 }}>
              ← Select a school year to configure its term dates
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: "#f1f5f9", marginBottom: 4 }}>
                  {selSy.label} — Term Date Ranges
                </div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                  Set the start and end dates for each term. The system uses these to automatically
                  determine the current term instead of the hardcoded month mapping.
                  Leave a term blank if it isn't used this school year.
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 680 }}>
                {TERMS.map(term => {
                  const { bg, text } = TERM_COLOR[term];
                  const v = termForm[term];
                  return (
                    <div key={term} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ background: bg, color: text, padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 800 }}>
                          {term}
                        </span>
                        {v.startDate && v.endDate && (
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            {v.startDate} → {v.endDate}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <FF label="Start Date" style={{ flex: 1 }}>
                          <Input
                            type="date"
                            value={v.startDate}
                            onChange={e => setTermForm(p => ({ ...p, [term]: { ...p[term], startDate: e.target.value } }))}
                          />
                        </FF>
                        <FF label="End Date" style={{ flex: 1 }}>
                          <Input
                            type="date"
                            value={v.endDate}
                            onChange={e => setTermForm(p => ({ ...p, [term]: { ...p[term], endDate: e.target.value } }))}
                          />
                        </FF>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <Btn onClick={handleSaveTerms} disabled={saving} variant="success">
                  {saving ? "Saving…" : "💾 Save Term Dates"}
                </Btn>
                {selSy && !selSy.is_active && (
                  <Btn variant="secondary" onClick={() => handleSetActive(selSy.sy_id, selSy.label)} disabled={saving}>
                    Set as Active SY
                  </Btn>
                )}
              </div>

              {/* Helper card */}
              <div style={{ marginTop: 20, background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 8, padding: "12px 16px", maxWidth: 680 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>💡 How this works</div>
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.65 }}>
                  Once saved, the system calls <code style={{ background: "#0f172a", padding: "1px 5px", borderRadius: 3, color: "#a5b4fc", fontSize: 11 }}>GET /school-years/active/current-term</code> to
                  resolve today's term dynamically. This replaces the hardcoded August–October = Prelim mapping.
                  Make sure to set this SY as <strong style={{ color: "#f1f5f9" }}>Active</strong> for the live system to use it.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
