import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { email, password, fullName, phone } = await req.json();

        if (!email || !password || !fullName) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);

        // Create the user using admin API (bypasses signups disabled)
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: email.toLowerCase(),
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                preferred_language: 'uz',
            },
        });

        if (createError) {
            console.error('Create user error:', createError);
            return new Response(JSON.stringify({ error: createError.message }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Attempt to update the profile record with 'self_registration' flag
        if (newUser.user) {
            // The profile might have been auto-created by a database trigger (handle-new-user).
            // If it exists, update it. If not, insert it.
            const { data: existingProfile } = await adminClient
                .from('profiles')
                .select('id')
                .eq('user_id', newUser.user.id)
                .maybeSingle();

            if (!existingProfile) {
                await adminClient.from('profiles').insert({
                    user_id: newUser.user.id,
                    full_name: fullName,
                    email: email.toLowerCase(),
                    phone: phone || null,
                    preferred_language: 'uz',
                    notes: 'self_registration',
                });
            } else {
                await adminClient.from('profiles').update({
                    full_name: fullName,
                    email: email.toLowerCase(),
                    phone: phone || null,
                    notes: 'self_registration',
                }).eq('user_id', newUser.user.id);
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                userId: newUser.user?.id,
                message: 'Registration successful'
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('Unexpected error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
