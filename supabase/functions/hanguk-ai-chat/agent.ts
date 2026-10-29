// The Hanguk AI agent loop (plan §4): understand → call tools → check → answer.
//
// The model only ever sees the tools offered to this caller. Each step's tool
// calls run in parallel; their names are reported through onEvent so the
// client can show "yo'riqnomani o'qiyapman…". The loop stops at maxSteps and
// then asks once more with tools switched off, so a long investigation still
// ends in an answer.
//
// deno-lint-ignore-file no-explicit-any
import { chatCompletion as defaultComplete, LimitReachedError, limitMessage } from "./llm.ts";
import { costUsd, type Usage } from "./pricing.ts";
import { type AgentTool, declare, type Source, type ToolCtx } from "./tools/types.ts";

export type AgentEvent = { type: "step"; tools: string[] };

export interface ToolCallLog {
  name: string;
  ms: number;
  ok: boolean;
  bytes: number;
}

export interface AgentResult {
  text: string;
  outcome: "ok" | "limit" | "clarify" | "empty" | "error";
  steps: number;
  toolCalls: ToolCallLog[];
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  costUsd: number;
  provider: string | null;
  model: string | null;
  sources: Source[];
  error?: string;
}

type Complete = typeof defaultComplete;

// count(*) comes back as BigInt from the SQL tool; JSON.stringify rejects it.
export function safeJson(v: unknown): string {
  return JSON.stringify(v ?? null, (_k, x) => (typeof x === "bigint" ? Number(x) : x));
}

const MAX_TOOL_CHARS = 12000;

export async function runAgent(o: {
  system: string;
  history: { role: string; content: string }[];
  message: string;
  tools: AgentTool[];
  ctx: ToolCtx;
  onEvent?: (e: AgentEvent) => void;
  complete?: Complete;
  maxSteps?: number;
}): Promise<AgentResult> {
  const complete = o.complete ?? defaultComplete;
  const maxSteps = o.maxSteps ?? 8;
  const byName = new Map(o.tools.map((t) => [t.name, t]));
  const declared = o.tools.map(declare);

  const messages: any[] = [
    { role: "system", content: o.system },
    ...o.history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: o.message },
  ];

  const res: AgentResult = {
    text: "", outcome: "ok", steps: 0, toolCalls: [], tokensIn: 0, tokensOut: 0, tokensCached: 0,
    costUsd: 0, provider: null, model: null, sources: [],
  };

  const account = (providerName: string, model: string, usage: Usage | undefined) => {
    res.provider = providerName;
    res.model = model;
    res.tokensIn += usage?.prompt_tokens ?? 0;
    res.tokensOut += usage?.completion_tokens ?? 0;
    res.tokensCached += usage?.prompt_tokens_details?.cached_tokens ?? 0;
    res.costUsd = Math.round((res.costUsd + costUsd(providerName, model, usage)) * 1e6) / 1e6;
  };

  for (let step = 0; step <= maxSteps; step++) {
    const lastChance = step === maxSteps;
    let data: any;
    try {
      const body: Record<string, unknown> = { messages };
      if (declared.length && !lastChance) {
        body.tools = declared;
        body.tool_choice = "auto";
      }
      const { response, provider } = await complete(body);
      data = await response.json();
      account(provider.name, provider.model, data?.usage);
    } catch (e) {
      if (e instanceof LimitReachedError) {
        return { ...res, text: limitMessage(o.ctx.language), outcome: "limit" };
      }
      return { ...res, outcome: "error", error: e instanceof Error ? e.message : String(e) };
    }

    const msg = data?.choices?.[0]?.message;
    if (!msg) return { ...res, outcome: "error", error: "no message in model response" };

    const calls: any[] = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (calls.length && !lastChance) {
      res.steps++;
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
      o.onEvent?.({ type: "step", tools: calls.map((c) => String(c.function?.name ?? "")) });

      const outputs = await Promise.all(calls.map(async (tc) => {
        const name = String(tc.function?.name ?? "");
        const tool = byName.get(name);
        const started = Date.now();
        let content: string;
        let ok = true;
        if (!tool) {
          ok = false;
          content = safeJson({ error: `unknown tool: ${name}` });
        } else {
          let args: any = {};
          try { args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; } catch { /* bad args → {} */ }
          try {
            const out = await tool.run(o.ctx, args);
            if (out.sources?.length) res.sources.push(...out.sources);
            ok = !(out.data && typeof out.data === "object" && "error" in (out.data as any));
            content = safeJson(out.data);
          } catch (e) {
            ok = false;
            content = safeJson({ error: e instanceof Error ? e.message : String(e) });
          }
        }
        if (content.length > MAX_TOOL_CHARS) {
          content = content.slice(0, MAX_TOOL_CHARS) + ` … [truncated at ${MAX_TOOL_CHARS} chars — narrow the query]`;
        }
        res.toolCalls.push({ name, ms: Date.now() - started, ok, bytes: content.length });
        return { role: "tool", tool_call_id: tc.id, content };
      }));
      messages.push(...outputs);
      continue;
    }

    res.text = String(msg.content ?? "").trim();
    if (!res.text) return { ...res, outcome: "empty" };
    if (isClarify(res.text)) res.outcome = "clarify";
    return res;
  }
  return { ...res, outcome: "empty" };
}

export function isClarify(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith("{")) return false;
  try {
    return JSON.parse(t)?.type === "clarify";
  } catch {
    return false;
  }
}

const SOURCES_TITLE: Record<string, string> = {
  uz: "Manbalar", ru: "Источники", en: "Sources", ko: "출처", vi: "Nguồn",
};

/**
 * The knowledge sources (guidelines, PDF pages, web pages) the tools returned,
 * deduplicated, as a short list under the answer. CRM rows are not listed: the
 * answer names them itself.
 */
export function sourcesFooter(sources: Source[], language: string, max = 6): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const s of sources) {
    if (s.kind === "crm") continue;
    const key = `${s.kind}|${s.label}|${s.page ?? ""}|${s.url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const page = s.page ? `, ${s.page}` : "";
    const date = s.date ? ` (${s.date})` : "";
    lines.push(s.url ? `- [${s.label}${page}](${s.url})${date}` : `- ${s.label}${page}${date}`);
    if (lines.length >= max) break;
  }
  if (!lines.length) return "";
  return `\n\n**${SOURCES_TITLE[language] ?? SOURCES_TITLE.en}:**\n${lines.join("\n")}`;
}
