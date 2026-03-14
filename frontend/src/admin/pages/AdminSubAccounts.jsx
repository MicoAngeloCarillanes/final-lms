/**
 * AdminSubAccounts.jsx
 * FOLDER: src/admin/pages/AdminSubAccounts.jsx
 *
 * Features:
 *  - Create sub-admin accounts (Department Admin or General Admin)
 *  - ✏️ Edit Sub-Admin — modal to update display name, email, scope, scope_ref
 *  - 🔑 Change Password — modal using Supabase hash_password RPC
 *  - Deactivate / Reactivate
 *  - Account Requests tab (sub-admin → main admin approval workflow)
 */
import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { subAdminApi, approvalApi, userApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF, Toast } from "../../components/ui";
import TopBar from "../../components/TopBar";
import LMSGrid from "../../components/LMSGrid";

// ─── Constants ────────────────────────────────────────────────────────────────
const SCOPE_META = {
  department:   { icon: "🏛️", color: "#a5b4fc", bg: "rgba(99,102,241,.15)" },
  organization: { icon: "🏢", color: "#34d399",  bg: "rgba(16,185,129,.15)" },
  registrar:    { icon: "📋", color: "#fbbf24",  bg: "rgba(245,158,11,.15)" },
  library:      { icon: "📚", color: "#60a5fa",  bg: "rgba(59,130,246,.15)" },
  other:        { icon: "⚙️",  color: "#94a3b8",  bg: "rgba(100,116,139,.15)"},
};

const SCOPE_OPTIONS = [
  { value: "department",   label: "🏛️ Department  (Full access)" },
  { value: "organization", label: "🏢 Organization (Announcements & chat only)" },
  { value: "registrar",    label: "📋 Registrar    (Announcements & chat only)" },
  { value: "library",      label: "📚 Library       (Announcements & chat only)" },
  { value: "other",        label: "⚙️ Other          (Announcements & chat only)" },
];

const getType   = (scope) => scope === "department" ? "Department Admin" : "General Admin";
const typeColor = (scope) => scope === "department" ? "purple" : "success";

const emptyCreate = { display_name: "", username: "", email: "", scope: "department", scope_ref: "", password: "" };

