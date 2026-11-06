// deno test supabase/functions/staff-bot/summary_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import type { AiAttempt, StructuredArgs, StructuredResult } from "./ai.ts";
import type { DbError } from "./aiops.ts";
import { isWorkday } from "./notify.ts";
import { type GroupDigest, renderGroupDigest } from "./core.ts";
import {
  buildSummaryPrompt,
  cleanSummary,
  createSummaryOps,
  type DayMessage,
  digestPoints,
  SUMMARY_MIN_MESSAGES,
  tashkentDate,
} from "./summary.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

const T = (s: string) => Date.parse(s);
const FRI_2130 = T("2026-11-06T16:30:00Z"); // juma 21:30 Toshkent
const SUN_2130 = T("2026-11-08T16:30:00Z"); // yakshanba

const msg = (i: number, p: Partial<DayMessage> = {}): DayMessage => ({
  message_id: i, at: `2026-11-06T0${4 + (i % 5)}:1${i % 10}:00+00:00`, author: "Diyora", external: false,
  text: `Xabar ${i}`, ...p,
});

const att = (p: Partial<AiAttempt> = {}): AiAttempt => ({
  provider: "claude", model: "claude-haiku-5-5", attempt: 1, ok: true, status: 200, error: null,
  latency_ms: 900, input_tokens: 1500, output_tokens: 200, cost_usd: 0.00025, ...p,
});

const AI_OK = {
  points: ["Kamera o'rnatish muhokama qilindi", "2. Diyora 3 ta talaba hujjatini topshirdi", "Kamera o'rnatish muhokama qilindi", "  "],
  topics: ["kamera", "hujjatlar"],
  decisions: ["Kamera dushanba o'rnatiladi"],
  open_questions: [],
};

function harness(opts: {
  msgs?: DayMessage[];
  ai?: StructuredResult<unknown>;
  settings?: Record<string, string>;
  now?: number;
  saveError?: DbError | null;
  summaryRow?: unknown;
}) {
  const rpc: { fn: string; args: Any }[] = [];
  const aiCalls: { purpose: string; args: StructuredArgs; jobId: string | null | undefined }[] = [];
  const queued: { kind: string; key: string; payload: Any; error: string | null }[] = [];
  const settings = { group_chat_id: "-100500", workdays: "1,2,3,4,5,6", ...(opts.settings ?? {}) };
  const ops = createSummaryOps({
    db: {
      rpc(fn, args) {
        rpc.push({ fn, args });
        if (fn === "bot_group_day_messages") return Promise.resolve({ data: opts.msgs ?? [], error: null });
        if (fn === "bot_group_summary_save") return Promise.resolve({ data: null, error: opts.saveError ?? null });
        if (fn === "bot_group_summary_get") return Promise.resolve({ data: opts.summaryRow ?? null, error: null });
        return Promise.resolve({ data: null, error: { message: `stub yo'q: ${fn}` } });
      },
    },
    ai: {
      structured<T>(purpose: string, args: StructuredArgs, jobId?: string | null) {
        aiCalls.push({ purpose, args, jobId });
        return Promise.resolve((opts.ai ?? { data: AI_OK, provider: "claude", attempts: [att()], error: null }) as StructuredResult<T>);
      },
      enqueue(kind, key, payload, error) {
        queued.push({ kind, key, payload, error });
        return Promise.resolve("job-1");
      },
    },
    setting: (k) => Promise.resolve((settings as Record<string, string>)[k] ?? ""),
    isWorkday,
    now: () => opts.now ?? FRI_2130,
  });
  return { ops, rpc, aiCalls, queued };
}

const P = (s = "") => new URLSearchParams(s);
const FIVE = [1, 2, 3, 4, 5].map((i) => msg(i));

Deno.test("tashkentDate: UTC+5 bo'yicha sana", () => {
  assertEquals(tashkentDate(T("2026-11-06T18:59:00Z")), "2026-11-06");
  assertEquals(tashkentDate(T("2026-11-06T19:00:00Z")), "2026-11-07");
});

Deno.test("cleanSummary: takror/bo'sh tashlanadi, raqamli ro'yxat belgisi olinadi, son saqlanadi", () => {
  const r = cleanSummary(AI_OK)!;
  assertEquals(r.summary, "• Kamera o'rnatish muhokama qilindi\n• Diyora 3 ta talaba hujjatini topshirdi");
  assertEquals(r.topics, ["kamera", "hujjatlar"]);
  assertEquals(r.decisions, ["Kamera dushanba o'rnatiladi"]);
  assertEquals(r.open_questions, []);
  assertEquals(cleanSummary({ ...AI_OK, points: ["3 ta talaba keldi"] })!.summary, "• 3 ta talaba keldi");
  assertEquals(cleanSummary({ ...AI_OK, points: [] }), null);
  assertEquals(cleanSummary(null), null);
  const many = cleanSummary({ ...AI_OK, points: Array.from({ length: 9 }, (_, i) => `Band ${i}`) })!;
  assertEquals(many.summary.split("\n").length, 6);
});

