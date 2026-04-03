import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { magicCode } = await req.json();

    if (!magicCode?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Magic code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize magic code (uppercase, remove spaces)
    const normalizedCode = magicCode.trim().toUpperCase().replace(/\s+/g, '');
    const codeMask = normalizedCode.slice(-3).padStart(normalizedCode.length, '*');

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log('Looking up magic code:', codeMask);

    // Find profile with this magic code
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('magic_code', normalizedCode)
      .maybeSingle();

    if (profileError) {
      console.error('Profile lookup error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile) {
      console.log('No profile found for magic code:', codeMask);
      return new Response(
        JSON.stringify({ error: 'Invalid code. Please check and try again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found profile:', profile.id, 'user_id:', profile.user_id);

    // Check if user has staff roles (staff should not use magic code login)
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.user_id);

    const isStaff = userRoles?.some(r => ['staff', 'admin', 'owner'].includes(r.role));

    if (isStaff) {
      return new Response(
        JSON.stringify({ error: 'Staff members should use username/password login' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bug #2 Fix: Prevent double auth account creation
    // Strategy: check by profile.user_id first, then fall back to checking
    // by the deterministic email pattern student-{profile.user_id}@hanguk.local
    // This handles the race condition where profile.user_id is a pre-login fake UUID
    // but an auth account already exists (from a previous login attempt).

    let existingUser = null;

    // Primary check: does an auth user exist with profile.user_id?
    const { data: userById } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
    if (userById?.user) {
      existingUser = userById.user;
    }

    // Secondary check: search by deterministic email pattern to catch orphaned accounts
    // This prevents creating a second auth user if profile.user_id was already updated
    if (!existingUser) {
      const deterministicEmail = `student-${profile.user_id}@hanguk.local`;
      
      // We must paginate listUsers because the default perPage is 50, meaning
      // any orphaned students beyond the first 50 will be missed and crash createUser!
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        
        if (!userList?.users || userList.users.length === 0) {
          break;
        }

        const found = userList.users.find(u => u.email === deterministicEmail);
        if (found) {
          existingUser = found;
          console.log('Found existing auth user by email pattern:', deterministicEmail);
          break;
        }

        if (userList.users.length < 1000) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    let userId = profile.user_id;
    let session = null;

    // Deterministic password derived from user_id — stable across logins
    const stablePassword = `student-${profile.user_id}-hanguk-A1!`;

    if (!existingUser) {
      // Create auth user for this student
      const email = `student-${profile.user_id}@hanguk.local`;

      console.log('Creating auth user for student:', email);

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: stablePassword,
        email_confirm: true, // Auto-confirm
        user_metadata: {
          full_name: profile.full_name,
          is_student: true,
          original_user_id: profile.user_id, // Pass original profile user_id for trigger
        }
      });

      if (createError) {
        console.error('Failed to create auth user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;

      // Profile user_id is updated by the handle_new_user trigger
      // documents + applications cascade automatically via ON UPDATE CASCADE
      // Only storage files need manual migration below
      const oldUserId = profile.user_id;

      // Bug #7 Fix: Move storage files from old UUID folder to new UUID folder
      // so student can access files uploaded by staff before first login
      try {
        const { data: oldFiles } = await supabaseAdmin.storage
          .from('student-documents')
          .list(oldUserId);

        if (oldFiles && oldFiles.length > 0) {
          const movePromises = oldFiles.map(file =>
            supabaseAdmin.storage
              .from('student-documents')
              .move(`${oldUserId}/${file.name}`, `${userId}/${file.name}`)
          );
          await Promise.allSettled(movePromises);
          console.log(`Moved ${oldFiles.length} storage files from ${oldUserId}/ to ${userId}/`);
        }
      } catch (storageError) {
        // Non-fatal: log but don't block login if file move fails
        console.warn('Storage file migration warning:', storageError);
      }

      console.log('Created auth user:', userId);

      // Sign in the user with the stable password
      const { data: sessionData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password: stablePassword,
      });

      if (signInError) {
        console.error('Failed to sign in:', signInError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      session = sessionData.session;
    } else {
      // User exists — sign in with stable password (no password reset needed)
      const email = existingUser.email!;
      // Ensure profile.user_id is pointing to this auth user (may have drifted)
      if (profile.user_id !== existingUser.id) {
        console.log(`Correcting profile.user_id from ${profile.user_id} to ${existingUser.id}`);
        userId = existingUser.id;
        await supabaseAdmin.from('profiles').update({ user_id: existingUser.id }).eq('id', profile.id);
      } else {
        userId = existingUser.id;
      }

      const { data: sessionData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password: stablePassword,
      });

      if (signInError) {
        // If stable password doesn't work (legacy user), reset to stable password once
        console.log('Stable password failed, resetting for user:', userId);
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: stablePassword,
        });

        if (updateError) {
          console.error('Failed to reset password:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to create session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Try sign in again with stable password
        const { data: retryData, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
          email,
          password: stablePassword,
        });

        if (retryError) {
          console.error('Failed to sign in after password reset:', retryError);
          return new Response(
            JSON.stringify({ error: 'Failed to create session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        session = retryData.session;
      } else {
        session = sessionData.session;
      }
    }

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Login successful for student:', profile.full_name);

    return new Response(
      JSON.stringify({ 
        success: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          token_type: session.token_type,
        },
        user: {
          id: session.user.id,
          email: session.user.email,
        },
        profile: {
          id: profile.id,
          full_name: profile.full_name,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
