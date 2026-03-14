/**
 * AdminViewAccounts.jsx
 * FOLDER: src/admin/pages/AdminViewAccounts.jsx
 *
 * Features:
 *  - View all student / teacher accounts in a searchable grid
 *  - Detail drawer on row click
 *  - ✏️ Edit Profile — modal to update any user's details (users + students tables)
 *  - 🔑 Change Password — modal using Supabase hash_password RPC
 *  - 🔴/🟢 Deactivate / Reactivate account
 */
import React, { useState } from "react";
import { supabase } from "../../supabaseClient";
import { userApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

const CIVIL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];
const YEAR_LEVELS    = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const SEMESTERS      = ["1st Semester", "2nd Semester", "Summer"];

// ─── Shared field display helper ─────────────────────────────────────────────
const Field = ({ label, value }) => (
  <div style={{ marginBottom: 9 }}>
    <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
    <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>{value || <span style={{ color: "#334155" }}>—</span>}</div>
  </div>
);

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
function EditProfileModal({ target, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName:    target.fullName    || "",
    username:    target.username    || "",
    email:       target.email       || "",
    civilStatus: target.civilStatus || "Single",
    birthdate:   target.birthdate   || "",
    address:     target.address     || "",
    yearLevel:   target.yearLevel   || "1st Year",
    semester:    target.semester    || "1st Semester",
  });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    setErr("");
    if (!form.fullName.trim()) { setErr("Full name is required."); return; }
    if (!form.username.trim()) { setErr("Username is required."); return; }

    setBusy(true);
    try {
      // Update users table
      const { error: uErr } = await supabase
        .from("users")
        .update({
          full_name:    form.fullName.trim(),
          username:     form.username.trim(),
          email:        form.email.trim() || null,
          civil_status: form.civilStatus  || null,
          birthdate:    form.birthdate    || null,
          address:      form.address.trim() || null,
          updated_at:   new Date().toISOString(),
        })
        .eq("user_id", target._uuid);

      if (uErr) throw new Error(uErr.message.includes("username") ? "Username already taken." : uErr.message);

      // Update students table if student
      if (target.role === "student") {
        const { error: sErr } = await supabase
          .from("students")
          .update({
            year_level: form.yearLevel,
            semester:   form.semester,
          })
          .eq("user_id", target._uuid);

        if (sErr) throw new Error(sErr.message);
      }

      // Return updated user object to parent
      const updated = {
        ...target,
        fullName:    form.fullName.trim(),
        username:    form.username.trim(),
        email:       form.email.trim(),
        civilStatus: form.civilStatus,
        birthdate:   form.birthdate,
        address:     form.address.trim(),
        yearLevel:   form.yearLevel,
        semester:    form.semester,
      };
      onSaved(updated);
    } catch (e) {
      setErr(e.message || "Save failed.");
    }
    setBusy(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: "24px 26px", width: 520, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>✏️ Edit Profile</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {target.id} · <Badge color={target.role === "student" ? "success" : "purple"}>{target.role}</Badge>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Form */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FF label="Full Name" required>
            <Input value={form.fullName} onChange={e => upd("fullName", e.target.value)} placeholder="e.g. John Doe" />
          </FF>
          <FF label="Username" required>
            <Input value={form.username} onChange={e => upd("username", e.target.value)} placeholder="e.g. jdoe" />
          </FF>
          <FF label="Email">
            <Input type="email" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="e.g. john@school.edu" />
          </FF>
          <FF label="Civil Status">
            <Sel value={form.civilStatus} onChange={e => upd("civilStatus", e.target.value)}>
              {CIVIL_STATUSES.map(s => <option key={s}>{s}</option>)}
            </Sel>
          </FF>
          <FF label="Birthdate">
            <Input type="date" value={form.birthdate} onChange={e => upd("birthdate", e.target.value)} />
          </FF>
        </div>

        <FF label="Address">
          <Input value={form.address} onChange={e => upd("address", e.target.value)} placeholder="e.g. 123 Main St, City" />
        </FF>

        {/* Student-only fields */}
        {target.role === "student" && (
          <>
            <div style={{ borderTop: "1px solid #334155", paddingTop: 12, fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Academic Info
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FF label="Year Level">
                <Sel value={form.yearLevel} onChange={e => upd("yearLevel", e.target.value)}>
                  {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
                </Sel>
              </FF>
              <FF label="Semester">
                <Sel value={form.semester} onChange={e => upd("semester", e.target.value)}>
                  {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                </Sel>
              </FF>
            </div>
          </>
        )}

        {err && (
          <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#f87171", fontWeight: 700 }}>
            ⚠ {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={busy}>
            {busy ? "⏳ Saving…" : "✓ Save Changes"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────
function ChangePasswordModal({ target, onClose, onSuccess }) {
  const [useDefault,  setUseDefault]  = useState(true);
  const [newPw,       setNewPw]       = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [busy,        setBusy]        = useState(false);
  const [err,         setErr]         = useState("");

  const handleSave = async () => {
    setErr("");
    if (!useDefault) {
      if (newPw.length < 6)    { setErr("Password must be at least 6 characters."); return; }
      if (newPw !== confirmPw) { setErr("Passwords do not match."); return; }
    }
    setBusy(true);
    try {
      await userApi.resetPassword(target.username, useDefault ? undefined : newPw);
      onSuccess(`Password for "${target.username}" has been reset.`);
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
              {target.fullName} · <span style={{ color: "#a5b4fc" }}>{target.username}</span>
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
            Password reset to <code style={{ background: "#0f172a", padding: "1px 5px", borderRadius: 4 }}>Welcome@123</code>. User should change it on next login.
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

// ─── AdminViewAccounts ────────────────────────────────────────────────────────
export default function AdminViewAccounts({ users, setUsers }) {
  const [filterRole, setFilterRole] = useState("all");
  const [sel,        setSel]        = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [pwTarget,   setPwTarget]   = useState(null);
  const [toast,      setToast]      = useState("");

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };

  const data = users.filter(u =>
    u.role !== "admin" && (filterRole === "all" || u.role === filterRole)
  );

  const toggleActive = async (row) => {
    const next = row.isActive === false;
    const { error } = await supabase.from("users").update({ is_active: next }).eq("user_id", row._uuid);
    if (error) { showToast("Error: " + error.message); return; }
    setUsers(prev => prev.map(u => u._uuid === row._uuid ? { ...u, isActive: next } : u));
    if (sel?._uuid === row._uuid) setSel(s => ({ ...s, isActive: next }));
    showToast(next ? "Account activated." : "Account deactivated.");
  };

  // Called by EditProfileModal when save succeeds
  const handleSaved = (updated) => {
    setUsers(prev => prev.map(u => u._uuid === updated._uuid ? updated : u));
    setSel(updated);
    setEditTarget(null);
    showToast("Profile updated successfully.");
  };

  const cols = [
    { field: "id",          header: "ID",          width: 90 },
    { field: "fullName",    header: "Full Name",    width: 150 },
    { field: "username",    header: "Username",     width: 110 },
    { field: "role",        header: "Role",         width: 80,
      cellRenderer: v => <Badge color={v === "student" ? "success" : "purple"}>{v}</Badge> },
    { field: "email",       header: "Email" },
    { field: "civilStatus", header: "Civil Status", width: 95 },
    { field: "birthdate",   header: "Birthdate",    width: 100 },
    { field: "yearLevel",   header: "Year",         width: 90 },
    { field: "semester",    header: "Semester",     width: 110 },
    { field: "isActive",    header: "Status",       width: 85,
      cellRenderer: v => <Badge color={v !== false ? "success" : "danger"}>{v !== false ? "Active" : "Inactive"}</Badge> },
    { field: "_uuid",       header: "Actions",      width: 185, sortable: false,
      cellRenderer: (_, row) => (
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          <Btn size="sm" variant="secondary" onClick={() => setEditTarget(row)}>✏️ Edit</Btn>
          <Btn size="sm" variant="secondary" onClick={() => setPwTarget(row)}>🔑</Btn>
          {row.isActive !== false
            ? <Btn size="sm" variant="danger"  onClick={() => toggleActive(row)}>Off</Btn>
            : <Btn size="sm" variant="success" onClick={() => toggleActive(row)}>On</Btn>
          }
        </div>
      )},
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: "rgba(16,185,129,.15)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 8, padding: "9px 14px", color: "#34d399", fontSize: 13, fontWeight: 600 }}>
          ✓ {toast}
        </div>
      )}

      {/* Modals */}
      {editTarget && (
        <EditProfileModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
      {pwTarget && (
        <ChangePasswordModal
          target={pwTarget}
          onClose={() => setPwTarget(null)}
          onSuccess={(msg) => { showToast(msg); setPwTarget(null); }}
        />
      )}

      <TopBar
        title="Account Directory"
        subtitle="Admin · View, edit & manage all accounts"
        actions={
          <div style={{ display: "flex", background: "#0f172a", borderRadius: 7, padding: 3, border: "1px solid #334155" }}>
            {["all", "student", "teacher"].map(r => (
              <button key={r} onClick={() => setFilterRole(r)}
                style={{ padding: "5px 14px", borderRadius: 5, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, textTransform: "capitalize", background: filterRole === r ? "#4f46e5" : "transparent", color: filterRole === r ? "#fff" : "#475569", transition: "all .15s" }}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Grid */}
        <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, flexShrink: 0 }}>
            {data.length} account{data.length !== 1 ? "s" : ""}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <LMSGrid columns={cols} rowData={data} onRowClick={setSel} selectedId={sel?.id} height="100%" />
          </div>
        </div>

        {/* Detail drawer */}
        {sel && (
          <div style={{ width: 270, borderLeft: "1px solid #334155", background: "#1e293b", padding: "16px 14px", overflowY: "auto", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9" }}>Account Details</div>
              <button onClick={() => setSel(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#475569", fontSize: 18 }}>×</button>
            </div>

            {/* Avatar */}
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: sel.role === "student" ? "rgba(16,185,129,.15)" : "rgba(99,102,241,.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 22, fontWeight: 800, color: sel.role === "student" ? "#34d399" : "#a5b4fc" }}>
                {sel.fullName?.charAt(0)}
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#e2e8f0", marginBottom: 6 }}>{sel.fullName}</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                <Badge color={sel.role === "student" ? "success" : "purple"}>{sel.role}</Badge>
                <Badge color={sel.isActive !== false ? "success" : "danger"}>{sel.isActive !== false ? "Active" : "Inactive"}</Badge>
              </div>
            </div>

            {/* Fields */}
            <Field label="ID"           value={sel.id} />
            <Field label="Username"     value={sel.username} />
            <Field label="Email"        value={sel.email} />
            <Field label="Civil Status" value={sel.civilStatus} />
            <Field label="Birthdate"    value={sel.birthdate} />
            <Field label="Address"      value={sel.address} />
            {sel.role === "student" && <>
              <Field label="Year Level" value={sel.yearLevel} />
              <Field label="Semester"   value={sel.semester} />
            </>}

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid #334155" }}>
              <Btn onClick={() => setEditTarget(sel)} style={{ width: "100%" }}>
                ✏️ Edit Profile
              </Btn>
              <Btn variant="secondary" onClick={() => setPwTarget(sel)} style={{ width: "100%" }}>
                🔑 Change Password
              </Btn>
              {sel.isActive !== false
                ? <Btn variant="danger"  onClick={() => toggleActive(sel)} style={{ width: "100%" }}>🔴 Deactivate Account</Btn>
                : <Btn variant="success" onClick={() => toggleActive(sel)} style={{ width: "100%" }}>🟢 Reactivate Account</Btn>
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
