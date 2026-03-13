import React, { useState, useEffect, useCallback } from "react";
import { departmentApi } from "../../lib/api";
import { Badge, Btn, Input, Toast } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar from "../../components/TopBar";

// ─── Empty form state ─────────────────────────────────────────────────────────
const emptyForm = { code: "", name: "", room: "", email: "", phone: "", description: "" };

// ─── AdminDepartments ─────────────────────────────────────────────────────────
export default function AdminDepartments() {
  const [rows,     setRows]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState({ name: "", code: "" });
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState("");
  const [selected, setSelected] = useState(null);   // row being edited
  const [form,     setForm]     = useState(emptyForm);
  const [mode,     setMode]     = useState("list"); // "list" | "create" | "edit"
  const [confirmDel, setConfirmDel] = useState(null); // department to delete

  const SIZE = 15;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  // ── Fetch list ───────────────────────────────────────────────────────────────
  const loadList = useCallback(async (pg = page, srch = search) => {
    setLoading(true);
    try {
      const res = await departmentApi.getList({
        page:   pg,
        size:   SIZE,
        ...(srch.name && { name: srch.name }),
        ...(srch.code && { code: srch.code }),
      });
      setRows(res?.items  ?? res?.data  ?? []);
      setTotal(res?.total ?? res?.count ?? 0);
    } catch (err) {
      showToast("Failed to load departments: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSearch = (e) => {
    const { name, value } = e.target;
    setSearch(s => ({ ...s, [name]: value }));
    setPage(1);
  };

  const openCreate = () => { setForm(emptyForm); setSelected(null); setMode("create"); };

  const openEdit = (row) => {
    setSelected(row);
    setForm({
      code:        row.code        ?? "",
      name:        row.name        ?? "",
      room:        row.room        ?? "",
      email:       row.email       ?? "",
      phone:       row.phone       ?? "",
      description: row.description ?? "",
    });
    setMode("edit");
  };

  const cancelForm = () => { setMode("list"); setSelected(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      showToast("Code and Name are required."); return;
    }
    try {
      if (mode === "create") {
        await departmentApi.create({ ...form });
        showToast("Department created!");
      } else {
        await departmentApi.update({ departmentId: selected.departmentId, ...form });
        showToast("Department updated!");
      }
      cancelForm();
      loadList(1, search);
      setPage(1);
    } catch (err) {
      showToast((mode === "create" ? "Create" : "Update") + " failed: " + err.message);
    }
  };

  const handleToggleActive = async (row) => {
    const next = row.isActive === 1 ? 0 : 1;
    try {
      await departmentApi.setActive(row.departmentId, next);
      showToast(`Department ${next === 1 ? "activated" : "deactivated"}.`);
      loadList();
    } catch (err) {
      showToast("Status update failed: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await departmentApi.delete(confirmDel.departmentId);
      showToast(`"${confirmDel.name}" deleted.`);
      setConfirmDel(null);
      loadList(1, search);
      setPage(1);
    } catch (err) {
      showToast("Delete failed: " + err.message);
    }
  };

  // ── Grid columns ──────────────────────────────────────────────────────────────
  const cols = [
    { field: "code",  header: "Code",  width: 90 },
    { field: "name",  header: "Name" },
    { field: "room",  header: "Room",  width: 110 },
    { field: "email", header: "Email", width: 200 },
    { field: "phone", header: "Phone", width: 130 },
    {
      field: "isActive", header: "Status", width: 100,
      cellRenderer: (v, row) => (
        <button
          onClick={e => { e.stopPropagation(); handleToggleActive(row); }}
          style={{
            fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 9999, cursor: "pointer",
            border: "none",
            background: v === 1 ? "#dcfce7" : "#fee2e2",
            color:      v === 1 ? "#166534" : "#991b1b",
          }}
        >
          {v === 1 ? "🟢 Active" : "🔴 Inactive"}
        </button>
      ),
    },
    {
      field: "departmentId", header: "Actions", width: 140,
      cellRenderer: (_, row) => (
        <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
          <Btn size="sm" variant="secondary" onClick={() => openEdit(row)}>✏️ Edit</Btn>
          <Btn size="sm" variant="danger"    onClick={() => setConfirmDel(row)}>🗑</Btn>
        </div>
      ),
    },
  ];

  const totalPages = Math.ceil(total / SIZE) || 1;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="Department Management"
        subtitle={`${total} department${total !== 1 ? "s" : ""} · connected to NestJS API`}
      />

      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}>
          <Toast msg={toast} />
        </div>
      )}

      {/* ── List view ── */}
      {mode === "list" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "14px 18px", gap: 12 }}>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Input
              name="code"
              value={search.code}
              onChange={handleSearch}
              placeholder="Search code…"
              style={{ width: 160 }}
            />
            <Input
              name="name"
              value={search.name}
              onChange={handleSearch}
              placeholder="Search name…"
              style={{ width: 220 }}
            />
            <Btn onClick={() => { setSearch({ name: "", code: "" }); setPage(1); }} variant="secondary" size="sm">Clear</Btn>
            <div style={{ marginLeft: "auto" }}>
              <Btn onClick={openCreate}>➕ New Department</Btn>
            </div>
          </div>

          {/* Grid */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#475569", fontSize: 14 }}>
                Loading…
              </div>
            ) : (
              <LMSGrid columns={cols} rowData={rows} height="100%" />
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", paddingTop: 4 }}>
              <Btn size="sm" variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</Btn>
              <span style={{ fontSize: 12, color: "#64748b" }}>Page {page} / {totalPages}</span>
              <Btn size="sm" variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</Btn>
            </div>
          )}
        </div>
      )}

      {/* ── Create / Edit form ── */}
      {(mode === "create" || mode === "edit") && (
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", maxWidth: 580 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#e2e8f0", marginBottom: 18 }}>
            {mode === "create" ? "➕ New Department" : `✏️ Edit: ${selected?.name}`}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={labelStyle}>
              Code <span style={{ color: "#ef4444" }}>*</span>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CCS" />
            </label>
            <label style={labelStyle}>
              Name <span style={{ color: "#ef4444" }}>*</span>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. College of Computer Studies" />
            </label>
            <label style={labelStyle}>
              Room
              <Input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. Room 301" />
            </label>
            <label style={labelStyle}>
              Email
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="dept@school.edu" />
            </label>
            <label style={labelStyle}>
              Phone
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="09XXXXXXXXX" />
            </label>
            <label style={labelStyle}>
              Description
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Optional description…"
                style={{ border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "#e2e8f0", outline: "none", resize: "vertical", width: "100%" }}
              />
            </label>

            <div style={{ display: "flex", gap: 10, paddingTop: 6 }}>
              <Btn onClick={handleSave}>{mode === "create" ? "Create" : "Save Changes"}</Btn>
              <Btn variant="secondary" onClick={cancelForm}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {confirmDel && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#e2e8f0", marginBottom: 8 }}>Delete Department</div>
            <p style={{ fontSize: 13, color: "#475569", marginBottom: 18 }}>
              Are you sure you want to delete <strong>{confirmDel.name}</strong>? This action performs a soft delete and cannot be undone from the UI.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setConfirmDel(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={handleDelete}>Delete</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const labelStyle = {
  display: "flex", flexDirection: "column", gap: 5,
  fontSize: 12, fontWeight: 700, color: "#475569",
};

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};

const modalStyle = {
  background: "#1e293b", borderRadius: 10, padding: "24px 28px",
  width: 420, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
};
