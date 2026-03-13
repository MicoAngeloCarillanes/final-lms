import React, { useState } from "react";
import { Badge } from "../../components/ui";
import LMSGrid from "../../components/LMSGrid";
import TopBar  from "../../components/TopBar";

export default function AdminViewAccounts({ users }) {
  const [filterRole, setFilterRole] = useState("all");
  const [sel,        setSel]        = useState(null);

  const data = users.filter(u =>
    u.role !== "admin" && (filterRole === "all" || u.role === filterRole)
  );

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
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar
        title="Account Directory"
        subtitle="Admin · View & search all accounts"
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
          <LMSGrid columns={cols} rowData={data} onRowClick={setSel} selectedId={sel?.id} height="100%" />
        </div>

        {/* Detail drawer */}
        {sel && (
          <div style={{ width: 248, borderLeft: "1px solid #334155", background: "#1e293b", padding: "16px 14px", overflowY: "auto", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>Account Details</div>
              <button onClick={() => setSel(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#475569", fontSize: 18 }}>×</button>
            </div>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: sel.role === "student" ? "#d1fae5" : "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 22, fontWeight: 800, color: sel.role === "student" ? "#065f46" : "#5b21b6" }}>
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
              ["Year Level",   sel.yearLevel],
              ["Semester",     sel.semester],
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
