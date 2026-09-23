import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Creates a partner learning center together with its login.
//
// The account deliberately gets NO user_roles row. Any role at all would make
// it staff to is_staff_user(), is_non_investor_staff() and the policies that
// admit "anyone in user_roles" (payments among them). What makes the account a
// center is the learning_centers row pointing at it — see
// 20260923120000_learning_centers.sql.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: currentUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !currentUser) return json({ error: 'Unauthorized' }, 401);

    const { data: roles } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id);

    const canCreate = roles?.some((r) => r.role === 'owner' || r.role === 'admin');
    if (!canCreate) return json({ error: 'Only owners and admins can create learning centers' }, 403);

    const body = await req.json();
    const name = String(body.name ?? '').trim();
    const username = String(body.username ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!name || !username || !password) return json({ error: 'Missing required fields' }, 400);
    if (!USERNAME_RE.test(username)) {
      return json({ error: 'Login faqat lotin harflari, raqam, nuqta, chiziqcha (3–32 belgi)' }, 400);
    }
    if (password.length < 6) return json({ error: 'Parol kamida 6 belgi bo‘lishi kerak' }, 400);

    const optional = (v: unknown) => {
      const s = typeof v === 'string' ? v.trim() : '';
      return s === '' ? null : s;
    };

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const email = `${username}@hanguk.local`;
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        username,
        preferred_language: 'uz',
        account_type: 'learning_center',
      },
    });

    if (createError || !newUser.user) {
      console.error('Create user error:', createError);
      return json({ error: createError?.message ?? 'Failed to create user' }, 400);
    }

    const userId = newUser.user.id;

    // Same profile handling as create-staff: the auth trigger may or may not
    // have created one, and a center never has a student magic_code.
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: insertProfileError } = await adminClient.from('profiles').insert({
        user_id: userId,
        full_name: name,
        username,
        preferred_language: 'uz',
        magic_code: null,
      });
      if (insertProfileError) console.error('Profile insert error:', insertProfileError);
    } else {
      await adminClient
        .from('profiles')
        .update({ full_name: name, username, magic_code: null })
        .eq('user_id', userId);
    }

    const { data: center, error: centerError } = await adminClient
      .from('learning_centers')
      .insert({
        name,
        city: optional(body.city),
        address: optional(body.address),
        contact_person: optional(body.contactPerson),
        phone: optional(body.phone),
        notes: optional(body.notes),
        assigned_to: optional(body.assignedTo),
        user_id: userId,
        created_by: currentUser.id,
      })
      .select('id')
      .single();

    if (centerError || !center) {
      console.error('Center insert error:', centerError);
      // A login without a center is a dangling account that can sign in and
      // see nothing; remove it so the owner can simply try again.
      await adminClient.auth.admin.deleteUser(userId);
      return json({ error: centerError?.message ?? 'Failed to create learning center' }, 400);
    }

    return json({ centerId: center.id, userId, username });
  } catch (error) {
    console.error('Unexpected error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
