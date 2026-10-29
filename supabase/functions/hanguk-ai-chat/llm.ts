// Chat-completion providers for Hanguk AI.
//
// History: 2026-10-27 Asrbek approved the free plan (Cerebras → Groq
// gpt-oss-120b). Hanguk AI 2.0 (plan §11, decision D1) adds paid providers
// without changing anything until they are switched on:
//
//   AI_PROVIDERS   comma list that orders the chain, e.g. "anthropic,gemini,groq".
//                  Unset = the 27-okt behaviour: Cerebras, Groq, and Gemini only
//                  while neither free key exists. A name without its key is skipped.
//   <NAME>_MODEL   per-provider model override (ANTHROPIC_MODEL, GEMINI_MODEL …).
//
// Every provider is called in the OpenAI chat-completions shape the agent loop
// speaks. Anthropic's Messages API is translated both ways here (tools, tool
// results, prompt caching), so the agent never sees the difference.
//
// When a provider answers 429 (limit) or 5xx, the next one is tried.
//
// deno-lint-ignore-file no-explicit-any

export type ProviderName = "anthropic" | "gemini" | "cerebras" | "groq";

export interface Provider {
  name: ProviderName;
  url: string;
  key: string;
  model: string;
}

const env = (k: string) => Deno.env.get(k) || "";

function build(name: ProviderName): Provider | null {
  switch (name) {
    case "anthropic": {
      const key = env("ANTHROPIC_API_KEY");
      return key ? {
        name, key,
        url: "https://api.anthropic.com/v1/messages",
        model: env("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
      } : null;
    }
    case "gemini": {
      const key = env("GEMINI_API_KEY");
      return key ? {
        name, key,
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        model: env("GEMINI_MODEL") || "gemini-2.5-flash",
      } : null;
    }
    case "cerebras": {
      const key = env("CEREBRAS_API_KEY");
      return key ? {
        name, key,
        url: "https://api.cerebras.ai/v1/chat/completions",
        model: env("CEREBRAS_MODEL") || "gpt-oss-120b",
      } : null;
    }
    case "groq": {
      const key = env("GROQ_API_KEY");
      return key ? {
        name, key,
        url: "https://api.groq.com/openai/v1/chat/completions",
        model: env("GROQ_MODEL") || "openai/gpt-oss-120b",
      } : null;
    }
  }
}

const KNOWN: ProviderName[] = ["anthropic", "gemini", "cerebras", "groq"];

export function chatProviders(): Provider[] {
  const order = env("AI_PROVIDERS")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderName => (KNOWN as string[]).includes(s));
  if (order.length) {
    return [...new Set(order)].map(build).filter((p): p is Provider => !!p);
  }
  // Default (27-okt): free providers; Gemini only while neither free key exists.
  const free = (["cerebras", "groq"] as ProviderName[]).map(build).filter((p): p is Provider => !!p);
  if (free.length) return free;
  const gemini = build("gemini");
  return gemini ? [gemini] : [];
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

// ---- Anthropic <-> OpenAI shape ------------------------------------------

function textOf(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === "string" ? c : c?.text ?? "")).join("");
  return content == null ? "" : String(content);
}

/** OpenAI chat-completions request → Anthropic Messages request. */
export function toAnthropicRequest(body: Record<string, any>, model: string): Record<string, any> {
  const system: string[] = [];
  const messages: any[] = [];
  const push = (role: "user" | "assistant", block: any) => {
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content.push(block);
    else messages.push({ role, content: [block] });
  };

  for (const m of body.messages ?? []) {
    if (m.role === "system") {
      system.push(textOf(m.content));
    } else if (m.role === "tool") {
      push("user", { type: "tool_result", tool_use_id: m.tool_call_id, content: textOf(m.content) || "(empty)" });
    } else if (m.role === "assistant") {
      const text = textOf(m.content);
      if (text) push("assistant", { type: "text", text });
      for (const tc of m.tool_calls ?? []) {
        let input: any = {};
        try { input = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; } catch { input = {}; }
        push("assistant", { type: "tool_use", id: tc.id, name: tc.function?.name, input });
      }
    } else {
      const text = textOf(m.content);
      if (text) push("user", { type: "text", text });
    }
  }

  const out: Record<string, any> = {
    model,
    max_tokens: body.max_tokens ?? 4096,
    messages,
  };
  if (system.length) {
    // The system prompt and the tool list are the same on every call of a
    // question (and across questions): cache them.
    out.system = [{ type: "text", text: system.join("\n\n"), cache_control: { type: "ephemeral" } }];
  }
  if (Array.isArray(body.tools) && body.tools.length) {
    out.tools = body.tools.map((t: any, i: number, all: any[]) => {
      const tool: any = {
        name: t.function?.name,
        description: t.function?.description ?? "",
        input_schema: t.function?.parameters ?? { type: "object", properties: {} },
      };
      if (i === all.length - 1) tool.cache_control = { type: "ephemeral" };
      return tool;
    });
    if (body.tool_choice === "none") out.tool_choice = { type: "none" };
    else out.tool_choice = { type: "auto" };
  }
  if (typeof body.temperature === "number") out.temperature = body.temperature;
  return out;
}

