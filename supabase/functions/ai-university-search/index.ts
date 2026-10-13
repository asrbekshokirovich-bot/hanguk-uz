// ai-university-search — the app's university search by field of study, read
// by a language model (owner, 2026-10-13: "IT deb yozsam IT ga aloqador barcha
// universitetlar, stomatologiya deb yozsa faqat stomatologiya yo'nalishi bor
// universitetlar chiqsin").
//
// The student types a field in any language ("IT", "stomatologiya",
// "hamshiralik", "компьютер") and the app calls this while they type. Claude
// turns it into search terms for programme names, and `ai_search_by_field`
// (20261013110000_ai_search_in_database.sql) finds, in one query, every
// university in the app's catalogue with a programme of that field. The model
// never sees or returns a university of its own, so it cannot invent one.
// Fee, TOPIK, city and degree are not read here: the app's Filtr screen does
// those.
//
// What the model read for a text is kept in `ai_search_terms`, so the same
// text — from anyone — reaches the model once. A new call is rationed by a
// daily allowance per signed-in student, per IP for guests, and for the whole
// app (`ai_search_take`, 20261013090000_ai_search_usage.sql).
//
// POST { query: string (2–200 chars) }
// →    { results: [{ institution_id, guideline_id, matched, match_count }],
//        terms: string[],
//        mode: "field"  — the text names a field; `results` are its universities
//            | "none"   — no field in the text (a name, a city): the app's own
//                         name search answers instead
//            | "text"   — the model was unavailable or the allowance is spent:
//                         the same, so the box never stops working }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

import { corsHeaders } from "../_shared/cors.ts";
import { parseTermsReply, queryKey } from "./search.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

/** Fast models first; the next one answers if a model is unavailable. */
const MODELS = ["claude-haiku-5-5", "claude-haiku-4-5"];
const MODEL_TIMEOUT_MS = 8_000;

/** Daily allowances (Tashkent day) for calls that reach the model. */
const LIMIT_USER = 500;
const LIMIT_GUEST_IP = 300;
const LIMIT_GLOBAL = 20_000;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ------------------------------------------------------------------ the model

const SYSTEM = [
  "A student types into the university search of an app for studying in South Korea. Find the FIELD",
  "OF STUDY in the text and return search terms that find the Korean universities' programmes of",
  'that field by name. Reply with JSON only: {"terms": [...]}. The text may be Uzbek (Latin or',
  "Cyrillic), Russian, English or Korean, with typos and slang, and may be unfinished because the",
  "student is still typing.",
  "",
  'Programme names are in English and/or Korean, e.g. "Computer Science and Engineering",',
  '"Dept. of Information Security", "치위생학과 (Dental Hygiene)", "컴퓨터공학과". A term matches',
  'the start of an English word (a stem or a phrase: "comput", "information secur"), a whole short',
  'acronym ("ai", "it", "ict", "sw"), or any part of a Korean name ("컴퓨터", "치위생").',
  "",
  "Rules:",
  "- Give 4-16 terms: English stems AND Korean words, for the field and the programmes that clearly",
  "  belong to it. Include close sub-fields of the same profession.",
  "- Be precise: every term must name ONLY that field. Never a broad word that also names other",
  '  fields: not "information", "data", "cyber", "science", "engineering", "management",',
  '  "정보", "데이터", "공학" alone; use phrases ("information technolog", "data scien",',
  '  "cybersecur", "정보통신", "정보보호", "데이터사이언스").',
  "- Ignore everything that is not a field: cities, fees, TOPIK, degree, university names.",
  '- No field in the text (only a university name, a city, a fee...) -> {"terms": []}.',
  "",
  "Examples:",
  "IT / АйТи / dasturlash -> comput, software, information technolog, information secur, information and",
  "  communication, information system, informatics, cybersecur, cyber secur, artificial intelligence,",
  "  data scien, ai, it, ict, 컴퓨터, 소프트웨어, 정보통신, 정보보호, 정보보안, 인공지능, 데이터사이언스",
  "stomatologiya / стоматология / dentist -> dent, 치의, 치위생, 치기공, 치과",
  "hamshiralik / медсестра / nursing -> nurs, 간호",
  "biznes / менеджмент -> business, 경영",
  "Woosong / Seul / arzon / TOPIK 3 -> (no field) []",
].join("\n");

/** The terms for [query]; null when no model could answer. */
async function readTerms(query: string): Promise<string[] | null> {
  if (!ANTHROPIC_API_KEY) return null;
  for (const model of MODELS) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          max_tokens: 400,
          temperature: 0,
          system: SYSTEM,
          messages: [{ role: "user", content: query }],
        }),
      });
      if (!res.ok) {
        console.error(`readTerms ${model}: ${res.status} ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const data = await res.json();
      const text: string = (data?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
      const terms = parseTermsReply(text);
      if (terms) return terms;
      console.error(`readTerms ${model}: reply was not {"terms": [...]}`);
    } catch (e) {
      console.error(`readTerms ${model}:`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

/** What the model read for this text before, from `ai_search_terms`. */
async function storedTerms(key: string): Promise<string[] | null> {
  const { data, error } = await admin.from("ai_search_terms").select("terms").eq("query_key", key).maybeSingle();
  if (error) console.error("ai_search_terms read:", error.message);
  return (data?.terms as string[] | undefined) ?? null;
}

async function storeTerms(key: string, terms: string[]) {
  const { error } = await admin.from("ai_search_terms").upsert({ query_key: key, terms });
  if (error) console.error("ai_search_terms write:", error.message);
}

// --------------------------------------------------------------- allowance

async function signedInUser(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  // Guests send the publishable key; only a user's token is worth verifying.
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part + "=".repeat((4 - part.length % 4) % 4)));
    if (payload?.role !== "authenticated") return null;
  } catch (_e) {
    return null;
  }
  const { data } = await admin.auth.getUser(token);
  return data?.user?.id ?? null;
}

function clientIp(req: Request): string {
  return (req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    "unknown").trim();
}

/** True when this caller may spend a model call. Fails open. */
async function takeAllowance(req: Request): Promise<boolean> {
  try {
    const user = await signedInUser(req);
    const { data, error } = await admin.rpc("ai_search_take", {
      p_key: user ? `user:${user}` : `ip:${clientIp(req)}`,
      p_limit: user ? LIMIT_USER : LIMIT_GUEST_IP,
      p_global_limit: LIMIT_GLOBAL,
    });
    if (error) {
      console.error("ai_search_take:", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("allowance:", e);
    return true;
  }
}

// ------------------------------------------------------------------ handler

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let query = "";
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query.trim() : "";
  } catch (_e) {
    return json({ error: "invalid JSON" }, 400);
  }
  if (query.length < 2 || query.length > 200) return json({ error: "query must be 2–200 characters" }, 400);

  const key = queryKey(query);
  let terms = await storedTerms(key);
  if (!terms && (await takeAllowance(req))) {
    terms = await readTerms(query);
    // A text with no field is kept too: "Woosong" needs no second call either.
    if (terms) await storeTerms(key, terms);
  }
  if (!terms) return json({ results: [], terms: [], mode: "text" });
  if (terms.length === 0) return json({ results: [], terms, mode: "none" });

  // Every university of the field, not a top few.
  const { data, error } = await admin.rpc("ai_search_by_field", { p_terms: terms });
  if (error) {
    console.error("ai_search_by_field:", error.message);
    return json({ results: [], terms, mode: "text" });
  }
  return json({ results: data ?? [], terms, mode: "field" });
});
