/**
 * SubAdminAccountRequests.jsx
 * FOLDER: src/sub-admin/pages/SubAdminAccountRequests.jsx  (new file)
 *
 * Sub-admin submits new student/faculty account requests.
 * These go to the main admin's approval queue before the account is created.
 */
import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { approvalApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF, Toast } from "../../components/ui";
import TopBar from "../../components/TopBar";
import LMSGrid from "../../components/LMSGrid";

const emptyForm = {
  role: "student", full_name: "", username: "", email: "",
  civil_status: "Single", birthdate: "", address: "",
  year_level: "1st Year", semester: "1st Semester", password: "",
};

export default function SubAdminAccountRequests({ user }) {
  const [tab,      setTab]      = useState("submit");   // "submit" | "history"
  const [form,     setForm]     = useState(emptyForm);
  const [errors,   setErrors]   = useState({});
  const [busy,     setBusy]     = useState(false);
  const [toast,    setToast]    = useState("");
  const [history,  setHistory]  = useState([]);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    // Load this sub-admin's submitted requests
    approvalApi.getAll()
      .then(all => setHistory(all.filter(a => a.submitted_by === user._uuid || a.submitter_name === user.fullName)))
      .catch(console.error);
  }, [user]);

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = "Required";
    if (!form.username.trim())  e.username  = "Required";
    if (!form.password.trim())  e.password  = "Required";
    if (!form.birthdate)        e.birthdate = "Required";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setBusy(true);
    try {
      // Hash the password via Supabase RPC before storing in the approval record
      const { data: hash, error: hashErr } = await supabase.rpc("hash_password", { plain: form.password });
      if (hashErr || !hash) {
        setErrors({ password: "Password hashing failed." });
        setBusy(false);
        return;
      }

      const payload = {
        submitted_by:   user._uuid,
        submitter_name: user.fullName,
        role:           form.role,
        full_name:      form.full_name.trim(),
        username:       form.username.trim(),
        email:          form.email.trim() || null,
        civil_status:   form.civil_status || null,
        birthdate:      form.birthdate    || null,
        address:        form.address.trim() || null,
        year_level:     form.role === "student" ? form.year_level : null,
        semester:       form.role === "student" ? form.semester   : null,
        password_hash:  hash,
      };

      const record = await approvalApi.submit(payload);
      setHistory(prev => [record, ...prev]);
      setForm(emptyForm);
      setErrors({});
      showToast(`Request for "${payload.full_name}" submitted for main admin approval!`);
    } catch (err) {
      showToast("Error: " + err.message);
    }
    setBusy(false);
  };

  const statusColor = { pending: "warning", approved: "success", rejected: "danger" };

  const cols = [
    { field: "full_name",  header: "Full Name" },
    { field: "username",   header: "Username",   width: 120 },
    { field: "role",       header: "Role",       width: 80,
      cellRenderer: v => <Badge color={v === "student" ? "success" : "purple"}>{v}</Badge> },
    { field: "status",     header: "Status",     width: 100,
      cellRenderer: v => <Badge color={statusColor[v] || "default"}>{v}</Badge> },
    { field: "created_at", header: "Submitted",  width: 120,
      cellRenderer: v => v ? new Date(v).toLocaleDateString() : "—" },
    { field: "reviewed_at",header: "Reviewed",   width: 120,
      cellRenderer: v => v ? new Date(v).toLocaleDateString() : "—" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar
        title="Account Requests"
        subtitle={`${user.scopeRef || user.fullName} · Submit new accounts for admin approval`}
      />

      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}>
          <Toast msg={toast} />
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #334155", background: "#1e293b", padding: "0 20px", flexShrink: 0 }}>
        {[
          { id: "submit",  label: "➕ Submit New Request" },
          { id: "history", label: `📋 My Requests (${history.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: tab === t.id ? "#a5b4fc" : "#475569", borderBottom: `2px solid ${tab === t.id ? "#6366f1" : "transparent"}`, marginBottom: -1, transition: "color .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Submit form ── */}
      {tab === "submit" && (
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 14 }}>

            <div style={{ background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#fbbf24" }}>
              ⚠️ Submitted accounts require main admin approval before the account is activated.
            </div>

            {/* Role toggle */}
            <div style={{ display: "flex", background: "#0f172a", borderRadius: 8, padding: 3, border: "1px solid #334155" }}>
              {["student", "teacher"].map(r => (
                <button key={r} onClick={() => upd("role", r)}
                  style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, textTransform: "capitalize", transition: "all .15s", background: form.role === r ? "#4f46e5" : "transparent", color: form.role === r ? "#fff" : "#64748b" }}>
                  {r === "student" ? "🎓 Student" : "👩‍🏫 Teacher"}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FF label="Full Name" required error={errors.full_name}>
                <Input value={form.full_name} onChange={e => upd("full_name", e.target.value)} placeholder="e.g. John Doe" />
              </FF>
              <FF label="Username" required error={errors.username}>
                <Input value={form.username} onChange={e => upd("username", e.target.value)} placeholder="e.g. jdoe" />
              </FF>
              <FF label="Email">
                <Input type="email" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="john@school.edu" />
              </FF>
              <FF label="Initial Password" required error={errors.password}>
                <Input type="password" value={form.password} onChange={e => upd("password", e.target.value)} placeholder="Temporary password" />
              </FF>
              <FF label="Civil Status">
                <Sel value={form.civil_status} onChange={e => upd("civil_status", e.target.value)}>
                  {["Single","Married","Divorced","Widowed"].map(s => <option key={s}>{s}</option>)}
                </Sel>
              </FF>
              <FF label="Birthdate" required error={errors.birthdate}>
                <Input type="date" value={form.birthdate} onChange={e => upd("birthdate", e.target.value)} />
              </FF>
            </div>

            <FF label="Address">
              <Input value={form.address} onChange={e => upd("address", e.target.value)} placeholder="e.g. 123 Main St, City" />
            </FF>

            {form.role === "student" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FF label="Year Level">
                  <Sel value={form.year_level} onChange={e => upd("year_level", e.target.value)}>
                    {["1st Year","2nd Year","3rd Year","4th Year"].map(y => <option key={y}>{y}</option>)}
                  </Sel>
                </FF>
                <FF label="Semester">
                  <Sel value={form.semester} onChange={e => upd("semester", e.target.value)}>
                    {["1st Semester","2nd Semester","Summer"].map(s => <option key={s}>{s}</option>)}
                  </Sel>
                </FF>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <Btn onClick={submit} disabled={busy} style={{ flex: 1 }}>
                {busy ? "⏳ Submitting…" : "📤 Submit for Approval"}
              </Btn>
              <Btn variant="secondary" onClick={() => { setForm(emptyForm); setErrors({}); }}>Reset</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── History ── */}
      {tab === "history" && (
        <div style={{ flex: 1, padding: "14px 18px", overflow: "hidden", background: "#0f172a" }}>
          <LMSGrid columns={cols} rowData={history} height="100%" />
        </div>
      )}
    </div>
  );
}
