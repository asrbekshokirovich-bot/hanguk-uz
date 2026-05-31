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
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with user's token to verify they have permission
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY'))!;
    const supabaseServiceKey = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user: currentUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if the current user has owner or admin role
    const { data: roles } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id);

    // Only owners can create new staff accounts
    const isOwner = roles?.some((r) => r.role === 'owner');
    if (!isOwner) {
      return new Response(JSON.stringify({ error: 'Only owners can create staff accounts' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the request body
    const { username, password, fullName, roles: assignRoles } = await req.json();

    if (!username || !password || !fullName || !assignRoles || assignRoles.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Create the user using admin API
    const email = `${username.toLowerCase()}@hanguk.local`;
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        username: username.toLowerCase(),
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

    // Ensure profile exists + set username/full name
    if (newUser.user) {
      // In some setups there is no auth trigger to auto-create profiles,
      // so we create one here if missing.
      const { data: existingProfile, error: existingProfileError } = await adminClient
        .from('profiles')
        .select('id')
        .eq('user_id', newUser.user.id)
        .maybeSingle();

      if (existingProfileError) {
        console.error('Profile lookup error:', existingProfileError);
      }

      if (!existingProfile) {
        // Create staff profile WITHOUT magic_code (magic_code is for students only)
        const { error: insertProfileError } = await adminClient
          .from('profiles')
          .insert({
            user_id: newUser.user.id,
            full_name: fullName,
            username: username.toLowerCase(),
            preferred_language: 'uz',
            magic_code: null, // Explicitly set to null - staff never have magic_code
          });

        if (insertProfileError) {
          console.error('Profile insert error:', insertProfileError);
        }
      } else {
        // Update existing profile and ensure magic_code is null for staff
        await adminClient
          .from('profiles')
          .update({ 
            full_name: fullName, 
            username: username.toLowerCase(),
            magic_code: null, // Ensure staff profiles never have magic_code
          })
          .eq('user_id', newUser.user.id);
      }

      // Add the selected roles
      const roleInserts = assignRoles.map((role: string) => ({
        user_id: newUser.user!.id,
        role,
      }));

      const { error: roleError } = await adminClient.from('user_roles').insert(roleInserts);

      if (roleError) {
        console.error('Role insert error:', roleError);
        return new Response(
          JSON.stringify({
            userId: newUser.user.id,
            warning: 'User created but failed to assign roles',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        userId: newUser.user?.id, 
        message: 'Staff account created successfully' 
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
