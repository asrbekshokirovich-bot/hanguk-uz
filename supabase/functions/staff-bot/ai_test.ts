// deno test supabase/functions/staff-bot/ai_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import {
  type AiDeps,
  attemptLine,
  claudeCost,
  parseProviderOrder,
  RETRY_DELAY_MS,
  schemaError,
  shortError,
  structuredJSON,
} from "./ai.ts";

const SCHEMA = {
  type: "object",
  properties: { a: { type: "string" }, n: { type: "integer" }, k: { type: "string", enum: ["x", "y"] } },
  required: ["a"],
};
const ARGS = { system: "s", prompt: "p", schema: SCHEMA };
const KEYS = { GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "c" };

const resp = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const claudeOk = (input: unknown = { a: "c" }, usage: unknown = { input_tokens: 2000, output_tokens: 300 }, model = "claude-haiku-5-5") =>
  () => resp(200, { model, content: [{ type: "tool_use", name: "answer", input }], usage });
const geminiOk = (text = '{"a":"g"}', usageMetadata: unknown = { promptTokenCount: 900, candidatesTokenCount: 100, thoughtsTokenCount: 50 }) =>
  () => resp(200, { candidates: [{ content: { parts: [{ text }] } }], usageMetadata });
const err = (status: number, body: unknown = { error: { type: "overloaded_error", message: "Overloaded" } }) => () => resp(status, body);

type Route = () => Response;

/** Soxta tarmoq: har provayder uchun javoblar navbati (oxirgisi takrorlanadi). */
function fake(routes: { claude?: Route[]; gemini?: Route[] }, extra: Record<string, string> = {}) {
  const calls: { provider: string; body: Record<string, unknown> }[] = [];
  const logs: { line: string; ok: boolean }[] = [];
  const slept: number[] = [];
  let t = 1000;
  const f = ((url: string | URL | Request, init?: RequestInit) => {
    const provider = String(url).includes("generativelanguage") ? "gemini" : "claude";
    calls.push({ provider, body: JSON.parse(String(init?.body)) });
    const q = routes[provider as "claude" | "gemini"] ?? [];
    const next = q.length > 1 ? q.shift()! : q[0];
    if (!next) return Promise.reject(new Error(`kutilmagan so'rov: ${provider}`));
    return Promise.resolve(next());
  }) as typeof fetch;
  const deps: Partial<AiDeps> = {
    env: (k) => ({ ...KEYS, ...extra } as Record<string, string>)[k],
    fetch: f,
    log: (line, ok) => logs.push({ line, ok }),
    sleep: (ms) => { slept.push(ms); return Promise.resolve(); },
    now: () => (t += 50),
    timeoutMs: 0,
  };
  return { deps, calls, logs, slept, seen: () => calls.map((c) => c.provider) };
}

Deno.test("Standart tartib (D1): avval Claude; ishlasa Gemini chaqirilmaydi", async () => {
  const n = fake({ claude: [claudeOk()], gemini: [geminiOk()] });
  const r = await structuredJSON(ARGS, n.deps);
  assertEquals([r.data, r.provider, r.error], [{ a: "c" }, "claude", null]);
  assertEquals(n.seen(), ["claude"]);
  assertEquals(r.attempts.length, 1);
});

Deno.test("Tartib argument bilan: gemini, claude", async () => {
  const n = fake({ claude: [claudeOk()], gemini: [geminiOk()] });
  const r = await structuredJSON({ ...ARGS, order: ["gemini", "claude"] }, n.deps);
  assertEquals([r.data, r.provider], [{ a: "g" }, "gemini"]);
  assertEquals(n.seen(), ["gemini"]);
});

Deno.test("Faqat bitta provayder berilsa — zaxira yo'q", async () => {
  const n = fake({ claude: [err(500)], gemini: [geminiOk()] });
  const r = await structuredJSON({ ...ARGS, order: ["claude"] }, n.deps);
  assertEquals(r.data, null);
  assertEquals(n.seen(), ["claude"]);
});

Deno.test("529 → ~1,5 s kutib bitta qayta urinish, keyin muvaffaqiyat", async () => {
  const n = fake({ claude: [err(529), claudeOk()] });
  const r = await structuredJSON(ARGS, n.deps);
  assertEquals(r.provider, "claude");
  assertEquals(n.seen(), ["claude", "claude"]);
  assertEquals(n.slept, [RETRY_DELAY_MS]);
  assertEquals(RETRY_DELAY_MS, 1500);
  assertEquals(r.attempts.map((a) => [a.attempt, a.ok, a.status]), [[1, false, 529], [2, true, 200]]);
  assertEquals(r.attempts[0].error, "overloaded_error: Overloaded");
});

