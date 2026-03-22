/**
 * SubAdminStudentAccounts.jsx
 * FOLDER: src/sub-admin/pages/SubAdminStudentAccounts.jsx
 *
 * Lets a department sub-admin view and edit student accounts.
 * Editable fields: Year Level, Semester, Program.
 * Read-only fields: Full Name, Username, Email, Birthdate, Civil Status, Address.
 */
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { programApi } from "../../lib/api";
import { Badge, Btn, Sel, FF, Input } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const SEMESTERS   = ["1st Semester", "2nd Semester", "Summer"];

const S = {
  pane: { width: 320, borderRight: "1px solid #334155", background: "#1e293b", padding: "16px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flexShrink: 0 },
  grid: { flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8 },
  label: { fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" },
  sec: { borderTop: "1px solid #334155", paddingTop: 12, marginTop: 4 },
  readVal: { padding: "8px 10px", background: "#0f172a", borderRadius: 6, border: "1px solid #1e293b", fontSize: 13, color: "#94a3b8", minHeight: 35 },
};

export default function SubAdminStudentAccounts({ user, users = [] }) {
  const students = users.filter(u => u.role === "student");

  const [selStudent,   setSelStudent]   = useState(null);
  const [programOpts,  setProgramOpts]  = useState([]);
  const [form,         setForm]         = useState({ yearLevel: "", semester: "", programId: "" });
  const [saving,       setSaving]       = useState(false);
  const [search,        setSearch]        = useState("");
  const [filterProgram, setFilterProgram] = useState("");  // programId string or ""
  const [filterYear,    setFilterYear]    = useState("");
  const [filterSem,     setFilterSem]     = useState("");
  const [toast,        setToast]        = useState({ msg: "", type: "success" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500);
  };

  // Load program options once
  useEffect(() => {
    programApi.getOptions()
      .then(opts => setProgramOpts(opts ?? []))
      .catch(console.error);
  }, []);

  const selectStudent = useCallback((row) => {
    setSelStudent(row);
    setForm({
      yearLevel: row.yearLevel  || "1st Year",
      semester:  row.semester   || "1st Semester",
      programId: row.programId  ? String(row.programId) : "",
    });
  }, []);

  const handleSave = async () => {
    if (!selStudent || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("students").update({
        year_level: form.yearLevel || null,
        semester:   form.semester  || null,
        program_id: form.programId ? Number(form.programId) : null,
      }).eq("user_id", selStudent._uuid);

      if (error) throw new Error(error.message);

      showToast(`${selStudent.fullName}'s academic info updated.`);

      // Update the local selStudent so the read-only display refreshes immediately
      const programName = programOpts.find(p => String(p.programId) === form.programId)?.name || selStudent.programName || null;
      setSelStudent(prev => ({ ...prev, yearLevel: form.yearLevel, semester: form.semester, programId: form.programId ? Number(form.programId) : null, programName }));
    } catch (err) {
      showToast("Error: " + err.message, "error");
    }
    setSaving(false);
  };

  // Filtered student list for the grid
  // Build filter option lists from what actually exists in the student list
  const availablePrograms = [...new Map(
    students.filter(s => s.programId).map(s => [String(s.programId), s.programName || String(s.programId)])
  ).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const availableYears = [...new Set(students.map(s => s.yearLevel).filter(Boolean))]
    .sort((a, b) => (["1st Year","2nd Year","3rd Year","4th Year"].indexOf(a)) - (["1st Year","2nd Year","3rd Year","4th Year"].indexOf(b)));

  const availableSems = [...new Set(students.map(s => s.semester).filter(Boolean))]
    .sort((a, b) => (["1st Semester","2nd Semester","Summer"].indexOf(a)) - (["1st Semester","2nd Semester","Summer"].indexOf(b)));

  const activeFilterCount = [filterProgram, filterYear, filterSem].filter(Boolean).length;

  const filtered = students.filter(s => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!s.fullName?.toLowerCase().includes(q) &&
          !s.id?.toLowerCase().includes(q) &&
          !s.username?.toLowerCase().includes(q)) return false;
    }
    if (filterProgram && String(s.programId) !== filterProgram) return false;
    if (filterYear    && s.yearLevel !== filterYear)             return false;
    if (filterSem     && s.semester  !== filterSem)              return false;
    return true;
  });

  const cols = [
    { field: "id",          header: "ID",       width: 100 },
    { field: "fullName",    header: "Full Name" },
    { field: "username",    header: "Username",  width: 130 },
    { field: "programName", header: "Program",   width: 180,
      cellRenderer: v => v
        ? <span style={{ fontSize: 11, color: "#a5b4fc" }}>{v}</span>
        : <span style={{ fontSize: 11, color: "#334155" }}>—</span> },
    { field: "yearLevel",   header: "Year",      width: 90,
      cellRenderer: v => v
        ? <Badge color="info">{v}</Badge>
        : <span style={{ color: "#334155" }}>—</span> },
    { field: "semester",    header: "Semester",  width: 120,
      cellRenderer: v => v
        ? <Badge color="purple">{v}</Badge>
        : <span style={{ color: "#334155" }}>—</span> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="Student Accounts"
        subtitle={`${filtered.length} student${filtered.length !== 1 ? "s" : ""} · click a row to edit academic info`}
      />

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, maxWidth: 420, background: toast.type === "error" ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)", border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`, borderRadius: 8, padding: "10px 14px", color: toast.type === "error" ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600 }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left pane — edit form */}
        <div style={S.pane}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>✏️ Edit Student</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              {selStudent ? selStudent.fullName : "Select a student from the table"}
            </div>
          </div>

          {!selStudent && (
            <div style={{ fontSize: 13, color: "#334155", textAlign: "center", paddingTop: 32 }}>
              👉 Click any student row to edit their academic information.
            </div>
          )}

          {selStudent && (
            <>
              {/* Read-only identity info */}
              <div style={S.sec}>
                <div style={{ ...S.label, marginBottom: 10 }}>👤 Student Info</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[["Student ID", selStudent.id], ["Username", selStudent.username], ["Email", selStudent.email || "—"]].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{l}</div>
                      <div style={S.readVal}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Editable academic info */}
              <div style={S.sec}>
                <div style={{ ...S.label, marginBottom: 10 }}>🎓 Academic Info</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <FF label="Program">
                    <Sel value={form.programId} onChange={e => setForm(f => ({ ...f, programId: e.target.value }))}>
                      <option value="">— No Program —</option>
                      {programOpts.map(p => (
                        <option key={p.programId} value={p.programId}>{p.code} — {p.name}</option>
                      ))}
                    </Sel>
                  </FF>
                  <FF label="Year Level">
                    <Sel value={form.yearLevel} onChange={e => setForm(f => ({ ...f, yearLevel: e.target.value }))}>
                      {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
                    </Sel>
                  </FF>
                  <FF label="Semester">
                    <Sel value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))}>
                      {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                    </Sel>
                  </FF>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                <Btn onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                  {saving ? "⏳ Saving…" : "✓ Save Changes"}
                </Btn>
                <Btn variant="secondary" onClick={() => { setSelStudent(null); setForm({ yearLevel: "", semester: "", programId: "" }); }}>
                  ✕
                </Btn>
              </div>
            </>
          )}
        </div>

        {/* Right — student grid */}
        <div style={S.grid}>
          {/* Search + Filter bar */}
          <div style={{ flexShrink: 0, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, ID or username…"
              style={{ maxWidth: 260 }}
            />

            {/* Program filter */}
            <div style={{ position: "relative" }}>
              <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
                style={{ border: `1px solid ${filterProgram ? "#6366f1" : "#334155"}`, borderRadius: 6, padding: "7px 32px 7px 10px", fontSize: 12, fontFamily: "inherit", color: "#e2e8f0", background: "#1e293b", cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", minWidth: 140 }}>
                <option value="">All Programs</option>
                {availablePrograms.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 10, color: filterProgram ? "#a5b4fc" : "#475569" }}>▼</span>
              {filterProgram && <span style={{ position: "absolute", top: -5, right: -5, width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />}
            </div>

            {/* Year Level filter */}
            <div style={{ position: "relative" }}>
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                style={{ border: `1px solid ${filterYear ? "#6366f1" : "#334155"}`, borderRadius: 6, padding: "7px 32px 7px 10px", fontSize: 12, fontFamily: "inherit", color: "#e2e8f0", background: "#1e293b", cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", minWidth: 130 }}>
                <option value="">All Year Levels</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 10, color: filterYear ? "#a5b4fc" : "#475569" }}>▼</span>
              {filterYear && <span style={{ position: "absolute", top: -5, right: -5, width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />}
            </div>

            {/* Semester filter */}
            <div style={{ position: "relative" }}>
              <select value={filterSem} onChange={e => setFilterSem(e.target.value)}
                style={{ border: `1px solid ${filterSem ? "#6366f1" : "#334155"}`, borderRadius: 6, padding: "7px 32px 7px 10px", fontSize: 12, fontFamily: "inherit", color: "#e2e8f0", background: "#1e293b", cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", minWidth: 130 }}>
                <option value="">All Semesters</option>
                {availableSems.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 10, color: filterSem ? "#a5b4fc" : "#475569" }}>▼</span>
              {filterSem && <span style={{ position: "absolute", top: -5, right: -5, width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />}
            </div>

            {/* Clear filters */}
            {(activeFilterCount > 0 || search) && (
              <button onClick={() => { setSearch(""); setFilterProgram(""); setFilterYear(""); setFilterSem(""); }}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: "#475569", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
                ✕ Clear{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
            )}
          </div>
          <div style={{ ...S.label, flexShrink: 0 }}>
            {filtered.length} of {students.length} student{students.length !== 1 ? "s" : ""}
            {activeFilterCount > 0 && <span style={{ marginLeft: 8, color: "#6366f1" }}>{activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>}
            {selStudent && <span style={{ marginLeft: 10, color: "#6366f1" }}>← {selStudent.fullName} selected</span>}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {filtered.length === 0
              ? <div style={{ color: "#334155", textAlign: "center", paddingTop: 40, fontSize: 13 }}>
                  No students match the current filters.
                </div>
              : <LMSGrid
                  columns={cols}
                  rowData={filtered}
                  height="100%"
                  selectedId={selStudent?.id}
                  onRowClick={row => selectStudent(row)}
                />
            }
          </div>
        </div>

      </div>
    </div>
  );
}
