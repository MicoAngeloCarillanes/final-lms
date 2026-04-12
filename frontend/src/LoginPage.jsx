import { useState } from "react";
import { normalizeUser } from "./lib/normalizers";
import { supabase } from "./supabaseClient";

export default function LoginPage({ onLogin }) {
    const [u, setU] = useState("");
    const [p, setP] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    /**
     * doLogin
     * Authenticates using the public.users table and verify_password RPC.
     */
    async function doLogin(username = u, password = p) {
        if (!username || !password) {
            setErr("Please enter both username and password.");
            return;
        }

        setErr("");
        setLoading(true);

        try {
            // 1. Fetch core user record
            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("*")
                .eq("username", username)
                .maybeSingle();

            if (userError || !userData) {
                setErr("Invalid username or password.");
                setLoading(false);
                return;
            }

            // 2. Verify hashed password via RPC
            const { data: isValid, error: rpcError } = await supabase.rpc("verify_password", {
                plain: password,
                hash: userData.password_hash
            });

            if (rpcError || !isValid) {
                setErr("Invalid username or password.");
                setLoading(false);
                return;
            }

            // 3. Check if account is verified/active
            if (userData.is_verified === false) {
                setErr("Please check your email to activate your account first.");
                setLoading(false);
                return;
            }

            // 4. Fetch role-specific sub-data (Students/Teachers)
            let subData = null;
            if (userData.role === "student") {
                const { data: stuRow } = await supabase
                    .from("students")
                    .select("*")
                    .eq("user_id", userData.user_id)
                    .maybeSingle();

                let program = null;
                if (stuRow?.program_id) {
                    const { data: progRow } = await supabase
                        .from("program")
                        .select("program_id, code, name")
                        .eq("program_id", stuRow.program_id)
                        .maybeSingle();
                    program = progRow || null;
                }
                subData = { students: stuRow ? [{ ...stuRow, program }] : [] };
            } else if (userData.role === "teacher") {
                const { data: tchRow } = await supabase
                    .from("teachers")
                    .select("*")
                    .eq("user_id", userData.user_id)
                    .maybeSingle();
                subData = { teachers: tchRow ? [tchRow] : [] };
            }

            // 5. Finalize Session
            const fullUser = { ...userData, ...subData };
            localStorage.setItem("lms_user", JSON.stringify(fullUser));
            onLogin(normalizeUser(fullUser));

        } catch (e) {
            console.error("Login Error:", e);
            setErr("Connection error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "#0f172a" }}>
            {/* Left — form */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>
                <div style={{ width: "100%", maxWidth: 380 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
                        <div style={{ width: 40, height: 40, background: "#4f46e5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
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
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Username</label>
                            <input
                                type="text" value={u}
                                onChange={e => setU(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && doLogin()}
                                placeholder="Enter your username"
                                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "11px 14px", fontSize: 14, color: "#fff", fontFamily: "inherit", outline: "none" }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Password</label>
                            <input
                                type="password" value={p}
                                onChange={e => setP(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && doLogin()}
                                placeholder="Enter your password"
                                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "11px 14px", fontSize: 14, color: "#fff", fontFamily: "inherit", outline: "none" }}
                            />
                        </div>

                        {err && (
                            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "8px 12px", color: "#f87171", fontSize: 13 }}>
                                {err}
                            </div>
                        )}

                        <button
                            onClick={() => doLogin()} disabled={loading}
                            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", opacity: loading ? 0.7 : 1, transition: "opacity .15s", letterSpacing: "-0.01em", marginTop: 2 }}>
                            {loading ? "Verifying..." : "Sign In →"}
                        </button>
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
                        ["🏫", "Multi-role: Admin, Sub-Admin, Teacher & Student"],
                        ["📚", "Full course & material management"],
                        ["📊", "Real-time grading & grade reports"],
                        ["🔒", "Secure account & password management"],
                        ["📢", "Announcements & department messaging"],
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