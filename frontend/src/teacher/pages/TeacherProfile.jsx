/**
 * TeacherProfile.jsx
 * FOLDER: src/teacher/pages/TeacherProfile.jsx  (replace existing)
 *
 * Change from previous version:
 *  - changePassword now calls NestJS POST /api/user/change-password
 */
import React, { useState } from "react";
import { supabase } from "../../supabaseClient";
import { userApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF, Card, Toast } from "../../components/ui";
import TopBar from "../../components/TopBar";

export default function TeacherProfile({ user, onUpdateUser }) {
  const [editing,  setEditing]  = useState(false);
  const [form,     setForm]     = useState({ ...user });
  const [pwForm,   setPwForm]   = useState({ current: "", next: "", confirm: "" });
  const [pwErr,    setPwErr]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [toast,    setToast]    = useState("");
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const startEditing  = () => { setForm({ ...user }); setEditing(true); };
  const cancelEditing = () => { setForm({ ...user }); setEditing(false); };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("users").update({
      full_name:    form.fullName    || null,
      username:     form.username    || null,
      email:        form.email       || null,
      civil_status: form.civilStatus || null,
      birthdate:    form.birthdate   || null,
      address:      form.address     || null,
    }).eq("user_id", user._uuid);
    if (error) { showToast("Error: " + error.message); setSaving(false); return; }
    onUpdateUser({ ...user, ...form });
    setEditing(false); setSaving(false);
    showToast("Profile updated!");
  };

  // Uses NestJS POST /api/user/change-password
  const changePassword = async () => {
    setPwErr("");
    if (!pwForm.current)               { setPwErr("Enter your current password."); return; }
    if (pwForm.next.length < 6)        { setPwErr("New password must be at least 6 characters."); return; }
    if (pwForm.next !== pwForm.confirm) { setPwErr("New passwords do not match."); return; }

    setPwSaving(true);
    try {
      await userApi.changePassword(user.username, pwForm.current, pwForm.next);
      setPwForm({ current: "", next: "", confirm: "" });
      showToast("Password changed successfully!");
    } catch (err) {
      setPwErr(err.message || "Failed to change password.");
    }
    setPwSaving(false);
  };

  const fieldVal = (f, type) => editing
    ? <Input type={type} value={form[f] || ""} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
    : <div style={{ padding: "8px 10px", background: "#0f172a", borderRadius: 6, border: "1px solid #334155", fontSize: 13, color: "#cbd5e1", minHeight: 35 }}>{user[f] || <span style={{ color: "#475569" }}>—</span>}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="My Profile" subtitle="Teacher · Account Settings"
        actions={editing
          ? <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" onClick={cancelEditing} disabled={saving}>✕ Cancel</Btn>
              <Btn variant="success"   onClick={save}          disabled={saving}>{saving ? "⏳ Saving…" : "✓ Save Changes"}</Btn>
            </div>
          : <Btn variant="secondary" onClick={startEditing}>✏ Edit Profile</Btn>}
      />
      <div style={{ flex: 1, padding: "20px 22px", overflowY: "auto", display: "flex", gap: 18 }}>
        {/* Sidebar */}
        <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <Card style={{ textAlign: "center", padding: "22px 16px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(99,102,241,.15)", border: "3px solid #6366f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 26, fontWeight: 900, color: "#a5b4fc" }}>
              {user.fullName?.charAt(0)}
            </div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#e2e8f0", marginBottom: 4 }}>{user.fullName}</div>
            <Badge color="purple">Teacher</Badge>
            <div style={{ marginTop: 10, fontSize: 11, color: "#475569" }}>{user.id}</div>
          </Card>
          {toast && <Toast msg={toast} />}
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#e2e8f0", marginBottom: 16 }}>Personal Information</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FF label="Full Name">{fieldVal("fullName")}</FF>
              <FF label="Username">{fieldVal("username")}</FF>
              <FF label="Email">{fieldVal("email")}</FF>
              <FF label="Civil Status">
                {editing
                  ? <Sel value={form.civilStatus || ""} onChange={e => setForm(p => ({ ...p, civilStatus: e.target.value }))}>
                      {["Single","Married","Divorced","Widowed"].map(s => <option key={s}>{s}</option>)}
                    </Sel>
                  : <div style={{ padding: "8px 10px", background: "#0f172a", borderRadius: 6, border: "1px solid #334155", fontSize: 13, color: "#cbd5e1", minHeight: 35 }}>{user.civilStatus || <span style={{ color: "#475569" }}>—</span>}</div>}
              </FF>
              <FF label="Birthdate">{fieldVal("birthdate", "date")}</FF>
            </div>
            <div style={{ marginTop: 14 }}>
              <FF label="Address">
                {editing
                  ? <Input value={form.address || ""} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="e.g. 123 Main St, City" />
                  : <div style={{ padding: "8px 10px", background: "#0f172a", borderRadius: 6, border: "1px solid #334155", fontSize: 13, color: "#cbd5e1", minHeight: 35 }}>{user.address || <span style={{ color: "#475569" }}>—</span>}</div>}
              </FF>
            </div>
          </Card>

          {/* Change Password — now uses NestJS backend */}
          <Card>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#e2e8f0", marginBottom: 4 }}>🔒 Change Password</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
              Your password is verified and updated securely on the server.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <FF label="Current Password">
                <Input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} placeholder="Current password" />
              </FF>
              <FF label="New Password">
                <Input type="password" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} placeholder="Min. 6 characters" />
              </FF>
              <FF label="Confirm New Password">
                <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat new password" />
              </FF>
            </div>
            {pwErr && <div style={{ marginTop: 8, fontSize: 12, color: "#f87171", fontWeight: 700 }}>⚠ {pwErr}</div>}
            <div style={{ marginTop: 12 }}>
              <Btn onClick={changePassword} disabled={pwSaving} variant="secondary">
                {pwSaving ? "⏳ Saving…" : "🔒 Update Password"}
              </Btn>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