Deno.test("buildSummaryPrompt: vaqt (Toshkent), muallif, tashqi; uzun xabar qisqartiriladi", () => {
  const p = buildSummaryPrompt("2026-11-06", [
    msg(1, { at: "2026-11-06T04:05:00Z", text: "🎤 Salom   hammaga" }),
    msg(2, { at: "2026-11-06T05:00:00Z", author: "tashqi", external: true, text: "x".repeat(1500) }),
  ]);
  assertEquals(p.includes("[09:05] Diyora: 🎤 Salom hammaga"), true, p);
  assertEquals(p.includes("[10:00] tashqi: " + "x".repeat(999) + "…"), true);
  assertEquals(p.includes("Messages (2)"), true);
});

Deno.test("buildSummaryPrompt: juda uzun kun — oxirgi xabarlar saqlanadi", () => {
  const big = Array.from({ length: 60 }, (_, i) => msg(i, { text: `M${i} ` + "y".repeat(990) }));
  const p = buildSummaryPrompt("2026-11-06", big);
  assertEquals(p.includes("M59 "), true);
  assertEquals(p.includes("M0 "), false);
  assertEquals(/Kunning boshidagi \d+ ta xabar sig'madi/.test(p), true);
  assertEquals(p.length < 42_000, true);
});

Deno.test("run: ish kuni — xabarlar → AI (group_summary) → saqlash", async () => {
  const h = harness({ msgs: FIVE });
  const r = await h.ops.run(P());
  assertEquals(r, { ok: true, status: "saved", chat_id: -100500, date: "2026-11-06", messages: 5, model: "claude-haiku-5-5" });
  assertEquals(h.rpc[0], { fn: "bot_group_day_messages", args: { p_chat: -100500, p_date: "2026-11-06" } });
  assertEquals(h.aiCalls.length, 1);
  assertEquals(h.aiCalls[0].purpose, "group_summary");
  assertEquals(h.aiCalls[0].jobId, null);
  const save = h.rpc.find((c) => c.fn === "bot_group_summary_save")!.args;
  assertEquals(save.p_chat, -100500);
  assertEquals(save.p_date, "2026-11-06");
  assertEquals(save.p_message_count, 5);
  assertEquals(save.p_model, "claude-haiku-5-5");
  assertEquals(save.p_decisions, ["Kamera dushanba o'rnatiladi"]);
  assertEquals(h.queued.length, 0);
});

Deno.test("run: model — muvaffaqiyatli urinishniki (Claude xato → Gemini)", async () => {
  const h = harness({
    msgs: FIVE,
    ai: { data: AI_OK, provider: "gemini", error: null, attempts: [
      att({ ok: false, status: 529, error: "overloaded" }), att({ provider: "gemini", model: "gemini-2.5-flash", cost_usd: null }),
    ] },
  });
  const r = await h.ops.run(P());
  assertEquals(r.ok && r.status === "saved" && r.model, "gemini-2.5-flash");
});

Deno.test(`run: ${SUMMARY_MIN_MESSAGES} tadan kam xabar — AI chaqirilmaydi, yozilmaydi`, async () => {
  const h = harness({ msgs: [msg(1), msg(2), msg(3, { text: "   " })] });
  const r = await h.ops.run(P());
  assertEquals(r, { ok: true, status: "few", chat_id: -100500, date: "2026-11-06", messages: 2 });
  assertEquals(h.aiCalls.length, 0);
  assertEquals(h.rpc.map((c) => c.fn), ["bot_group_day_messages"]);
});

Deno.test("run: dam olish kuni, o'chirilgan, guruh yo'q — hech narsa", async () => {
  const off = harness({ msgs: FIVE, now: SUN_2130 });
  assertEquals(await off.ops.run(P()), { ok: true, status: "offday" });
  assertEquals(off.rpc.length, 0);
  const dis = harness({ msgs: FIVE, settings: { group_summary_enabled: "false" } });
  assertEquals(await dis.ops.run(P()), { ok: true, status: "disabled" });
  const nochat = harness({ msgs: FIVE, settings: { group_chat_id: "" } });
  assertEquals(await nochat.ops.run(P()), { ok: true, status: "no_chat" });
});

Deno.test("run: qo'lda &date= — ish kuni tekshirilmaydi, &chat= ustun", async () => {
  const h = harness({ msgs: FIVE, now: SUN_2130 });
  const r = await h.ops.run(P("date=2026-11-07&chat=-42"));
  assertEquals(r.ok && r.status, "saved");
  assertEquals(h.rpc[0].args, { p_chat: -42, p_date: "2026-11-07" });
});

Deno.test("run: provayderlar xato — bot_jobs navbatiga (gs:<chat>:<sana>), yozilmaydi", async () => {
  const h = harness({ msgs: FIVE, ai: { data: null, provider: null, attempts: [att({ ok: false, status: 529 })], error: "claude 529" } });
  const r = await h.ops.run(P());
  assertEquals(r, { ok: false, status: "ai_error", chat_id: -100500, date: "2026-11-06", error: "claude 529", queued: true });
  assertEquals(h.queued, [{ kind: "group_summary", key: "gs:-100500:2026-11-06", payload: { chat_id: -100500, date: "2026-11-06" }, error: "claude 529" }]);
  assertEquals(h.rpc.some((c) => c.fn === "bot_group_summary_save"), false);
});

Deno.test("run: AI bo'sh bandlar qaytarsa — yozilmaydi (empty)", async () => {
  const h = harness({ msgs: FIVE, ai: { data: { ...AI_OK, points: [] }, provider: "claude", attempts: [att()], error: null } });
  assertEquals((await h.ops.run(P())).status, "empty");
  assertEquals(h.rpc.some((c) => c.fn === "bot_group_summary_save"), false);
});

Deno.test("job: navbatdan — jobId bilan, xato bo'lsa qayta navbatga qo'yilmaydi", async () => {
  const bad = harness({ msgs: FIVE, ai: { data: null, provider: null, attempts: [], error: "gemini 503" } });
  const err = await bad.ops.job({ id: "j1", kind: "group_summary", payload: { chat_id: -100500, date: "2026-11-06" }, attempts: 1 });
  assertEquals(err, "gemini 503");
  assertEquals(bad.aiCalls[0].jobId, "j1");
  assertEquals(bad.queued.length, 0);
  const good = harness({ msgs: FIVE });
  assertEquals(await good.ops.job({ id: "j2", kind: "group_summary", payload: { chat_id: -100500, date: "2026-11-06" }, attempts: 2 }), undefined);
  // buzuq ish — yopiladi
  assertEquals(await good.ops.job({ id: "j3", kind: "group_summary", payload: { date: "x" }, attempts: 1 }), undefined);
});

Deno.test("job: saqlashda baza xatosi — qayta urinish uchun xato matni", async () => {
  const h = harness({ msgs: FIVE, saveError: { message: "boom" } });
  assertEquals(await h.ops.job({ id: "j", kind: "group_summary", payload: { chat_id: 1, date: "2026-11-06" }, attempts: 1 }), "bot_group_summary_save: boom");
});

Deno.test("digestChat / digestPoints: bandlar, ko'pi bilan 5; yo'q bo'lsa null", async () => {
  assertEquals(digestPoints("• A\n• B\n\n- C"), ["A", "B", "C"]);
  assertEquals(digestPoints("• 1\n• 2\n• 3\n• 4\n• 5\n• 6").length, 5);
  const h = harness({ summaryRow: { summary: "• Kamera\n• Hujjatlar" } });
  assertEquals(await h.ops.digestChat(-100500, "2026-11-05"), ["Kamera", "Hujjatlar"]);
  assertEquals(h.rpc[0].args, { p_chat: -100500, p_date: "2026-11-05" });
  assertEquals(await harness({}).ops.digestChat(-100500, "2026-11-05"), null);
  assertEquals(await harness({}).ops.digestChat(0, "2026-11-05"), null);
});

const DIGEST: GroupDigest = {
  date: "2026-11-06", weekday: 5, prev_date: "2026-11-05",
  counts: { open: 1, overdue: 0, today: 0, done: 0 }, people: [], brief: null, reports: null,
};

Deno.test("renderGroupDigest: «💬 Kecha guruhda» — escape, 5 band; xulosa yo'q bo'lsa bo'lim yo'q", () => {
  const t = renderGroupDigest({ ...DIGEST, chat: ["<b>Kamera</b> & eshik", "B", "C", "D", "E", "F"] });
  assertEquals(t.includes("💬 <b>Kecha guruhda</b>\n• &lt;b&gt;Kamera&lt;/b&gt; &amp; eshik\n• B\n• C\n• D\n• E"), true, t);
  assertEquals(t.includes("• F"), false);
  assertEquals(renderGroupDigest(DIGEST).includes("guruhda"), false);
  assertEquals(renderGroupDigest({ ...DIGEST, chat: [] }).includes("guruhda"), false);
  assertEquals(renderGroupDigest({ ...DIGEST, chat: null }).includes("guruhda"), false);
  const mon = renderGroupDigest({ ...DIGEST, date: "2026-11-09", weekday: 1, prev_date: "2026-11-07", chat: ["A"] });
  assertEquals(mon.includes("💬 <b>Shanba kuni guruhda</b>\n• A"), true, mon);
});
