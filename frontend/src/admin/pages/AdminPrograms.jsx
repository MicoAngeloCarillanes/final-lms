/**
 * AdminPrograms.jsx
 * FOLDER: src/admin/pages/AdminPrograms.jsx  (new file)
 *
 * CRUD management for academic programs, connected to NestJS /api/program endpoints.
 * Add this page to AdminDashboard.jsx nav and pages object.
 */
import React, { useState, useEffect, useCallback } from "react";
import { programApi, departmentApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF, Toast } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar from "../../components/TopBar";

const emptyForm = { code: "", name: "", departmentId: "", description: "" };

export default function AdminPrograms() {
  const [rows,        setRows]        = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState({ name: "", code: "" });
  const [loading,     setLoading]     = useState(false);
  const [deptOptions, setDeptOptions] = useState([]);
  const [form,        setForm]        = useState(emptyForm);
  const [mode,        setMode]        = useState("list");   // "list" | "create" | "edit"
  const [selected,    setSelected]    = useState(null);
  const [toast,       setToast]       = useState("");
  const [confirmDel,  setConfirmDel]  = useState(null);
  const SIZE = 15;

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };

  // Load department options for dropdown
  useEffect(() => {
    departmentApi.getOptions()
      .then(opts => setDeptOptions(opts ?? []))
      .catch(console.error);
  }, []);

  const load = useCallback(async (pg = page, srch = search) => {
    setLoading(true);
    try {
      const res = await programApi.getList({
        page: pg, size: SIZE,
        ...(srch.name && { name: srch.name }),
        ...(srch.code && { code: srch.code }),
      });
      setRows(res?.content ?? res?.items ?? []);
      setTotal(res?.totalElements ?? res?.total ?? 0);
    } catch (e) { showToast("Load failed: " + e.message); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm); setSelected(null); setMode("create"); };
  const openEdit   = (row) => {
    setSelected(row);
    setForm({ code: row.code || "", name: row.name || "", departmentId: row.departmentId || "", description: row.description || "" });
    setMode("edit");
  };
  const cancel = () => { setMode("list"); setSelected(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) { showToast("Code and Name are required."); return; }
    try {
      if (mode === "create") {
        await programApi.create({ code: form.code.trim(), name: form.name.trim(), departmentId: form.departmentId || undefined, description: form.description.trim() || undefined });
        showToast("Program created!");
      } else {
        await programApi.update({ programId: selected.programId, code: form.code.trim(), name: form.name.trim(), departmentId: form.departmentId || undefined, description: form.description.trim() || undefined });
        showToast("Program updated!");
      }
      cancel();
      load(1, search);
      setPage(1);
    } catch (e) { showToast("Error: " + e.message); }
  };

  const toggleActive = async (row) => {
    try {
      await programApi.setActive(row.programId, row.isActive === 1 ? 0 : 1);
      showToast(`Program ${row.isActive === 1 ? "deactivated" : "activated"}.`);
      load();
    } catch (e) { showToast("Error: " + e.message); }
  };

  const del = async () => {
    if (!confirmDel) return;
    try {
      await programApi.delete(confirmDel.programId);
      showToast(`"${confirmDel.name}" deleted.`);
      setConfirmDel(null);
      load(1, search); setPage(1);
    } catch (e) { showToast("Delete failed: " + e.message); }
  };

  const totalPages = Math.ceil(total / SIZE) || 1;

  const cols = [
    { field: "code",           header: "Code",       width: 90 },
    { field: "name",           header: "Program Name" },
    { field: "departmentName", header: "Department" },
    { field: "description",    header: "Description" },
    { field: "isActive",       header: "Status",     width: 110,
      cellRenderer: (v, row) => (
        <button onClick={e => { e.stopPropagation(); toggleActive(row); }}
          style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 9999, border: "none", cursor: "pointer", background: v === 1 ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)", color: v === 1 ? "#34d399" : "#f87171" }}>
          {v === 1 ? "🟢 Active" : "🔴 Inactive"}
        </button>
      )},
    { field: "programId", header: "Actions", width: 130, sortable: false,
      cellRenderer: (_, row) => (
        <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
          <Btn size="sm" variant="secondary" onClick={() => openEdit(row)}>✏️ Edit</Btn>
          <Btn size="sm" variant="danger"    onClick={() => setConfirmDel(row)}>🗑</Btn>
        </div>
      )},
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar title="Program Management" subtitle={`${total} programs · NestJS API`} />

      {toast && <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}><Toast msg={toast} /></div>}

      {/* List */}
      {mode === "list" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "14px 18px", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
            <Input name="code" value={search.code} onChange={e => { setSearch(s => ({ ...s, code: e.target.value })); setPage(1); }} placeholder="Search code…" style={{ width: 150 }} />
            <Input name="name" value={search.name} onChange={e => { setSearch(s => ({ ...s, name: e.target.value })); setPage(1); }} placeholder="Search name…" style={{ width: 220 }} />
            <Btn variant="secondary" size="sm" onClick={() => { setSearch({ name: "", code: "" }); setPage(1); }}>Clear</Btn>
            <div style={{ marginLeft: "auto" }}><Btn onClick={openCreate}>➕ New Program</Btn></div>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {loading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#475569" }}>Loading…</div>
              : <LMSGrid columns={cols} rowData={rows} height="100%" />
            }
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Btn size="sm" variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</Btn>
              <span style={{ fontSize: 12, color: "#64748b" }}>Page {page} / {totalPages}</span>
              <Btn size="sm" variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</Btn>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit form */}
      {(mode === "create" || mode === "edit") && (
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", maxWidth: 560 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9", marginBottom: 18 }}>
            {mode === "create" ? "➕ New Program" : `✏️ Edit: ${selected?.name}`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FF label="Code *">
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. BSCS" />
              </FF>
              <FF label="Department">
                <Sel value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
                  <option value="">— No Department —</option>
                  {deptOptions.map(d => <option key={d.departmentId} value={d.departmentId}>{d.name}</option>)}
                </Sel>
              </FF>
            </div>
            <FF label="Program Name *">
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bachelor of Science in Computer Science" />
            </FF>
            <FF label="Description">
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                placeholder="Optional description…"
                style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "#e2e8f0", resize: "vertical", outline: "none" }} />
            </FF>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={save}>{mode === "create" ? "Create Program" : "Save Changes"}</Btn>
              <Btn variant="secondary" onClick={cancel}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "24px 28px", width: 400, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9", marginBottom: 8 }}>Delete Program</div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Delete <strong style={{ color: "#e2e8f0" }}>{confirmDel.name}</strong>? This performs a soft delete.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setConfirmDel(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={del}>Delete</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
