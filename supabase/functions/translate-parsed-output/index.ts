import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GEMINI_AI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Hangul compatibility Jamo + precomposed syllables. Used to skip the AI
// round-trip when a payload has no Korean to translate.
const HANGUL_RE = /[\u3130-\u318F\uAC00-\uD7A3]/;

// Translates Korean free-text inside an AI-extracted `parsed_output` payload to
// English for display in the review queue. This is display-only: the original
// Korean stays the stored source of truth, so the structure (keys, array order,
// enum codes, dates, numbers) must be preserved exactly — only Hangul strings
// are rewritten.
const SYSTEM_PROMPT = `You translate the Korean text inside a JSON value into English. The JSON was extracted from Korean university admission documents and is shown to English-speaking reviewers.

Return a JSON object of the exact form {"translated": <value>}, where <value> has the SAME shape as the input:
- Keep identical keys, identical nesting, and identical array order and length. Never add, remove, rename, or reorder keys or array items.
- Translate every string value that contains Korean (Hangul) characters fully into natural, concise English. Translate the whole string, including mixed Korean/number/parenthetical text. Preserve meaning, dates, numbers, and units.
- Return byte-for-byte, do NOT translate or modify: numbers, booleans, null, ISO date/time strings (e.g. "2022-07-08T17:00:00+09:00"), and ASCII-only identifier strings such as enum/type codes (e.g. "apply_open", "registration_close", "not_required", "university_wide", "tuition_waiver_pct").
Output ONLY the JSON object, with no commentary.`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const parsedOutput = body?.parsed_output;
    if (parsedOutput === undefined || parsedOutput === null) {
      return json({ error: "Missing parsed_output" }, 400);
    }

    const serialized = JSON.stringify(parsedOutput);

    // Fast path: nothing Korean to translate — echo the payload back unchanged.
    if (!HANGUL_RE.test(serialized)) {
      return json({ translated: parsedOutput });
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) return json({ error: "Translation is not configured" }, 500);

    const aiResponse = await fetch(GEMINI_AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${geminiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: serialized },
        ],
        temperature: 0,
        max_tokens: 16000,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("translate-parsed-output AI error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return json({ error: "Translation service is busy. Try again shortly." }, 429);
      }
      return json({ error: "Translation service error" }, 502);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return json({ error: "No translation returned" }, 502);

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (_err) {
      console.error("translate-parsed-output parse error:", String(content).slice(0, 500));
      return json({ error: "Malformed translation" }, 502);
    }

    // The model is asked to wrap the result as { translated: ... }; fall back to
    // the bare object if it returned the payload directly.
    const translated =
      parsed && typeof parsed === "object" && !Array.isArray(parsed) && "translated" in parsed
        ? (parsed as Record<string, unknown>).translated
        : parsed;

    return json({ translated });
  } catch (error) {
    console.error("translate-parsed-output error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
