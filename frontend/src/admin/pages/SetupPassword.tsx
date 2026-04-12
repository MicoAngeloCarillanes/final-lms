import { useEffect, useState } from 'react';
import { Btn, FF, Input } from '../../components/ui';
import { supabase } from '../../supabaseClient';

export default function SetupPassword() {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm]   = useState("");
    const [error, setError]       = useState("");
    const [busy, setBusy]         = useState(false);
    
    const [targetUser, setTargetUser] = useState(null);
    const [isChecking, setIsChecking] = useState(true);

    /**
     * validateToken
     * Checks the public.users table for a matching setup_token
     */
    useEffect(() => {
        async function validateToken() {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');

            if (!token) {
                setError("No invitation token found in the URL.");
                setIsChecking(false);
                return;
            }

            // Look up the token directly in the users table
            const { data, error: dbErr } = await supabase
                .from("users")
                .select("user_id, email, full_name, is_verified")
                .eq("setup_token", token)
                .maybeSingle();

            if (dbErr) {
                setError("Database connection error. Please try again later.");
            } else if (!data) {
                setError("This invitation link is invalid or has already been used.");
            } else if (data.is_verified) {
                setError("This account is already activated. Please log in.");
            } else {
                setTargetUser(data);
            }
            
            setIsChecking(false);
        }

        validateToken();
    }, []);

    /**
     * handleSetup
     * Updates the password_hash and clears the setup_token
     */
    async function handleSetup(e) {
        e.preventDefault();
        setError("");

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirm) {
            setError("Passwords do not match.");
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        setBusy(true);
        try {
            // 1. Hash the password using your RPC
            const { data: hashData, error: hashErr } = await supabase.rpc("hash_password", { 
                plain: password 
            });

            if (hashErr) throw new Error("Encryption failed. Please try again.");

            // 2. Update the user who has this token
            const { data: user, error: updateErr } = await supabase
                .from("users")
                .update({ 
                    password_hash: hashData, 
                    setup_token: null, // Wipe the token so it expires
                    is_verified: true,
                    is_active: true
                })
                .eq("setup_token", token)
                .select()
                .single();

            if (updateErr || !user) {
                throw new Error("Failed to activate account. The link may have expired.");
            }

            alert("Account activated successfully! You can now log in.");
            window.location.href = "/";
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    if (isChecking) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#f1f5f9' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔍</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>Verifying secure link...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a' }}>
            <div style={{ background: '#1e293b', padding: '32px', borderRadius: '12px', width: '400px', border: '1px solid #334155' }}>
                <h2 style={{ color: '#f1f5f9', margin: '0 0 8px 0' }}>Activate Account</h2>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
                    {targetUser ? `Setting password for ${targetUser.email}` : "Set your password to access the LMS."}
                </p>

                {error ? (
                    <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 6, padding: "12px", color: "#f87171", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
                        ⚠ {error}
                        <Btn onClick={() => window.location.href = "/"} variant="secondary" style={{ width: '100%', marginTop: '16px' }}>
                            Return to Login
                        </Btn>
                    </div>
                ) : (
                    <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <FF label="New Password">
                            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 characters" />
                        </FF>
                        <FF label="Confirm Password">
                            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Repeat password" />
                        </FF>
                        <Btn type="submit" disabled={busy} style={{ marginTop: '8px' }}>
                            {busy ? "Activating..." : "Set Password & Login"}
                        </Btn>
                    </form>
                )}
            </div>
        </div>
    );
}