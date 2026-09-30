// translate-app-texts — fill in the English, Korean and Russian names of the
// admission documents shown in the app's university catalogue.
//
// The guideline Excel is filled in Uzbek, so `university_guideline_docs
// .hujjat_nomi` is Uzbek. The app shows it in the language the student chose
// (owner, 2026-09-30: everything but faculty names follows the app language),
// reading the translation from `app_text_translations`
// (20260930220000_app_text_translations.sql). Names already there were
// translated by hand; this function translates any name added since, and runs
// every 30 minutes from pg_cron (translate-app-texts-30min).
//
// Called with the project's secret key in `apikey`, or the service-role key as
// a Bearer token — never by the app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const MODELS = ["claude-opus-4-7", "claude-sonnet-4-6"];
const BATCH = 40;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A secret key in `apikey`, or the service-role key itself as a Bearer. */
function authorized(req: Request): boolean {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_") && knownSecretKeys().includes(apikey)) return true;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer !== "" && bearer === SERVICE_KEY;
}

function knownSecretKeys(): string[] {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!raw) return [];
    return Object.values(JSON.parse(raw)).filter((v): v is string => typeof v === "string");
  } catch (_e) {
    return [];
  }
}

const SYSTEM =
  "You translate the names of admission documents for Korean universities from Uzbek " +
  "into English, Korean and Russian, as a university admissions office would write them " +
  "(e.g. 'Ariza formasi' → Application form / 입학원서 / Заявление-анкета; " +
  "'Pasport nusxasi' → Passport copy / 여권 사본 / Копия паспорта). Keep abbreviations " +
  "such as ARC, TOPIK, IELTS as they are. Reply with JSON only: an array with one object " +
  '{"en": "...", "ko": "...", "ru": "..."} per input, in the same order.';

type Row = { en: string; ko: string; ru: string };

async function translate(names: string[]): Promise<Row[]> {
  let lastError = "";
  for (const model of MODELS) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(names) }],
      }),
    });
    if (!resp.ok) {
      lastError = `${model} ${resp.status} ${(await resp.text()).slice(0, 200)}`;
      continue;
    }
    const data = await resp.json();
    const text: string = (data?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    try {
      const rows = JSON.parse(text.slice(start, end + 1)) as Row[];
      if (Array.isArray(rows) && rows.length === names.length &&
          rows.every((r) => r && typeof r.en === "string" && typeof r.ko === "string" && typeof r.ru === "string")) {
        return rows;
      }
      lastError = `${model}: answer did not match the input`;
    } catch (_e) {
      lastError = `${model}: answer was not JSON`;
    }
  }
  throw new Error(lastError || "no model answered");
}

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);
  if (!ANTHROPIC_API_KEY) return json({ error: "ai_not_configured" }, 500);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("fn_app_texts_untranslated", { p_limit: BATCH });
  if (error) return json({ error: error.message }, 500);

  const names = ((data ?? []) as { source: string }[]).map((r) => r.source);
  if (!names.length) return json({ ok: true, translated: 0 });

  try {
    const rows = await translate(names);
    const { error: upsertError } = await supabase.from("app_text_translations").upsert(
      names.map((source, i) => ({
        source,
        en: rows[i].en.trim(),
        ko: rows[i].ko.trim(),
        ru: rows[i].ru.trim(),
        translated_by: "ai",
      })),
      { onConflict: "source" },
    );
    if (upsertError) return json({ error: upsertError.message }, 500);
    return json({ ok: true, translated: names.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("translate-app-texts:", message);
    return json({ error: message }, 502);
  }
});
