import { createClient } from "@supabase/supabase-js";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// 1. Define CORS headers to allow your React app to communicate with this function
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // In production, replace '*' with your actual domain
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    // 2. Handle the browser's "preflight" request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const body = await req.json();

        const {
            username,
            fullName,
            email,
            civilStatus,
            birthdate,
            address,
            role,
            yearLevel,
            semester,
            programId
        } = body;

        if (!email) {
            return new Response(
                JSON.stringify({ error: "Email is required." }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        const prefix = role === "student" ? "STU" : "TCH";

        // Logic to get next display_id
        const { data: maxRow, error: maxErr } = await supabase
            .from("users")
            .select("display_id")
            .eq("role", role)
            .order("display_id", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (maxErr) {
            return new Response(
                JSON.stringify({ error: maxErr.message }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        const lastNum = maxRow
            ? parseInt(maxRow.display_id.replace(/\D/g, ""), 10)
            : 0;

        const nextNum = (isNaN(lastNum) ? 0 : lastNum) + 1;
        const displayId = `${prefix}${String(nextNum).padStart(3, "0")}`;

        // 3. Invite the user to Supabase Auth
        const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
            email.trim(),
            {
                redirectTo: "http://localhost:5173" // Update this for production later!
            }
        );

        if (inviteErr || !inviteData?.user) {
            return new Response(
                JSON.stringify({ error: inviteErr?.message ?? "Invite failed." }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        const authUserId = inviteData.user.id;

        // 4. Insert into public.users
        const { data: userRow, error: userErr } = await supabase
            .from("users")
            .insert({
                user_id: authUserId,
                display_id: displayId,
                username: username.trim(),
                full_name: fullName.trim(),
                email: email.trim(),
                civil_status: civilStatus || null,
                birthdate: birthdate || null,
                address: address?.trim() || null,
                role
            })
            .select()
            .single();

        if (userErr) {
            return new Response(
                JSON.stringify({ error: userErr.message }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        // 5. Insert into specific role table
        if (role === "student") {
            const { error: stuErr } = await supabase
                .from("students")
                .insert({
                    user_id: authUserId,
                    year_level: yearLevel,
                    semester,
                    program_id: programId ? Number(programId) : null
                });

            if (stuErr) throw new Error(stuErr.message);
        } else {
            const { error: tchErr } = await supabase
                .from("teachers")
                .insert({ user_id: authUserId });

            if (tchErr) throw new Error(tchErr.message);
        }

        // 6. Success Response
        return new Response(
            JSON.stringify({
                message: "User invited successfully.",
                user: userRow
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown error."
            }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});