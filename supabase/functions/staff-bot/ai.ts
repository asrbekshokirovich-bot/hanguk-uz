// Xodim boti uchun tuzilgan (JSON) AI javobi — provayderlar navbat bilan (reja B0-2).
//
// - Tartib argument bilan beriladi (`order`); index.ts uni bot_settings.ai_provider_order'dan oladi
//   (standart claude,gemini — D1). Kaliti yo'q provayder o'tkazib yuboriladi.
// - Har provayderda 429/503/529 bo'lsa ~1,5 s kutib bitta qayta urinish, keyin keyingi provayder.
// - Javob sxemaga tekshiriladi (majburiy maydon, tur, enum); yaroqsiz javob — xato, keyingi provayder.
// - Har urinish natijasi qaytariladi va loglanadi: provayder, model, ok, HTTP status, qisqa xato,
//   vaqt (ms), kirish/chiqish tokenlari (Claude `usage`, Gemini `usageMetadata`), narx
//   (Claude — rasmiy narx bo'yicha; Gemini — null). Jurnalga (ai_calls) aiops.ts yozadi.
// - Claude'dan JSON majburiy tool_use orqali olinadi (input_schema = shu sxema). Claude'ga temperature
//   YUBORILMAYDI: yangi modellar uni 400 «temperature is deprecated» bilan rad etadi (#574).
// - Sof: env, fetch, logger, sleep, vaqt in'ektsiya qilinadi (ai_test.ts).
//
// Kalitlar: ANTHROPIC_API_KEY, GEMINI_API_KEY (hanguk-ai-chat bilan umumiy).
// Modellar: STAFF_BOT_CLAUDE_MODEL (standart claude-haiku-5-5), STAFF_BOT_GEMINI_MODEL (standart gemini-2.5-flash).

export type Provider = "claude" | "gemini";

export const PROVIDERS: readonly Provider[] = ["claude", "gemini"];
/** D1: Claude Haiku 5.5 asosiy, Gemini zaxira. */
export const DEFAULT_ORDER: readonly Provider[] = ["claude", "gemini"];
/** Shu statuslarda o'sha provayderga bitta qayta urinish (limit, band, ortiqcha yuklama). */
export const RETRY_STATUSES: ReadonlySet<number> = new Set([429, 503, 529]);
export const RETRY_DELAY_MS = 1500;
const TIMEOUT_MS = 25_000;
const CLAUDE_URL = "https://api.anthropic.com/v1/messages";

export interface StructuredArgs {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  /** Faqat Gemini uchun; Claude'ga yuborilmaydi. */
  temperature?: number;
  /** Provayderlar tartibi; bo'sh yoki berilmasa DEFAULT_ORDER. */
  order?: readonly Provider[];
}

export interface AiAttempt {
  provider: Provider;
  model: string;
  /** 1 — birinchi urinish, 2 — 429/503/529 dan keyingi qayta urinish. */
  attempt: number;
  ok: boolean;
  /** HTTP status; tarmoq xatosi yoki vaqt tugaganda null. */
  status: number | null;
  error: string | null;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  /** USD. Claude — rasmiy narx bo'yicha; Gemini va narxi noma'lum model — null. */
  cost_usd: number | null;
}

export interface StructuredResult<T> {
  /** null — hech bir provayder yaroqli javob bermadi (xato; AI «hech narsa yo'q» degani emas). */
  data: T | null;
  provider: Provider | null;
  attempts: AiAttempt[];
  /** data=null bo'lsa qisqa sabab (oxirgi urinish). */
  error: string | null;
}

type Env = (k: string) => string | undefined;

export interface AiDeps {
  env: Env;
  fetch: typeof fetch;
  /** Har urinish uchun bitta qator. */
  log: (line: string, ok: boolean) => void;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  timeoutMs: number;
}

const defaultDeps: AiDeps = {
  env: (k) => Deno.env.get(k),
  fetch: (input, init) => fetch(input, init),
  log: (line, ok) => (ok ? console.log(line) : console.warn(line)),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
  timeoutMs: TIMEOUT_MS,
};