/** Anthropic Messages response → OpenAI chat-completions response. */
export function fromAnthropicResponse(data: any): any {
  const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
  const toolCalls = blocks
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
  const u = data?.usage ?? {};
  const cacheRead = Number(u.cache_read_input_tokens ?? 0);
  const cacheWrite = Number(u.cache_creation_input_tokens ?? 0);
  return {
    choices: [{
      message: { role: "assistant", content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
      finish_reason: data?.stop_reason ?? null,
    }],
    usage: {
      prompt_tokens: Number(u.input_tokens ?? 0) + cacheRead + cacheWrite,
      completion_tokens: Number(u.output_tokens ?? 0),
      prompt_tokens_details: { cached_tokens: cacheRead, cache_write_tokens: cacheWrite },
    },
  };
}

function send(p: Provider, body: Record<string, unknown>): Promise<Response> {
  if (p.name === "anthropic") {
    return fetch(p.url, {
      method: "POST",
      headers: {
        "x-api-key": p.key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(toAnthropicRequest(body as any, p.model)),
    });
  }
  return fetch(p.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, model: p.model }),
  });
}

/**
 * POST one chat-completions request, falling through the providers on a limit
 * or server error. Returns the first OK response (OpenAI-shaped JSON for every
 * provider) and which provider served it.
 */
export async function chatCompletion(
  body: Record<string, unknown>,
): Promise<{ response: Response; provider: Provider }> {
  const providers = chatProviders();
  if (!providers.length) throw new Error("No AI provider key is configured (AI_PROVIDERS / CEREBRAS_API_KEY / GROQ_API_KEY)");

  let lastStatus = 0;
  let lastText = "";
  for (const p of providers) {
    let response = await send(p, body);
    // Cerebras' free tier allows only a few requests per minute; one agent
    // question makes several. Wait once and retry before moving on.
    if (response.status === 429 && p.name === "cerebras") {
      await response.body?.cancel();
      await sleep(RETRY_WAIT_MS);
      response = await send(p, body);
    }
    if (response.ok) {
      if (p.name === "anthropic") {
        const data = await response.json();
        response = new Response(JSON.stringify(fromAnthropicResponse(data)), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return { response, provider: p };
    }
    lastStatus = response.status;
    lastText = (await response.text()).slice(0, 300);
    console.error(`[hanguk-ai] ${p.name} ${response.status}: ${lastText}`);
    // Anthropic answers 529 when overloaded; treat it like a 5xx.
    // A bad request will fail the same way elsewhere; only limits and outages move on.
    if (response.status !== 429 && response.status < 500) break;
  }
  if (lastStatus === 429) throw new LimitReachedError("AI limit reached for now");
  throw new Error(`AI provider error ${lastStatus}: ${lastText}`);
}

/** Text shown when every provider is out of quota. */
export function limitMessage(language: string): string {
  if (language === "ru") return "Лимит ИИ на сейчас исчерпан. Попробуйте через несколько минут.";
  if (language === "en") return "The AI limit is used up for now. Please try again in a few minutes.";
  if (language === "ko") return "현재 AI 한도를 모두 사용했습니다. 몇 분 후 다시 시도해 주세요.";
  if (language === "vi") return "Đã hết giới hạn AI trong lúc này. Vui lòng thử lại sau vài phút.";
  return "AI limiti hozircha tugadi. Bir necha daqiqadan so'ng qayta urinib ko'ring.";
}
