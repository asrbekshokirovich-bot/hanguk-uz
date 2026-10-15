// meta-leadgen-webhook
// ----------------------------------------------------------------------------
// Meta lead forms (Instagram / Facebook) -> `leads`, straight from the form —
// not as a DM that becomes a phone-less card (spec §5, decision 3.1). The form
// has the phone, the campaign, the ad and the answers.
//
//   GET   Meta's subscription check: hub.mode=subscribe, hub.verify_token must be
//         META_VERIFY_TOKEN, the answer is hub.challenge.
//   POST  a delivery: X-Hub-Signature-256 is checked against META_APP_SECRET
//         (fail closed: 503 while the secret is not set, 401 for a bad signature).
//         For every entry[].changes[] with field "leadgen" the lead is fetched from
//         the Graph API with META_PAGE_ACCESS_TOKEN (needs leads_retrieval) and
//         inserted into `leads`: source 'meta_form', source_id = the leadgen id,
//         first_contact_at = the form's own time, campaign / ad set / ad / form
//         names, the ids in `utm`, the answers in `notes` (and in cert_level /
//         age / city / education_level when they clearly match the card's lists).
//
// The database does the rest: the BEFORE INSERT trigger starts the 10-minute
// timer, the AFTER INSERT trigger merges the person into an existing card by
// phone. This function never writes timer fields.
//
// Idempotent: `uq_leads_meta_form` is unique on source_id for source 'meta_form',
// so Meta delivering the same form twice (it retries) inserts once — a unique
// violation counts as success.
//
// The delivery is answered 200 at once and processed after the answer
// (EdgeRuntime.waitUntil), so Meta never retries into a slow Graph API. The raw
// delivery (ids only, no personal data) is logged in instagram_webhook_events
// with event_kind 'leadgen' and marked processed / given an error, so a lead that
// failed can be replayed by hand. Failures go to the console WITHOUT personal
// data: ids and error codes only. One lead failing never fails the others.
//
// AUTH: Meta cannot send a JWT, so verify_jwt is off (config.toml); the
// signature above is the authentication.
//
// Env: META_APP_SECRET, META_VERIFY_TOKEN, META_PAGE_ACCESS_TOKEN.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/identity.ts";
import {
  applyAdInfo,
  applyFormInfo,
  extractLeadgenRefs,
  hubVerification,
  mapGraphLead,
  needsNameLookup,
  verifySignature,
  type GraphLead,
  type LeadgenRef,
} from "./parse.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const GRAPH = "https://graph.facebook.com/v19.0";
const LEAD_FIELDS = "created_time,field_data,ad_id,adset_id,campaign_id,form_id,ad_name,adset_name,campaign_name,form_name";

const admin: any = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

class GraphError extends Error {
  constructor(public status: number, public code: number | null, message: string) {
    super(message);
  }
}

/**
 * GET {GRAPH}/{id}?fields=...  Transient failures (network, 5xx, rate limit)
 * are retried twice. The URL carries the access token, so it is never logged
 * and never put in an error.
 */
