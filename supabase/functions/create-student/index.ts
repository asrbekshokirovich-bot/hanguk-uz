import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Generate a unique 8-character magic code
function generateMagicCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoiding confusing chars like 0/O, 1/I/L
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fullName, phone, birthDate, city, officeLocation, paymentPlan, paymentMode, contractDate, contractUrl, languageTrack, isGksApplicant } = await req.json();

    if (!fullName?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Full name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the request is from an authenticated staff member
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has staff roles
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Roles query error:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedRoles = ['owner', 'admin', 'call_operator', 'document_handler'];
    const hasPermission = userRoles?.some(r => allowedRoles.includes(r.role));

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if phone number already exists in profiles to prevent duplicate students
    if (phone) {
      const { data: existingPhone } = await supabaseAdmin
        .from('profiles')
        .select('id, user_id')
        .eq('phone', phone)
        .maybeSingle();
      
      if (existingPhone) {
        // Check if this profile belongs to a staff member
        const { data: isStaff } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', existingPhone.user_id)
          .maybeSingle();
        
        if (isStaff) {
          return new Response(
            JSON.stringify({ success: false, error: 'This phone number belongs to a staff account' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: false, error: 'A student with this phone number already exists' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for duplicate name to prevent race-condition duplicates
    const { data: existingName } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('full_name', fullName.trim())
      .not('magic_code', 'is', null);

    if (existingName && existingName.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'A student with this name already exists',
          existingId: existingName[0].id 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a unique user_id for the student profile (no auth account yet)
    const studentUserId = crypto.randomUUID();

    // Generate unique magic code with retry logic
    let magicCode = generateMagicCode();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('magic_code', magicCode)
        .maybeSingle();

      if (!existing) break;
      
      magicCode = generateMagicCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate unique magic code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating student profile with user_id:', studentUserId);

    // Create profile directly without auth account
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: studentUserId,
        full_name: fullName.trim(),
        phone: phone || null,
        birth_date: birthDate || null,
        city: city || null,
        office_location: officeLocation || null,
        payment_plan: paymentPlan || null,
        payment_mode: paymentMode || 'one_time',
        contract_date: contractDate || null,
        contract_url: contractUrl || null,
        magic_code: magicCode,
        language_track: languageTrack || 'korean',
        is_gks_applicant: isGksApplicant || false,
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to create student profile: ' + profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Student profile created successfully:', profile.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        profileId: profile.id,
        userId: studentUserId,
        magicCode: magicCode // Return magic code so staff can share with student
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