/** «claude,gemini» → ["claude","gemini"]. Noto'g'ri/takror nomlar tashlanadi; bo'sh bo'lsa DEFAULT_ORDER. */
export function parseProviderOrder(raw: string | null | undefined): Provider[] {
  const out: Provider[] = [];
  for (const p of String(raw ?? "").toLowerCase().split(/[\s,;]+/)) {
    if ((PROVIDERS as readonly string[]).includes(p) && !out.includes(p as Provider)) out.push(p as Provider);
  }
  return out.length ? out : [...DEFAULT_ORDER];
}

// ── narx ──────────────────────────────────────────────────────────────────

export interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface Price { input: number; output: number; cacheWrite: number; cacheRead: number }

// USD / 1 mln token. Manba: https://platform.claude.com/docs/en/about-claude/pricing (05.11.2026).
// Haiku 5.5 narxi prompt uzunligiga bog'liq: so'rov prompti (kesh bilan) 100 000 tokendan oshsa — yuqori narx.
// Kesh yozish — 5 daqiqalik (standart) narx.
const HAIKU_5_5: Price = { input: 0.10, output: 0.50, cacheWrite: 0.125, cacheRead: 0.01 };
const HAIKU_5_5_LONG: Price = { input: 0.50, output: 2.50, cacheWrite: 0.625, cacheRead: 0.05 };
const SONNET_5_5: Price = { input: 2, output: 10, cacheWrite: 2.50, cacheRead: 0.10 };

function claudePrice(model: string, promptTokens: number): Price | null {
  if (model.startsWith("claude-haiku-5-5")) return promptTokens > 100_000 ? HAIKU_5_5_LONG : HAIKU_5_5;
  if (model.startsWith("claude-sonnet-5-5")) return SONNET_5_5;
  return null; // narxi ma'lum bo'lmagan model — o'ylab topilmaydi
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Claude so'rovi narxi (USD, 6 xona). Model narxi ma'lum bo'lmasa yoki usage yo'q bo'lsa null. */
export function claudeCost(model: string, u: ClaudeUsage | null | undefined): number | null {
  if (!u) return null;
  const inp = num(u.input_tokens), out = num(u.output_tokens);
  const cw = num(u.cache_creation_input_tokens), cr = num(u.cache_read_input_tokens);
  const p = claudePrice(model, inp + cw + cr);
  if (!p) return null;
  const usd = (inp * p.input + out * p.output + cw * p.cacheWrite + cr * p.cacheRead) / 1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}

// ── javobni tekshirish ────────────────────────────────────────────────────

function typeOk(v: unknown, t: string): boolean {
  switch (t) {
    case "string": return typeof v === "string";
    case "number": return typeof v === "number" && Number.isFinite(v);
    case "integer": return typeof v === "number" && Number.isInteger(v);
    case "boolean": return typeof v === "boolean";
    case "array": return Array.isArray(v);
    case "object": return typeof v === "object" && v !== null && !Array.isArray(v);
    default: return true;
  }
}

/** Javob sxemaga mosmi (yuqori daraja: majburiy maydon, tur, enum). Mos bo'lsa null, aks holda qisqa sabab. */
export function schemaError(data: unknown, schema: Record<string, unknown>): string | null {
  if (schema.type !== "object") return null;
  if (!typeOk(data, "object")) return "javob obyekt emas";
  const obj = data as Record<string, unknown>;
  for (const k of (schema.required ?? []) as string[]) {
    if (obj[k] === undefined || obj[k] === null) return `«${k}» yo'q`;
  }
  const props = (schema.properties ?? {}) as Record<string, { type?: string; enum?: unknown[] }>;
  for (const [k, s] of Object.entries(props)) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    if (s.type && !typeOk(v, s.type)) return `«${k}» ${s.type} emas`;
    if (Array.isArray(s.enum) && !s.enum.includes(v)) return `«${k}» ruxsat etilmagan qiymat`;
  }
  return null;
}

