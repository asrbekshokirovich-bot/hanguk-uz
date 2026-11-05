// supabase/functions/backfill-uz/index.ts
//
// One-shot backfill: add Uzbek (`*_uz`) sibling fields to AI-extracted
// `extraction_jobs.parsed_output` payloads. Korean stays source of truth;
// we ADD parallel `<base>_uz` siblings (never remove/overwrite Korean).
//
// POST body: { ids: string[], dry_run?: boolean, mode?: string, tmap?: object }
//   - mode:"extract": return the distinct Korean strings for the ids (union),
//     no translation, no write.
//   - tmap: caller-supplied Korean->Uzbek map, used DIRECTLY (no Gemini) to
//     build `_uz` siblings, then written. Rows not fully covered are skipped.
//   - dry_run: build but do not write; return samples.
// Idempotent: rows already containing any `_uz` key are skipped.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_AI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const HANGUL = /[㄰-㆏가-힣]/;

const SYSTEM_PROMPT =
  `You are a professional translator rendering South Korean university admission documents into Uzbek for Uzbek-speaking reviewers.

You receive a JSON object {"src": [ ...Korean strings... ]}. Return a JSON object {"t": [ ...Uzbek strings... ]} where:
- The "t" array has EXACTLY the same length and order as "src". Exactly one translation per element.
- Translate the full meaning of each string into natural, fluent Uzbek in Latin script (as written in Uzbekistan).
- Preserve numbers, monetary amounts, dates, percentages, phone numbers, university/department proper nouns, and embedded English words or acronyms (TOPIK, IELTS, GPA, SAT, IB, ICT, etc.).
- Translate Korean department/track names to their Uzbek meaning where clear; keep genuinely untranslatable proper nouns as-is.
- You may tidy obvious OCR/line-break artefacts, but stay faithful to the meaning. Preserve newline characters that separate list items.
- Output ONLY the JSON object, no commentary.`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isKo(v) {
  return typeof v === "string" && HANGUL.test(v);
}

function collectKorean(node, set) {
  if (Array.isArray(node)) {
    for (const n of node) {
      if (isKo(n)) set.add(n);
      else collectKorean(n, set);
    }
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) {
      if (isKo(v)) set.add(v);
      else collectKorean(v, set);
    }
  }
}

function uzOf(v, tmap) {
  if (isKo(v)) return tmap[v] ?? v;
  if (Array.isArray(v)) return v.map((e) => (isKo(e) ? (tmap[e] ?? e) : e));
  return v;
}

function applyUz(node, tmap) {
  if (Array.isArray(node)) return node.map((n) => applyUz(n, tmap));
  if (node && typeof node === "object") {
    const src = node;
    const out = {};
    for (const [k, v] of Object.entries(src)) {
      out[k] = v && typeof v === "object" ? applyUz(v, tmap) : v;
      if (k.endsWith("_uz")) continue;
      const base = k.endsWith("_ko") ? k.slice(0, -3) : k;
      const sib = `${base}_uz`;
      if (sib in src) continue;
      if (isKo(v)) {
        out[sib] = tmap[v] ?? v;
      } else if (Array.isArray(v) && v.some(isKo)) {
        out[sib] = uzOf(v, tmap);
      } else if (k.endsWith("_ko") && v === null) {
        out[sib] = null;
      }
    }
    return out;
  }
  return node;
}

function hasUzKey(payload) {
  return /"[^"]*_uz"\s*:/.test(JSON.stringify(payload));
}

async function translateChunk(chunk, apiKey) {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(GEMINI_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ src: chunk }) },
        ],
        temperature: 0,
        max_tokens: 24000,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      lastErr = `gemini ${res.status}: ${(await res.text()).slice(0, 300)}`;
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw new Error(lastErr);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) { lastErr = "gemini: empty content"; continue; }
    let parsed;
    try { parsed = JSON.parse(content); } catch { lastErr = "gemini: malformed JSON"; continue; }
    const t = parsed?.t;
    if (!Array.isArray(t) || t.length !== chunk.length) {
      lastErr = `gemini: length mismatch`;
      continue;
    }
    return t.map((x) => (typeof x === "string" ? x : String(x)));
  }
  throw new Error(lastErr || "translation failed");
}

