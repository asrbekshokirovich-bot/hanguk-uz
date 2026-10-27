// Chat-completion providers for Hanguk AI (Asrbek, 2026-10-27: "tekin rejani
// tasdiqlayman").
//
// Free tiers that do not use prompts for training, tried in order:
//   1. Cerebras  gpt-oss-120b          ~1M tokens/day, 30K tokens/min
//   2. Groq      openai/gpt-oss-120b   1K requests/day, 200K tokens/day, 8K tokens/min
// (limits from the providers' rate-limit pages, Oct 2026). Both speak the
// OpenAI chat-completions format, with tools and streaming.
//
// When a provider answers 429 (limit) or 5xx, the next one is tried. Gemini is
// used ONLY while neither free key is configured, so nothing changes until the
// CEREBRAS_API_KEY / GROQ_API_KEY secrets are added; once they are, student data
// is no longer sent to Gemini's free tier for chat.
//
// deno-lint-ignore-file no-explicit-any

export interface Provider {
  name: "cerebras" | "groq" | "gemini";
  url: string;
  key: string;
  model: string;
}

export function chatProviders(): Provider[] {
  const list: Provider[] = [];
  const cerebras = Deno.env.get("CEREBRAS_API_KEY");
  if (cerebras) {
    list.push({
      name: "cerebras",
      url: "https://api.cerebras.ai/v1/chat/completions",
      key: cerebras,
      model: Deno.env.get("CEREBRAS_MODEL") || "gpt-oss-120b",
    });
  }
  const groq = Deno.env.get("GROQ_API_KEY");
  if (groq) {
    list.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: groq,
      model: Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b",
    });
  }
  if (!list.length) {
    const gemini = Deno.env.get("GEMINI_API_KEY");
    if (gemini) {
      list.push({
        name: "gemini",
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        key: gemini,
        model: "gemini-2.5-flash",
      });
    }
  }
  return list;
}

export let RETRY_WAIT_MS = 8000;
/** Tests shorten the wait. */
export function setRetryWaitMs(ms: number) {
  RETRY_WAIT_MS = ms;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class LimitReachedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitReachedError";
  }
}

/**
 * POST one chat-completions request, falling through the providers on a limit
 * or server error. Returns the first OK response (streaming or not) and which
 * provider served it.
 */
export async function chatCompletion(
  body: Record<string, unknown>,
): Promise<{ response: Response; provider: Provider }> {
  const providers = chatProviders();
  if (!providers.length) throw new Error("No AI provider key is configured (CEREBRAS_API_KEY / GROQ_API_KEY)");

  let lastStatus = 0;
  let lastText = "";
  for (const p of providers) {
    const send = () => fetch(p.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model: p.model }),
    });
    let response = await send();
    // Cerebras' free tier allows only a few requests per minute; one agent
    // question makes several. Wait once and retry before moving on, so a
    // tool loop does not drain Groq's small per-minute token budget.
    if (response.status === 429 && p.name === "cerebras") {
      await response.body?.cancel();
      await sleep(RETRY_WAIT_MS);
      response = await send();
    }
    if (response.ok) return { response, provider: p };
    lastStatus = response.status;
    lastText = (await response.text()).slice(0, 300);
    console.error(`[hanguk-ai] ${p.name} ${response.status}: ${lastText}`);
    // A bad request will fail the same way elsewhere; only limits and outages move on.
    if (response.status !== 429 && response.status < 500) break;
  }
  if (lastStatus === 429) throw new LimitReachedError("Free AI limit reached for now");
  throw new Error(`AI provider error ${lastStatus}: ${lastText}`);
}

/** Uzbek / Russian / English text shown when every free provider is out of quota. */
export function limitMessage(language: string): string {
  if (language === "ru") return "Бесплатный лимит ИИ на сейчас исчерпан. Попробуйте через несколько минут.";
  if (language === "en") return "The free AI limit is used up for now. Please try again in a few minutes.";
  if (language === "ko") return "현재 무료 AI 한도를 모두 사용했습니다. 몇 분 후 다시 시도해 주세요.";
  return "Tekin AI limiti hozircha tugadi. Bir necha daqiqadan so'ng qayta urinib ko'ring.";
}
