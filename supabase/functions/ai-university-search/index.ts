// ai-university-search — the app's university search by field of study, read
// by a language model (owner, 2026-10-13: "IT deb yozsam IT ga aloqador barcha
// universitetlar, stomatologiya deb yozsa faqat stomatologiya yo'nalishi bor
// universitetlar chiqsin").
//
// The student types a field in any language ("IT", "stomatologiya",
// "hamshiralik", "компьютер") and the app calls this while they type. Gemini
// turns it into search terms for programme names; search.ts finds every
// university in the app's catalogue (`v_app_university_catalog`) with a
// programme of that field. The model never sees or returns a university of its
// own, so it cannot invent one. Fee, TOPIK, city and degree are not read here:
// the app's Filtr screen does those.
//
// Open to guests and students alike, with a daily allowance per signed-in
// student, per IP for guests, and for the whole app (`ai_search_take`,
// 20261013090000_ai_search_usage.sql).
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
import { type CatalogRow, type FacultyRow, sanitizeTerms, searchByField } from "./search.ts";

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
  loadedAt: number;
}

const CATALOG_TTL_MS = 10 * 60_000;
let catalog: Catalog | null = null;
let loading: Promise<Catalog> | null = null;

function loadCatalog(): Promise<Catalog> {
  if (catalog && Date.now() - catalog.loadedAt < CATALOG_TTL_MS) return Promise.resolve(catalog);
  if (loading) return loading;
  loading = (async () => {
    // The order the app reads it in (the newest intake first).
    const { data: rows, error } = await admin
      .from("v_app_university_catalog")
      .select(
        "guideline_id, institution_id, daraja, narx_valyuta, kontrakt_min, kontrakt_max, kontrakt_davri, " +
          "is_partner, is_active",
      )
      .order("qabul_yili", { ascending: false });
    if (error) throw new Error(`catalogue: ${error.message}`);

    // Thousands of faculty rows: read past the API's 1000-row page.
    const faculties: FacultyRow[] = [];
    const PAGE = 1000;
    for (let from = 0;; from += PAGE) {
      const { data, error: e } = await admin
        .from("v_app_university_faculties")
        .select("guideline_id, fakultet_en, fakultet_kr")
        .order("guideline_id")
        .order("tartib")
        .range(from, from + PAGE - 1);
      if (e) throw new Error(`faculties: ${e.message}`);
      faculties.push(...((data ?? []) as FacultyRow[]));
      if (!data || data.length < PAGE) break;
    }

    const fresh: Catalog = {
      rows: (rows ?? []) as unknown as CatalogRow[],
      faculties,
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

const TERMS_SCHEMA = {
  type: "OBJECT",
  properties: { terms: { type: "ARRAY", items: { type: "STRING" } } },
  required: ["terms"],
};

const SYSTEM = [
  "A student types into the university search of an app for studying in South Korea. Find the FIELD",
  "OF STUDY in the text and return search terms that find the Korean universities' programmes of",
  'that field by name, as JSON {"terms": [...]}. The text may be Uzbek (Latin or Cyrillic), Russian,',
  "English or Korean, with typos and slang, and may be unfinished because the student is still typing.",
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

async function readTerms(query: string): Promise<string[] | null> {
  if (!GEMINI_API_KEY) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: query }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 400,
          responseMimeType: "application/json",
          responseSchema: TERMS_SCHEMA,
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
  return sanitizeTerms(JSON.parse(text));
}

/** The same text typed again (or by someone else) needs no second call. */
const TERMS_CACHE_MAX = 500;
const termsCache = new Map<string, string[]>();

function cacheTerms(key: string, terms: string[]) {
  if (termsCache.size >= TERMS_CACHE_MAX) {
    termsCache.delete(termsCache.keys().next().value!);
  }
  termsCache.set(key, terms);
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
  let terms = termsCache.get(key) ?? null;
  if (!terms && (await takeAllowance(req))) {
    try {
      terms = await readTerms(query);
      if (terms) cacheTerms(key, terms);
    } catch (e) {
      console.error("readTerms:", e instanceof Error ? e.message : e);
    }
  }
  if (!terms) return json({ results: [], terms: [], mode: "text" });
  if (terms.length === 0) return json({ results: [], terms, mode: "none" });

  // Every university of the field, not a top few.
  const hits = searchByField(c.rows, c.faculties, terms);
  return json({
    results: hits.map((h) => ({
      institution_id: h.institution_id,
      guideline_id: h.guideline_id,
      matched: h.matched,
      match_count: h.matchCount,
    })),
    terms,
    mode: "field",
  });
});