async function buildTmap(sources, apiKey) {
  const tmap = {};
  let batch = [];
  let chars = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    const t = await translateChunk(batch, apiKey);
    batch.forEach((ko, i) => (tmap[ko] = t[i]));
    batch = [];
    chars = 0;
  };
  for (const s of sources) {
    batch.push(s);
    chars += s.length;
    if (batch.length >= 40 || chars >= 5000) await flush();
  }
  await flush();
  return tmap;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase env not configured" }, 500);
  const admin = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => null);
  const ids = body?.ids;
  const dryRun = body?.dry_run === true;
  const mode = typeof body?.mode === "string" ? body.mode : undefined;
  const providedTmap =
    body?.tmap && typeof body.tmap === "object" && !Array.isArray(body.tmap)
      ? body.tmap
      : undefined;
  if (!Array.isArray(ids) || ids.length === 0) return json({ error: "Missing ids[]" }, 400);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey && !providedTmap && mode !== "extract") {
    return json({ error: "GEMINI_API_KEY not configured" }, 500);
  }

  if (mode === "extract") {
    const union = new Set();
    const perId = {};
    const skipped = [];
    for (const id of ids) {
      const { data, error } = await admin
        .from("extraction_jobs").select("id, parsed_output").eq("id", id).single();
      if (error) { skipped.push({ id, reason: error.message }); continue; }
      const payload = data?.parsed_output;
      if (payload == null) { skipped.push({ id, reason: "no parsed_output" }); continue; }
      if (hasUzKey(payload)) { skipped.push({ id, reason: "already has _uz" }); continue; }
      const set = new Set();
      collectKorean(payload, set);
      perId[id] = set.size;
      for (const s of set) union.add(s);
    }
    const strings = [...union];
    return json({
      mode: "extract",
      ids_in: ids.length,
      distinct: strings.length,
      total_chars: strings.reduce((a, s) => a + s.length, 0),
      per_id: perId,
      skipped,
      strings,
    });
  }

  const results = [];
  for (const id of ids) {
    try {
      const { data, error } = await admin
        .from("extraction_jobs").select("id, parsed_output").eq("id", id).single();
      if (error) throw new Error(error.message);
      const payload = data?.parsed_output;
      if (payload == null) { results.push({ id, status: "skipped", reason: "no parsed_output" }); continue; }
      if (hasUzKey(payload)) { results.push({ id, status: "skipped", reason: "already has _uz" }); continue; }
      const koSet = new Set();
      collectKorean(payload, koSet);
      const sources = [...koSet];
      if (sources.length === 0) { results.push({ id, status: "skipped", reason: "no Korean" }); continue; }

      const tmap = providedTmap
        ? Object.fromEntries(sources.filter((s) => typeof providedTmap[s] === "string").map((s) => [s, providedTmap[s]]))
        : await buildTmap(sources, apiKey);
      const missing = sources.filter((s) => !tmap[s] || tmap[s] === s);
      const projected = applyUz(payload, tmap);

      if (dryRun) {
        const sample = sources.slice(0, 8).map((ko) => ({ ko, uz: tmap[ko] }));
        results.push({ id, status: "dry_run", korean_strings: sources.length, translated: sources.length - missing.length, missing: missing.length, sample });
        continue;
      }

      if (providedTmap && missing.length > 0) {
        results.push({ id, status: "skipped", reason: "tmap missing translations", korean_strings: sources.length, missing: missing.length, missing_sample: missing.slice(0, 20) });
        continue;
      }

      const { error: upErr } = await admin
        .from("extraction_jobs").update({ parsed_output: projected }).eq("id", id);
      if (upErr) throw new Error(upErr.message);
      results.push({ id, status: "updated", korean_strings: sources.length, translated: sources.length - missing.length });
    } catch (e) {
      results.push({ id, status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({ processed: results.length, dry_run: dryRun, results });
});
