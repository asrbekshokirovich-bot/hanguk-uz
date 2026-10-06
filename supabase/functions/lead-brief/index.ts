// lead-brief
// ----------------------------------------------------------------------------
// The AI brief and the AI reply draft of a lead (spec §7.1, §7.2, §10).
//
// pg_cron calls it every 2 minutes (lead-brief, service-role bearer). A run
// takes up to 5 leads whose client wrote at least 2 minutes ago and whose brief
// is older than that message, and for each one:
//
//   1. reads the conversation — lead_timeline_v2(lead, 60): every channel, our
//      calls, the events — and asks Gemini (_shared/gemini.ts generateJSON) for
//        { brief, reply_draft, missing, field_suggestions }
//   2. field_suggestions -> lead_field_suggestions (status 'pending'), only for
//      fields that are EMPTY on the card; an existing suggestion (pending or
//      already decided) is left alone. Nothing is ever written into the card's
//      own fields.
//   3. if the last thing said is the client's and there is a chat to answer on
//      (instagram / telegram), the draft -> lead_drafts(kind 'ai_reply',
//      dedupe_key 'ai:<lead>:<client message time>'). Never sent automatically;
//      it shows on BUGUN as "Yuborish / Tahrir / O'tkazib yuborish".
//   4. leads.ai_summary = brief, ai_brief_at = now(), ai_brief_msg_at = the
//      client message time that was briefed — LAST, so a lead that failed
//      half-way is picked again, and a message that arrives meanwhile is picked
//      up on the next run. Replaying a run changes nothing (the draft key and
//      the suggestion rows are unique).
//
// The prompt and every check on the answer (prices only from lead_settings.offers,
// no forbidden word, no discount, phone only after the answer) are pure functions
// in brief.ts. A bad draft is dropped, the brief is still written. One lead
// failing never stops the others; a lead that keeps failing sits out 10 minutes.
//
// Without GEMINI_API_KEY the run answers 200 { skipped: "no_key" }.
// `?dry=1` lists the leads that would be briefed and does nothing else.
//
// AUTH: verify_jwt is off at the gateway (config.toml); the caller is checked in
// _shared/service-auth.ts.
//
// Env: GEMINI_API_KEY.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateJSON } from "../_shared/gemini.ts";
import { isServiceRequest, restJwtVerifier } from "../_shared/service-auth.ts";
import {
  BRIEF_SCHEMA,
  buildBriefPrompt,
  draftKey,
  lastClientMessage,
  needsBrief,
  pickDraftChannel,
  validateBriefResponse,
  type BriefLead,
  type BriefSettings,
  type Offers,
  type TimelineRow,
} from "./brief.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "gemini-2.5-flash"; // the default of _shared/gemini.ts generateJSON

const BATCH = 5;
/** Candidates fetched per run (newest client message first); the rest of the filter is in code. */
const CANDIDATE_WINDOW = 300;
const LOOKBACK_DAYS = 30;
const FAIL_LIMIT = 2;
const FAIL_PAUSE_MS = 10 * 60_000;

const LEAD_COLUMNS = [
  "id", "full_name", "phone", "source", "stage", "language", "merged_into_id", "matched_student_id",
  "last_client_msg_at", "ai_brief_msg_at", "ai_brief_at", "ai_summary", "crm_generation",
  "education_level", "cert_level", "age", "study_year", "city", "decider", "target_intake", "budget_range",
  "product_fit", "objection", "competitor", "campaign_name", "form_name", "ad_name",
].join(", ");

const verifyJwt = restJwtVerifier(SUPABASE_URL);