/** Matndagi API kalitini yashirish (Deno fetch xatosi URL'ni, Gemini URL'i esa `?key=` ni o'z ichiga oladi). */
export function redactKeys(s: string): string {
  return s.replace(/([?&](?:key|api_key)=)[^&\s)"']+/gi, "$1***").replace(/\b(sk-ant-|AIza)[\w-]{8,}/g, "$1***");
}

/** API xato javobidan qisqa matn: «tur: xabar» (kalitlar yashiriladi). */
export function shortError(raw: string, max = 200): string {
  let msg = redactKeys(raw);
  try {
    const e = JSON.parse(raw)?.error;
    if (e && typeof e === "object") msg = [e.type ?? e.status, e.message].filter(Boolean).join(": ") || raw;
  } catch { /* JSON emas — matnning o'zi */ }
  msg = redactKeys(String(msg)).replace(/\s+/g, " ").trim();
  if (!msg) return "—";
  return msg.length > max ? msg.slice(0, max - 1) + "…" : msg;
}

function thrownError(e: unknown): string {
  if (e instanceof Error) return e.name === "TimeoutError" || e.name === "AbortError" ? "vaqt tugadi (timeout)" : shortError(e.message);
  return shortError(String(e));
}

// ── provayderlar ──────────────────────────────────────────────────────────

interface Outcome { data: unknown; att: AiAttempt }

/** So'rov uchun vaqt chegarasi (0 — chegarasiz; testlarda taymer qoldirmaslik uchun). */
const timeoutSignal = (d: AiDeps): AbortSignal | undefined => (d.timeoutMs > 0 ? AbortSignal.timeout(d.timeoutMs) : undefined);

function blank(provider: Provider, model: string): AiAttempt {
  return {
    provider, model, attempt: 1, ok: false, status: null, error: null, latency_ms: 0,
    input_tokens: null, output_tokens: null, cost_usd: null,
  };
}

/** Tayyor javobni tekshirish: bo'sh → xato, sxemaga mos emas → xato. */
function judge(att: AiAttempt, data: unknown, schema: Record<string, unknown>, empty: string): Outcome {
  if (data === null || data === undefined) return { data: null, att: { ...att, error: empty } };
  const bad = schemaError(data, schema);
  if (bad) return { data: null, att: { ...att, error: `sxema: ${bad}` } };
  return { data, att: { ...att, ok: true } };
}

async function claudeOnce(a: StructuredArgs, d: AiDeps): Promise<Outcome | null> {
  const key = d.env("ANTHROPIC_API_KEY");
  if (!key) return null;
  const model = d.env("STAFF_BOT_CLAUDE_MODEL") || "claude-haiku-5-5";
  const att = blank("claude", model);
  const t0 = d.now();
  let status: number | null = null;
  try {
    const res = await d.fetch(CLAUDE_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        // temperature yuborilmaydi: yangi Claude modellari uni rad etadi (400 «temperature is deprecated»).
        system: a.system,
        messages: [{ role: "user", content: a.prompt }],
        tools: [{ name: "answer", description: "Return the result in this exact structure.", input_schema: a.schema }],
        tool_choice: { type: "tool", name: "answer" },
      }),
      signal: timeoutSignal(d),
    });
    status = res.status;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { data: null, att: { ...att, status: res.status, error: shortError(body || `HTTP ${res.status}`), latency_ms: d.now() - t0 } };
    }
    const j = await res.json();
    const used = typeof j?.model === "string" && j.model ? j.model : model;
    const u = (j?.usage ?? null) as ClaudeUsage | null;
    const done: AiAttempt = {
      ...att, model: used, status: res.status, latency_ms: d.now() - t0,
      input_tokens: u ? num(u.input_tokens) + num(u.cache_creation_input_tokens) + num(u.cache_read_input_tokens) : null,
      output_tokens: u ? num(u.output_tokens) : null,
      cost_usd: claudeCost(used, u),
    };
    // deno-lint-ignore no-explicit-any
    const block = (Array.isArray(j?.content) ? j.content : []).find((c: any) => c?.type === "tool_use" && c?.name === "answer");
    return judge(done, block?.input ?? null, a.schema, "javobda tool_use yo'q");
  } catch (e) {
    return { data: null, att: { ...att, status, error: thrownError(e), latency_ms: d.now() - t0 } };
  }
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

