import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import { normalizeUser } from "./lib/normalizers";

export default function LoginPage({ onLogin }) {
  const [u,       setU]       = useState("");
  const [p,       setP]       = useState("");
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async (username = u, password = p) => {
    setErr(""); setLoading(true);
    try {
      // 1. Fetch user row
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .single();

      if (userError || !userData) {
        setErr("Invalid username or password."); setLoading(false); return;
      }

      // 2. Verify password via RPC
      const { data: ok } = await supabase
        .rpc("verify_password", { plain: password, hash: userData.password_hash });

      if (!ok) {
        setErr("Invalid username or password."); setLoading(false); return;
      }

      // 3. Fetch role subclass row
      let subData = null;
      if (userData.role === "student") {
        const { data } = await supabase
          .from("students").select("*").eq("user_id", userData.user_id).single();
        subData = { students: data ? [data] : [] };
      } else if (userData.role === "teacher") {
        const { data } = await supabase
          .from("teachers").select("*").eq("user_id", userData.user_id).single();
        subData = { teachers: data ? [data] : [] };
      }

      onLogin(normalizeUser({ ...userData, ...subData }));
    } catch (e) {
      setErr("Connection error. Please try again.");
    }
    setLoading(false);
  };

  const quick = [
    { label: "Admin",   icon: "🛡", u: "admin",  p: "admin123", c: "#f59e0b" },
    { label: "Student", icon: "🎓", u: "jdoe",   p: "pass123",  c: "#10b981" },
    { label: "Teacher", icon: "📖", u: "pjones", p: "pass123",  c: "#6366f1" },
  ];

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "#0f172a" }}>
      {/* Left — form */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 72px", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 25% 55%, rgba(79,70,229,.14) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 380, position: "relative" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
            <div style={{ width: 46, height: 46, background: "#4f46e5", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em" }}>EduLMS</div>
              <div style={{ color: "#475569", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>Learning Management System</div>
            </div>
          </div>

          <h1 style={{ color: "#fff", fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 6 }}>Welcome back</h1>
          <p style={{ color: "#475569", fontSize: 14, marginBottom: 32 }}>Sign in to access your learning portal.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {[["Username", "text", u, setU], ["Password", "password", p, setP]].map(([lbl, type, val, set]) => (
              <div key={lbl}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>{lbl}</label>
                <input
                  type={type} value={val}
                  onChange={e => set(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && doLogin()}
                  placeholder={`Enter your ${lbl.toLowerCase()}`}
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "11px 14px", fontSize: 14, color: "#fff", fontFamily: "inherit", outline: "none" }}
                  onFocus={e => e.target.style.borderColor = "#6366f1"}
                  onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>
            ))}

            {err && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "8px 12px", color: "#f87171", fontSize: 13 }}>
                {err}
              </div>
            )}

            <button
              onClick={() => doLogin()} disabled={loading}
              style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", opacity: loading ? 0.7 : 1, transition: "opacity .15s", letterSpacing: "-0.01em", marginTop: 2 }}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </div>

          {/* Demo quick-access */}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 10, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center", marginBottom: 10 }}>Demo Quick Access</div>
            <div style={{ display: "flex", gap: 8 }}>
              {quick.map(q => (
                <button key={q.label}
                  onClick={() => { setU(q.u); setP(q.p); doLogin(q.u, q.p); }}
                  style={{ flex: 1, padding: "8px 4px", borderRadius: 7, border: `1px solid ${q.c}44`, background: `${q.c}11`, color: q.c, fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                  {q.icon} {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right — promo */}
      <div style={{ width: 400, background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 100%)", display: "flex", flexDirection: "column", justifyContent: "center", padding: 48, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: "rgba(99,102,241,.15)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(245,158,11,.1)", filter: "blur(40px)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
          <h2 style={{ color: "#fff", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.3, marginBottom: 14 }}>Your complete academic ecosystem</h2>
          <p style={{ color: "#a5b4fc", fontSize: 13, lineHeight: 1.8, marginBottom: 28 }}>Manage courses, assignments, grades, and more — unified in one modern platform.</p>
          {[
            ["🏫", "Multi-role: Admin, Teacher & Student"],
            ["📚", "Full course & material management"],
            ["📊", "Real-time grading & grade reports"],
            ["🔒", "Secure account management"],
          ].map(([ic, txt]) => (
            <div key={txt} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>{ic}</span>
              <span style={{ color: "#c7d2fe", fontSize: 13 }}>{txt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
