/**
 * AdminPrograms.jsx
 * FOLDER: src/admin/pages/AdminPrograms.jsx
 *
 * Two-level view:
 *   Level 1 — Program cards grid  +  left pane to Add/Edit programs
 *   Level 2 — Students of the selected program with search / year / semester filters
 *
 * Add   → programApi.create()  → is_active=true  → appears in student account dropdown
 * Delete → programApi.delete() → soft-delete      → removed from student account dropdown
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase }                    from "../../supabaseClient";
import { programApi, departmentApi }   from "../../lib/api";
import { Btn, Input, Sel, FF }         from "../../components/ui";
import TopBar                          from "../../components/TopBar";

// ── Constants ─────────────────────────────────────────────────────────────────
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
const SEMESTERS   = ["1st Semester", "2nd Semester", "Summer"];
const emptyForm   = { code: "", name: "", description: "", departmentId: "" };

// ── Colour palette for cards (cycles) ─────────────────────────────────────────
const PALETTE = [
  { accent: "#6366f1", bg: "rgba(99,102,241,.1)",  border: "rgba(99,102,241,.25)"  },
  { accent: "#0ea5e9", bg: "rgba(14,165,233,.1)",  border: "rgba(14,165,233,.25)"  },
  { accent: "#34d399", bg: "rgba(16,185,129,.1)",  border: "rgba(16,185,129,.25)"  },
  { accent: "#f59e0b", bg: "rgba(245,158,11,.1)",  border: "rgba(245,158,11,.25)"  },
  { accent: "#f87171", bg: "rgba(239,68,68,.1)",   border: "rgba(239,68,68,.25)"   },
  { accent: "#a78bfa", bg: "rgba(167,139,250,.1)", border: "rgba(167,139,250,.25)" },
  { accent: "#fb923c", bg: "rgba(251,146,60,.1)",  border: "rgba(251,146,60,.25)"  },
  { accent: "#38bdf8", bg: "rgba(56,189,248,.1)",  border: "rgba(56,189,248,.25)"  },
];

// ── Shared label style ────────────────────────────────────────────────────────
const S = {
  label: { fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" },
  pane:  { width: 268, borderRight: "1px solid #334155", background: "#1e293b", padding: "16px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flexShrink: 0 },
  sec:   { borderTop: "1px solid #334155", paddingTop: 12, marginTop: 4 },
};

// ── Pill badges ───────────────────────────────────────────────────────────────
const Pill = ({ label, color = "#6366f1" }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 9999,
    background: `${color}22`, color, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
    {label}
  </span>
);
const YearPill = ({ v }) => {
  const m = { "1st Year": "#6366f1", "2nd Year": "#0ea5e9", "3rd Year": "#34d399", "4th Year": "#f59e0b", "5th Year": "#f87171" };
  return <Pill label={v} color={m[v] || "#94a3b8"} />;
};
const SemPill = ({ v }) => {
  const m = { "1st Semester": "#0ea5e9", "2nd Semester": "#8b5cf6", "Summer": "#f59e0b" };
  return <Pill label={v} color={m[v] || "#94a3b8"} />;
};

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteProgramModal({ program, studentCount, onConfirm, onCancel, deleting }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#1e293b", border: "1px solid rgba(239,68,68,.35)", borderRadius: 12,
        padding: "26px 28px", width: 450, maxWidth: "90vw" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#f87171", marginBottom: 8 }}>
          🗑 Delete Program "{program.code}"?
        </div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
          Are you sure you want to delete <strong style={{ color: "#e2e8f0" }}>{program.name}</strong>?
        </p>

        {studentCount > 0 ? (
          <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)",
            borderRadius: 8, padding: "11px 14px", marginBottom: 18, fontSize: 12, color: "#f87171", lineHeight: 1.6 }}>
            ⚠️ <strong>{studentCount} student{studentCount !== 1 ? "s" : ""}</strong> are currently assigned to this
            program. Their account records will be kept but the program link will be cleared.
          </div>
        ) : (
          <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)",
            borderRadius: 8, padding: "11px 14px", marginBottom: 18, fontSize: 12, color: "#fbbf24", lineHeight: 1.6 }}>
            ℹ️ This program has no enrolled students.
          </div>
        )}

        <div style={{ fontSize: 12, color: "#475569", marginBottom: 20, lineHeight: 1.5 }}>
          The program will be <strong style={{ color: "#e2e8f0" }}>removed from the student account creation dropdown</strong> immediately.
          This action cannot be undone from the UI.
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onCancel} disabled={deleting}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? "⏳ Deleting…" : `Delete "${program.code}"`}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Program Card ──────────────────────────────────────────────────────────────
function ProgramCard({ program, studentCount, colorMeta, onView, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? colorMeta.bg : "rgba(15,23,42,.6)",
        border: `1.5px solid ${hovered ? colorMeta.accent : colorMeta.border}`,
        borderRadius: 12, padding: "18px 20px", transition: "all .18s",
        display: "flex", flexDirection: "column", gap: 10,
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? `0 8px 24px ${colorMeta.accent}22` : "none",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: colorMeta.accent,
          letterSpacing: "0.07em", background: colorMeta.bg,
          border: `1px solid ${colorMeta.border}`, borderRadius: 7,
          padding: "3px 10px", flexShrink: 0 }}>
          {program.code}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: colorMeta.accent, lineHeight: 1 }}>{studentCount}</div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>student{studentCount !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* Name */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.4 }}>{program.name}</div>

      {/* Description */}
      {program.description && (
        <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {program.description}
        </div>
      )}

      {/* Action buttons row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
        <Btn size="sm" onClick={e => { e.stopPropagation(); onView(program); }}
          style={{ flex: 1, fontSize: 11, padding: "5px 8px" }}>
          View Students →
        </Btn>
        <Btn size="sm" variant="secondary"
          onClick={e => { e.stopPropagation(); onEdit(program); }}
          style={{ fontSize: 11, padding: "5px 10px" }}>
          ✏️
        </Btn>
        <Btn size="sm" variant="danger"
          onClick={e => { e.stopPropagation(); onDelete(program); }}
          style={{ fontSize: 11, padding: "5px 10px" }}>
          🗑
        </Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminPrograms({ users }) {
  const students = useMemo(() => (users || []).filter(u => u.role === "student"), [users]);

  // ── Navigation ────────────────────────────────────────────────────────────────
  const [level,      setLevel]      = useState("list");
  const [selProgram, setSelProgram] = useState(null);

  // ── Programs & departments ────────────────────────────────────────────────────
  const [programs,    setPrograms]    = useState([]);
  const [deptOptions, setDeptOptions] = useState([]);
  const [loading,     setLoading]     = useState(false);

  // ── Add / Edit form ───────────────────────────────────────────────────────────
  const [form,        setForm]        = useState(emptyForm);
  const [editingId,   setEditingId]   = useState(null); // programId being edited
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState("");

  // ── Delete modal ──────────────────────────────────────────────────────────────
  const [confirmDel,  setConfirmDel]  = useState(null); // program obj
  const [deleting,    setDeleting]    = useState(false);

  // ── Detail-view filters ───────────────────────────────────────────────────────
  const [search,      setSearch]      = useState("");
  const [yearFilter,  setYearFilter]  = useState("");
  const [semFilter,   setSemFilter]   = useState("");

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500);
  };

  // ── Load programs ─────────────────────────────────────────────────────────────
  const loadPrograms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("program")
      .select("program_id, code, name, description, is_active, department_id")
      .eq("is_deleted", false)
      .order("name", { ascending: true });
    if (!error) setPrograms(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPrograms();
    departmentApi.getOptions()
      .then(opts => setDeptOptions(opts ?? []))
      .catch(() => {});
  }, [loadPrograms]);

  // ── Derived counts ────────────────────────────────────────────────────────────
  const studentCountMap = useMemo(() => {
    const map = {};
    students.forEach(s => { if (s.programId) map[s.programId] = (map[s.programId] || 0) + 1; });
    return map;
  }, [students]);

  // ── Add / Edit CRUD ───────────────────────────────────────────────────────────
  const upd = (k, v) => { setForm(f => ({ ...f, [k]: v })); setFormError(""); };

  const startEdit = (prog) => {
    setEditingId(prog.program_id);
    setForm({
      code:         prog.code         || "",
      name:         prog.name         || "",
      description:  prog.description  || "",
      departmentId: prog.department_id || "",
    });
    setFormError("");
    window.scrollTo(0, 0);
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  };

  const saveProgram = async () => {
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    if (!code || !name) { setFormError("Code and Program Name are required."); return; }

    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await programApi.update({
          programId:    editingId,
          code, name,
          departmentId: form.departmentId || null,
          description:  form.description.trim() || null,
        });
        showToast(`Program "${code}" updated.`);
      } else {
        await programApi.create({
          code, name,
          departmentId: form.departmentId || null,
          description:  form.description.trim() || null,
        });
        showToast(`Program "${code}" created — now available in student account creation.`);
      }
      cancelForm();
      await loadPrograms();
    } catch (e) {
      setFormError(e.message);
    }
    setSaving(false);
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleteProgram = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await programApi.delete(confirmDel.program_id);
      showToast(`Program "${confirmDel.code}" deleted — removed from account creation dropdown.`);
      setConfirmDel(null);
      await loadPrograms();
      // If currently viewing this program's students, go back
      if (selProgram?.program_id === confirmDel.program_id) goBack();
    } catch (e) {
      showToast(e.message, "error");
    }
    setDeleting(false);
  };

  // ── Navigation ────────────────────────────────────────────────────────────────
  const drillProgram = (prog) => {
    setSelProgram(prog);
    setLevel("detail");
    setSearch(""); setYearFilter(""); setSemFilter("");
  };

  const goBack = () => {
    setLevel("list"); setSelProgram(null);
    setSearch(""); setYearFilter(""); setSemFilter("");
  };

  // ── Detail students ───────────────────────────────────────────────────────────
  const detailStudents = useMemo(() => {
    if (!selProgram) return [];
    return students.filter(s => {
      if (String(s.programId) !== String(selProgram.program_id)) return false;
      if (yearFilter && s.yearLevel !== yearFilter) return false;
      if (semFilter  && s.semester  !== semFilter)  return false;
      if (search) {
        const q = search.toLowerCase();
        return s.fullName?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [students, selProgram, search, yearFilter, semFilter]);

  const yearBreakdown = useMemo(() => {
    if (!selProgram) return [];
    const base = students.filter(s => String(s.programId) === String(selProgram.program_id));
    return YEAR_LEVELS.map(yr => ({ yr, count: base.filter(s => s.yearLevel === yr).length })).filter(x => x.count > 0);
  }, [students, selProgram]);

  // ── Subtitle ──────────────────────────────────────────────────────────────────
  const subtitle = level === "list"
    ? `${programs.length} program${programs.length !== 1 ? "s" : ""}`
    : `${selProgram?.name} · ${detailStudents.length} student${detailStudents.length !== 1 ? "s" : ""}${search || yearFilter || semFilter ? " (filtered)" : ""}`;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      <TopBar title="Programs" subtitle={subtitle}
        actions={level === "detail" && (
          <Btn variant="secondary" size="sm" onClick={goBack}>← Back to Programs</Btn>
        )}
      />

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 20px",
        background: "#1e293b", borderBottom: "1px solid #334155", flexShrink: 0 }}>
        <button onClick={goBack}
          style={{ background: "none", border: "none", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
            color: level === "list" ? "#f1f5f9" : "#6366f1", cursor: level !== "list" ? "pointer" : "default" }}>
          🎓 Programs
        </button>
        {selProgram && (<>
          <span style={{ color: "#334155" }}>›</span>
          <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{selProgram.name}</span>
        </>)}
      </div>

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, maxWidth: 500,
          background: toast.type === "error" ? "rgba(239,68,68,.12)" : "rgba(16,185,129,.12)",
          border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`,
          borderRadius: 8, padding: "10px 16px",
          color: toast.type === "error" ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600 }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      {/* Delete modal */}
      {confirmDel && (
        <DeleteProgramModal
          program={confirmDel}
          studentCount={studentCountMap[confirmDel.program_id] || 0}
          onConfirm={deleteProgram}
          onCancel={() => { if (!deleting) setConfirmDel(null); }}
          deleting={deleting}
        />
      )}

      {/* ══ LEVEL: LIST ══ */}
      {level === "list" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── Left pane — Add / Edit form ── */}
          <div style={S.pane}>
            <div style={{ marginBottom: 2 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", display: "flex", alignItems: "center", gap: 6 }}>
                {editingId ? "✏️" : "➕"} {editingId ? "Edit Program" : "New Program"}
              </div>
              {editingId && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                Changes apply immediately to the student account dropdown.
              </div>}
            </div>

            <FF label="Code *">
              <Input
                value={form.code}
                onChange={e => upd("code", e.target.value.toUpperCase())}
                placeholder="e.g. BSCS"
                maxLength={20}
                style={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}
              />
            </FF>

            <FF label="Program Name *">
              <Input
                value={form.name}
                onChange={e => upd("name", e.target.value)}
                placeholder="e.g. Bachelor of Science in Computer Science"
              />
            </FF>

            <FF label="Description">
              <textarea
                value={form.description}
                onChange={e => upd("description", e.target.value)}
                placeholder="Optional…"
                rows={2}
                style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
                  padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "#e2e8f0",
                  resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
            </FF>

            <FF label="Department (optional)">
              <Sel value={form.departmentId} onChange={e => upd("departmentId", e.target.value)}>
                <option value="">— None —</option>
                {deptOptions.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                ))}
              </Sel>
            </FF>

            {formError && (
              <div style={{ fontSize: 12, color: "#f87171", background: "rgba(239,68,68,.08)",
                border: "1px solid rgba(239,68,68,.25)", borderRadius: 6, padding: "7px 10px" }}>
                ⚠ {formError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
              <Btn onClick={saveProgram} disabled={saving} style={{ flex: 1 }}>
                {saving ? "⏳ Saving…" : editingId ? "✓ Save Changes" : "✦ Create Program"}
              </Btn>
              {editingId && (
                <Btn variant="secondary" onClick={cancelForm}>Cancel</Btn>
              )}
            </div>

            {/* Info note */}
            <div style={{ ...S.sec }}>
              <div style={{ background: "rgba(16,185,129,.07)", border: "1px solid rgba(16,185,129,.18)",
                borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#34d399", marginBottom: 5 }}>ℹ️ Account Dropdown</div>
                <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
                  Programs you <strong style={{ color: "#34d399" }}>create</strong> appear immediately in the Program dropdown when creating student accounts. <strong style={{ color: "#f87171" }}>Deleted</strong> programs are removed from the dropdown right away.
                </div>
              </div>
            </div>

            {/* Summary stats */}
            <div style={S.sec}>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { icon: "🎓", val: programs.length,                                    label: "Total Programs",  color: "#a5b4fc" },
                  { icon: "👥", val: students.length,                                    label: "Total Students",  color: "#60a5fa" },
                  { icon: "✅", val: programs.filter(p => p.is_active).length,           label: "Active Programs", color: "#34d399" },
                ].map(({ icon, val, label, color }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10,
                    background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px" }}>
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right area — Program cards grid ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
            {loading ? (
              <div style={{ color: "#475569", textAlign: "center", paddingTop: 60, fontSize: 13 }}>Loading programs…</div>
            ) : programs.length === 0 ? (
              <div style={{ color: "#475569", textAlign: "center", paddingTop: 60, fontSize: 13 }}>
                No programs yet. Create one in the left panel.
              </div>
            ) : (
              <>
                <div style={{ ...S.label, marginBottom: 14 }}>
                  {programs.length} Program{programs.length !== 1 ? "s" : ""} — click a card or use the buttons
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {programs.map((prog, idx) => (
                    <ProgramCard
                      key={prog.program_id}
                      program={prog}
                      studentCount={studentCountMap[prog.program_id] || 0}
                      colorMeta={PALETTE[idx % PALETTE.length]}
                      onView={drillProgram}
                      onEdit={startEdit}
                      onDelete={p => setConfirmDel(p)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ LEVEL: DETAIL (students) ══ */}
      {level === "detail" && selProgram && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Filter bar */}
          <div style={{ background: "#1e293b", borderBottom: "1px solid #334155",
            padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>

            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 160 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                color: "#475569", fontSize: 13, pointerEvents: "none" }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ID or email…"
                style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 7,
                  padding: "7px 10px 7px 32px", fontSize: 12, color: "#e2e8f0", fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box" }}
                onFocus={e  => { e.target.style.borderColor = "#6366f1"; }}
                onBlur={e   => { e.target.style.borderColor = "#334155"; }}
              />
            </div>

            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 7,
                padding: "7px 12px", fontSize: 12, color: "#e2e8f0", fontFamily: "inherit",
                cursor: "pointer", outline: "none", minWidth: 130 }}>
              <option value="">All Year Levels</option>
              {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
            </select>

            <select value={semFilter} onChange={e => setSemFilter(e.target.value)}
              style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 7,
                padding: "7px 12px", fontSize: 12, color: "#e2e8f0", fontFamily: "inherit",
                cursor: "pointer", outline: "none", minWidth: 140 }}>
              <option value="">All Semesters</option>
              {SEMESTERS.map(s => <option key={s}>{s}</option>)}
            </select>

            {(search || yearFilter || semFilter) && (
              <Btn size="sm" variant="secondary"
                onClick={() => { setSearch(""); setYearFilter(""); setSemFilter(""); }}>
                ✕ Clear
              </Btn>
            )}

            <div style={{ marginLeft: "auto", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
              <strong style={{ color: "#e2e8f0" }}>{detailStudents.length}</strong> of{" "}
              {students.filter(s => String(s.programId) === String(selProgram.program_id)).length} students
            </div>
          </div>

          {/* Content area */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* Sidebar */}
            <div style={{ width: 230, borderRight: "1px solid #334155", background: "#1e293b",
              padding: "16px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flexShrink: 0 }}>

              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "14px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase",
                  letterSpacing: "0.07em", marginBottom: 8 }}>Program Info</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#a5b4fc", marginBottom: 4 }}>{selProgram.code}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.4, marginBottom: 6 }}>{selProgram.name}</div>
                {selProgram.description && (
                  <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic", lineHeight: 1.5 }}>{selProgram.description}</div>
                )}
              </div>

              <div style={{ background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.2)",
                borderRadius: 10, padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#a5b4fc", lineHeight: 1 }}>
                  {students.filter(s => String(s.programId) === String(selProgram.program_id)).length}
                </div>
                <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, marginTop: 4 }}>Total Students</div>
              </div>

              {yearBreakdown.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase",
                    letterSpacing: "0.07em", marginBottom: 8 }}>Year Breakdown</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {yearBreakdown.map(({ yr, count }) => {
                      const total = students.filter(s => String(s.programId) === String(selProgram.program_id)).length;
                      const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                      const cols  = { "1st Year": "#6366f1", "2nd Year": "#0ea5e9", "3rd Year": "#34d399", "4th Year": "#f59e0b", "5th Year": "#f87171" };
                      const col   = cols[yr] || "#94a3b8";
                      return (
                        <div key={yr}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>{yr}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{count}</span>
                          </div>
                          <div style={{ height: 4, background: "#0f172a", borderRadius: 9999 }}>
                            <div style={{ height: "100%", background: col, borderRadius: 9999, width: `${pct}%`, transition: "width .4s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(search || yearFilter || semFilter) && (
                <div style={{ background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.2)",
                  borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b", textTransform: "uppercase",
                    letterSpacing: "0.07em", marginBottom: 6 }}>Active Filters</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {search     && <div style={{ fontSize: 11, color: "#94a3b8" }}>🔍 "{search}"</div>}
                    {yearFilter && <div style={{ fontSize: 11, color: "#94a3b8" }}>📅 {yearFilter}</div>}
                    {semFilter  && <div style={{ fontSize: 11, color: "#94a3b8" }}>📖 {semFilter}</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Student table */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {detailStudents.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", height: "100%", gap: 12 }}>
                  <div style={{ fontSize: 48 }}>👥</div>
                  <div style={{ color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 1.8 }}>
                    {(search || yearFilter || semFilter)
                      ? "No students match the current filters."
                      : `No students enrolled in ${selProgram.code} yet.`}
                  </div>
                  {(search || yearFilter || semFilter) && (
                    <Btn size="sm" variant="secondary"
                      onClick={() => { setSearch(""); setYearFilter(""); setSemFilter(""); }}>
                      Clear filters
                    </Btn>
                  )}
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#1e293b", borderBottom: "2px solid #334155",
                      position: "sticky", top: 0, zIndex: 1 }}>
                      {["#", "Student ID", "Full Name", "Email", "Year Level", "Semester"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10,
                          fontWeight: 800, color: "#475569", textTransform: "uppercase",
                          letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailStudents.map((s, idx) => (
                      <tr key={s._uuid || s.id}
                        style={{ borderBottom: "1px solid #1e293b",
                          background: idx % 2 === 0 ? "transparent" : "rgba(30,41,59,.4)", transition: "background .12s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,.07)"}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "rgba(30,41,59,.4)"}
                      >
                        <td style={{ padding: "11px 16px", color: "#475569", fontSize: 11, fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: "11px 16px" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 12, color: "#a5b4fc", fontWeight: 700 }}>{s.id}</span>
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          <div style={{ fontWeight: 700, color: "#e2e8f0" }}>{s.fullName}</div>
                          {s.username && <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>@{s.username}</div>}
                        </td>
                        <td style={{ padding: "11px 16px", color: "#64748b", fontSize: 12 }}>
                          {s.email || <span style={{ color: "#334155", fontStyle: "italic" }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          {s.yearLevel ? <YearPill v={s.yearLevel} /> : <span style={{ color: "#334155" }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          {s.semester ? <SemPill v={s.semester} /> : <span style={{ color: "#334155" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
