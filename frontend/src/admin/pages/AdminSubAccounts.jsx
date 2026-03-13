/**
 * AdminSubAccounts.jsx — Create & manage sub-admin accounts
 * (Department admin, Organization admin, etc.)
 * Main admin can also approve/reject accounts submitted by sub-admins.
 *
 * FOLDER: src/admin/pages/AdminSubAccounts.jsx
 */
import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { subAdminApi, approvalApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF, Toast } from "../../components/ui";
import TopBar from "../../components/TopBar";
import LMSGrid from "../../components/LMSGrid";

const SCOPE_META = {
  department:   { icon: "🏛️", color: "#a5b4fc", bg: "rgba(99,102,241,.15)"  },
  organization: { icon: "🏢", color: "#34d399",  bg: "rgba(16,185,129,.15)" },
  registrar:    { icon: "📋", color: "#fbbf24",  bg: "rgba(245,158,11,.15)" },
  library:      { icon: "📚", color: "#60a5fa",  bg: "rgba(59,130,246,.15)" },
  other:        { icon: "⚙️",  color: "#94a3b8",  bg: "rgba(100,116,139,.15)"},
};

const empty = { display_name: "", username: "", email: "", scope: "department", scope_ref: "", password: "" };

export default function AdminSubAccounts({ user }) {
  const [tab,         setTab]         = useState("sub-admins");   // "sub-admins" | "approvals"
  const [subAdmins,   setSubAdmins]   = useState([]);
  const [approvals,   setApprovals]   = useState([]);
  const [form,        setForm]        = useState(empty);
  const [errors,      setErrors]      = useState({});
  const [toast,       setToast]       = useState("");
  const [selApproval, setSelApproval] = useState(null);
  const [mode,        setMode]        = useState("list");          // "list" | "create"
  const [busy,        setBusy]        = useState(false);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    subAdminApi.getAll().then(setSubAdmins).catch(console.error);
    approvalApi.getAll().then(setApprovals).catch(console.error);
  }, []);

  const pendingCount = approvals.filter(a => a.status === "pending").length;

  // ── Create sub-admin ────────────────────────────────────────
  const submit = async () => {
    const e = {};
    if (!form.display_name.trim()) e.display_name = "Required";
    if (!form.username.trim())     e.username      = "Required";
    if (!form.password.trim())     e.password      = "Required";
    if (Object.keys(e).length) { setErrors(e); return; }

    setBusy(true);
    try {
      // Hash the password via the same RPC used for regular accounts
      const { data: hashData, error: hashErr } = await supabase.rpc("hash_password", { plain: form.password });
      if (hashErr || !hashData) { setErrors({ password: "Password hashing failed — check hash_password SQL function." }); setBusy(false); return; }

      // Insert into users table first
      const { data: newUser, error: uErr } = await supabase.from("users").insert({
        display_id:    `SA-${Date.now()}`,
        username:      form.username.trim(),
        full_name:     form.display_name.trim(),
        email:         form.email.trim() || null,
        password_hash: hashData,
        role:          "sub_admin",
        is_active:     true,
      }).select().single();

      if (uErr) { setErrors({ username: uErr.message.includes("username") ? "Username taken" : uErr.message }); setBusy(false); return; }

      // Insert into sub_admins
      const sa = await subAdminApi.create({
        user_id:      newUser.user_id,
        display_name: form.display_name.trim(),
        username:     form.username.trim(),
        email:        form.email.trim() || null,
        scope:        form.scope,
        scope_ref:    form.scope_ref.trim() || null,
        created_by:   user._uuid,
      });

      setSubAdmins(prev => [sa, ...prev]);
      setForm(empty); setErrors({});
      setMode("list");
      showToast(`Sub-admin "${sa.display_name}" created!`);
    } catch (err) { showToast("Error: " + err.message); }
    setBusy(false);
  };

  // ── Approve / Reject account ────────────────────────────────
  const review = async (id, status) => {
    setBusy(true);
    try {
      const updated = await approvalApi.review(id, status, user._uuid);

      if (status === "approved") {
        // Create the actual user account
        const a = approvals.find(x => x.id === id);
        if (a) {
          const { data: newUser, error: uErr } = await supabase.from("users").insert({
            display_id:    `${a.role === "student" ? "STU" : "TCH"}-${Date.now()}`,
            username:      a.username,
            full_name:     a.full_name,
            email:         a.email || null,
            password_hash: a.password_hash,
            civil_status:  a.civil_status || null,
            birthdate:     a.birthdate || null,
            address:       a.address || null,
            role:          a.role,
            is_active:     true,
          }).select().single();

          if (!uErr && newUser) {
            if (a.role === "student") {
              await supabase.from("students").insert({ user_id: newUser.user_id, year_level: a.year_level, semester: a.semester });
            } else {
              await supabase.from("teachers").insert({ user_id: newUser.user_id });
            }
          }
        }
      }

      setApprovals(prev => prev.map(a => a.id === id ? updated : a));
      setSelApproval(null);
      showToast(status === "approved" ? "✅ Account approved & created!" : "❌ Request rejected.");
    } catch (err) { showToast("Error: " + err.message); }
    setBusy(false);
  };

  const deactivate = async (id) => {
    try {
      await subAdminApi.update(id, { is_active: false });
      setSubAdmins(prev => prev.map(s => s.id === id ? { ...s, is_active: false } : s));
      showToast("Sub-admin deactivated.");
    } catch (err) { showToast("Error: " + err.message); }
  };

  // ── Grid columns ────────────────────────────────────────────
  const subAdminCols = [
    { field: "display_name", header: "Name" },
    { field: "username",     header: "Username", width: 120 },
    { field: "scope",        header: "Scope", width: 110,
      cellRenderer: v => {
        const m = SCOPE_META[v] || SCOPE_META.other;
        return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999 }}>{m.icon} {v}</span>;
      }},
    { field: "scope_ref",    header: "Assigned To" },
    { field: "email",        header: "Email" },
    { field: "is_active",    header: "Status", width: 90,
      cellRenderer: v => <Badge color={v ? "success" : "danger"}>{v ? "Active" : "Inactive"}</Badge> },
    { field: "id", header: "Actions", width: 110, sortable: false,
      cellRenderer: (_, row) => row.is_active
        ? <Btn size="sm" variant="danger" onClick={e => { e.stopPropagation(); deactivate(row.id); }}>Deactivate</Btn>
        : <span style={{ fontSize: 11, color: "#475569" }}>—</span>
    },
  ];

  const approvalCols = [
    { field: "full_name",      header: "Full Name" },
    { field: "username",       header: "Username",     width: 110 },
    { field: "role",           header: "Role",         width: 80,
      cellRenderer: v => <Badge color={v === "student" ? "success" : "purple"}>{v}</Badge> },
    { field: "submitter_name", header: "Submitted By", width: 130 },
    { field: "status",         header: "Status",       width: 100,
      cellRenderer: v => <Badge color={v === "approved" ? "success" : v === "rejected" ? "danger" : "warning"}>{v}</Badge> },
    { field: "created_at",     header: "Date",         width: 120,
      cellRenderer: v => v ? new Date(v).toLocaleDateString() : "—" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar
        title="Sub-Admin Management"
        subtitle="Department, organization & other admin accounts"
      />

      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}>
          <Toast msg={toast} />
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #334155", background: "#1e293b", padding: "0 20px", flexShrink: 0 }}>
        {[
          { id: "sub-admins", label: "🛡️ Sub-Admins" },
          { id: "approvals",  label: `📥 Account Requests${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: tab === t.id ? "#a5b4fc" : "#475569", borderBottom: `2px solid ${tab === t.id ? "#6366f1" : "transparent"}`, marginBottom: -1, transition: "color .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Sub-admins tab ── */}
      {tab === "sub-admins" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Grid */}
          <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{subAdmins.length} Sub-Admin Accounts</div>
              <Btn onClick={() => setMode(mode === "create" ? "list" : "create")}>
                {mode === "create" ? "✕ Cancel" : "➕ New Sub-Admin"}
              </Btn>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <LMSGrid columns={subAdminCols} rowData={subAdmins} height="100%" />
            </div>
          </div>

          {/* Create form drawer */}
          {mode === "create" && (
            <div style={{ width: 320, borderLeft: "1px solid #334155", background: "#1e293b", padding: "18px 20px", overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", marginBottom: 4 }}>New Sub-Admin</div>

              <FF label="Scope / Type" required>
                <Sel value={form.scope} onChange={e => upd("scope", e.target.value)}>
                  {Object.keys(SCOPE_META).map(s => <option key={s} value={s}>{SCOPE_META[s].icon} {s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </Sel>
              </FF>
              <FF label="Assigned To (e.g. CCS, Student Council)" required>
                <Input value={form.scope_ref} onChange={e => upd("scope_ref", e.target.value)} placeholder="e.g. College of Computer Studies" />
              </FF>
              <FF label="Display Name" required error={errors.display_name}>
                <Input value={form.display_name} onChange={e => upd("display_name", e.target.value)} placeholder="e.g. CCS Admin" />
              </FF>
              <FF label="Username" required error={errors.username}>
                <Input value={form.username} onChange={e => upd("username", e.target.value)} placeholder="e.g. ccs_admin" />
              </FF>
              <FF label="Email">
                <Input type="email" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="admin@school.edu" />
              </FF>
              <FF label="Password" required error={errors.password}>
                <Input type="password" value={form.password} onChange={e => upd("password", e.target.value)} placeholder="Initial password" />
              </FF>

              <div style={{ background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#fbbf24" }}>
                ⚠️ Sub-admins can submit student/faculty account requests, which you'll approve here.
              </div>

              <Btn onClick={submit} disabled={busy} style={{ marginTop: 4 }}>
                {busy ? "Creating…" : "✦ Create Sub-Admin"}
              </Btn>
            </div>
          )}
        </div>
      )}

      {/* ── Approvals tab ── */}
      {tab === "approvals" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Grid */}
          <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {["all", "pending", "approved", "rejected"].map(s => (
                <button key={s} onClick={() => {}}
                  style={{ padding: "4px 12px", borderRadius: 9999, border: "1px solid #334155", background: "transparent", color: "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {s.charAt(0).toUpperCase()+s.slice(1)} {s === "pending" && pendingCount > 0 ? `(${pendingCount})` : ""}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <LMSGrid columns={approvalCols} rowData={approvals} onRowClick={setSelApproval} selectedId={selApproval?.id} height="100%" />
            </div>
          </div>

          {/* Approval detail */}
          {selApproval && (
            <div style={{ width: 300, borderLeft: "1px solid #334155", background: "#1e293b", padding: "18px 18px", overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>Request Details</div>
                <button onClick={() => setSelApproval(null)} style={{ background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer" }}>×</button>
              </div>

              {/* Avatar */}
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: selApproval.role === "student" ? "rgba(16,185,129,.15)" : "rgba(99,102,241,.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 20, fontWeight: 800, color: selApproval.role === "student" ? "#34d399" : "#a5b4fc" }}>
                  {selApproval.full_name?.charAt(0)}
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>{selApproval.full_name}</div>
                <Badge color={selApproval.role === "student" ? "success" : "purple"}>{selApproval.role}</Badge>
              </div>

              {/* Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["Username",       selApproval.username],
                  ["Email",          selApproval.email],
                  ["Submitted By",   selApproval.submitter_name],
                  ["Civil Status",   selApproval.civil_status],
                  ["Birthdate",      selApproval.birthdate],
                  ["Year Level",     selApproval.year_level],
                  ["Semester",       selApproval.semester],
                  ["Address",        selApproval.address],
                ].filter(([,v]) => v).map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{l}</div>
                    <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Status */}
              <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>STATUS</div>
                <Badge color={selApproval.status === "approved" ? "success" : selApproval.status === "rejected" ? "danger" : "warning"}>
                  {selApproval.status.toUpperCase()}
                </Badge>
              </div>

              {/* Action buttons — only for pending */}
              {selApproval.status === "pending" && (
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <Btn onClick={() => review(selApproval.id, "approved")} disabled={busy} style={{ flex: 1 }}>
                    ✅ Approve
                  </Btn>
                  <Btn variant="danger" onClick={() => review(selApproval.id, "rejected")} disabled={busy} style={{ flex: 1 }}>
                    ❌ Reject
                  </Btn>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
