/**
 * SubAdminPasswordReset.jsx
 * FOLDER: src/sub-admin/pages/SubAdminPasswordReset.jsx  (new file)
 *
 * Allows a sub-admin (department admin) to reset any user's password
 * to the school default (Welcome@123) or a custom temporary password.
 * Calls POST /api/user/reset-password on the NestJS backend.
 */
import React, { useState } from "react";
import { userApi } from "../../lib/api";
import { Btn, Input, FF, Toast } from "../../components/ui";
import TopBar from "../../components/TopBar";

export default function SubAdminPasswordReset({ user, users = [] }) {
  const [username,    setUsername]    = useState("");
  const [useCustom,   setUseCustom]   = useState(false);
  const [customPw,    setCustomPw]    = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [busy,        setBusy]        = useState(false);
  const [toast,       setToast]       = useState({ msg: "", type: "success" });
  const [log,         setLog]         = useState([]);   // audit log shown in UI

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500);
  };

  // Suggestions from loaded users list
  const suggestions = username.length >= 2
    ? users.filter(u =>
        u.role !== "admin" && u.role !== "sub_admin" &&
        (u.username?.toLowerCase().includes(username.toLowerCase()) ||
         u.fullName?.toLowerCase().includes(username.toLowerCase()))
      ).slice(0, 5)
    : [];

  const handleReset = async () => {
    if (!username.trim()) { showToast("Enter a username.", "error"); return; }
    if (useCustom) {
      if (customPw.length < 6) { showToast("Password must be at least 6 characters.", "error"); return; }
      if (customPw !== confirmPw) { showToast("Passwords do not match.", "error"); return; }
    }

    setBusy(true);
    try {
      const result = await userApi.resetPassword(
        username.trim(),
        useCustom ? customPw : undefined
      );

      const entry = {
        at:       new Date().toLocaleTimeString(),
        username: username.trim(),
        by:       user.fullName,
        type:     useCustom ? "Custom password" : "Default password",
      };
      setLog(prev => [entry, ...prev].slice(0, 20));

      setUsername("");
      setCustomPw("");
      setConfirmPw("");
      showToast(result || "Password reset successfully.");
    } catch (err) {
      showToast(err.message || "Reset failed.", "error");
    }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar
        title="Password Reset"
        subtitle={`${user.scopeRef || user.fullName} · Reset user passwords`}
      />

      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", gap: 20 }}>

        {/* ── Reset form ── */}
        <div style={{ flex: 1, maxWidth: 480, display: "flex", flexDirection: "column", gap: 16 }}>

          {toast.msg && (
            <div style={{
              background: toast.type === "error" ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)",
              border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`,
              borderRadius: 8, padding: "10px 14px",
              color: toast.type === "error" ? "#f87171" : "#34d399",
              fontSize: 13, fontWeight: 600,
            }}>
              {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
            </div>
          )}

          {/* Info banner */}
          <div style={{ background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.25)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#a5b4fc", marginBottom: 4 }}>🔑 How Password Reset Works</div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
              The user's password will be reset to the school default password (<code style={{ background: "#0f172a", padding: "1px 5px", borderRadius: 4, color: "#a5b4fc" }}>Welcome@123</code>) or a temporary password you provide.
              The user must log in and change it on their Profile page.
            </div>
          </div>

          {/* Username field with autocomplete suggestions */}
          <div style={{ position: "relative" }}>
            <FF label="Username to Reset" required>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Type username or full name…"
                autoComplete="off"
              />
            </FF>
            {suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,.3)", overflow: "hidden", marginTop: 2,
              }}>
                {suggestions.map(u => (
                  <button key={u.id} onClick={() => setUsername(u.username)}
                    style={{
                      width: "100%", textAlign: "left", padding: "9px 14px",
                      background: "transparent", border: "none", cursor: "pointer",
                      borderBottom: "1px solid #334155", fontFamily: "inherit",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#334155"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{u.username}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{u.fullName} · {u.role}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Toggle custom password */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#94a3b8", userSelect: "none" }}>
            <div onClick={() => setUseCustom(p => !p)}
              style={{
                width: 36, height: 20, borderRadius: 10, transition: "background .2s", cursor: "pointer",
                background: useCustom ? "#4f46e5" : "#334155", position: "relative", flexShrink: 0,
              }}>
              <div style={{
                position: "absolute", top: 2, left: useCustom ? 18 : 2,
                width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s",
              }} />
            </div>
            Set a custom temporary password instead of default
          </label>

          {useCustom && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px", background: "#1e293b", borderRadius: 10, border: "1px solid #334155" }}>
              <FF label="Temporary Password">
                <Input
                  type="password"
                  value={customPw}
                  onChange={e => setCustomPw(e.target.value)}
                  placeholder="Min. 6 characters"
                />
              </FF>
              <FF label="Confirm Password">
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat password"
                />
              </FF>
            </div>
          )}

          <Btn onClick={handleReset} disabled={busy || !username.trim()} style={{ marginTop: 4 }}>
            {busy ? "⏳ Resetting…" : "🔑 Reset Password"}
          </Btn>
        </div>

        {/* ── Audit log ── */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#e2e8f0", marginBottom: 12 }}>📋 Reset Log (this session)</div>
          {log.length === 0
            ? (
              <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "20px 16px", textAlign: "center", color: "#475569", fontSize: 13 }}>
                No resets yet this session.
              </div>
            )
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {log.map((entry, i) => (
                  <div key={i} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0" }}>{entry.username}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                      {entry.type} · by {entry.by}
                    </div>
                    <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>{entry.at}</div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}