// ─── Edit Sub-Admin Modal ─────────────────────────────────────────────────────
function EditSubAdminModal({ target, onClose, onSaved }) {
  const [form, setForm] = useState({
    display_name: target.display_name || "",
    username:     target.username     || "",
    email:        target.email        || "",
    scope:        target.scope        || "other",
    scope_ref:    target.scope_ref    || "",
  });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    setErr("");
    if (!form.display_name.trim()) { setErr("Display name is required."); return; }
    if (!form.username.trim())     { setErr("Username is required."); return; }

    setBusy(true);
    try {
      // Update users table (full_name + username + email)
      const { error: uErr } = await supabase
        .from("users")
        .update({
          full_name:  form.display_name.trim(),
          username:   form.username.trim(),
          email:      form.email.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", target.user_id);

      if (uErr) throw new Error(uErr.message.includes("username") ? "Username already taken." : uErr.message);

      // Update sub_admins table (display_name + email + scope + scope_ref)
      const { data: updated, error: sErr } = await supabase
        .from("sub_admins")
        .update({
          display_name: form.display_name.trim(),
          username:     form.username.trim(),
          email:        form.email.trim() || null,
          scope:        form.scope,
          scope_ref:    form.scope_ref.trim() || null,
          updated_at:   new Date().toISOString(),
        })
        .eq("id", target.id)
        .select()
        .single();

      if (sErr) throw new Error(sErr.message);

      onSaved(updated);
    } catch (e) {
      setErr(e.message || "Save failed.");
    }
    setBusy(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: "24px 26px", width: 480, maxWidth: "95vw", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>✏️ Edit Sub-Admin</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              <span style={{ color: "#a5b4fc" }}>{target.username}</span>
              <span style={{ marginLeft: 8 }}><Badge color={typeColor(target.scope)}>{getType(target.scope)}</Badge></span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* Scope type selector */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { scope: "department", title: "Department Admin", desc: "Full access", color: "#a5b4fc", bg: "rgba(99,102,241,.12)" },
            { scope: "other",      title: "General Admin",    desc: "Announcements + chat only", color: "#34d399", bg: "rgba(16,185,129,.12)" },
          ].map(opt => (
            <button key={opt.scope}
              onClick={() => upd("scope", opt.scope === "other" ? (form.scope !== "department" ? form.scope : "organization") : "department")}
              style={{
                border: `2px solid ${(opt.scope === "department") === (form.scope === "department") ? opt.color : "#334155"}`,
                borderRadius: 8, padding: "10px 12px",
                background: (opt.scope === "department") === (form.scope === "department") ? opt.bg : "transparent",
                textAlign: "left", cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
              }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: (opt.scope === "department") === (form.scope === "department") ? opt.color : "#475569", marginBottom: 3 }}>{opt.title}</div>
              <div style={{ fontSize: 11, color: "#475569" }}>{opt.desc}</div>
            </button>
          ))}
        </div>

        {/* General scope sub-selector */}
        {form.scope !== "department" && (
          <FF label="Scope">
            <Sel value={form.scope} onChange={e => upd("scope", e.target.value)}>
              {SCOPE_OPTIONS.filter(o => o.value !== "department").map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Sel>
          </FF>
        )}

        {/* Fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FF label="Display Name" required>
            <Input value={form.display_name} onChange={e => upd("display_name", e.target.value)} placeholder="e.g. CCS Admin" />
          </FF>
          <FF label="Username" required>
            <Input value={form.username} onChange={e => upd("username", e.target.value)} placeholder="e.g. ccs_admin" />
          </FF>
        </div>

        <FF label="Email">
          <Input type="email" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="admin@school.edu" />
        </FF>

        <FF label="Assigned To (department / unit name)">
          <Input value={form.scope_ref} onChange={e => upd("scope_ref", e.target.value)} placeholder="e.g. College of Computer Studies" />
        </FF>

        {err && (
          <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#f87171", fontWeight: 700 }}>
            ⚠ {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={busy}>{busy ? "⏳ Saving…" : "✓ Save Changes"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────
function ChangePasswordModal({ target, onClose, onSuccess }) {
  const [useDefault, setUseDefault] = useState(true);
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [busy,       setBusy]       = useState(false);
  const [err,        setErr]        = useState("");

  const handleSave = async () => {
    setErr("");
    if (!useDefault) {
      if (newPw.length < 6)    { setErr("Password must be at least 6 characters."); return; }
      if (newPw !== confirmPw) { setErr("Passwords do not match."); return; }
    }
    setBusy(true);
    try {
      await userApi.resetPassword(target.username, useDefault ? undefined : newPw);
      onSuccess(`Password for "${target.display_name}" has been reset.`);
    } catch (e) {
      setErr(e.message || "Reset failed.");
    }
    setBusy(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}>
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "24px 26px", width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>🔑 Change Password</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {target.display_name} · <span style={{ color: "#a5b4fc" }}>{target.username}</span>
              <span style={{ marginLeft: 8 }}><Badge color={typeColor(target.scope)}>{getType(target.scope)}</Badge></span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ background: "#0f172a", borderRadius: 8, padding: 3, display: "flex", border: "1px solid #334155" }}>
          {[{ id: true, label: "Reset to Default  (Welcome@123)" }, { id: false, label: "Set Custom Password" }].map(opt => (
            <button key={String(opt.id)} onClick={() => { setUseDefault(opt.id); setErr(""); }}
              style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, transition: "all .15s", background: useDefault === opt.id ? "#4f46e5" : "transparent", color: useDefault === opt.id ? "#fff" : "#64748b" }}>
              {opt.label}
            </button>
          ))}
        </div>

        {!useDefault && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FF label="New Password">
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 6 characters" />
            </FF>
            <FF label="Confirm Password">
              <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
            </FF>
          </div>
        )}

        {useDefault && (
          <div style={{ background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.25)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#a5b4fc" }}>
            Password reset to <code style={{ background: "#0f172a", padding: "1px 5px", borderRadius: 4 }}>Welcome@123</code>. Sub-admin should change it on next login.
          </div>
        )}

        {err && <div style={{ fontSize: 12, color: "#f87171", fontWeight: 700 }}>⚠ {err}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={busy}>{busy ? "⏳ Resetting…" : "🔑 Reset Password"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── AdminSubAccounts ─────────────────────────────────────────────────────────
export default function AdminSubAccounts({ user }) {
  const [tab,          setTab]          = useState("sub-admins");
  const [subAdmins,    setSubAdmins]    = useState([]);
  const [approvals,    setApprovals]    = useState([]);
  const [form,         setForm]         = useState(emptyCreate);
  const [errors,       setErrors]       = useState({});
  const [toast,        setToast]        = useState("");
  const [selApproval,  setSelApproval]  = useState(null);
  const [mode,         setMode]         = useState("list");
  const [busy,         setBusy]         = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [editTarget,   setEditTarget]   = useState(null);
  const [pwTarget,     setPwTarget]     = useState(null);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    subAdminApi.getAll().then(setSubAdmins).catch(console.error);
    approvalApi.getAll().then(setApprovals).catch(console.error);
  }, []);

  const pendingCount      = approvals.filter(a => a.status === "pending").length;
  const filteredApprovals = activeFilter === "all" ? approvals : approvals.filter(a => a.status === activeFilter);

  // ── Create ────────────────────────────────────────────────────────────────
  const submit = async () => {
    const e = {};
    if (!form.display_name.trim()) e.display_name = "Required";
    if (!form.username.trim())     e.username      = "Required";
    if (!form.password.trim())     e.password      = "Required";
    if (Object.keys(e).length) { setErrors(e); return; }

    setBusy(true);
    try {
      const { data: hashData, error: hashErr } = await supabase.rpc("hash_password", { plain: form.password });
      if (hashErr || !hashData) { setErrors({ password: "Password hashing failed." }); setBusy(false); return; }

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
      setForm(emptyCreate); setErrors({});
      setMode("list");
      showToast(`${getType(form.scope)} "${sa.display_name}" created!`);
    } catch (err) { showToast("Error: " + err.message); }
    setBusy(false);
  };

  // ── Approve / Reject ──────────────────────────────────────────────────────
  const review = async (id, status) => {
    setBusy(true);
    try {
      const updated = await approvalApi.review(id, status, user._uuid);

      if (status === "approved") {
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

  const setActive = async (id, isActive) => {
    try {
      await subAdminApi.update(id, { is_active: isActive });
      setSubAdmins(prev => prev.map(s => s.id === id ? { ...s, is_active: isActive } : s));
      showToast(isActive ? "Sub-admin reactivated." : "Sub-admin deactivated.");
    } catch (err) { showToast("Error: " + err.message); }
  };

  // ── Grid columns ──────────────────────────────────────────────────────────
  const subAdminCols = [
    { field: "display_name", header: "Name" },
    { field: "username",     header: "Username",  width: 120 },
    { field: "scope",        header: "Type",      width: 150,
      cellRenderer: v => <Badge color={typeColor(v)}>{getType(v)}</Badge> },
    { field: "scope",        header: "Scope",     width: 105,
      cellRenderer: v => {
        const m = SCOPE_META[v] || SCOPE_META.other;
        return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999 }}>{m.icon} {v}</span>;
      }},
    { field: "scope_ref",  header: "Assigned To" },
    { field: "email",      header: "Email" },
    { field: "is_active",  header: "Status", width: 85,
      cellRenderer: v => <Badge color={v ? "success" : "danger"}>{v ? "Active" : "Inactive"}</Badge> },
    { field: "id", header: "Actions", width: 230, sortable: false,
      cellRenderer: (_, row) => (
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          <Btn size="sm" variant="secondary" onClick={() => setEditTarget(row)}>✏️ Edit</Btn>
          <Btn size="sm" variant="secondary" onClick={() => setPwTarget(row)}>🔑</Btn>
          {row.is_active
            ? <Btn size="sm" variant="danger"  onClick={() => setActive(row.id, false)}>Off</Btn>
            : <Btn size="sm" variant="success" onClick={() => setActive(row.id, true) }>On</Btn>
          }
        </div>
      ),
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
        subtitle="Create department admins (full access) or general admins (announcements & chat only)"
      />

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}>
          <Toast msg={toast} />
        </div>
      )}

      {/* Modals */}
      {editTarget && (
        <EditSubAdminModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setSubAdmins(prev => prev.map(s => s.id === updated.id ? updated : s));
            setEditTarget(null);
            showToast("Sub-admin updated successfully.");
          }}
        />
      )}
      {pwTarget && (
        <ChangePasswordModal
          target={pwTarget}
          onClose={() => setPwTarget(null)}
          onSuccess={(msg) => { showToast(msg); setPwTarget(null); }}
        />
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
          <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {subAdmins.length} Sub-Admin Accounts
              </div>
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
            <div style={{ width: 360, borderLeft: "1px solid #334155", background: "#1e293b", padding: "18px 20px", overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", marginBottom: 2 }}>New Sub-Admin</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { scope: "department", title: "Department Admin", desc: "Full access — accounts, passwords, announcements & chat", color: "#a5b4fc", bg: "rgba(99,102,241,.12)" },
                  { scope: "other",      title: "General Admin",    desc: "Announcements & chat only",                                color: "#34d399", bg: "rgba(16,185,129,.12)" },
                ].map(opt => (
                  <button key={opt.scope}
                    onClick={() => upd("scope", opt.scope === "other" ? form.scope !== "department" ? form.scope : "organization" : "department")}
                    style={{ border: `2px solid ${(opt.scope === "department") === (form.scope === "department") ? opt.color : "#334155"}`, borderRadius: 8, padding: "10px 12px", background: (opt.scope === "department") === (form.scope === "department") ? opt.bg : "transparent", textAlign: "left", cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: (opt.scope === "department") === (form.scope === "department") ? opt.color : "#475569", marginBottom: 4 }}>{opt.title}</div>
                    <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              {form.scope !== "department" && (
                <FF label="Scope">
                  <Sel value={form.scope} onChange={e => upd("scope", e.target.value)}>
                    {SCOPE_OPTIONS.filter(o => o.value !== "department").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Sel>
                </FF>
              )}

              <FF label="Assigned To (department / unit name)">
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

              <div style={{ background: form.scope === "department" ? "rgba(99,102,241,.1)" : "rgba(16,185,129,.1)", border: `1px solid ${form.scope === "department" ? "rgba(99,102,241,.25)" : "rgba(16,185,129,.25)"}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: form.scope === "department" ? "#a5b4fc" : "#34d399" }}>
                {form.scope === "department"
                  ? "🏛️ Full access — accounts, passwords, announcements, chat."
                  : "ℹ️ Limited access — announcements and chat only."}
              </div>

              <Btn onClick={submit} disabled={busy} style={{ marginTop: 4 }}>
                {busy ? "Creating…" : `✦ Create ${getType(form.scope)}`}
              </Btn>
            </div>
          )}
        </div>
      )}

      {/* ── Approvals tab ── */}
      {tab === "approvals" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {["all", "pending", "approved", "rejected"].map(s => (
                <button key={s} onClick={() => setActiveFilter(s)}
                  style={{ padding: "4px 12px", borderRadius: 9999, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s", border: activeFilter === s ? "1px solid #6366f1" : "1px solid #334155", background: activeFilter === s ? "#4f46e5" : "transparent", color: activeFilter === s ? "#fff" : "#64748b" }}>
                  {s.charAt(0).toUpperCase()+s.slice(1)}{s === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
                </button>
              ))}
              <span style={{ fontSize: 12, color: "#475569", marginLeft: 4 }}>{filteredApprovals.length} record{filteredApprovals.length !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <LMSGrid columns={approvalCols} rowData={filteredApprovals} onRowClick={setSelApproval} selectedId={selApproval?.id} height="100%" />
            </div>
          </div>

          {selApproval && (
            <div style={{ width: 300, borderLeft: "1px solid #334155", background: "#1e293b", padding: "18px 18px", overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>Request Details</div>
                <button onClick={() => setSelApproval(null)} style={{ background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer" }}>×</button>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: selApproval.role === "student" ? "rgba(16,185,129,.15)" : "rgba(99,102,241,.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 20, fontWeight: 800, color: selApproval.role === "student" ? "#34d399" : "#a5b4fc" }}>
                  {selApproval.full_name?.charAt(0)}
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>{selApproval.full_name}</div>
                <Badge color={selApproval.role === "student" ? "success" : "purple"}>{selApproval.role}</Badge>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["Username",     selApproval.username],
                  ["Email",        selApproval.email],
                  ["Submitted By", selApproval.submitter_name],
                  ["Civil Status", selApproval.civil_status],
                  ["Birthdate",    selApproval.birthdate],
                  ["Year Level",   selApproval.year_level],
                  ["Semester",     selApproval.semester],
                  ["Address",      selApproval.address],
                ].filter(([,v]) => v).map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{l}</div>
                    <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>STATUS</div>
                <Badge color={selApproval.status === "approved" ? "success" : selApproval.status === "rejected" ? "danger" : "warning"}>{selApproval.status.toUpperCase()}</Badge>
              </div>
              {selApproval.status === "pending" && (
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <Btn onClick={() => review(selApproval.id, "approved")} disabled={busy} style={{ flex: 1 }}>✅ Approve</Btn>
                  <Btn variant="danger" onClick={() => review(selApproval.id, "rejected")} disabled={busy} style={{ flex: 1 }}>❌ Reject</Btn>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
