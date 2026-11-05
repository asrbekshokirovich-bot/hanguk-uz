// Xodim boti uchun tuzilgan (JSON) AI javobi: avval Gemini, u ishlamasa (limit, xato, bo'sh javob) — Claude.
// Claude'dan JSON majburiy tool_use orqali olinadi (input_schema = shu sxema).
// Kalitlar: GEMINI_API_KEY, ANTHROPIC_API_KEY (hanguk-ai-chat bilan umumiy).
// Modellar: STAFF_BOT_GEMINI_MODEL (standart gemini-2.5-flash), STAFF_BOT_CLAUDE_MODEL (standart claude-haiku-5-5).

export interface StructuredArgs {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  /** Faqat Gemini uchun; Claude'ga yuborilmaydi. */
  temperature?: number;
}

export interface StructuredResult<T> {
  data: T | null;
  provider: "gemini" | "claude" | null;
}

type Fetch = typeof fetch;
type Env = (k: string) => string | undefined;

const defaultEnv: Env = (k) => Deno.env.get(k);

async function viaGemini<T>(a: StructuredArgs, env: Env, f: Fetch): Promise<T | null> {
  const key = env("GEMINI_API_KEY");
  if (!key) return null;
  const model = env("STAFF_BOT_GEMINI_MODEL") || "gemini-2.5-flash";
  const res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: a.system }] },
      contents: [{ role: "user", parts: [{ text: a.prompt }] }],
      generationConfig: { temperature: a.temperature ?? 0, responseMimeType: "application/json", responseSchema: a.schema },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  // deno-lint-ignore no-explicit-any
  const text = (j?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) as T : null;
  }
}

async function viaClaude<T>(a: StructuredArgs, env: Env, f: Fetch): Promise<T | null> {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) return null;
  const res = await f("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: env("STAFF_BOT_CLAUDE_MODEL") || "claude-haiku-5-5",
      max_tokens: 1024,
      // temperature yuborilmaydi: yangi Claude modellari uni rad etadi (400 «temperature is deprecated»).
      system: a.system,
      messages: [{ role: "user", content: a.prompt }],
      tools: [{ name: "answer", description: "Return the result in this exact structure.", input_schema: a.schema }],
      tool_choice: { type: "tool", name: "answer" },
    }),
  });
  if (!res.ok) throw new Error(`claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  // deno-lint-ignore no-explicit-any
  const block = (j?.content ?? []).find((c: any) => c.type === "tool_use" && c.name === "answer");
  return (block?.input as T) ?? null;
}

/** Gemini → (ishlamasa) Claude. Ikkalasi ham ishlamasa data=null. */
export async function structuredJSON<T>(a: StructuredArgs, env: Env = defaultEnv, f: Fetch = fetch): Promise<StructuredResult<T>> {
  try {
    const g = await viaGemini<T>(a, env, f);
    if (g) return { data: g, provider: "gemini" };
  } catch (e) {
    console.warn("staff-bot ai: gemini failed, trying claude:", e instanceof Error ? e.message : e);
  }
  try {
    const c = await viaClaude<T>(a, env, f);
    if (c) return { data: c, provider: "claude" };
  } catch (e) {
    console.error("staff-bot ai: claude failed:", e instanceof Error ? e.message : e);
  }
  return { data: null, provider: null };
}
