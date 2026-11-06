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
        // Get the authorization header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Create Supabase client with user's token to verify they have permission
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const userClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } },
        });

        // Get the current user
        const { data: { user: currentUser }, error: userError } = await userClient.auth.getUser();
        if (userError || !currentUser) {
            return new Response(JSON.stringify({ error: 'Unauthorized: ' + (userError?.message || 'No user') }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Check if the current user has owner role
        const { data: roles } = await userClient
            .from('user_roles')
            .select('role')
            .eq('user_id', currentUser.id);

        // Only owners can change passwords
        const isOwner = roles?.some((r) => r.role === 'owner');
        if (!isOwner) {
            return new Response(JSON.stringify({ error: 'Faqat owner boshqa foydalanuvchilar parolini o\'zgartira oladi' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Parse the request body
        const { userId, newPassword } = await req.json();

        if (!userId || !newPassword) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (newPassword.length < 6) {
            return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Create admin client with service role key to update user
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);

        // Update the user's password using the admin API
        const { data, error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
            password: newPassword,
        });

        if (updateError) {
            console.error('Update password error:', updateError);
            return new Response(JSON.stringify({ error: updateError.message }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Insert history record
        const { error: historyError } = await adminClient
            .from('staff_password_history')
            .insert({
                user_id: userId,
                changed_by: currentUser.id
            });

        if (historyError) {
            console.error('History insert error:', historyError);
        }

        return new Response(
            JSON.stringify({ message: 'Parol muvaffaqiyatli o\'zgartirildi' }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error: any) {
        console.error('Unexpected error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
