import { assertEquals } from "jsr:@std/assert@1";
import { structuredJSON } from "./ai.ts";

const ARGS = { system: "s", prompt: "p", schema: { type: "object", properties: { a: { type: "string" } } } };
const env = (m: Record<string, string>) => (k: string) => m[k];
const resp = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function stub(gemini: () => Response, claude: () => Response, seen: string[]) {
  return ((url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("generativelanguage")) { seen.push("gemini"); return Promise.resolve(gemini()); }
    seen.push("claude:" + JSON.parse(String(init?.body)).tool_choice.name);
    return Promise.resolve(claude());
  }) as typeof fetch;
}

const geminiOk = () => resp(200, { candidates: [{ content: { parts: [{ text: '{"a":"g"}' }] } }] });
const claudeOk = () => resp(200, { content: [{ type: "tool_use", name: "answer", input: { a: "c" } }] });

Deno.test("Gemini ishlasa — Claude chaqirilmaydi", async () => {
  const seen: string[] = [];
  const r = await structuredJSON(ARGS, env({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "c" }), stub(geminiOk, claudeOk, seen));
  assertEquals(r, { data: { a: "g" }, provider: "gemini" });
  assertEquals(seen, ["gemini"]);
});

Deno.test("Gemini limiti (429) — Claude javob beradi", async () => {
  const seen: string[] = [];
  const r = await structuredJSON(ARGS, env({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "c" }),
    stub(() => resp(429, { error: { status: "RESOURCE_EXHAUSTED" } }), claudeOk, seen));
  assertEquals(r, { data: { a: "c" }, provider: "claude" });
  assertEquals(seen, ["gemini", "claude:answer"]);
});

Deno.test("Gemini bo'sh javob yoki kalitsiz — Claude", async () => {
  const seen: string[] = [];
  const r1 = await structuredJSON(ARGS, env({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "c" }),
    stub(() => resp(200, { candidates: [] }), claudeOk, seen));
  assertEquals(r1.provider, "claude");
  const r2 = await structuredJSON(ARGS, env({ ANTHROPIC_API_KEY: "c" }), stub(geminiOk, claudeOk, []));
  assertEquals(r2.provider, "claude");
});

Deno.test("Ikkalasi ham ishlamasa — null", async () => {
  const r = await structuredJSON(ARGS, env({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "c" }),
    stub(() => resp(500, {}), () => resp(529, {}), []));
  assertEquals(r, { data: null, provider: null });
});

Deno.test("Claude so'roviga temperature qo'shilmaydi (yangi modellar 400 beradi)", async () => {
  let body: Record<string, unknown> = {};
  const f = ((url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("generativelanguage")) return Promise.resolve(resp(429, {}));
    body = JSON.parse(String(init?.body));
    return Promise.resolve(claudeOk());
  }) as typeof fetch;
  const r = await structuredJSON({ ...ARGS, temperature: 0 }, env({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "c" }), f);
  assertEquals(r.provider, "claude");
  assertEquals("temperature" in body, false);
  assertEquals(body.model, "claude-haiku-5-5");
});