async function geminiOnce(a: StructuredArgs, d: AiDeps): Promise<Outcome | null> {
  const key = d.env("GEMINI_API_KEY");
  if (!key) return null;
  const model = d.env("STAFF_BOT_GEMINI_MODEL") || "gemini-2.5-flash";
  const att = blank("gemini", model);
  const t0 = d.now();
  let status: number | null = null;
  try {
    const res = await d.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: a.system }] },
        contents: [{ role: "user", parts: [{ text: a.prompt }] }],
        generationConfig: { temperature: a.temperature ?? 0, responseMimeType: "application/json", responseSchema: a.schema },
      }),
      signal: timeoutSignal(d),
    });
    status = res.status;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { data: null, att: { ...att, status: res.status, error: shortError(body || `HTTP ${res.status}`), latency_ms: d.now() - t0 } };
    }
    const j = await res.json();
    const um = j?.usageMetadata;
    const done: AiAttempt = {
      ...att, status: res.status, latency_ms: d.now() - t0,
      input_tokens: um ? num(um.promptTokenCount) : null,
      // fikrlash tokenlari ham chiqish sifatida hisoblanadi
      output_tokens: um ? num(um.candidatesTokenCount) + num(um.thoughtsTokenCount) : null,
      cost_usd: null, // bepul tarif, narx noma'lum
    };
    // deno-lint-ignore no-explicit-any
    const text = (j?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? "").join("").trim();
    if (!text) return { data: null, att: { ...done, error: "bo'sh javob" } };
    return judge(done, parseJsonText(text), a.schema, "javob JSON emas");
  } catch (e) {
    return { data: null, att: { ...att, status, error: thrownError(e), latency_ms: d.now() - t0 } };
  }
}

/** Log qatori: «staff-bot ai: claude claude-haiku-5-5 #1 ok 200 812ms in=1234 out=56 $0.000151». */
export function attemptLine(a: AiAttempt): string {
  const head = `staff-bot ai: ${a.provider} ${a.model} #${a.attempt} ${a.ok ? "ok" : "xato"} ${a.status ?? "—"} ${Math.round(a.latency_ms)}ms`;
  const tok = a.input_tokens !== null || a.output_tokens !== null ? ` in=${a.input_tokens ?? 0} out=${a.output_tokens ?? 0}` : "";
  const cost = a.cost_usd !== null ? ` $${a.cost_usd}` : "";
  return head + tok + cost + (a.error ? ` — ${a.error}` : "");
}

/**
 * Tartib bo'yicha provayderlar; birinchi yaroqli javob qaytadi.
 * Hech biri ishlamasa data=null va error (navbatga qo'yish chaqiruvchining ishi).
 */
export async function structuredJSON<T>(a: StructuredArgs, deps: Partial<AiDeps> = {}): Promise<StructuredResult<T>> {
  const d: AiDeps = { ...defaultDeps, ...deps };
  const order = a.order?.length ? parseProviderOrder(a.order.join(",")) : [...DEFAULT_ORDER];
  const attempts: AiAttempt[] = [];
  for (const p of order) {
    for (let n = 1; n <= 2; n++) {
      const r = p === "claude" ? await claudeOnce(a, d) : await geminiOnce(a, d);
      if (!r) break; // kalit yo'q — provayder o'tkazib yuboriladi
      const att = { ...r.att, attempt: n };
      attempts.push(att);
      d.log(attemptLine(att), att.ok);
      if (att.ok) return { data: r.data as T, provider: p, attempts, error: null };
      if (n === 1 && att.status !== null && RETRY_STATUSES.has(att.status)) {
        await d.sleep(RETRY_DELAY_MS);
        continue;
      }
      break;
    }
  }
  const last = attempts[attempts.length - 1];
  const error = last ? `${last.provider} ${last.status ?? "—"}: ${last.error ?? "xato"}` : "AI kaliti sozlanmagan";
  d.log(`staff-bot ai: hech bir provayder javob bermadi (${error})`, false);
  return { data: null, provider: null, attempts, error };
}
