// geminiFetch — fetch() for Gemini calls that falls back to Claude when Gemini
// is out of quota (Asrbek, 2026-11-02: "gemini limiti tugasa Claude javob bersin").
//
// Drop-in for the two request shapes the functions use:
//   - native  …/models/<m>:generateContent           (contents / parts / inlineData)
//   - OpenAI  …/v1beta/openai/chat/completions        (messages / image_url / tools)
// On 429 (quota / rate limit) or 503 (overloaded) the same request goes to the
// Anthropic Messages API and the answer comes back in the caller's shape
// (Gemini candidates or OpenAI choices), so the caller's parsing is unchanged.
// The response carries `x-ai-fallback: anthropic`.
//
// Not converted (the original Gemini error is returned): embeddings (Anthropic
// has no embedding model), audio and other files Claude cannot read (only
// JPEG/PNG/GIF/WebP images and PDF), file URIs, Gemini's own tools.
//
// deno-lint-ignore-file no-explicit-any

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const FALLBACK_STATUS = new Set([429, 503]);
const MAX_TOKENS_CAP = 32000;
// No temperature / top_p / top_k in the Claude request: claude-sonnet-5-5 rejects
// them with HTTP 400 ("`temperature` is deprecated for this model").

const env = (k: string): string => {
  try {
    return (globalThis as any).Deno?.env?.get(k) ?? "";
  } catch {
    return "";
  }
};

export class Unsupported extends Error {}

function mediaBlock(mime: string, data: string): any {
  const m = (mime || "").toLowerCase().split(";")[0].trim();
  if (m === "image/jpg") return mediaBlock("image/jpeg", data);
  if (IMAGE_TYPES.has(m)) return { type: "image", source: { type: "base64", media_type: m, data } };
  if (m === "application/pdf") return { type: "document", source: { type: "base64", media_type: m, data } };
  throw new Unsupported(`Claude cannot read ${m || "this file type"}`);
}

function jsonInstruction(schema?: unknown): string {
  return "Reply with one valid JSON value only — no prose, no markdown fences." +
    (schema ? `\nIt must follow this JSON schema:\n${JSON.stringify(schema)}` : "");
}

function pushBlock(messages: any[], role: "user" | "assistant", block: any) {
  const last = messages[messages.length - 1];
  if (last && last.role === role) last.content.push(block);
  else messages.push({ role, content: [block] });
}

/** Claude sometimes wraps JSON in ```json fences; Gemini's JSON mode never does. */
export function stripFences(text: string): string {
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1] : text;
}

function maxTokens(n: unknown): number {
  const v = typeof n === "number" && n > 0 ? n : 8192;
  return Math.min(v, MAX_TOKENS_CAP);
}

// ---- native Gemini ⇄ Anthropic --------------------------------------------

export function geminiToAnthropic(body: any, model: string): { req: any; json: boolean } {
  const cfg = body?.generationConfig ?? body?.generation_config ?? {};
  if (Array.isArray(body?.tools) && body.tools.length) throw new Unsupported("Gemini tools");
  const sys = body?.systemInstruction ?? body?.system_instruction;
  const system: string[] = [];
  for (const p of sys?.parts ?? []) if (p?.text) system.push(p.text);
  if (typeof sys === "string") system.push(sys);

  const json = (cfg.responseMimeType ?? cfg.response_mime_type) === "application/json";
  if (json) system.push(jsonInstruction(cfg.responseSchema ?? cfg.response_schema));

  const messages: any[] = [];
  for (const c of body?.contents ?? []) {
    const role = c?.role === "model" ? "assistant" : "user";
    for (const p of c?.parts ?? []) {
      if (typeof p?.text === "string") {
        if (p.text) pushBlock(messages, role, { type: "text", text: p.text });
      } else if (p?.inlineData || p?.inline_data) {
        const d = p.inlineData ?? p.inline_data;
        pushBlock(messages, role, mediaBlock(d.mimeType ?? d.mime_type, d.data));
      } else {
        throw new Unsupported("Gemini part type");
      }
    }
  }
  // Claude puts media first and text last best, and wants a user turn first.
  if (!messages.length || messages[0].role !== "user") throw new Unsupported("no user turn");

  const req: any = { model, max_tokens: maxTokens(cfg.maxOutputTokens ?? cfg.max_output_tokens), messages };
  if (system.length) req.system = system.join("\n\n");
  return { req, json };
}

export function anthropicToGemini(data: any, json: boolean): any {
  const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
  let text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
  if (json) text = stripFences(text);
  const u = data?.usage ?? {};
  const inTok = Number(u.input_tokens ?? 0) + Number(u.cache_read_input_tokens ?? 0) + Number(u.cache_creation_input_tokens ?? 0);
  const outTok = Number(u.output_tokens ?? 0);
  return {
    candidates: [{
      content: { role: "model", parts: [{ text }] },
      finishReason: data?.stop_reason === "max_tokens" ? "MAX_TOKENS" : "STOP",
      index: 0,
    }],
    usageMetadata: { promptTokenCount: inTok, candidatesTokenCount: outTok, totalTokenCount: inTok + outTok },
    modelVersion: data?.model ?? "claude",
  };
}

// ---- OpenAI-compatible ⇄ Anthropic ----------------------------------------

function openaiContent(content: any): any[] {
  if (typeof content === "string") return content ? [{ type: "text", text: content }] : [];
  const out: any[] = [];
  for (const p of Array.isArray(content) ? content : []) {
    if (typeof p === "string") out.push({ type: "text", text: p });
    else if (p?.type === "text") { if (p.text) out.push({ type: "text", text: p.text }); }
    else if (p?.type === "image_url") {
      const url: string = typeof p.image_url === "string" ? p.image_url : p.image_url?.url ?? "";
      const m = url.match(/^data:([^;,]+);base64,(.*)$/s);
      if (!m) throw new Unsupported("remote image URL");
      out.push(mediaBlock(m[1], m[2]));
    } else throw new Unsupported(`content part ${p?.type}`);
  }
  return out;
}