async function graphGet(id: string, fields: string, token: string): Promise<any> {
  const url = `${GRAPH}/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
  let last: GraphError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(attempt === 1 ? 500 : 1500);
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch (_e) {
      last = new GraphError(0, null, "network error");
      continue;
    }
    const body = await res.json().catch(() => null);
    if (res.ok && body && !body.error) return body;
    const err = body?.error ?? {};
    last = new GraphError(res.status, typeof err.code === "number" ? err.code : null, String(err.message ?? `HTTP ${res.status}`).slice(0, 160));
    const transient = res.status >= 500 || res.status === 429 || err.is_transient === true || [1, 2, 4, 17, 32, 613].includes(err.code);
    if (!transient) break;
  }
  throw last ?? new GraphError(0, null, "unknown");
}

/** The lead, with the names of its ad / ad set / campaign / form filled in when the lead itself has none. */
async function fetchLead(ref: LeadgenRef, token: string): Promise<GraphLead> {
  let lead: GraphLead;
  try {
    // `platform` says Instagram or Facebook; ask for it, but a Graph version
    // that refuses the field must not cost us the lead.
    lead = await graphGet(ref.leadgen_id, `${LEAD_FIELDS},platform`, token);
  } catch (e) {
    if (e instanceof GraphError && e.status === 400 && e.code === 100) {
      lead = await graphGet(ref.leadgen_id, LEAD_FIELDS, token);
    } else {
      throw e;
    }
  }

  const need = needsNameLookup(lead);
  if (need.ad) {
    try {
      lead = applyAdInfo(lead, await graphGet(lead.ad_id!, "name,adset{name},campaign{name}", token));
    } catch (e) {
      console.warn(`meta-leadgen: ad lookup for lead ${ref.leadgen_id} failed (${describe(e)})`);
    }
  }
  if (need.form) {
    try {
      lead = applyFormInfo(lead, await graphGet(lead.form_id!, "name", token));
    } catch (e) {
      console.warn(`meta-leadgen: form lookup for lead ${ref.leadgen_id} failed (${describe(e)})`);
    }
  }
  return lead;
}

/** Error text that is safe to log: codes and Graph's own message, never a URL or a row. */
function describe(e: unknown): string {
  if (e instanceof GraphError) return `graph ${e.status}${e.code != null ? ` code ${e.code}` : ""}: ${e.message}`;
  return e instanceof Error ? e.message.slice(0, 160) : "error";
}

/** One lead. 'created' | 'duplicate'; throws on anything else. */
async function storeLead(ref: LeadgenRef, token: string): Promise<"created" | "duplicate"> {
  // Meta retries: skip the Graph call for a form we already hold.
  const { data: existing } = await admin
    .from("leads")
    .select("id")
    .eq("source", "meta_form")
    .eq("source_id", ref.leadgen_id)
    .maybeSingle();
  if (existing) return "duplicate";

  const graph = await fetchLead(ref, token);
  const row = mapGraphLead(graph, ref, { normalizePhone });

  const { error } = await admin.from("leads").insert(row);
  if (error) {
    if (error.code === "23505") return "duplicate"; // the unique index: stored by a concurrent delivery
    // code + message only: `details` of a Postgres error can quote the row
    throw new Error(`insert: ${error.code ?? "?"} ${String(error.message ?? "").slice(0, 160)}`);
  }
  return "created";
}

async function processDelivery(refs: LeadgenRef[], eventId: string | null): Promise<void> {
  const token = Deno.env.get("META_PAGE_ACCESS_TOKEN");
  const errors: string[] = [];

  if (!token) {
    errors.push("META_PAGE_ACCESS_TOKEN is not set");
    console.error("meta-leadgen: META_PAGE_ACCESS_TOKEN is not set — leads not fetched");
  } else {
    let created = 0;
    let duplicate = 0;
    for (const ref of refs) {
      try {
        if ((await storeLead(ref, token)) === "created") created++;
        else duplicate++;
      } catch (e) {
        const msg = `${ref.leadgen_id}: ${describe(e)}`;
        errors.push(msg);
        console.error(`meta-leadgen: lead ${msg}`);
      }
    }
    if (created || duplicate) console.log(`meta-leadgen: ${created} lead(s) created, ${duplicate} already stored`);
  }

  if (eventId) {
    const { error } = await admin
      .from("instagram_webhook_events")
      .update(errors.length ? { error: errors.join(" | ").slice(0, 1000) } : { processed: true })
      .eq("id", eventId);
    if (error) console.error("meta-leadgen: could not update the event log:", error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    const v = hubVerification(new URL(req.url).searchParams, Deno.env.get("META_VERIFY_TOKEN"));
    return new Response(v.body, { status: v.status, headers: { "Content-Type": "text/plain" } });
  }
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // Fail closed: without the app secret nothing can be verified, so nothing is processed.
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!appSecret) {
    console.error("meta-leadgen: META_APP_SECRET is not set — refusing to process an unverified delivery");
    return new Response("Signature verification unavailable", { status: 503 });
  }

  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("x-hub-signature-256"), appSecret))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch (_e) {
    return new Response("Bad JSON", { status: 400 });
  }

  const refs = extractLeadgenRefs(body);
  const ack = () =>
    new Response(JSON.stringify({ ok: true, received: refs.length }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (!refs.length) return ack();

  // The raw delivery (ids only) first, so a failure can be replayed.
  let eventId: string | null = null;
  try {
    const { data } = await admin
      .from("instagram_webhook_events")
      .insert({ event_kind: "leadgen", payload: body, processed: false })
      .select("id")
      .single();
    eventId = data?.id ?? null;
  } catch (_e) { /* the log is a convenience, not a gate */ }

  const work = processDelivery(refs, eventId).catch((e) => console.error("meta-leadgen: delivery failed:", describe(e)));
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }
  return ack();
});
