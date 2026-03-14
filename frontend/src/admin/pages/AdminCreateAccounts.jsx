/**
 * AdminCreateAccounts.jsx
 * FOLDER: src/admin/pages/AdminCreateAccounts.jsx
 *
 * Changes:
 *  - Added Program dropdown for student accounts using programApi.getOptions (NestJS)
 *  - Stores program_id in the students table on insert
 */
import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { programApi } from "../../lib/api";
import { Badge, Btn, Input, Sel, FF, Toast } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

export default function AdminCreateAccounts({ users, setUsers }) {
  const emptyForm = {
    username: "", fullName: "", email: "", civilStatus: "Single",
    birthdate: "", password: "", address: "",
    yearLevel: "1st Year", semester: "1st Semester", programId: "",
  };

  const [role,         setRole]         = useState("student");
  const [form,         setForm]         = useState(emptyForm);
  const [errors,       setErrors]       = useState({});
  const [toast,        setToast]        = useState("");
  const [sel,          setSel]          = useState(null);
  const [programOpts,  setProgramOpts]  = useState([]);

  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  // Load program options from NestJS on mount
  useEffect(() => {
    programApi.getOptions()
      .then(opts => setProgramOpts(opts ?? []))
      .catch(console.error);
  }, []);

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username  = "Required";
    if (!form.fullName.trim()) e.fullName  = "Required";
    if (!form.password.trim()) e.password  = "Required";
    if (!form.birthdate)       e.birthdate = "Required";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    // 1. Hash the password via Supabase RPC
    const { data: hashData, error: hashErr } = await supabase
      .rpc("hash_password", { plain: form.password });
    if (hashErr || !hashData) {
      setErrors({ password: "Could not hash password. Run hash_password SQL in Supabase." });
      return;
    }

    // 2. Generate display_id safely from the DB
    const prefix = role === "student" ? "STU" : "TCH";
    const { data: maxRow } = await supabase
      .from("users")
      .select("display_id")
      .eq("role", role)
      .order("display_id", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastNum   = maxRow ? parseInt(maxRow.display_id.replace(/\D/g, ""), 10) : 0;
    const nextNum   = (isNaN(lastNum) ? 0 : lastNum) + 1;
    const displayId = `${prefix}${String(nextNum).padStart(3, "0")}`;

    // 3. Insert into users table
    const { data: newUserRow, error: userErr } = await supabase
      .from("users")
      .insert({
        display_id:    displayId,
        username:      form.username.trim(),
        full_name:     form.fullName.trim(),
        email:         form.email.trim() || null,
        password_hash: hashData,
        civil_status:  form.civilStatus || null,
        birthdate:     form.birthdate   || null,
        address:       form.address.trim() || null,
        role,
      })
      .select()
      .single();

    if (userErr) {
      setErrors({ username: userErr.message.includes("username") ? "Username already taken" : userErr.message });
      return;
    }

    // 4. Insert into role subclass table (include program_id for students)
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

    // 5. Update local state
    const programName = programOpts.find(p => String(p.programId) === String(form.programId))?.name || "";
    const newUser = {
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
      password:    "",
    };
    setUsers(prev => [...prev, newUser]);
    setForm(emptyForm);
    setErrors({});
    setToast(`${role === "student" ? "Student" : "Teacher"} account created!`);
    setTimeout(() => setToast(""), 3000);
  };

  const cols = [
    { field: "id",          header: "ID",           width: 90 },
    { field: "fullName",    header: "Full Name",     width: 150 },
    { field: "username",    header: "Username",      width: 110 },
    { field: "role",        header: "Role",          width: 80,
      cellRenderer: v => <Badge color={v === "student" ? "success" : "purple"}>{v}</Badge> },
    { field: "email",       header: "Email" },
    { field: "civilStatus", header: "Civil Status",  width: 95 },
    { field: "birthdate",   header: "Birthdate",     width: 100 },
    ...(role === "student"
      ? [
          { field: "yearLevel",  header: "Year",     width: 90 },
          { field: "semester",   header: "Semester", width: 110 },
          { field: "programName",header: "Program" },
        ]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Create Accounts" subtitle="Admin · User Management" />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Create form ── */}
        <div style={{ width: 330, borderRight: "1px solid #334155", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 11, overflowY: "auto", flexShrink: 0, background: "#1e293b" }}>
          <Toast msg={toast} />

          {/* Role toggle */}
          <div style={{ display: "flex", background: "#0f172a", borderRadius: 8, padding: 3, border: "1px solid #334155" }}>
            {["student", "teacher"].map(r => (
              <button key={r} onClick={() => { setRole(r); setErrors({}); }}
                style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, textTransform: "capitalize", transition: "all .15s", background: role === r ? "#1e293b" : "transparent", color: role === r ? "#fff" : "#64748b", boxShadow: role === r ? "0 0 0 1px #6366f1" : "none" }}>
                {r === "student" ? "🎓 Student" : "👩‍🏫 Teacher"}
              </button>
            ))}
          </div>

          <FF label="Username"  required error={errors.username}><Input value={form.username} onChange={e => upd("username", e.target.value)} placeholder="e.g. jdoe" /></FF>
          <FF label="Full Name" required error={errors.fullName}><Input value={form.fullName} onChange={e => upd("fullName", e.target.value)} placeholder="e.g. John Doe" /></FF>
          <FF label="Email Address"><Input type="email" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="e.g. john@lms.edu" /></FF>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <FF label="Civil Status">
              <Sel value={form.civilStatus} onChange={e => upd("civilStatus", e.target.value)}>
                {["Single", "Married", "Divorced", "Widowed"].map(s => <option key={s}>{s}</option>)}
              </Sel>
            </FF>
            <FF label="Birthdate" required error={errors.birthdate}>
              <Input type="date" value={form.birthdate} onChange={e => upd("birthdate", e.target.value)} />
            </FF>
          </div>

          <FF label="Password" required error={errors.password}>
            <Input type="password" value={form.password} onChange={e => upd("password", e.target.value)} placeholder="Initial password" />
          </FF>

          <FF label="Address">
            <Input value={form.address} onChange={e => upd("address", e.target.value)} placeholder="e.g. 123 Main St, City" />
          </FF>

          {role === "student" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <FF label="Year Level">
                  <Sel value={form.yearLevel} onChange={e => upd("yearLevel", e.target.value)}>
                    {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => <option key={y}>{y}</option>)}
                  </Sel>
                </FF>
                <FF label="Semester">
                  <Sel value={form.semester} onChange={e => upd("semester", e.target.value)}>
                    {["1st Semester", "2nd Semester", "Summer"].map(s => <option key={s}>{s}</option>)}
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

          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <Btn onClick={submit} style={{ flex: 1 }}>✦ Create Account</Btn>
            <Btn variant="secondary" onClick={() => { setForm(emptyForm); setErrors({}); }}>Reset</Btn>
          </div>
        </div>

        {/* ── Accounts grid ── */}
        <div style={{ flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f172a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {users.filter(u => u.role !== "admin").length} Accounts Registered
            </div>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <LMSGrid
              columns={cols}
              rowData={users.filter(u => u.role !== "admin")}
              onRowClick={setSel}
              selectedId={sel?.id}
              height="100%"
            />
          </div>
        </div>

        {/* ── Detail drawer ── */}
        {sel && (
          <div style={{ width: 240, borderLeft: "1px solid #334155", background: "#1e293b", padding: "16px 14px", overflowY: "auto", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9" }}>Account Details</div>
              <button onClick={() => setSel(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#475569", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: sel.role === "student" ? "rgba(16,185,129,.15)" : "rgba(99,102,241,.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 20, fontWeight: 800, color: sel.role === "student" ? "#34d399" : "#a5b4fc" }}>
                {sel.fullName?.charAt(0)}
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#e2e8f0", marginBottom: 4 }}>{sel.fullName}</div>
              <Badge color={sel.role === "student" ? "success" : "purple"}>{sel.role}</Badge>
            </div>
            {[
              ["ID",           sel.id],
              ["Username",     sel.username],
              ["Email",        sel.email],
              ["Civil Status", sel.civilStatus],
              ["Birthdate",    sel.birthdate],
              ["Address",      sel.address],
              ["Year Level",   sel.yearLevel],
              ["Semester",     sel.semester],
              ["Program",      sel.programName],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} style={{ marginBottom: 9 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{l}</div>
                <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
