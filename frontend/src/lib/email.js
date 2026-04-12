// src/lib/email.js

export async function sendInviteEmail(email, token, fullName) {
    const inviteLink = `${window.location.origin}/setup-password?token=${token}`;
    
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`
        },
        body: JSON.stringify({
            from: 'LMS Admin <onboarding@resend.dev>', // Keep this as onboarding@resend.dev
            to: [email],
            subject: 'Set up your LMS Account',
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Welcome to the LMS, ${fullName}!</h2>
                    <p>An administrator has created an account for you.</p>
                    <p>Please click the secure link below to set your password and activate your account:</p>
                    <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Activate Account</a>
                    <p style="margin-top: 20px; font-size: 12px; color: #666;">If the button doesn't work, copy and paste this URL: <br/> ${inviteLink}</p>
                </div>
            `
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send email via Resend.");
    }
    return true;
}