/** This instance's memory: leads being briefed right now, and leads that keep failing. */
const inFlight = new Set<string>();
const failures = new Map<string, { count: number; until: number }>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!(await isServiceRequest(req, {
    serviceKey: SERVICE_KEY,
    secretKeysJson: Deno.env.get("SUPABASE_SECRET_KEYS"),
    verifyJwt,
  }))) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!Deno.env.get("GEMINI_API_KEY")) return json({ ok: true, skipped: "no_key" });

  const supabase: any = createClient(SUPABASE_URL, SERVICE_KEY);
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  try {
    const now = Date.now();
    const candidates = await pickLeads(supabase, now);
    if (dry) {
      return json({ ok: true, dry: true, picked: candidates.map((l) => ({ id: l.id, last_client_msg_at: l.last_client_msg_at })) });
    }
    if (!candidates.length) return json({ ok: true, picked: 0, briefed: 0, drafts: 0, failed: 0 });

    const settings = await loadSettings(supabase);
    const results = await Promise.allSettled(candidates.map((l) => briefOne(supabase, l, settings)));

    let briefed = 0;
    let drafts = 0;
    let failed = 0;
    results.forEach((r, i) => {
      const id = candidates[i].id;
      if (r.status === "fulfilled") {
        briefed++;
        if (r.value.draft) drafts++;
        failures.delete(id);
      } else {
        failed++;
        const f = failures.get(id) ?? { count: 0, until: 0 };
        f.count++;
        if (f.count >= FAIL_LIMIT) f.until = Date.now() + FAIL_PAUSE_MS;
        failures.set(id, f);
        // the lead id only: the message can hold the client's words
        console.error(`lead-brief: lead ${id} failed:`, r.reason instanceof Error ? r.reason.message : String(r.reason));
      }
    });

    if (briefed || failed) console.log(`lead-brief: ${candidates.length} picked, ${briefed} briefed, ${drafts} draft(s), ${failed} failed`);
    return json({ ok: true, picked: candidates.length, briefed, drafts, failed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("lead-brief failed:", message);
    return json({ ok: false, error: message }, 500);
  }
});

/**
 * Up to BATCH leads that need a brief. PostgREST cannot compare two columns,
 * so the database narrows it down (a client message in the last 30 days, at
 * least 2 minutes old, not merged, not a student) and needsBrief() makes the
 * "brief older than the message" decision.
 */
async function pickLeads(supabase: any, now: number): Promise<BriefLead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .not("last_client_msg_at", "is", null)
    .gte("last_client_msg_at", new Date(now - LOOKBACK_DAYS * 86_400_000).toISOString())
    .lte("last_client_msg_at", new Date(now - 2 * 60_000).toISOString())
    .is("merged_into_id", null)
    .is("matched_student_id", null)
    .neq("stage", "student")
    .order("last_client_msg_at", { ascending: false })
    .limit(CANDIDATE_WINDOW);
  if (error) throw new Error(`leads: ${error.message}`);

  return ((data ?? []) as BriefLead[])
    .filter((l) => needsBrief(l, now))
    .filter((l) => !inFlight.has(l.id))
    .filter((l) => {
      const f = failures.get(l.id);
      return !(f && f.count >= FAIL_LIMIT && f.until > now);
    })
    .slice(0, BATCH);
}

async function loadSettings(supabase: any): Promise<BriefSettings> {
  const { data, error } = await supabase
    .from("lead_settings")
    .select("key, value")
    .in("key", ["offers", "forbidden_words", "auto_reply"]);
  if (error) throw new Error(`lead_settings: ${error.message}`);
  const map = new Map<string, any>((data ?? []).map((r: any) => [r.key, r.value]));
  const offers = (map.get("offers") && typeof map.get("offers") === "object" ? map.get("offers") : {}) as Offers;
  const forbiddenWords = (Array.isArray(map.get("forbidden_words")) ? map.get("forbidden_words") : []).map(String);
  const auto = map.get("auto_reply") ?? {};
  const autoReplyTexts = [auto?.uz, auto?.ru].filter((t: unknown): t is string => typeof t === "string" && t.trim() !== "");
  return { offers, forbiddenWords, autoReplyTexts };
}