const textOf = (c: any): string =>
  typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => (typeof x === "string" ? x : x?.text ?? "")).join("") : "";

export function openaiToAnthropic(body: any, model: string): { req: any; json: boolean } {
  const system: string[] = [];
  const messages: any[] = [];
  for (const m of body?.messages ?? []) {
    if (m.role === "system" || m.role === "developer") system.push(textOf(m.content));
    else if (m.role === "tool") {
      pushBlock(messages, "user", { type: "tool_result", tool_use_id: m.tool_call_id, content: textOf(m.content) || "(empty)" });
    } else if (m.role === "assistant") {
      const t = textOf(m.content);
      if (t) pushBlock(messages, "assistant", { type: "text", text: t });
      for (const tc of m.tool_calls ?? []) {
        let input: any = {};
        try { input = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; } catch { input = {}; }
        pushBlock(messages, "assistant", { type: "tool_use", id: tc.id, name: tc.function?.name, input });
      }
    } else {
      for (const b of openaiContent(m.content)) pushBlock(messages, "user", b);
    }
  }
  if (!messages.length || messages[0].role !== "user") throw new Unsupported("no user turn");

  const rf = body?.response_format?.type;
  const json = rf === "json_object" || rf === "json_schema";
  if (json) system.push(jsonInstruction(body?.response_format?.json_schema?.schema));

  const req: any = { model, max_tokens: maxTokens(body?.max_completion_tokens ?? body?.max_tokens), messages };
  if (system.length) req.system = system.join("\n\n");
  if (Array.isArray(body?.tools) && body.tools.length) {
    req.tools = body.tools.map((t: any) => ({
      name: t.function?.name,
      description: t.function?.description ?? "",
      input_schema: t.function?.parameters ?? { type: "object", properties: {} },
    }));
    const tc = body.tool_choice;
    if (tc && typeof tc === "object" && tc.function?.name) req.tool_choice = { type: "tool", name: tc.function.name };
    else if (tc === "required") req.tool_choice = { type: "any" };
    else if (tc === "none") req.tool_choice = { type: "none" };
    else req.tool_choice = { type: "auto" };
  }
  return { req, json };
}

export function anthropicToOpenai(data: any, json: boolean): any {
  const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
  let text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
  if (json) text = stripFences(text);
  const toolCalls = blocks
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
  const u = data?.usage ?? {};
  const inTok = Number(u.input_tokens ?? 0) + Number(u.cache_read_input_tokens ?? 0) + Number(u.cache_creation_input_tokens ?? 0);
  return {
    id: data?.id ?? "claude-fallback",
    object: "chat.completion",
    model: data?.model ?? "claude",
    choices: [{
      index: 0,
      message: { role: "assistant", content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
      finish_reason: toolCalls.length ? "tool_calls" : data?.stop_reason === "max_tokens" ? "length" : "stop",
    }],
    usage: { prompt_tokens: inTok, completion_tokens: Number(u.output_tokens ?? 0), total_tokens: inTok + Number(u.output_tokens ?? 0) },
  };
}

// ---- the fetch wrapper ------------------------------------------------------

type Kind = "native" | "openai" | null;

export function geminiKind(url: string): Kind {
  if (!url.includes("generativelanguage.googleapis.com")) return null;
  if (url.includes("/openai/chat/completions")) return "openai";
  if (/:generateContent(\?|$)/.test(url)) return "native";
  return null; // embeddings, model lists, streaming
}

export async function geminiFetch(
  input: string | URL | Request,
  init?: RequestInit,
  doFetch: typeof fetch = fetch,
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const res = await doFetch(input as any, init);
  if (!FALLBACK_STATUS.has(res.status)) return res;

  const kind = geminiKind(url);
  const key = env("ANTHROPIC_API_KEY");
  if (!kind || !key || typeof init?.body !== "string") return res;

  let converted: { req: any; json: boolean };
  try {
    const body = JSON.parse(init.body);
    const model = env("ANTHROPIC_FALLBACK_MODEL") || "claude-sonnet-5-5";
    converted = kind === "native" ? geminiToAnthropic(body, model) : openaiToAnthropic(body, model);
  } catch (e) {
    console.warn(`[gemini→claude] not converted: ${e instanceof Error ? e.message : e}`);
    return res;
  }

  const gemErr = (await res.clone().text().catch(() => "")).slice(0, 160);
  console.warn(`[gemini→claude] Gemini ${res.status}, trying Claude (${converted.req.model}). ${gemErr}`);
  const started = Date.now();
  const c = await doFetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(converted.req),
    signal: init?.signal,
  });
  if (!c.ok) {
    console.error(`[gemini→claude] Claude ${c.status}: ${(await c.text().catch(() => "")).slice(0, 300)}`);
    return res; // the caller sees the original Gemini error
  }
  const data = await c.json();
  const out = kind === "native" ? anthropicToGemini(data, converted.json) : anthropicToOpenai(data, converted.json);
  console.log(`[gemini→claude] ok in ${Date.now() - started} ms, ${data?.usage?.input_tokens ?? 0}/${data?.usage?.output_tokens ?? 0} tokens`);
  return new Response(JSON.stringify(out), {
    status: 200,
    headers: { "content-type": "application/json", "x-ai-fallback": "anthropic" },
  });
}
