/**
 * AdminAccounts.jsx
 * FOLDER: src/admin/pages/AdminAccounts.jsx  (new — replaces AdminCreateAccounts + AdminViewAccounts)
 *
 * Single unified account management page:
 *  LEFT PANE  — Create new account (blank form) OR edit existing (populated on row click)
 *  RIGHT PANE — Searchable grid of all student + teacher accounts only
 *               (admin / sub_admin accounts are excluded)
 *
 *  Clicking a row populates the left pane for editing — no popup drawer.
 *  Clicking "New Account" resets the pane back to create mode.
 *
 *  Features:
 *   ✦ Create student / teacher accounts
 *   ✏️ Edit any account details (users + students tables)
 *   🔑 Change / reset password inline in the left pane
 *   🔴/🟢 Deactivate / Reactivate from the left pane
 *   🔍 Filter grid by role
 */
import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { programApi, userApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF, Toast } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

// ─── Constants ────────────────────────────────────────────────────────────────
const CIVIL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];
const YEAR_LEVELS    = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const SEMESTERS      = ["1st Semester", "2nd Semester", "Summer"];

const emptyForm = {
  username: "", fullName: "", email: "", civilStatus: "Single",
  birthdate: "", password: "", address: "",
  yearLevel: "1st Year", semester: "1st Semester", programId: "",
};

// ─── Section header inside left pane ─────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", paddingTop: 6 }}>
    {children}
  </div>
);

