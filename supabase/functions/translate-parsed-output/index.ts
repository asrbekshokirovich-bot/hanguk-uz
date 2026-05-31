import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Gemini via the OpenAI-compatible endpoint (same as compare-universities /
// translate-document); Anthropic Messages as a fallback so this works with
// whichever AI key the project has configured.
const GEMINI_AI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODEL = "google/gemini-2.5-flash";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

// Hangul compatibility Jamo + precomposed syllables. Used to skip the AI
// round-trip when a payload has no Korean to translate.
const HANGUL_RE = /[㄰-㆏가-힣]/;

// Translates Korean free-text inside an AI-extracted `parsed_output` payload to
// English for display in the review queue. Display-only: structure (keys, array
// order, enum codes, dates, numbers) is preserved exactly; only Hangul strings
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

class AIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function callGemini(apiKey: string, userText: string): Promise<string> {
  const resp = await fetch(GEMINI_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      temperature: 0,
      max_tokens: 16000,
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const errorText = await resp.text();
    console.error("translate-parsed-output Gemini error:", resp.status, errorText);
    throw new AIError(resp.status, errorText);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AIError(502, "Empty Gemini response");
  return content;
}

async function callAnthropic(apiKey: string, userText: string): Promise<string> {
  const resp = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    }),
  });
  if (!resp.ok) {
    const errorText = await resp.text();
    console.error("translate-parsed-output Anthropic error:", resp.status, errorText);
    throw new AIError(resp.status, errorText);
  }
  const data = await resp.json();
  const text = Array.isArray(data.content)
    ? data.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("")
    : "";
  if (!text) throw new AIError(502, "Empty Anthropic response");
  return text;
}

// The model returns { translated: ... }; tolerate code fences and a bare object.
function extractTranslated(content: string): unknown {
  let text = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("AI did not return JSON");
    parsed = JSON.parse(text.slice(start, end + 1));
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "translated" in parsed) {
    return (parsed as Record<string, unknown>).translated;
  }
  return parsed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  // Lightweight health check: reports which AI keys are configured (booleans
  // only — never the values) so the integration can be diagnosed without an
  // invocation.
  if (req.method === "GET") {
    return json({ ok: true, hasGemini: !!geminiKey, hasAnthropic: !!anthropicKey });
  }
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

    if (!geminiKey && !anthropicKey) {
      console.error("translate-parsed-output: no AI key configured (GEMINI_API_KEY / ANTHROPIC_API_KEY)");
      return json({ error: "Translation is not configured" }, 500);
    }

    // Try whichever provider has a key; fall back to the other on failure.
    const providers: Array<() => Promise<string>> = [];
    if (geminiKey) providers.push(() => callGemini(geminiKey, serialized));
    if (anthropicKey) providers.push(() => callAnthropic(anthropicKey, serialized));

    let lastErr: unknown = null;
    for (const run of providers) {
      try {
        const content = await run();
        return json({ translated: extractTranslated(content) });
      } catch (err) {
        lastErr = err;
        const status = err instanceof AIError ? err.status : 0;
        // Don't burn the fallback on rate/credit limits — surface them.
        if (status === 429) return json({ error: "Translation service is busy. Try again shortly." }, 429);
        if (status === 402) return json({ error: "AI credits exhausted." }, 402);
      }
    }

    console.error("translate-parsed-output: all providers failed:", lastErr);
    return json({ error: "Translation service error" }, 502);
  } catch (error) {
    console.error("translate-parsed-output error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
