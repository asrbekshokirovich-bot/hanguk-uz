// ai-university-search — the app's university search, read by a language
// model (owner, 2026-10-13: "qidiruvda yozganda sun'iy intellekt topsin").
//
// The student types anything ("Seulda arzon IT", "TOPIKsiz Daejeon",
// "Woosong") and the app calls this while they type. Gemini turns the text
// into a small structured intent; search.ts then finds and ranks the matching
// universities among the ones the app's catalogue shows
// (`v_app_university_catalog`, the CRM's "Ma'lumotli" universities). The model
// never sees or returns a university of its own, so it cannot invent one.
//
// Open to guests and students alike, with a daily allowance per signed-in
// student, per IP for guests, and for the whole app (`ai_search_take`,
// 20261013090000_ai_search_usage.sql). Over the allowance, or when the model
// fails, the answer is a plain name search (`mode: "text"`) instead of an
// error, so the search box never stops working.
//
// POST { query: string (2–200 chars) }
// →    { results: [{ institution_id, guideline_id, matched, match_count }],
//        interpreted: { cities, keywords, name, degree, max_tuition_krw,
//                       topik_max, type, english_only, partner_only },
//        relaxed: string[], mode: "ai" | "text" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

import { corsHeaders } from "../_shared/cors.ts";
import {
  type CatalogRow,
  EMPTY_INTENT,
  type FacultyRow,
  fallbackIntent,
  type Intent,
  sanitizeIntent,
  searchCatalog,
} from "./search.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const MODEL = "gemini-2.5-flash";
const MODEL_TIMEOUT_MS = 8_000;

/** Daily allowances (Tashkent day). A typed query costs a few calls. */
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

// ---------------------------------------------------------------- catalogue

interface Catalog {
  rows: CatalogRow[];
  faculties: FacultyRow[];
  cities: string[];
  names: string[];
  loadedAt: number;
}

const CATALOG_TTL_MS = 10 * 60_000;
let catalog: Catalog | null = null;
let loading: Promise<Catalog> | null = null;