// ─── AdminAccounts ────────────────────────────────────────────────────────────
export default function AdminAccounts({ users, setUsers }) {
  // "create" = blank new-account form | "edit" = editing existing user
  const [mode,        setMode]        = useState("create");
  const [role,        setRole]        = useState("student");
  const [form,        setForm]        = useState(emptyForm);
  const [editTarget,  setEditTarget]  = useState(null);   // the user being edited
  const [errors,      setErrors]      = useState({});
  const [toast,       setToast]       = useState({ msg: "", type: "success" });
  const [filterRole,  setFilterRole]  = useState("all");
  const [selId,       setSelId]       = useState(null);   // highlighted row id
  const [programOpts, setProgramOpts] = useState([]);

  // Password section inside left pane (edit mode only)
  const [pwOpen,      setPwOpen]      = useState(false);
  const [pwDefault,   setPwDefault]   = useState(true);
  const [newPw,       setNewPw]       = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [pwBusy,      setPwBusy]      = useState(false);

  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  };

  // Load program options (NestJS)
  useEffect(() => {
    programApi.getOptions()
      .then(opts => setProgramOpts(opts ?? []))
      .catch(console.error);
  }, []);

  // Only show student + teacher accounts
  const gridData = users.filter(u =>
    (u.role === "student" || u.role === "teacher") &&
    (filterRole === "all" || u.role === filterRole)
  );

  // ── Row click → populate left pane for editing ─────────────────────────────
  const handleRowClick = (row) => {
    setMode("edit");
    setEditTarget(row);
    setSelId(row.id);
    setRole(row.role);
    setForm({
      username:    row.username    || "",
      fullName:    row.fullName    || "",
      email:       row.email       || "",
      civilStatus: row.civilStatus || "Single",
      birthdate:   row.birthdate   || "",
      password:    "",
      address:     row.address     || "",
      yearLevel:   row.yearLevel   || "1st Year",
      semester:    row.semester    || "1st Semester",
      programId:   row.programId   ? String(row.programId) : "",
    });
    setErrors({});
    setPwOpen(false);
    setNewPw(""); setConfirmPw(""); setPwDefault(true);
  };

  // ── Reset to create mode ───────────────────────────────────────────────────
  const resetToCreate = () => {
    setMode("create");
    setEditTarget(null);
    setSelId(null);
    setRole("student");
    setForm(emptyForm);
    setErrors({});
    setPwOpen(false);
    setNewPw(""); setConfirmPw("");
  };

  // ── Validate shared fields ─────────────────────────────────────────────────
  const validate = (isCreate) => {
    const e = {};
    if (!form.username.trim()) e.username = "Required";
    if (!form.fullName.trim()) e.fullName = "Required";
    if (isCreate && !form.password.trim()) e.password = "Required";
    if (isCreate && !form.birthdate)       e.birthdate = "Required";
    return e;
  };

  // ── CREATE ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const e = validate(true);
    if (Object.keys(e).length) { setErrors(e); return; }

    const { data: hashData, error: hashErr } = await supabase
      .rpc("hash_password", { plain: form.password });
    if (hashErr || !hashData) {
      setErrors({ password: "Could not hash password." }); return;
    }

    const prefix = role === "student" ? "STU" : "TCH";
    const { data: maxRow } = await supabase.from("users")
      .select("display_id").eq("role", role)
      .order("display_id", { ascending: false }).limit(1).maybeSingle();
    const lastNum   = maxRow ? parseInt(maxRow.display_id.replace(/\D/g, ""), 10) : 0;
    const nextNum   = (isNaN(lastNum) ? 0 : lastNum) + 1;
    const displayId = `${prefix}${String(nextNum).padStart(3, "0")}`;

    const { data: newUserRow, error: userErr } = await supabase.from("users").insert({
      display_id:    displayId,
      username:      form.username.trim(),
      full_name:     form.fullName.trim(),
      email:         form.email.trim() || null,
      password_hash: hashData,
      civil_status:  form.civilStatus || null,
      birthdate:     form.birthdate   || null,
      address:       form.address.trim() || null,
      role,
    }).select().single();

    if (userErr) {
      setErrors({ username: userErr.message.includes("username") ? "Username already taken" : userErr.message });
      return;
    }

    if (role === "student") {
      await supabase.from("students").insert({
        user_id:    newUserRow.user_id,
        year_level: form.yearLevel,
        semester:   form.semester,
        program_id: form.programId ? Number(form.programId) : null,
      });
    } else {
      await supabase.from("teachers").insert({ user_id: newUserRow.user_id });
    }

    const programName = programOpts.find(p => String(p.programId) === form.programId)?.name || "";
    const newUser = {
      _uuid:       newUserRow.user_id,
      id:          displayId,
      username:    form.username.trim(),
      fullName:    form.fullName.trim(),
      email:       form.email.trim(),
      civilStatus: form.civilStatus,
      birthdate:   form.birthdate,
      address:     form.address.trim(),
      role,
      yearLevel:   form.yearLevel,
      semester:    form.semester,
      programName,
      isActive:    true,
    };
    setUsers(prev => [...prev, newUser]);
    setForm(emptyForm);
    setErrors({});
    showToast(`${role === "student" ? "Student" : "Teacher"} account created!`);
  };

  // ── SAVE EDIT ──────────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    const e = validate(false);
    if (Object.keys(e).length) { setErrors(e); return; }

    const { error: uErr } = await supabase.from("users").update({
      full_name:    form.fullName.trim(),
      username:     form.username.trim(),
      email:        form.email.trim() || null,
      civil_status: form.civilStatus  || null,
      birthdate:    form.birthdate    || null,
      address:      form.address.trim() || null,
      updated_at:   new Date().toISOString(),
    }).eq("user_id", editTarget._uuid);

    if (uErr) {
      setErrors({ username: uErr.message.includes("username") ? "Username already taken" : uErr.message });
      return;
    }

    if (editTarget.role === "student") {
      await supabase.from("students").update({
        year_level: form.yearLevel,
        semester:   form.semester,
      }).eq("user_id", editTarget._uuid);
    }

    const programName = programOpts.find(p => String(p.programId) === form.programId)?.name || editTarget.programName || "";
    const updated = { ...editTarget, ...form, fullName: form.fullName.trim(), username: form.username.trim(), email: form.email.trim(), address: form.address.trim(), programName };
    setUsers(prev => prev.map(u => u._uuid === editTarget._uuid ? updated : u));
    setEditTarget(updated);
    showToast("Profile updated successfully.");
  };

  // ── TOGGLE ACTIVE ──────────────────────────────────────────────────────────
  const handleToggleActive = async () => {
    const next = editTarget.isActive === false;
    const { error } = await supabase.from("users").update({ is_active: next }).eq("user_id", editTarget._uuid);
    if (error) { showToast(error.message, "error"); return; }
    const updated = { ...editTarget, isActive: next };
    setUsers(prev => prev.map(u => u._uuid === editTarget._uuid ? updated : u));
    setEditTarget(updated);
    showToast(next ? "Account activated." : "Account deactivated.");
  };

  // ── RESET PASSWORD (inline in left pane) ───────────────────────────────────
  const handlePasswordReset = async () => {
    if (!pwDefault) {
      if (newPw.length < 6)    { showToast("Password must be at least 6 characters.", "error"); return; }
      if (newPw !== confirmPw) { showToast("Passwords do not match.", "error"); return; }
    }
    setPwBusy(true);
    try {
      await userApi.resetPassword(editTarget.username, pwDefault ? undefined : newPw);
      showToast("Password reset successfully.");
      setPwOpen(false);
      setNewPw(""); setConfirmPw(""); setPwDefault(true);
    } catch (e) {
      showToast(e.message || "Reset failed.", "error");
    }
    setPwBusy(false);
  };

  // ── Grid columns ───────────────────────────────────────────────────────────
  const cols = [
    { field: "id",          header: "ID",          width: 90 },
    { field: "fullName",    header: "Full Name",    width: 150 },
    { field: "username",    header: "Username",     width: 110 },
    { field: "role",        header: "Role",         width: 80,
      cellRenderer: v => <Badge color={v === "student" ? "success" : "purple"}>{v}</Badge> },
    { field: "email",       header: "Email" },
    { field: "civilStatus", header: "Civil Status", width: 95 },
    { field: "birthdate",   header: "Birthdate",    width: 100 },
    { field: "yearLevel",   header: "Year",         width: 80 },
    { field: "semester",    header: "Semester",     width: 110 },
    { field: "isActive",    header: "Status",       width: 85,
      cellRenderer: v => <Badge color={v !== false ? "success" : "danger"}>{v !== false ? "Active" : "Inactive"}</Badge> },
  ];

  const isCreate = mode === "create";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Toast */}
      {toast.msg && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 9999,
          background: toast.type === "error" ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)",
          border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`,
          borderRadius: 8, padding: "9px 14px",
          color: toast.type === "error" ? "#f87171" : "#34d399",
          fontSize: 13, fontWeight: 600,
        }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      <TopBar
        title="Account Management"
        subtitle={`Admin · ${gridData.length} student & teacher account${gridData.length !== 1 ? "s" : ""}`}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Role filter */}
            <div style={{ display: "flex", background: "#0f172a", borderRadius: 7, padding: 3, border: "1px solid #334155" }}>
              {["all", "student", "teacher"].map(r => (
                <button key={r} onClick={() => setFilterRole(r)}
                  style={{ padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, textTransform: "capitalize", background: filterRole === r ? "#4f46e5" : "transparent", color: filterRole === r ? "#fff" : "#475569", transition: "all .15s" }}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            {!isCreate && (
              <Btn onClick={resetToCreate}>➕ New Account</Btn>
            )}
          </div>
        }
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── LEFT PANE ─────────────────────────────────────────────────────── */}
        <div style={{ width: 340, borderRight: "1px solid #334155", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flexShrink: 0, background: "#1e293b" }}>

          {/* Pane header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9" }}>
                {isCreate ? "✦ New Account" : "✏️ Edit Account"}
              </div>
              {!isCreate && editTarget && (
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                  {editTarget.id} ·{" "}
                  <Badge color={editTarget.role === "student" ? "success" : "purple"}>{editTarget.role}</Badge>
                  {" "}
                  <Badge color={editTarget.isActive !== false ? "success" : "danger"}>
                    {editTarget.isActive !== false ? "Active" : "Inactive"}
                  </Badge>
                </div>
              )}
            </div>
            {!isCreate && (
              <button onClick={resetToCreate}
                style={{ background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
                title="Back to create">
                ×
              </button>
            )}
          </div>

          {/* Role toggle — only in create mode */}
          {isCreate && (
            <div style={{ display: "flex", background: "#0f172a", borderRadius: 8, padding: 3, border: "1px solid #334155" }}>
              {["student", "teacher"].map(r => (
                <button key={r} onClick={() => { setRole(r); setErrors({}); }}
                  style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, transition: "all .15s", background: role === r ? "#1e293b" : "transparent", color: role === r ? "#fff" : "#64748b", boxShadow: role === r ? "0 0 0 1px #6366f1" : "none" }}>
                  {r === "student" ? "🎓 Student" : "👩‍🏫 Teacher"}
                </button>
              ))}
            </div>
          )}

          {/* ── Personal info fields ── */}
          <SectionLabel>Personal Info</SectionLabel>

          <FF label="Full Name" required error={errors.fullName}>
            <Input value={form.fullName} onChange={e => upd("fullName", e.target.value)} placeholder="e.g. John Doe" />
          </FF>
          <FF label="Username" required error={errors.username}>
            <Input value={form.username} onChange={e => upd("username", e.target.value)} placeholder="e.g. jdoe" />
          </FF>
          <FF label="Email">
            <Input type="email" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="e.g. john@school.edu" />
          </FF>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <FF label="Civil Status">
              <Sel value={form.civilStatus} onChange={e => upd("civilStatus", e.target.value)}>
                {CIVIL_STATUSES.map(s => <option key={s}>{s}</option>)}
              </Sel>
            </FF>
            <FF label="Birthdate" required={isCreate} error={errors.birthdate}>
              <Input type="date" value={form.birthdate} onChange={e => upd("birthdate", e.target.value)} />
            </FF>
          </div>

          <FF label="Address">
            <Input value={form.address} onChange={e => upd("address", e.target.value)} placeholder="e.g. 123 Main St, City" />
          </FF>

          {/* ── Password field — create mode only ── */}
          {isCreate && (
            <>
              <SectionLabel>Security</SectionLabel>
              <FF label="Password" required error={errors.password}>
                <Input type="password" value={form.password} onChange={e => upd("password", e.target.value)} placeholder="Initial password" />
              </FF>
            </>
          )}

          {/* ── Student academic info ── */}
          {(role === "student" || (!isCreate && editTarget?.role === "student")) && (
            <>
              <SectionLabel>Academic Info</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
              <FF label="Program">
                <Sel value={form.programId} onChange={e => upd("programId", e.target.value)}>
                  <option value="">— No Program —</option>
                  {programOpts.map(p => (
                    <option key={p.programId} value={p.programId}>{p.code} — {p.name}</option>
                  ))}
                </Sel>
              </FF>
            </>
          )}

          {/* ── Create / Save buttons ── */}
          <div style={{ display: "flex", gap: 8, paddingTop: 2 }}>
            {isCreate ? (
              <>
                <Btn onClick={handleCreate} style={{ flex: 1 }}>✦ Create Account</Btn>
                <Btn variant="secondary" onClick={() => { setForm(emptyForm); setErrors({}); }}>Reset</Btn>
              </>
            ) : (
              <Btn onClick={handleSaveEdit} style={{ flex: 1 }}>✓ Save Changes</Btn>
            )}
          </div>

          {/* ── Edit-mode only: password reset + deactivate ── */}
          {!isCreate && editTarget && (
            <>
              {/* Divider */}
              <div style={{ borderTop: "1px solid #334155", margin: "4px 0" }} />

              {/* Password reset toggle */}
              <button onClick={() => setPwOpen(o => !o)}
                style={{ background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#a5b4fc", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                🔑 Change Password
                <span style={{ fontSize: 11, color: "#475569" }}>{pwOpen ? "▲ collapse" : "▼ expand"}</span>
              </button>

              {pwOpen && (
                <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Default / custom toggle */}
                  <div style={{ display: "flex", background: "#1e293b", borderRadius: 6, padding: 2, border: "1px solid #334155" }}>
                    {[{ id: true, label: "Default (Welcome@123)" }, { id: false, label: "Custom" }].map(opt => (
                      <button key={String(opt.id)} onClick={() => { setPwDefault(opt.id); setNewPw(""); setConfirmPw(""); }}
                        style={{ flex: 1, padding: "5px 8px", borderRadius: 5, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, transition: "all .15s", background: pwDefault === opt.id ? "#4f46e5" : "transparent", color: pwDefault === opt.id ? "#fff" : "#64748b" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {!pwDefault && (
                    <>
                      <FF label="New Password">
                        <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 6 characters" />
                      </FF>
                      <FF label="Confirm Password">
                        <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat password" />
                      </FF>
                    </>
                  )}

                  <Btn onClick={handlePasswordReset} disabled={pwBusy} variant="secondary">
                    {pwBusy ? "⏳ Resetting…" : "🔑 Reset Password"}
                  </Btn>
                </div>
              )}

              {/* Deactivate / Reactivate */}
              {editTarget.isActive !== false
                ? <Btn variant="danger"  onClick={handleToggleActive} style={{ width: "100%" }}>🔴 Deactivate Account</Btn>
                : <Btn variant="success" onClick={handleToggleActive} style={{ width: "100%" }}>🟢 Reactivate Account</Btn>
              }
            </>
          )}
        </div>

        {/* ── RIGHT PANE — grid ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
            {gridData.length} account{gridData.length !== 1 ? "s" : ""}
            {!isCreate && (
              <span style={{ marginLeft: 10, color: "#6366f1", fontWeight: 600, fontSize: 10 }}>
                ← editing {editTarget?.fullName}
              </span>
            )}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <LMSGrid
              columns={cols}
              rowData={gridData}
              onRowClick={handleRowClick}
              selectedId={selId}
              height="100%"
            />
          </div>
          <div style={{ fontSize: 11, color: "#334155", flexShrink: 0 }}>
            💡 Click any row to edit that account in the left pane
          </div>
        </div>
      </div>
    </div>
  );
}
