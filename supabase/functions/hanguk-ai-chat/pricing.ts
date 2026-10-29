// USD per 1M tokens, from the providers' official pricing pages (opened
// 2026-10-29; plan §11.1). Used only to fill ai_runs.cost_usd so spending is
// visible; billing itself is the provider's.
//
// Cerebras and Groq run on their free tiers (27-okt), so they cost 0 unless
// <NAME>_PAID=1 is set (Groq paid gpt-oss-120b: $0.15 / $0.60).

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
}

interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite?: number;
}

// Matched by prefix, longest first.
const PRICES: [string, Price][] = [
  ["claude-haiku-5-5", { input: 0.10, output: 0.50, cacheRead: 0.01, cacheWrite: 0.125 }],
  ["claude-sonnet-5-5", { input: 2, output: 10, cacheRead: 0.10, cacheWrite: 2.5 }],
  ["claude-opus-5-5", { input: 4, output: 20, cacheRead: 0.20, cacheWrite: 5 }],
  ["claude-sonnet-4-6", { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 }],
  ["gemini-3.8-flash", { input: 0.75, output: 3.75, cacheRead: 0.75 }],
  ["gemini-3.5-flash-lite", { input: 0.30, output: 2.50, cacheRead: 0.30 }],
  ["openai/gpt-oss-120b", { input: 0.15, output: 0.60, cacheRead: 0.15 }],
  ["gpt-oss-120b", { input: 0.15, output: 0.60, cacheRead: 0.15 }],
];

function priceFor(model: string): Price | null {
  const hit = PRICES.filter(([p]) => model.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : null;
}

export function costUsd(provider: string, model: string, u: Usage | undefined): number {
  if (!u) return 0;
  const free = (provider === "cerebras" || provider === "groq") && Deno.env.get(`${provider.toUpperCase()}_PAID`) !== "1";
  if (free) return 0;
  const p = priceFor(model);
  if (!p) return 0;
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  const written = u.prompt_tokens_details?.cache_write_tokens ?? 0;
  const fresh = Math.max(0, (u.prompt_tokens ?? 0) - cached - written);
  const usd = (fresh * p.input + cached * p.cacheRead + written * (p.cacheWrite ?? p.input) +
    (u.completion_tokens ?? 0) * p.output) / 1e6;
  return Math.round(usd * 1e6) / 1e6;
}
