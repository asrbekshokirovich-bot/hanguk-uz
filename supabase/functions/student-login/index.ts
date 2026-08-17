// ⚠️ DEAD — nothing calls this. Use `student-login-v2`.
//
// v1 was kept deployed "for 48-hour rollback safety" when v2 landed and then
// forgotten for months, during which `src/pages/Auth.tsx` still pointed here.
// That mattered on 2026-08-14: the profile lookup below reports *any* error as
// "Failed to verify code", so a Cloudflare 522 from an unreachable database
// reads to the student as a bad access code. On iOS that wording cost an App
// Store rejection under guideline 2.1(a); the web was one outage away from the
// same dead end. v2 retries the transient class and answers
// SERVICE_UNAVAILABLE / 503 instead.
//
// The web client moved to v2 on 2026-08-17, so this function now has no
// callers in either app. It is left deployed rather than deleted only because
// undeploying is someone's decision to take deliberately — if nothing appears
// in its logs for a week, delete it. Do not add callers; fix v2 instead.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Mint a session for `email` without reading or writing the stored password.
 *
 * The magic code has already proved who this is by the time we get here, so a
 * one-time token is enough. Returns null rather than throwing, so the caller
 * can fall back to the legacy password path and a failure here cannot lock
 * students out.
 */
// deno-lint-ignore no-explicit-any
async function mintSessionWithoutPassword(admin: any, email: string): Promise<any | null> {
  try {
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const hashedToken = link?.properties?.hashed_token;
    if (linkErr || !hashedToken) return null;

    // GoTrue has spelled this OTP type both ways across versions; try the
    // specific one first and fall back rather than guessing wrong.
    for (const type of ['magiclink', 'email']) {
      const { data, error } = await admin.auth.verifyOtp({ token_hash: hashedToken, type });
      if (!error && data?.session) return data.session;
    }
    return null;
  } catch {
    return null;
  }
}

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
      // User exists — mint a session without touching the stored password.
      //
      // The password dance below authenticates by *setting* a password derived
      // here, resetting the account's real one whenever the derived value does
      // not match. For students whose accounts came from `create-student`
      // (name-based emails, with a password staff chose) it never matches, so
      // the first magic-code login silently overwrote a working credential.
      //
      // The magic code already proved who this is. A one-time token is enough,
      // and leaves the password alone. Falls through to the old path if the
      // exchange is unavailable, so this cannot lock anyone out.
      const email = existingUser.email!;

      const otpSession = await mintSessionWithoutPassword(supabaseAdmin, email);
      if (otpSession) {
        userId = existingUser.id;
        if (profile.user_id !== existingUser.id) {
          await supabaseAdmin.from('profiles').update({ user_id: existingUser.id }).eq('id', profile.id);
        }
        session = otpSession;
      } else {
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
