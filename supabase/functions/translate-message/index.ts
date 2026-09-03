// translate-message — short-text translation for the CRM inbox.
//
// Two callers, one function:
//   • reading — an inbound message in a language the operator does not read
//   • writing — the operator types in Uzbek and sends in Korean
//
// WHY NOT translate-fields. The September 2026 audit suggested reusing it, and
// reading it showed that was wrong on two counts. It is gated by
// `fn_can_review_uni_db` — the university-data reviewer role, which a call
// operator does not have — so the inbox would get 403. And its system prompt is
// written for Korean admission documents: "keep codes and percentages intact",
// no register, no politeness. Chat needs the opposite instructions. Same
// provider and the same fallback ladder, different job.
//
// Auth: staff JWT (owner / admin / call_operator), the same roles that may
// read the conversation being translated.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const MODELS = ["claude-opus-4-7", "claude-sonnet-4-6"];
const STAFF_ROLES = ["owner", "admin", "call_operator"];
const MAX_TEXTS = 50;
const MAX_CHARS = 4000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

const LANG_NAME: Record<string, string> = {
  uz: "Uzbek",
  ru: "Russian",
  en: "English",
  ko: "Korean",
};

async function staffUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", data.user.id);
  const ok = (roles ?? []).some((r: any) => STAFF_ROLES.includes(String(r.role)));
  return ok ? data.user.id : null;
}

/**
 * The instructions matter more than the model here. A student's message is
 * often half-Uzbek half-Russian with no punctuation, and a reply typed by an
 * operator must not arrive sounding curt — Korean in particular is rude
 * without the right ending, and a literal translation of "send the document"
 * is an order.
 */
function buildSystem(target: string): string {
  const name = LANG_NAME[target] ?? "English";
  return [
    `You translate short chat messages between a study-abroad agency and its students into ${name}.`,
    `Translate meaning, not words: these are informal messages, often mixing languages, with typos and no punctuation.`,
    `Keep names, numbers, dates, amounts, university names and document names exactly as they appear.`,
    `Keep the tone of a helpful person doing their job — polite and plain. In Korean use the 해요체 register.`,
    `Do not add greetings, sign-offs, explanations or anything the original does not say.`,
    `If an input is empty, or already ${name}, return it unchanged.`,
    `Return ONLY a JSON object {"translations": [...]} whose array has exactly the same length and order as the input "texts" array.`,
  ].join(" ");
}

async function callAnthropic(model: string, system: string, texts: string[]): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0,
      system,
      messages: [{ role: "user", content: JSON.stringify({ texts }) }],
    }),
  });
  if (!resp.ok) throw new Error(`anthropic(${model}) ${resp.status} ${(await resp.text()).slice(0, 200)}`);
  const d = await resp.json();
  const text = Array.isArray(d.content)
    ? d.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
    : "";
  if (!text) throw new Error(`anthropic(${model}) empty response`);
  return text;
}

/**
 * Never return fewer items than were asked for: the caller pairs the result
 * with its inputs by index, and a short array would silently shift every
 * translation onto the wrong message.
 */
function parseTranslations(raw: string, n: number): string[] {
  let t = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let obj: any;
  try {
    obj = JSON.parse(t);
  } catch {
    const s = t.indexOf("{");
    const e = t.lastIndexOf("}");
    obj = s !== -1 && e > s ? JSON.parse(t.slice(s, e + 1)) : { translations: [] };
  }
  const arr = Array.isArray(obj.translations) ? obj.translations : [];
  return Array.from({ length: n }, (_, i) => (typeof arr[i] === "string" ? arr[i] : ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const uid = await staffUserId(req.headers.get("Authorization"));
  if (!uid) return json(403, { error: "forbidden" });
  if (!ANTHROPIC_API_KEY) return json(500, { error: "ai_not_configured" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  const texts = Array.isArray(body.texts) ? body.texts.map((x: unknown) => String(x ?? "")) : null;
  if (!texts) return json(400, { error: "texts_array_required" });
  if (texts.length === 0) return json(200, { translations: [] });
  if (texts.length > MAX_TEXTS) return json(400, { error: "too_many_texts" });
  if (texts.some((x: string) => x.length > MAX_CHARS)) return json(400, { error: "text_too_long" });

  const target = String(body.target_lang ?? "en").toLowerCase();
  if (!LANG_NAME[target]) return json(400, { error: "unsupported_target_lang" });

  const system = buildSystem(target);
  const errors: string[] = [];
  for (const model of MODELS) {
    try {
      const raw = await callAnthropic(model, system, texts);
      return json(200, {
        translations: parseTranslations(raw, texts.length),
        target_lang: target,
        model,
      });
    } catch (e) {
      errors.push(String(e).slice(0, 200));
    }
  }
  const joined = errors.join(" | ");
  console.error("translate-message error", joined);
  return json(502, { error: "translation_failed", detail: joined });
});
