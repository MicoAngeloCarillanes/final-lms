/**
 * AdminViewAccounts.jsx
 * FOLDER: src/admin/pages/AdminViewAccounts.jsx
 *
 * Changes:
 *  - Added "Status" column (active / inactive)
 *  - Added deactivate / reactivate action buttons per row
 *  - Detail drawer now shows active status with toggle button
 */
import React, { useState } from "react";
import { supabase } from "../../supabaseClient";
import { Badge, Btn } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

export default function AdminViewAccounts({ users, setUsers }) {
  const [filterRole, setFilterRole] = useState("all");
  const [sel,        setSel]        = useState(null);
  const [toast,      setToast]      = useState("");

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const data = users.filter(u =>
    u.role !== "admin" && (filterRole === "all" || u.role === filterRole)
  );

  // Toggle active status via Supabase
  const toggleActive = async (row) => {
    const nextActive = row.isActive === false ? true : false;
    const { error } = await supabase
      .from("users")
      .update({ is_active: nextActive })
      .eq("user_id", row._uuid);

    if (error) { showToast("Error: " + error.message); return; }

    setUsers(prev => prev.map(u =>
      u._uuid === row._uuid ? { ...u, isActive: nextActive } : u
    ));
    if (sel?._uuid === row._uuid) setSel(s => ({ ...s, isActive: nextActive }));
    showToast(nextActive ? "Account activated." : "Account deactivated.");
  };

  const cols = [
    { field: "id",          header: "ID",           width: 90 },
    { field: "fullName",    header: "Full Name",     width: 160 },
    { field: "username",    header: "Username",      width: 110 },
    { field: "role",        header: "Role",          width: 80,
      cellRenderer: v => <Badge color={v === "student" ? "success" : "purple"}>{v}</Badge> },
    { field: "email",       header: "Email" },
    { field: "civilStatus", header: "Civil Status",  width: 95 },
    { field: "birthdate",   header: "Birthdate",     width: 100 },
    { field: "yearLevel",   header: "Year",          width: 90 },
    { field: "semester",    header: "Semester",      width: 110 },
    { field: "isActive",    header: "Status",        width: 90,
      cellRenderer: v => (
        <Badge color={v !== false ? "success" : "danger"}>
          {v !== false ? "Active" : "Inactive"}
        </Badge>
      )},
    { field: "_uuid",       header: "Actions",       width: 120, sortable: false,
      cellRenderer: (_, row) => (
        <div onClick={e => e.stopPropagation()}>
          {row.isActive !== false
            ? <Btn size="sm" variant="danger"  onClick={() => toggleActive(row)}>Deactivate</Btn>
            : <Btn size="sm" variant="success" onClick={() => toggleActive(row)}>Reactivate</Btn>
          }
        </div>
      )},
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: "rgba(16,185,129,.15)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 8, padding: "9px 14px", color: "#34d399", fontSize: 13, fontWeight: 600 }}>
          ✓ {toast}
        </div>
      )}

      <TopBar
        title="Account Directory"
        subtitle="Admin · View, search, and manage all accounts"
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
          <div style={{ width: 260, borderLeft: "1px solid #334155", background: "#1e293b", padding: "16px 14px", overflowY: "auto", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9" }}>Account Details</div>
              <button onClick={() => setSel(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#475569", fontSize: 18 }}>×</button>
            </div>

            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: sel.role === "student" ? "rgba(16,185,129,.15)" : "rgba(99,102,241,.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 22, fontWeight: 800, color: sel.role === "student" ? "#34d399" : "#a5b4fc" }}>
                {sel.fullName?.charAt(0)}
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#e2e8f0", marginBottom: 4 }}>{sel.fullName}</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                <Badge color={sel.role === "student" ? "success" : "purple"}>{sel.role}</Badge>
                <Badge color={sel.isActive !== false ? "success" : "danger"}>{sel.isActive !== false ? "Active" : "Inactive"}</Badge>
              </div>
            </div>

            {[
              ["ID",           sel.id],
              ["Username",     sel.username],
              ["Email",        sel.email],
              ["Civil Status", sel.civilStatus],
              ["Birthdate",    sel.birthdate],
              ["Year Level",   sel.yearLevel],
              ["Semester",     sel.semester],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} style={{ marginBottom: 9 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{l}</div>
                <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>{v}</div>
              </div>
            ))}

            {/* Toggle action */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #334155" }}>
              {sel.isActive !== false
                ? (
                  <Btn variant="danger" onClick={() => toggleActive(sel)} style={{ width: "100%" }}>
                    🔴 Deactivate Account
                  </Btn>
                )
                : (
                  <Btn variant="success" onClick={() => toggleActive(sel)} style={{ width: "100%" }}>
                    🟢 Reactivate Account
                  </Btn>
                )
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