async function briefOne(supabase: any, lead: BriefLead, settings: BriefSettings): Promise<{ draft: boolean }> {
  inFlight.add(lead.id);
  try {
    const lastClientMsgAt = lead.last_client_msg_at as string;
    const nowIso = new Date().toISOString();

    const { data: tl, error: tlErr } = await supabase.rpc("lead_timeline_v2", { p_lead_id: lead.id, p_limit: 60 });
    if (tlErr) throw new Error(`timeline: ${tlErr.message}`);
    const timeline = (tl ?? []) as TimelineRow[];

    // A lead whose messages cannot be found has nothing to summarise: stop
    // picking it for this message, leave the card's summary as it is.
    if (!timeline.some((r) => r.kind === "message_in")) {
      await markBriefed(supabase, lead.id, lastClientMsgAt, nowIso, null);
      return { draft: false };
    }

    const { isClient, row: lastRow } = lastClientMessage(timeline, settings.autoReplyTexts);
    const { systemInstruction, prompt } = buildBriefPrompt({
      lead,
      timelineNewestFirst: timeline,
      settings,
      lastIsClient: isClient,
    });

    const answer = await generateJSON<any>({
      prompt,
      systemInstruction,
      schema: BRIEF_SCHEMA,
      temperature: 0.3,
    });
    const checked = validateBriefResponse(answer, { lead, settings, lastIsClient: isClient });
    if (!checked) throw new Error("model answer had no usable brief");
    if (checked.draftRejected) console.warn(`lead-brief: lead ${lead.id}: draft dropped (${checked.draftRejected.split(":")[0]})`);

    // 2. field suggestions — insert only, never over an existing row
    if (checked.suggestions.length) {
      const { error } = await supabase.from("lead_field_suggestions").upsert(
        checked.suggestions.map((s) => ({
          lead_id: lead.id,
          field: s.field,
          suggested_value: s.value,
          confidence: 0.75,
          evidence: null,
          evidence_channel: null,
          sources: { via: "lead-brief", client_msg_at: lastClientMsgAt },
          model: MODEL,
          status: "pending",
          updated_at: nowIso,
        })),
        { onConflict: "lead_id,field", ignoreDuplicates: true },
      );
      if (error) throw new Error(`suggestions: ${error.message}`);
    }

    // 3. the reply draft
    let draftWritten = false;
    const channel = pickDraftChannel(lastRow, lead);
    if (isClient && checked.replyDraft && channel) {
      const key = draftKey(lead.id, lastClientMsgAt);
      // lead_drafts.dedupe_key is a PARTIAL unique index, which ON CONFLICT cannot
      // name from here: insert, and treat "already there" (23505) as done.
      const { error } = await supabase.from("lead_drafts").insert({
        lead_id: lead.id,
        kind: "ai_reply",
        channel,
        text: checked.replyDraft,
        due_at: nowIso,
        dedupe_key: key,
      });
      if (error && error.code !== "23505") throw new Error(`draft: ${error.message}`);
      if (!error) {
        draftWritten = true;
        // an older, unsent AI draft is stale now that the client wrote again
        await supabase
          .from("lead_drafts")
          .update({ status: "skipped", handled_at: nowIso })
          .eq("lead_id", lead.id)
          .eq("kind", "ai_reply")
          .eq("status", "pending")
          .neq("dedupe_key", key);
      }
    }

    // 4. the brief — last
    await markBriefed(supabase, lead.id, lastClientMsgAt, nowIso, checked.brief, lead);
    return { draft: draftWritten };
  } finally {
    inFlight.delete(lead.id);
  }
}

/** ai_summary (when there is one), ai_brief_at, ai_brief_msg_at. */
async function markBriefed(
  supabase: any,
  leadId: string,
  lastClientMsgAt: string,
  nowIso: string,
  brief: string | null,
  lead?: BriefLead,
): Promise<void> {
  const patch: Record<string, unknown> = { ai_brief_at: nowIso, ai_brief_msg_at: lastClientMsgAt };
  if (brief) {
    patch.ai_summary = brief;
    // The first brief on a card that already holds text there (an old card's
    // 05.10 analysis, spec §16) would overwrite it: keep a copy in the events.
    if (lead && !lead.ai_brief_at && lead.ai_summary && lead.ai_summary.trim() && lead.ai_summary.trim() !== brief) {
      const { error } = await supabase.from("lead_events").insert({
        lead_id: leadId,
        kind: "field",
        payload: { keys: ["ai_summary"], previous_ai_summary: lead.ai_summary.slice(0, 4000), by: "lead-brief" },
      });
      if (error) console.error(`lead-brief: could not keep the previous summary of lead ${leadId}:`, error.message);
    }
  }
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) throw new Error(`lead update: ${error.message}`);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
