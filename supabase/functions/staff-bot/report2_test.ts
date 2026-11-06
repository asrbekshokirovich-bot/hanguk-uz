import { assertEquals } from "jsr:@std/assert@1";
import { buildDraftPrompt, buildReportDraft, cleanDraft, hasActivity, renderDraftOffer } from "./report2.ts";

Deno.test("hasActivity", () => {
  assertEquals(hasActivity({ completed: [], started: [], comments: [] }), false);
  assertEquals(hasActivity({ completed: ["x"], started: [], comments: [] }), true);
  assertEquals(hasActivity({ completed: [], started: [], comments: ["izoh"] }), true);
});

Deno.test("buildDraftPrompt — bo'sh faoliyat uchun matn", () => {
  const p = buildDraftPrompt({ completed: [], started: [], comments: [] });
  assertEquals(/bajarilgan vazifa yo'q/.test(p), true);
});

Deno.test("buildDraftPrompt — ro'yxatlar", () => {
  const p = buildDraftPrompt({ completed: ["A"], started: ["B"], comments: ["C"] });
  assertEquals(/- A/.test(p), true);
  assertEquals(/- B/.test(p), true);
  assertEquals(/- C/.test(p), true);
});

Deno.test("cleanDraft — hammasi bo'sh bo'lsa null", () => {
  assertEquals(cleanDraft({ done: "", blockers: "", plan: "" }, "haiku"), null);
  assertEquals(cleanDraft(null, null), null);
});

Deno.test("cleanDraft — matn yig'iladi", () => {
  const d = cleanDraft({ done: "Ishladim", blockers: "", plan: "Davom etaman" }, "haiku");
  assertEquals(d?.done, "Ishladim");
  assertEquals(d?.plan, "Davom etaman");
  assertEquals(/Ishladim/.test(d!.text), true);
  assertEquals(/Ertaga: Davom etaman/.test(d!.text), true);
});

Deno.test("renderDraftOffer — HTML escape", () => {
  const text = renderDraftOffer({ done: "x", blockers: null, plan: null, model: null, text: "<b>test</b>" });
  assertEquals(/&lt;b&gt;test&lt;\/b&gt;/.test(text), true);
});

Deno.test("buildReportDraft — faoliyat yo'q bo'lsa null (AI chaqirilmaydi)", async () => {
  let aiCalled = false;
  const deps = {
    db: { rpc: async () => ({ data: { completed: [], started: [], comments: [] }, error: null }) },
    ai: { structured: async () => { aiCalled = true; return { data: null, error: null, attempts: [] }; } },
  };
  const d = await buildReportDraft(deps as any, "u1");
  assertEquals(d, null);
  assertEquals(aiCalled, false);
});

Deno.test("buildReportDraft — AI ishlamasa null", async () => {
  const deps = {
    db: { rpc: async () => ({ data: { completed: ["A"], started: [], comments: [] }, error: null }) },
    ai: { structured: async () => ({ data: null, error: "xato", attempts: [] }) },
  };
  const d = await buildReportDraft(deps as any, "u1");
  assertEquals(d, null);
});

Deno.test("buildReportDraft — muvaffaqiyatli", async () => {
  const deps = {
    db: { rpc: async () => ({ data: [{ completed: ["A"], started: [], comments: [] }], error: null }) },
    ai: {
      structured: async () => ({
        data: { done: "A ni tugatdim", blockers: "", plan: "" },
        error: null,
        attempts: [{ provider: "claude", ok: true, model: "haiku", attempt: 1 } as any],
      }),
    },
  };
  const d = await buildReportDraft(deps as any, "u1");
  assertEquals(d?.model, "haiku");
  assertEquals(d?.done, "A ni tugatdim");
});