Deno.test("429/503 ikki marta → keyingi provayder (har birida bitta qayta urinish)", async () => {
  const n = fake({
    claude: [err(429, { error: { type: "rate_limit_error", message: "slow down" } })],
    gemini: [err(503, { error: { code: 503, status: "UNAVAILABLE", message: "high demand" } }), geminiOk()],
  });
  const r = await structuredJSON(ARGS, n.deps);
  assertEquals([r.data, r.provider], [{ a: "g" }, "gemini"]);
  assertEquals(n.seen(), ["claude", "claude", "gemini", "gemini"]);
  assertEquals(n.slept, [1500, 1500]);
  assertEquals(r.attempts.map((a) => `${a.provider}#${a.attempt}:${a.status}`), ["claude#1:429", "claude#2:429", "gemini#1:503", "gemini#2:200"]);
  assertEquals(r.attempts[2].error, "UNAVAILABLE: high demand");
});

Deno.test("400 va tarmoq xatosida qayta urinilmaydi", async () => {
  const n = fake({ claude: [err(400, { error: { type: "invalid_request_error", message: "bad" } })], gemini: [geminiOk()] });
  const r = await structuredJSON(ARGS, n.deps);
  assertEquals(n.seen(), ["claude", "gemini"]);
  assertEquals(n.slept, []);
  assertEquals(r.provider, "gemini");

  const t = fake({ claude: [() => { throw new TypeError("connection reset"); }], gemini: [geminiOk()] });
  const r2 = await structuredJSON(ARGS, t.deps);
  assertEquals(t.seen(), ["claude", "gemini"]);
  assertEquals([r2.attempts[0].status, r2.attempts[0].error, r2.attempts[0].ok], [null, "connection reset", false]);
});

Deno.test("Ikkalasi ham ishlamasa — data=null, xato va hamma urinishlar", async () => {
  const n = fake({ claude: [err(500)], gemini: [err(500, { error: { status: "INTERNAL", message: "boom" } })] });
  const r = await structuredJSON(ARGS, n.deps);
  assertEquals([r.data, r.provider], [null, null]);
  assertEquals(r.error, "gemini 500: INTERNAL: boom");
  assertEquals(r.attempts.length, 2);
  assertEquals(n.logs.at(-1)?.ok, false); // yakuniy qator
});

Deno.test("Kaliti yo'q provayder o'tkazib yuboriladi; kalit umuman bo'lmasa — xato, urinish yo'q", async () => {
  const n = fake({ claude: [claudeOk()], gemini: [geminiOk()] }, { ANTHROPIC_API_KEY: "" });
  const r = await structuredJSON(ARGS, n.deps);
  assertEquals([r.provider, n.seen()], ["gemini", ["gemini"]]);
  const z = fake({}, { ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "" });
  const r2 = await structuredJSON(ARGS, z.deps);
  assertEquals([r2.data, r2.attempts, r2.error], [null, [], "AI kaliti sozlanmagan"]);
});

Deno.test("usage → tokenlar va narx (Claude rasmiy narx, Gemini null)", async () => {
  const n = fake({ claude: [err(500)], gemini: [geminiOk()] });
  const r = await structuredJSON(ARGS, n.deps);
  const [c, g] = r.attempts;
  assertEquals([c.input_tokens, c.output_tokens, c.cost_usd], [null, null, null]); // xato javobda usage yo'q
  assertEquals([g.provider, g.model, g.input_tokens, g.output_tokens, g.cost_usd], ["gemini", "gemini-2.5-flash", 900, 150, null]);
  assertEquals(g.latency_ms, 50);

  const k = fake({ claude: [claudeOk({ a: "c" }, { input_tokens: 2000, output_tokens: 300 }, "claude-haiku-5-5-20261001")] });
  const r2 = await structuredJSON(ARGS, k.deps);
  const a = r2.attempts[0];
  assertEquals([a.model, a.input_tokens, a.output_tokens, a.cost_usd, a.ok, a.status], ["claude-haiku-5-5-20261001", 2000, 300, 0.00035, true, 200]);
});

Deno.test("claudeCost: Haiku 5.5 (≤100K va >100K), Sonnet 5.5, kesh, noma'lum model", () => {
  assertEquals(claudeCost("claude-haiku-5-5", { input_tokens: 2000, output_tokens: 300 }), 0.00035); // 2000×0.10 + 300×0.50
  assertEquals(claudeCost("claude-haiku-5-5", { input_tokens: 120_000, output_tokens: 1000 }), 0.0625); // 120K×0.50 + 1K×2.50
  assertEquals(claudeCost("claude-sonnet-5-5", { input_tokens: 1000, output_tokens: 100 }), 0.003); // 1K×2 + 100×10
  assertEquals(
    claudeCost("claude-haiku-5-5", { input_tokens: 100, cache_creation_input_tokens: 1000, cache_read_input_tokens: 2000, output_tokens: 10 }),
    0.00016, // 100×0.10 + 1000×0.125 + 2000×0.01 + 10×0.50
  );
  assertEquals(claudeCost("claude-opus-9", { input_tokens: 10, output_tokens: 10 }), null);
  assertEquals(claudeCost("claude-haiku-5-5", null), null);
});

Deno.test("Claude so'roviga temperature qo'shilmaydi (yangi modellar 400 beradi); Gemini'ga qo'shiladi", async () => {
  const n = fake({ claude: [err(500)], gemini: [geminiOk()] });
  await structuredJSON({ ...ARGS, temperature: 0 }, n.deps);
  const claude = n.calls.find((c) => c.provider === "claude")!.body;
  assertEquals("temperature" in claude, false);
  assertEquals(claude.model, "claude-haiku-5-5");
  assertEquals((claude.tool_choice as { name: string }).name, "answer");
  const gemini = n.calls.find((c) => c.provider === "gemini")!.body;
  assertEquals((gemini.generationConfig as { temperature: number }).temperature, 0);
});

