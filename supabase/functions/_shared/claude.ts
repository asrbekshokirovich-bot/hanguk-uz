// Shared Anthropic (Claude) client for all edge functions.
// Replaces the previous Gemini / generativelanguage.googleapis.com integration.
//
// - callClaude(): non-streaming text completion with model fallback.
// - streamClaude(): async generator of text deltas (for streaming endpoints).
// - extractJson(): tolerant JSON parser for "return only JSON" prompts.
// - toImageBlock() / toPdfBlock(): build Anthropic content blocks for vision/PDF.
//
// Anthropic takes the system prompt as a top-level `system` field (NOT a system
// message) and has no `response_format`; ask for JSON in the prompt and parse.

const KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const API_URL = "https://api.anthropic.com/v1/messages";

// Opus first (auto-used once enabled on the account), Sonnet as fallback.
const MODELS = ["claude-opus-4-7", "claude-sonnet-4-6"];

function headers(): HeadersInit {
  return {
    "x-api-key": KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
}

// Anthropic message content: a plain string, or an array of content blocks
// (text / image / document).
export type ClaudeBlock = Record<string, unknown>;
export type ClaudeContent = string | ClaudeBlock[];

export interface ClaudeOptions {
  maxTokens?: number;
  temperature?: number;
  /** Override the model fallback list for this call. */
  models?: string[];
}

/**
 * Non-streaming completion. Tries each model in order; returns the first
 * successful response's concatenated text. Throws if all models fail.
 */
export async function callClaude(
  system: string,
  userContent: ClaudeContent,
  { maxTokens = 4096, temperature, models = MODELS }: ClaudeOptions = {},
): Promise<string> {
  let lastErr = "";
  for (const model of models) {
    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    };
    if (typeof temperature === "number") body.temperature = temperature;

    let resp: Response;
    try {
      resp = await fetch(API_URL, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    } catch (e) {
      lastErr = `${model} fetch_error ${e instanceof Error ? e.message : String(e)}`;
      continue;
    }
    if (resp.ok) {
      const data = await resp.json();
      const text = Array.isArray(data.content)
        ? data.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("")
        : "";
      return text;
    }
    lastErr = `${model} ${resp.status} ${(await resp.text()).slice(0, 300)}`;
  }
  throw new Error("anthropic failed: " + lastErr);
}

/**
 * Streaming completion. Yields text deltas as they arrive. Tries each model in
 * order; falls back only before streaming has started for a given model.
 */
export async function* streamClaude(
  system: string,
  userContent: ClaudeContent,
  { maxTokens = 4096, temperature, models = MODELS }: ClaudeOptions = {},
): AsyncGenerator<string> {
  let lastErr = "";
  for (const model of models) {
    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      system,
      stream: true,
      messages: [{ role: "user", content: userContent }],
    };
    if (typeof temperature === "number") body.temperature = temperature;

    let resp: Response;
    try {
      resp = await fetch(API_URL, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    } catch (e) {
      lastErr = `${model} fetch_error ${e instanceof Error ? e.message : String(e)}`;
      continue;
    }
    if (!resp.ok || !resp.body) {
      lastErr = `${model} ${resp.status} ${(await resp.text().catch(() => "")).slice(0, 300)}`;
      continue;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) {
            yield ev.delta.text as string;
          }
        } catch {
          // ignore non-JSON keepalive lines
        }
      }
    }
    return;
  }
  throw new Error("anthropic stream failed: " + lastErr);
}

/**
 * Parse JSON from a model reply that may be wrapped in ``` fences or prose.
 * Falls back to extracting the outermost {...} or [...] span.
 */
export function extractJson<T = unknown>(raw: string): T {
  let t = (raw ?? "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(t) as T;
  } catch {
    // fall through to span extraction
  }
  const firstObj = t.indexOf("{");
  const lastObj = t.lastIndexOf("}");
  const firstArr = t.indexOf("[");
  const lastArr = t.lastIndexOf("]");
  let start = -1;
  let end = -1;
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    end = lastArr;
  } else {
    start = firstObj;
    end = lastObj;
  }
  if (start !== -1 && end > start) {
    return JSON.parse(t.slice(start, end + 1)) as T;
  }
  throw new Error("no JSON found in model output");
}

/**
 * Build an Anthropic image content block from a data URL or bare base64 string.
 */
export function toImageBlock(input: string, fallbackMediaType = "image/jpeg"): ClaudeBlock {
  let mediaType = fallbackMediaType;
  let data = input;
  const m = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (m) {
    mediaType = m[1];
    data = m[2];
  }
  return { type: "image", source: { type: "base64", media_type: mediaType, data } };
}

/**
 * Build an Anthropic document (PDF) content block from a bare base64 string.
 */
export function toPdfBlock(base64: string): ClaudeBlock {
  const data = base64.startsWith("data:") ? base64.replace(/^data:[^;]+;base64,/, "") : base64;
  return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
}
