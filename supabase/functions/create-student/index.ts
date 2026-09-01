import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/identity.ts";

interface PhoneInput {
  phone: string;
  label?: string | null;
  is_primary?: boolean;
}

// Normalise the incoming phones[] (or a legacy single `phone`) into a clean,
// de-duplicated list with exactly one primary number.
function normalizePhoneList(phones: unknown, legacyPhone: unknown): PhoneInput[] {
  const raw: PhoneInput[] = Array.isArray(phones)
    ? (phones as PhoneInput[])
    : legacyPhone
      ? [{ phone: String(legacyPhone), is_primary: true }]
      : [];

  const seen = new Set<string>();
  const cleaned: PhoneInput[] = [];
  for (const entry of raw) {
    const value = (entry?.phone ?? "").toString().trim();
    if (!value) continue;
    const norm = normalizePhone(value);
    const key = norm ?? value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ phone: value, label: entry?.label ?? null, is_primary: !!entry?.is_primary });
  }

  if (cleaned.length > 0 && !cleaned.some((p) => p.is_primary)) {
    cleaned[0].is_primary = true;
  }
  return cleaned;
}

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
    const { fullName, phone, phones, officeLocation, paymentPlan, paymentMode, contractDate, contractUrl, isGksApplicant, intakeId, languageTrack, discountPercent } = await req.json();

    // Region, birth date and language track are intentionally NOT accepted here —
    // they are filled automatically from the student's passport/certificates and
    // conversations once those are uploaded (process-document / infer-student-track).
    const phoneList = normalizePhoneList(phones, phone);
    const primaryPhone = phoneList.find((p) => p.is_primary)?.phone ?? null;
    const secondaryPhone = phoneList.find((p) => !p.is_primary)?.phone ?? null;

    // Required fields (mirrors the dialog so the API can't be bypassed). Only the
    // GKS-applicant flag is optional.
    const missing: string[] = [];
    if (!fullName?.trim()) missing.push('full name');
    if (phoneList.length === 0) missing.push('at least one phone number');
    if (!paymentPlan) missing.push('payment plan');
    if (!contractDate) missing.push('contract date');
    if (!contractUrl) missing.push('contract file');
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ error: `Missing required field(s): ${missing.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Discount % is optional (defaults to 0 = no discount) but must be a
    // valid 0-100 number when provided; this is the server-side enforcement
    // point since the DB CHECK constraint would otherwise be the only guard.
    const rawDiscount = discountPercent === undefined || discountPercent === null || discountPercent === ''
      ? 0
      : Number(discountPercent);
    if (Number.isNaN(rawDiscount) || rawDiscount < 0 || rawDiscount > 100) {
      return new Response(
        JSON.stringify({ error: 'Discount percent must be a number between 0 and 100' }),
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

    // Check whether ANY of the submitted numbers already belongs to someone —
    // a profile (phone/additional_phone) or another student's student_phones row.
    for (const entry of phoneList) {
      const norm = normalizePhone(entry.phone);
      const variants = Array.from(new Set([entry.phone, norm].filter(Boolean))) as string[];

      const orProfiles = variants
        .flatMap((v) => [`phone.eq.${v}`, `additional_phone.eq.${v}`])
        .join(',');
      const { data: existingPhone } = await supabaseAdmin
        .from('profiles')
        .select('id, user_id')
        .or(orProfiles)
        .maybeSingle();

      if (existingPhone) {
        const { data: isStaff } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', existingPhone.user_id)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            success: false,
            error: isStaff
              ? `Phone number ${entry.phone} belongs to a staff account`
              : `A student with phone number ${entry.phone} already exists`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (norm) {
        const { data: existingStudentPhone } = await supabaseAdmin
          .from('student_phones')
          .select('id')
          .eq('phone_norm', norm)
          .maybeSingle();
        if (existingStudentPhone) {
          return new Response(
            JSON.stringify({ success: false, error: `A student with phone number ${entry.phone} already exists` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
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
        // Keep phone/additional_phone populated for back-compat with identity
        // resolution; the full set lives in student_phones (inserted below).
        phone: primaryPhone,
        additional_phone: secondaryPhone,
        office_location: officeLocation || null,
        payment_plan: paymentPlan || null,
        payment_mode: paymentMode || 'one_time',
        contract_date: contractDate || null,
        contract_url: contractUrl || null,
        magic_code: magicCode,
        // Staff-selected track at creation; defaults to korean. Auto-fill from
        // certificates/conversations can still refine it later.
        language_track: ['korean', 'english', 'both'].includes(languageTrack) ? languageTrack : 'korean',
        language_track_source: ['korean', 'english', 'both'].includes(languageTrack) ? 'manual' : 'default',
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

    // Persist the full list of phone numbers.
    if (phoneList.length > 0) {
      const { error: phonesError } = await supabaseAdmin
        .from('student_phones')
        .insert(phoneList.map((p) => ({
          student_id: studentUserId,
          phone: p.phone,
          label: p.label || null,
          is_primary: !!p.is_primary,
        })));
      if (phonesError) console.error('Failed to insert student phones:', phonesError);
    }

    // Enroll the student in the active admission intake so they appear in that
    // season's roster immediately. Membership (student_intakes) is the CRM's
    // single source of truth for the per-season roster, so without this a newly
    // created student would be invisible in every season.
    let intakeForStudent: string | null = intakeId || null;
    if (!intakeForStudent) {
      const { data: def } = await supabaseAdmin
        .from('intakes')
        .select('id')
        .eq('is_default', true)
        .order('year', { ascending: false })
        .limit(1)
        .maybeSingle();
      intakeForStudent = def?.id || null;
    }
    if (intakeForStudent) {
      const { error: enrollError } = await supabaseAdmin
        .from('student_intakes')
        .upsert(
          { student_id: studentUserId, intake_id: intakeForStudent, discount_percent: rawDiscount },
          { onConflict: 'student_id,intake_id' },
        );
      if (enrollError) console.error('Failed to enroll student in intake:', enrollError);
    }

    // Record the staff bonus for this student's plan. `staff_bonuses` is owner-only
    // at the table level (security-hardening intent), but the service role can write
    // it — so this works regardless of which staff role created the student.
    if (paymentPlan) {
      const BONUS_AMOUNTS: Record<string, number> = { standart: 100000, premium: 150000, no_risk: 150000 };
      const normalizedPlan = String(paymentPlan).toLowerCase().replace(/[\s-]+/g, '_');
      const bonusAmount = BONUS_AMOUNTS[normalizedPlan];
      if (bonusAmount) {
        const { data: existingBonus } = await supabaseAdmin
          .from('staff_bonuses')
          .select('id')
          .eq('student_id', studentUserId)
          .limit(1)
          .maybeSingle();
        if (!existingBonus) {
          const monthYear = new Date().toISOString().slice(0, 7);
          const { error: bonusError } = await supabaseAdmin
            .from('staff_bonuses')
            .insert({
              student_id: studentUserId,
              plan_type: normalizedPlan,
              bonus_amount: bonusAmount,
              currency: 'UZS',
              status: 'pending',
              month_year: monthYear,
            });
          if (bonusError) console.error('Failed to create staff bonus:', bonusError);
        }
      }
    }

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