Deno.test("Sxemaga mos kelmagan javob — xato, keyingi provayder", async () => {
  const n = fake({ claude: [claudeOk({ n: 1 })], gemini: [geminiOk('{"a":"g","k":"z"}')] });
  const r = await structuredJSON(ARGS, n.deps);
  assertEquals(r.data, null);
  assertEquals(r.attempts.map((a) => a.error), ["sxema: «a» yo'q", "sxema: «k» ruxsat etilmagan qiymat"]);
  assertEquals(r.attempts[0].cost_usd, 0.00035); // to'langan, lekin yaroqsiz
  const b = fake({ claude: [() => resp(200, { content: [{ type: "text", text: "salom" }] })], gemini: [geminiOk("")] });
  const r2 = await structuredJSON(ARGS, b.deps);
  assertEquals(r2.attempts.map((a) => a.error), ["javobda tool_use yo'q", "bo'sh javob"]);
  const j = fake({ gemini: [geminiOk('Natija: {"a":"g"} tamom')] });
  assertEquals((await structuredJSON({ ...ARGS, order: ["gemini"] }, j.deps)).data, { a: "g" });
});

Deno.test("Log: har urinishga bitta qator, kalitsiz", async () => {
  const n = fake({ claude: [err(529), claudeOk()] });
  await structuredJSON(ARGS, n.deps);
  assertEquals(n.logs.map((l) => l.ok), [false, true]);
  assertEquals(n.logs[0].line, "staff-bot ai: claude claude-haiku-5-5 #1 xato 529 50ms — overloaded_error: Overloaded");
  assertEquals(n.logs[1].line, "staff-bot ai: claude claude-haiku-5-5 #2 ok 200 50ms in=2000 out=300 $0.00035");
  const g = fake({ gemini: [err(429)] });
  await structuredJSON({ ...ARGS, order: ["gemini"] }, g.deps);
  assertEquals(g.logs.some((l) => l.line.includes("key=") || l.line.includes("generativelanguage")), false);
});

Deno.test("parseProviderOrder", () => {
  assertEquals(parseProviderOrder("gemini, claude"), ["gemini", "claude"]);
  assertEquals(parseProviderOrder("Claude;claude;openai"), ["claude"]);
  assertEquals(parseProviderOrder(""), ["claude", "gemini"]);
  assertEquals(parseProviderOrder(null), ["claude", "gemini"]);
});

Deno.test("shortError, schemaError, attemptLine", () => {
  assertEquals(
    shortError('{"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED"}}'),
    "RESOURCE_EXHAUSTED: You exceeded your current quota",
  );
  assertEquals(shortError('{"type":"error","error":{"type":"invalid_request_error","message":"`temperature` is deprecated for this model."}}'),
    "invalid_request_error: `temperature` is deprecated for this model.");
  assertEquals(shortError("x".repeat(500)).length, 200);
  assertEquals(shortError(""), "—");
  assertEquals(schemaError({ a: "x", n: 1.5 }, SCHEMA), "«n» integer emas");
  assertEquals(schemaError([], SCHEMA), "javob obyekt emas");
  assertEquals(schemaError({ a: "x", n: 2, k: "y" }, SCHEMA), null);
  assertEquals(
    attemptLine({ provider: "gemini", model: "m", attempt: 1, ok: false, status: null, error: "vaqt tugadi (timeout)", latency_ms: 25000.4, input_tokens: null, output_tokens: null, cost_usd: null }),
    "staff-bot ai: gemini m #1 xato — 25000ms — vaqt tugadi (timeout)",
  );
});

Deno.test("Kalit loglarga va jurnalga tushmaydi (Deno fetch xatosida URL bo'ladi)", async () => {
  const n = fake({
    gemini: [() => { throw new TypeError("error sending request for url (https://generativelanguage.googleapis.com/v1beta/models/m:generateContent?key=AIzaSyD-secret123456): dns error"); }],
  });
  const r = await structuredJSON({ ...ARGS, order: ["gemini"] }, n.deps);
  assertEquals(r.attempts[0].error, "error sending request for url (https://generativelanguage.googleapis.com/v1beta/models/m:generateContent?key=***): dns error");
  assertEquals(JSON.stringify(n.logs).includes("secret123456"), false);
  assertEquals(shortError("x-api-key sk-ant-api03-abcdefghijklmnop"), "x-api-key sk-ant-***");
});

Deno.test("200 javob JSON emas — status saqlanadi, qayta urinilmaydi", async () => {
  const n = fake({ claude: [() => new Response("<html>", { status: 200 })], gemini: [geminiOk()] });
  const r = await structuredJSON(ARGS, n.deps);
  assertEquals([r.attempts[0].status, r.attempts[0].ok, n.seen()], [200, false, ["claude", "gemini"]]);
});
