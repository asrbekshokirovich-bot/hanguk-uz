// deno test supabase/functions/staff-bot/aiops_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import type { AiAttempt, StructuredArgs, StructuredResult, structuredJSON } from "./ai.ts";
import {
  aiAlertText,
  aiCallRows,
  cleanReportParts,
  createAiOps,
  type Db,
  type DbError,
  isQuietHour,
  type JobRow,
} from "./aiops.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

const DAY = Date.parse("2026-11-05T05:00:00Z"); // 10:00 Toshkent
const NIGHT = Date.parse("2026-11-05T18:30:00Z"); // 23:30 Toshkent

const att = (p: Partial<AiAttempt>): AiAttempt => ({
  provider: "claude", model: "claude-haiku-5-5", attempt: 1, ok: true, status: 200, error: null,
  latency_ms: 812.4, input_tokens: 2000, output_tokens: 300, cost_usd: 0.00035, ...p,
});

function stubDb(rpcs: Record<string, (args: Any) => { data?: unknown; error?: DbError | null }>) {
  const calls: { fn: string; args: Any }[] = [];
  const inserts: { table: string; rows: Any }[] = [];
  const db: Db = {
    rpc(fn, args) {
      calls.push({ fn, args });
      const h = rpcs[fn];
      const r = h ? h(args) : { error: { message: `stub yo'q: ${fn}` } };
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
    },
    from(table) {
      return {
        insert(rows: unknown) {
          inserts.push({ table, rows });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { db, calls, inserts, fns: () => calls.map((c) => c.fn) };
}

/** structuredJSON o'rniga: navbatdagi natijalar, so'rovlar yoziladi. */
function stubAi(results: StructuredResult<unknown>[]) {
  const seen: StructuredArgs[] = [];
  const fn = ((a: StructuredArgs) => {
    seen.push(a);
    return Promise.resolve(results.length > 1 ? results.shift()! : results[0]);
  }) as unknown as typeof structuredJSON;
  return { fn, seen };
}

const ok = (data: unknown): StructuredResult<unknown> => ({ data, provider: "claude", attempts: [att({})], error: null });
const fail = (error = "claude 529: overloaded_error: Overloaded"): StructuredResult<unknown> => ({
  data: null, provider: null, error,
  attempts: [att({ ok: false, status: 529, error: "overloaded_error: Overloaded", input_tokens: null, output_tokens: null, cost_usd: null })],
});

function ops(rpcs: Parameters<typeof stubDb>[0], results: StructuredResult<unknown>[], o: { order?: () => Promise<string | null>; now?: () => number } = {}) {
  const s = stubDb(rpcs);
  const ai = stubAi(results);
  const sent: { chat: number; text: string }[] = [];
  const x = createAiOps({
    db: s.db,
    providerOrder: o.order ?? (() => Promise.resolve("gemini,claude")),
    send: (chat, text) => { sent.push({ chat, text }); return Promise.resolve(); },
    structured: ai.fn,
    now: o.now ?? (() => DAY),
  });
  return { x, s, ai, sent };
}

Deno.test("structured: tartib sozlamadan (60 s kesh), har urinish ai_calls'ga", async () => {
  let reads = 0;
  let t = DAY;
  const { x, s, ai } = ops({}, [ok({ a: 1 })], { order: () => { reads++; return Promise.resolve("gemini, claude"); }, now: () => t });
  const r = await x.structured("group_analysis", { system: "s", prompt: "p", schema: {} }, "job-1");
  assertEquals(r.data, { a: 1 });
  assertEquals(ai.seen[0].order, ["gemini", "claude"]);
  await x.structured("report_split", { system: "s", prompt: "p", schema: {} });
  assertEquals(reads, 1);
  t += 61_000;
  await x.structured("report_split", { system: "s", prompt: "p", schema: {} });
  assertEquals(reads, 2);
  assertEquals(s.inserts.length, 3);
  assertEquals(s.inserts[0].table, "ai_calls");
  assertEquals(s.inserts[0].rows, [{
    source: "staff-bot", purpose: "group_analysis", provider: "claude", model: "claude-haiku-5-5", attempt: 1, ok: true,
    http_status: 200, error: null, latency_ms: 812, input_tokens: 2000, output_tokens: 300, cost_usd: 0.00035, job_id: "job-1",
  }]);
  assertEquals(s.inserts[1].rows[0].job_id, null);
});

Deno.test("structured: sozlamani o'qib bo'lmasa — standart tartib (claude, gemini)", async () => {
  const { x, ai } = ops({}, [ok({})], { order: () => Promise.reject(new Error("db down")) });
  await x.structured("group_analysis", { system: "s", prompt: "p", schema: {} });
  assertEquals(ai.seen[0].order, ["claude", "gemini"]);
});

Deno.test("aiCallRows: uzun xato qisqartiriladi, vaqt butun", () => {
  const rows = aiCallRows("report_split", [att({ ok: false, error: "x".repeat(400), latency_ms: 99.6 })]);
  assertEquals([rows[0].error?.length, rows[0].latency_ms, rows[0].ok], [300, 100, false]);
  assertEquals(aiCallRows("x_y", []), []);
});

Deno.test("splitReport: qismlar, bo'sh javob (xato emas), provayder xatosi", async () => {
  const a = ops({}, [ok({ done: " 3 ta qo'ng'iroq ", blockers: "", plan: "apostil" })]);
  assertEquals(await a.x.splitReport("bugun..."), { parts: { done: "3 ta qo'ng'iroq", blockers: null, plan: "apostil" }, error: null });
  assertEquals(a.ai.seen[0].temperature, 0);
  assertEquals(a.ai.seen[0].prompt.includes('"""bugun..."""'), true);
  const b = ops({}, [ok({ done: " ", blockers: "", plan: "" })]);
  assertEquals(await b.x.splitReport("x"), { parts: null, error: null });
  const c = ops({}, [fail()]);
  assertEquals(await c.x.splitReport("x"), { parts: null, error: "claude 529: overloaded_error: Overloaded" });
  assertEquals(c.s.inserts[0].rows[0].purpose, "report_split");
  assertEquals(cleanReportParts(null), null);
});

Deno.test("enqueue: bot_job_enqueue parametrlari; xato bo'lsa null", async () => {
  const a = ops({ bot_job_enqueue: () => ({ data: "job-9" }) }, [ok({})]);
  assertEquals(await a.x.enqueue("group_analysis", "ga:-100:5", { text: "t" }, "gemini 429"), "job-9");
  assertEquals(a.s.calls[0], { fn: "bot_job_enqueue", args: { p_kind: "group_analysis", p_key: "ga:-100:5", p_payload: { text: "t" }, p_error: "gemini 429" } });
  const b = ops({ bot_job_enqueue: () => ({ error: { message: "relation does not exist" } }) }, [ok({})]);
  assertEquals(await b.x.enqueue("report_split", "rs:1", {}, null), null);
});

const job = (p: Partial<JobRow>): JobRow => ({ id: "j1", kind: "report_split", payload: { report_id: "r1", raw: "bugun ish" }, attempts: 0, ...p });

Deno.test("reportJob: qayta ajratib bot_report_apply_split; xato — matn; buzuq ish — AI chaqirilmaydi", async () => {
  const a = ops({ bot_report_apply_split: () => ({ data: true }) }, [ok({ done: "ish", blockers: "", plan: "reja" })]);
  assertEquals(await a.x.reportJob(job({})), undefined);
  assertEquals(a.s.calls.find((c) => c.fn === "bot_report_apply_split")?.args,
    { p_report: "r1", p_raw: "bugun ish", p_done: "ish", p_blockers: null, p_plan: "reja" });
  assertEquals(a.s.inserts[0].rows[0].job_id, "j1");
  const b = ops({}, [fail("gemini 503: UNAVAILABLE")]);
  assertEquals(await b.x.reportJob(job({})), "gemini 503: UNAVAILABLE");
  const c = ops({}, [ok({})]);
  assertEquals(await c.x.reportJob(job({ payload: {} })), undefined);
  assertEquals(c.ai.seen.length, 0);
});

Deno.test("runJobs: birma-bir olinadi; ok → done, xato → qayta, 3-xato → failed; noma'lum tur va throw — xato", async () => {
  const queue: JobRow[] = [
    job({ id: "a", kind: "group_analysis" }),
    job({ id: "b", kind: "group_analysis", attempts: 2 }),
    job({ id: "c", kind: "boshqa" }),
    job({ id: "d", kind: "throws" }),
  ];
  const finished: Any[] = [];
  const { x, s, sent } = ops({
    bot_job_claim: () => ({ data: queue.length ? [queue.shift()] : [] }),
    bot_job_finish: (a) => {
      finished.push(a);
      const status = a.p_ok ? "done" : a.p_id === "b" ? "failed" : "pending";
      return { data: [{ status, attempts: 1 }] };
    },
    bot_ai_alert_state: () => ({ data: { calls: 0, errors: 0, failed_jobs: 0 } }),
  }, [ok({})]);
  const seen: string[] = [];
  const rep = await x.runJobs({
    group_analysis: (j) => { seen.push(j.id); return Promise.resolve(j.id === "a" ? undefined : "claude 529: Overloaded"); },
    throws: () => Promise.reject(new Error("db xato")),
  });
  assertEquals(seen, ["a", "b"]);
  assertEquals(finished.map((f) => [f.p_id, f.p_ok, f.p_error]), [
    ["a", true, null],
    ["b", false, "claude 529: Overloaded"],
    ["c", false, "noma'lum ish turi: boshqa"],
    ["d", false, "db xato"],
  ]);
  assertEquals(rep, { done: 1, retry: 2, failed: 1, alert: "none" });
  assertEquals(s.fns().filter((f) => f === "bot_job_claim").length, 5); // oxirgisi bo'sh
  assertEquals(sent.length, 0);
});

Deno.test("runJobs: report_split ichki bajaruvchi bilan; claim xatosi — to'xtaydi", async () => {
  const q = [job({})];
  const a = ops({
    bot_job_claim: () => ({ data: q.length ? [q.shift()] : [] }),
    bot_job_finish: () => ({ data: [{ status: "done", attempts: 1 }] }),
    bot_report_apply_split: () => ({ data: true }),
    bot_ai_alert_state: () => ({ data: { calls: 0, errors: 0, failed_jobs: 0 } }),
  }, [ok({ done: "ish", blockers: "", plan: "" })]);
  assertEquals((await a.x.runJobs({})).done, 1);
  const b = ops({ bot_job_claim: () => ({ error: { message: "function does not exist" } }), bot_ai_alert_state: () => ({ data: null }) }, [ok({})]);
  assertEquals(await b.x.runJobs({}), { done: 0, retry: 0, failed: 0, alert: "none" });
});

const BAD = { calls: 12, errors: 5, failed_jobs: 2, failed_kinds: { group_analysis: 1, report_split: 1 },
  last_error: { provider: "claude", status: 529, error: "overloaded_error: <Overloaded>" } };

Deno.test("aiAlertText: chegaralar va matn", () => {
  assertEquals(aiAlertText({ calls: 4, errors: 4, failed_jobs: 0 }), null); // 5 tadan kam chaqiruv
  assertEquals(aiAlertText({ calls: 10, errors: 1, failed_jobs: 0 }), null); // 10% < 20%
  assertEquals(aiAlertText({ calls: 5, errors: 1, failed_jobs: 0 })?.startsWith("⚠️ <b>AI: nosozlik</b>"), true); // aynan 20%
  assertEquals(aiAlertText({ calls: 0, errors: 0, failed_jobs: 1 })?.includes("3 marta urinib ham bajarilmagan ishlar: 1"), true);
  const t = aiAlertText(BAD)!;
  assertEquals(t.includes("• Oxirgi 60 daqiqa: 12 ta chaqiruv, 5 tasi xato (42%)"), true, t);
  assertEquals(t.includes("(guruh tahlili: 1, hisobotni ajratish: 1)"), true, t);
  assertEquals(t.includes("Oxirgi xato: claude 529: overloaded_error: &lt;Overloaded&gt;"), true, t);
  assertEquals(t.endsWith("CRM → Sozlamalar → Bot → «AI holati»."), true);
});

Deno.test("isQuietHour: 22:00–08:00 Toshkent", () => {
  const at = (hm: string) => Date.parse(`2026-11-05T${hm}:00+05:00`);
  assertEquals([at("21:59"), at("22:00"), at("03:00"), at("07:59"), at("08:00"), at("18:15")].map(isQuietHour),
    [false, true, true, true, false, false]);
});

Deno.test("alertCheck: ownerlarga DM, soatiga 1 ta (claim), tunda yuborilmaydi", async () => {
  const rpcs = (claimed: boolean) => ({
    bot_ai_alert_state: () => ({ data: BAD }),
    bot_ai_alert_claim: () => ({ data: claimed }),
    bot_owner_chats: () => ({ data: [{ user_id: "o1", dm_chat_id: 11 }, { user_id: "o2", dm_chat_id: null }, { user_id: "o3", dm_chat_id: 33 }] }),
  });
  const a = ops(rpcs(true), [ok({})]);
  assertEquals(await a.x.alertCheck(), "sent");
  assertEquals(a.sent.map((m) => m.chat), [11, 33]);
  assertEquals(a.sent[0].text.startsWith("⚠️ <b>AI"), true);

  const b = ops(rpcs(false), [ok({})]);
  assertEquals(await b.x.alertCheck(), "throttled");
  assertEquals(b.sent.length, 0);

  const c = ops(rpcs(true), [ok({})], { now: () => NIGHT });
  assertEquals(await c.x.alertCheck(), "quiet");
  assertEquals(c.s.fns().includes("bot_ai_alert_claim"), false); // tunda belgi ham qo'yilmaydi
  assertEquals(c.sent.length, 0);

  const d = ops({ bot_ai_alert_state: () => ({ data: { calls: 3, errors: 0, failed_jobs: 0 } }) }, [ok({})]);
  assertEquals(await d.x.alertCheck(), "none");
});

Deno.test("brief: bot_ai_stats(24) → qator ma'lumoti; xato bo'lsa null", async () => {
  const a = ops({ bot_ai_stats: (args) => ({ data: { hours: args.p_hours, calls: 27, errors: 3, cost_usd: 0.0042 } }) }, [ok({})]);
  assertEquals(await a.x.brief(24), { calls: 27, errors: 3, cost_usd: 0.0042 });
  assertEquals(a.s.calls[0].args, { p_hours: 24 });
  const b = ops({ bot_ai_stats: () => ({ error: { message: "function bot_ai_stats does not exist" } }) }, [ok({})]);
  assertEquals(await b.x.brief(), null);
});