function loadCatalog(): Promise<Catalog> {
  if (catalog && Date.now() - catalog.loadedAt < CATALOG_TTL_MS) return Promise.resolve(catalog);
  if (loading) return loading;
  loading = (async () => {
    // The order the app reads it in, so "the guideline for a degree" is the
    // same one its card shows (the newest intake first).
    const { data: rows, error } = await admin
      .from("v_app_university_catalog")
      .select(
        "guideline_id, institution_id, name_ko, name_ko_short, name_en, city_ko, institution_type, " +
          "univ_nomi_en, univ_nomi_kr, shahar, daraja, english_track, topik_min, narx_valyuta, " +
          "kontrakt_min, kontrakt_max, kontrakt_davri, is_partner, is_active",
      )
      .order("qabul_yili", { ascending: false });
    if (error) throw new Error(`catalogue: ${error.message}`);

    // Thousands of faculty rows: read past the API's 1000-row page.
    const faculties: FacultyRow[] = [];
    const PAGE = 1000;
    for (let from = 0;; from += PAGE) {
      const { data, error: e } = await admin
        .from("v_app_university_faculties")
        .select("guideline_id, kollej_en, fakultet_en, kollej_kr, fakultet_kr")
        .order("guideline_id")
        .order("tartib")
        .range(from, from + PAGE - 1);
      if (e) throw new Error(`faculties: ${e.message}`);
      faculties.push(...((data ?? []) as FacultyRow[]));
      if (!data || data.length < PAGE) break;
    }

    const list = (rows ?? []) as unknown as CatalogRow[];
    const active = list.filter((r) => r.is_active !== false);
    const fresh: Catalog = {
      rows: list,
      faculties,
      cities: [...new Set(active.map((r) => (r.shahar ?? "").trim()).filter(Boolean))].sort(),
      names: [...new Set(active.map((r) => (r.univ_nomi_en ?? r.name_en ?? "").trim()).filter(Boolean))].sort(),
      loadedAt: Date.now(),
    };
    catalog = fresh;
    return fresh;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

// ------------------------------------------------------------------ the model

const INTENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    cities: { type: "ARRAY", items: { type: "STRING" } },
    name: { type: "STRING", nullable: true },
    degree: { type: "STRING", nullable: true, enum: ["bakalavr", "magistratura"] },
    max_tuition_krw: { type: "NUMBER", nullable: true },
    topik_max: { type: "INTEGER", nullable: true },
    type: { type: "STRING", nullable: true, enum: ["national", "private"] },
    english_only: { type: "BOOLEAN", nullable: true },
    partner_only: { type: "BOOLEAN", nullable: true },
  },
  required: ["keywords", "cities"],
};

function systemInstruction(c: Catalog): string {
  return [
    "You read what a student typed into the university search of an app for studying in South Korea",
    "and return the search conditions as JSON. The text may be Uzbek (Latin or Cyrillic), Russian,",
    'English or Korean, with typos, Uzbek case endings ("Seulda", "Busandagi") and slang. It may be',
    "unfinished because the student is still typing: read what is there and do not guess beyond it.",
    "",
    "Fields (leave a field null or empty when the text does not say it):",
    "- name: a university the student names, written exactly as in the list below (fix typos and",
    '  transliterations: "vusong" -> "Woosong University"). Only when the text names one university.',
    "- cities: cities or provinces, written exactly as in the city list below when one fits;",
    '  a province ("Gyeonggi", "Chungnam") as its English short name.',
    "- keywords: the field of study, as 1-5 short English word stems that begin words in faculty",
    '  names ("comput", "software", "nurs", "business", "econom", "design", "korean") AND the',
    '  same field as 1-3 Korean words ("컴퓨터", "소프트웨어", "간호", "경영"). IT means computer,',
    "  software, information and AI. Empty when no field is named.",
    '- degree: "bakalavr" for bachelor\'s, "magistratura" for master\'s.',
    "- max_tuition_krw: the highest tuition per SEMESTER in Korean won. Convert: USD x 1400,",
    '  Uzbek so\'m / 9, per year / 2. "arzon" / "cheap" alone means 3000000.',
    '- topik_max: the TOPIK level the student has. "TOPIKsiz", "without TOPIK", "TOPIK shart emas"',
    "  means 0.",
    '- type: "national" for state universities (davlat), "private" for private ones (xususiy).',
    "- english_only: true when the student wants to study in English.",
    "- partner_only: true when the student asks for the agency's partner universities (hamkor).",
    "",
    `Cities: ${c.cities.join(", ")}.`,
    `Universities: ${c.names.join("; ")}.`,
  ].join("\n");
}

async function readIntent(query: string, c: Catalog): Promise<Intent | null> {
  if (!GEMINI_API_KEY) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction(c) }] },
        contents: [{ role: "user", parts: [{ text: query }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 400,
          responseMimeType: "application/json",
          responseSchema: INTENT_SCHEMA,
          // A lookup, not a puzzle: thinking would only add latency.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status} ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const text: string = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
    "";
  if (!text) return null;
  return sanitizeIntent(JSON.parse(text));
}

/** The same text typed again (or by someone else) needs no second call. */
const INTENT_CACHE_MAX = 500;
const intentCache = new Map<string, Intent>();

function cacheIntent(key: string, intent: Intent) {
  if (intentCache.size >= INTENT_CACHE_MAX) {
    intentCache.delete(intentCache.keys().next().value!);
  }
  intentCache.set(key, intent);
}

// --------------------------------------------------------------- allowance

/** Verified student ids by token, so typing does not verify on every key. */
const userByToken = new Map<string, { id: string | null; until: number }>();

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
  const hit = userByToken.get(token);
  if (hit && hit.until > Date.now()) return hit.id;
  const { data } = await admin.auth.getUser(token);
  const id = data?.user?.id ?? null;
  if (userByToken.size > 2000) userByToken.clear();
  userByToken.set(token, { id, until: Date.now() + 5 * 60_000 });
  return id;
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

const normalizeQuery = (q: string) => q.toLowerCase().replace(/\s+/g, " ").trim();

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

  let c: Catalog;
  try {
    c = await loadCatalog();
  } catch (e) {
    console.error(e);
    return json({ error: "catalogue unavailable" }, 503);
  }

  const key = normalizeQuery(query);
  let intent = intentCache.get(key) ?? null;
  let mode: "ai" | "text" = "ai";
  if (!intent) {
    if (await takeAllowance(req)) {
      try {
        intent = await readIntent(query, c);
        if (intent) cacheIntent(key, intent);
      } catch (e) {
        console.error("readIntent:", e instanceof Error ? e.message : e);
      }
    }
    if (!intent) {
      intent = fallbackIntent(query);
      mode = "text";
    }
  }

  // Every match, not a top few: what fits the student's conditions all shows.
  const { hits, relaxed } = searchCatalog(c.rows, c.faculties, intent ?? EMPTY_INTENT, 200);
  return json({
    results: hits.map((h) => ({
      institution_id: h.institution_id,
      guideline_id: h.guideline_id,
      matched: h.matched,
      match_count: h.matchCount,
    })),
    interpreted: {
      keywords: intent.keywords,
      cities: intent.cities,
      name: intent.name,
      degree: intent.degree,
      max_tuition_krw: intent.maxTuitionKrw,
      topik_max: intent.topikMax,
      type: intent.type,
      english_only: intent.englishOnly,
      partner_only: intent.partnerOnly,
    },
    relaxed,
    mode,
  });
});
