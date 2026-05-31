// P1 #31 / A2 / C3: Data-export Edge Function.
//
// Returns a JSON blob with everything Hanguk holds about the calling
// user. The client (Account screen → "Download my data") receives the
// payload, writes it to the app documents dir, and hands it to the
// platform share sheet so the user keeps a copy.
//
// Auth: must be called with the user's bearer token; we derive the
// caller's identity from `auth.uid()` and never trust client-supplied
// IDs.  RLS is on across every public table this function touches
// (see `20260512122000_enable_rls_audit.sql`), so even if the function
// were buggy the database would refuse to leak someone else's data.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Best-effort fetch — if a table doesn't exist on this branch we return
// an empty array rather than failing the whole export.
async function safeSelect(
  client: any,
  table: string,
  ownerColumn: string,
  userId: string,
): Promise<unknown[]> {
  try {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq(ownerColumn, userId);
    if (error) {
      console.warn(`[export-my-data] ${table}: ${error.message}`);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.warn(`[export-my-data] ${table}: threw ${(e as Error).message}`);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "MISSING_AUTH" }),
      { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  // User-scoped client: every query runs as `auth.uid()`, so RLS does
  // the access-control work for us.
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(
      JSON.stringify({ error: "INVALID_TOKEN" }),
      { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  const userId = userData.user.id;

  // Pull every table that may carry user-owned rows. Some tables use
  // `user_id`, some use `student_id`, some use `id` — try each variant.
  const [
    profile,
    profileById,
    applications,
    documents,
    studentSuggestions,
    studyPlanSessions,
    studyPlanDrafts,
    studyPlanAnalyses,
    studyPlanChatHistory,
    interviewSessions,
    interviewMessages,
    interviewFeedback,
    channelMessages,
    userRoles,
  ] = await Promise.all([
    safeSelect(client, "profiles", "user_id", userId),
    safeSelect(client, "profiles", "id", userId),
    safeSelect(client, "applications", "student_id", userId),
    safeSelect(client, "documents", "student_id", userId),
    safeSelect(client, "student_suggestions", "student_id", userId),
    safeSelect(client, "study_plan_sessions", "student_id", userId),
    safeSelect(client, "study_plan_drafts", "student_id", userId),
    safeSelect(client, "study_plan_analyses", "student_id", userId),
    safeSelect(client, "study_plan_chat_history", "student_id", userId),
    safeSelect(client, "interview_sessions", "student_id", userId),
    safeSelect(client, "interview_messages", "student_id", userId),
    safeSelect(client, "interview_feedback", "student_id", userId),
    safeSelect(client, "channel_messages", "sender_id", userId),
    safeSelect(client, "user_roles", "user_id", userId),
  ]);

  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    user: {
      id: userId,
      email: userData.user.email ?? null,
      phone: userData.user.phone ?? null,
      created_at: userData.user.created_at ?? null,
    },
    profiles: [...profile, ...profileById],
    applications,
    documents,
    student_suggestions: studentSuggestions,
    study_plan_sessions: studyPlanSessions,
    study_plan_drafts: studyPlanDrafts,
    study_plan_analyses: studyPlanAnalyses,
    study_plan_chat_history: studyPlanChatHistory,
    interview_sessions: interviewSessions,
    interview_messages: interviewMessages,
    interview_feedback: interviewFeedback,
    channel_messages: channelMessages,
    user_roles: userRoles,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="hanguk-export-${userId}.json"`,
    },
  });
});
