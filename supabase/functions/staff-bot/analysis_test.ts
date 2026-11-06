// deno test supabase/functions/staff-bot/analysis_test.ts — guruh tahlili 2.0 (B2-2): kontekst, so'rov,
// natijani tekshirish, bot_analyses/bot_proposals oqimi (stub baza bilan).
import { assertEquals } from "jsr:@std/assert@1";
import {
  ANALYSIS_SCHEMA,
  type AiFinding,
  type AnalysisContext,
  type AnalysisDeps,
  buildPrompt,
  contextFromLegacy,
  historyLine,
  interpretFindings,
  okModel,
  parseContext,
  runGroupAnalysis,
  TASKS_LIMIT,
} from "./analysis.ts";
import { schemaError } from "./ai.ts";

const assert = (cond: unknown, msg?: string) => assertEquals(!!cond, true, msg);

const A = "11111111-1111-4111-8111-111111111111"; // Aziz
const B = "22222222-2222-4222-8222-222222222222"; // Bobur
const T1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = Date.UTC(2026, 10, 6, 6, 0); // 06.11 11:00 Toshkent

const CTX: AnalysisContext = {
  staff: [
    { user_id: A, name: "Aziz Karimov", username: "aziz_k" },
    { user_id: B, name: "Bobur Aliyev", username: null },
  ],
  tasks: [
    { id: T1, title: "Talaba hujjatlarini apostil qilish", assignee: A, due_date: "2026-11-07T13:00:00Z", status: "todo" },
    { id: T2, title: "Universitetga to'lov chekini yuborish", assignee: B, status: "in_progress" },
  ],
};

const f = (o: Partial<AiFinding>): AiFinding => ({
  kind: "none", confidence: 0.9, reason: "sabab", assignee: "", task_ref: 0, title: "", due_text: "", priority: "normal", ...o,
});

// ── kontekst ──────────────────────────────────────────────────────────────

Deno.test("parseContext: noto'g'ri qatorlar tashlanadi, vazifalar 40 tadan oshmaydi", () => {
  const tasks = Array.from({ length: 55 }, (_, i) => ({ id: `t${i}`, title: `V${i}`, assignee: A }));
  const c = parseContext({ staff: [{ user_id: A, name: "Aziz" }, { name: "id yo'q" }], tasks: [...tasks, { title: "id yo'q" }] });
  assertEquals(c.staff, [{ user_id: A, name: "Aziz", username: null }]);
  assertEquals(c.tasks.length, TASKS_LIMIT);
  assertEquals(parseContext(null), { staff: [], tasks: [] });
});

Deno.test("contextFromLegacy: bot_group_context → umumiy ro'yxat", () => {
  const c = contextFromLegacy([
    { user_id: A, name: "Aziz", username: "aziz_k", tasks: [{ id: T1, title: "X" }] },
    { user_id: B, name: "Bobur", username: null, tasks: [{ id: T2, title: "Y" }] },
  ]);
  assertEquals(c.staff.length, 2);
  assertEquals(c.tasks.map((t) => [t.id, t.assignee]), [[T1, A], [T2, B]]);
});

// ── so'rov ────────────────────────────────────────────────────────────────

Deno.test("historyLine: javob, rasm, ovoz, ulanmagan odam", () => {
  const names = new Map([[A, "Aziz"]]);
  assertEquals(historyLine({ message_id: 5, user_id: A, text: null, media: "photo", reply_to_message_id: null }, names), "[#5] Aziz: [rasm]");
  assertEquals(historyLine({ message_id: 6, user_id: A, text: "shu", media: "photo", reply_to_message_id: 5 }, names), "[#6 ↩#5] Aziz: [rasm] shu");
  assertEquals(historyLine({ message_id: 7, user_id: A, text: "🎤 salom", media: "voice", reply_to_message_id: null }, names), "[#7] Aziz: 🎤 salom");
  assertEquals(historyLine({ message_id: 8, user_id: null, text: null, media: "voice", reply_to_message_id: null }, names),
    "[#8] Noma'lum (botga ulanmagan): [ovoz, matnga aylanmagan]");
});

Deno.test("buildPrompt: xodimlar, raqamlangan vazifalar, tarix va javob berilgan xabar", () => {
  const p = buildPrompt(CTX, [{ message_id: 9, user_id: B, text: "salom", media: null, reply_to_message_id: null }],
    { message_id: 12, user_id: A, name: "Aziz Karimov", text: "tugatib qo'y", media: null, reply_to_message_id: 3 },
    { message_id: 3, user_id: null, text: null, media: "photo", reply_to_message_id: null });
  assert(p.includes("- Aziz Karimov (@aziz_k)"));
  assert(p.includes("1. Talaba hujjatlarini apostil qilish — mas'ul: Aziz Karimov, muddat 2026-11-07"));
  assert(p.includes("2. Universitetga to'lov chekini yuborish — mas'ul: Bobur Aliyev, boshlangan"));
  assert(p.includes("[#9] Bobur Aliyev: salom"));
  assert(p.includes("Javob berilgan xabar:\n[#3] Noma'lum (botga ulanmagan): [rasm]"));
  assert(p.endsWith("TAHLIL QILINADIGAN XABAR:\n[#12 ↩#3] Aziz Karimov: tugatib qo'y"));
});

Deno.test("ANALYSIS_SCHEMA: namunaviy javob sxemaga mos", () => {
  assertEquals(schemaError({ findings: [f({})] }, ANALYSIS_SCHEMA), null);
  assert(schemaError({}, ANALYSIS_SCHEMA) !== null);
});

// ── natijani tekshirish ───────────────────────────────────────────────────

Deno.test("interpretFindings: none — kinds [none], taklif yo'q", () => {
  const r = interpretFindings({ findings: [f({ kind: "none", confidence: 0.95 })] }, CTX, NOW);
  assertEquals(r.kinds, ["none"]);
  assertEquals(r.proposals, []);
  assertEquals(r.confidence, 0.95);
  assertEquals(interpretFindings(null, CTX, NOW).kinds, ["none"]);
  assertEquals(interpretFindings({ findings: [] }, CTX, NOW).findings, []);
});

Deno.test("interpretFindings: new_task → create taklifi, muddat xabar vaqtiga nisbatan", () => {
  const r = interpretFindings({ findings: [f({ kind: "new_task", assignee: "Bobur", title: "Mijoz chatini yakunlash", due_text: "ertaga 15:00", priority: "high" })] }, CTX, NOW);
  assertEquals(r.kinds, ["new_task"]);
  assertEquals(r.proposals.length, 1);
  const p = r.proposals[0].proposal;
  assertEquals([p.kind, p.assignee_user_id, p.title, p.priority], ["create", B, "Mijoz chatini yakunlash", "high"]);
  assertEquals(p.due, "2026-11-07T10:00:00.000Z");
  assertEquals(r.findings[0].proposed, true);
});

Deno.test("interpretFindings: new_task taklif qilinmaydi — sababi yoziladi", () => {
  const cases: [Partial<AiFinding>, string][] = [
    [{ assignee: "Noma'lum odam", title: "Biror ish qilish" }, "mas'ul aniqlanmadi"],
    [{ assignee: "@aziz_k", title: "ok" }, "sarlavha yo'q"],
    [{ assignee: "Aziz", title: "Natijani aniqlashtirish", confidence: 0.6 }, "ishonch past"],
    [{ assignee: "Aziz", title: "Talaba hujjatlarini apostil qilish" }, "o'xshash ochiq vazifa bor"],
  ];
  for (const [o, skip] of cases) {
    const r = interpretFindings({ findings: [f({ kind: "new_task", ...o })] }, CTX, NOW);
    assertEquals(r.proposals, [], skip);
    assertEquals(r.findings[0].skip, skip);
    assertEquals(r.kinds, ["new_task"]); // tahlil sifatida baribir saqlanadi
  }
});

Deno.test("interpretFindings: close_task — id ro'yxatdan, mas'ul vazifanikidan", () => {
  const r = interpretFindings({ findings: [f({ kind: "close_task", task_ref: 2, assignee: "Aziz" })] }, CTX, NOW);
  const p = r.proposals[0].proposal;
  assertEquals([p.kind, p.task_id, p.assignee_user_id, p.assignee_name], ["close", T2, B, "Bobur Aliyev"]);
  const bad = interpretFindings({ findings: [f({ kind: "close_task", task_ref: 7 })] }, CTX, NOW);
  assertEquals(bad.proposals, []);
  assertEquals(bad.findings[0].skip, "vazifa ro'yxatda topilmadi");
  assertEquals(bad.findings[0].task_id, null);
});

Deno.test("interpretFindings: question/decision — faqat tahlil, taklif yo'q", () => {
  const r = interpretFindings({ findings: [
    f({ kind: "question", assignee: "Aziz", confidence: 0.8 }),
    f({ kind: "decision", confidence: 0.85 }),
    f({ kind: "none" }),
  ] }, CTX, NOW);
  assertEquals(r.kinds, ["question", "decision"]);
  assertEquals(r.proposals, []);
  assertEquals(r.findings[0].assignee_user_id, A);
});

Deno.test("interpretFindings: update_task — vazifa topilmasa yoki muddat aniqlanmasa taklif yo'q", () => {
  assertEquals(interpretFindings({ findings: [f({ kind: "update_task", task_ref: 0 })] }, CTX, NOW).findings[0].skip, "vazifa ro'yxatda topilmadi");
  const r = interpretFindings({ findings: [f({ kind: "update_task", task_ref: 1, assignee: "Bobur" })] }, CTX, NOW);
  assertEquals(r.proposals, []);
  assertEquals(r.findings[0].skip, "muddat aniqlanmadi");
  assertEquals(r.findings[0].task_id, T1);
  assertEquals(r.findings[0].assignee_user_id, B); // assignee maydoni doim parse qilinadi, taklif turini belgilamaydi
});

Deno.test("interpretFindings: update_task — muddat taklifi, xabar vaqtiga nisbatan", () => {
  const r = interpretFindings({ findings: [f({ kind: "update_task", task_ref: 1, due_text: "ertaga 15:00" })] }, CTX, NOW);
  assertEquals(r.kinds, ["update_task"]);
  assertEquals(r.proposals.length, 1);
  const p = r.proposals[0].proposal;
  assertEquals([p.kind, p.task_id, p.assignee_user_id, p.title], ["update", T1, A, "Talaba hujjatlarini apostil qilish"]);
  assertEquals(p.due, "2026-11-07T10:00:00.000Z");
  assertEquals(r.findings[0].proposed, true);
  const low = interpretFindings({ findings: [f({ kind: "update_task", task_ref: 1, due_text: "ertaga 15:00", confidence: 0.6 })] }, CTX, NOW);
  assertEquals(low.proposals, []);
  assertEquals(low.findings[0].skip, "ishonch past");
});

Deno.test("interpretFindings: bir turdan bitta taklif, noma'lum tur va ishonch chegarasi", () => {
  const r = interpretFindings({ findings: [
    f({ kind: "new_task", assignee: "Aziz", title: "Birinchi ishni qilish", confidence: 0.8 }),
    f({ kind: "new_task", assignee: "Bobur", title: "Ikkinchi ishni qilish", confidence: 0.9 }),
    // deno-lint-ignore no-explicit-any
    f({ kind: "boshqa" as any }),
    f({ kind: "decision", confidence: 7 }),
  ] }, CTX, NOW);
  assertEquals(r.proposals.length, 1);
  assertEquals(r.proposals[0].proposal.assignee_user_id, B);
  assertEquals(r.findings[0].proposed, false);
  assertEquals(r.findings[0].skip, "shu turdagi boshqa taklif ishonchliroq");
  assertEquals(r.findings.length, 3);
  assertEquals(r.findings[2].confidence, 1);
});

Deno.test("okModel: javob bergan urinish modeli", () => {
  const base = { attempt: 1, status: 200, error: null, latency_ms: 1, input_tokens: 1, output_tokens: 1, cost_usd: null };
  assertEquals(okModel([{ ...base, provider: "claude", model: "c", ok: false }, { ...base, provider: "gemini", model: "g", ok: true }]), "g");
  assertEquals(okModel([]), null);
});

// ── oqim (stub baza) ──────────────────────────────────────────────────────

interface Call { table: string; op: string; args: unknown[]; filters: [string, unknown][] }

// deno-lint-ignore no-explicit-any
type Any = any;

/** Supabase so'rov quruvchisining soddalashtirilgan nusxasi: javob `respond(call)` dan. */
function fakeDb(respond: (c: Call) => { data?: unknown; error?: Any; count?: number }, rpc: Record<string, Any>) {
  const calls: Call[] = [];
  const builder = (table: string) => {
    const call: Call = { table, op: "", args: [], filters: [] };
    const done = () => { calls.push(call); return Promise.resolve({ data: null, error: null, ...respond(call) }); };
    const q: Any = {
      select: (...a: unknown[]) => { if (!call.op) { call.op = "select"; call.args = a; } return q; },
      insert: (row: unknown) => { call.op = "insert"; call.args = [row]; return q; },
      update: (row: unknown) => { call.op = "update"; call.args = [row]; return q; },
      eq: (k: string, v: unknown) => { call.filters.push([k, v]); return q; },
      lt: (k: string, v: unknown) => { call.filters.push([`lt:${k}`, v]); return q; },
      gte: (k: string, v: unknown) => { call.filters.push([`gte:${k}`, v]); return q; },
      in: (k: string, v: unknown) => { call.filters.push([`in:${k}`, v]); return q; },
      order: () => q, limit: () => q,
      maybeSingle: done, single: done,
      then: (res: Any, rej: Any) => done().then(res, rej),
    };
    return q;
  };
  return {
    calls,
    db: {
      from: builder,
      rpc: (fn: string) => Promise.resolve(rpc[fn] ?? { data: null, error: { message: `no ${fn}` } }),
    },
  };
}

const MSG = { chat: { id: -100 }, message_id: 50, date: Math.floor(NOW / 1000) };
const AUTHOR = { user_id: A, full_name: "Aziz Karimov" };
const ATT = [{ provider: "claude" as const, model: "claude-haiku-5-5", attempt: 1, ok: true, status: 200, error: null, latency_ms: 5, input_tokens: 1, output_tokens: 1, cost_usd: 0 }];

function deps(over: { mode?: string; findings?: AiFinding[] | null; respond?: (c: Call) => Any; rpc?: Record<string, Any> } = {}) {
  const fake = fakeDb(over.respond ?? (() => ({})), over.rpc ?? { bot_analysis_context: { data: CTX, error: null } });
  const enqueued: unknown[] = [];
  const replies: unknown[] = [];
  const prompts: string[] = [];
  const d: AnalysisDeps = {
    db: fake.db,
    ai: {
      structured: (_p, args) => {
        prompts.push(args.prompt);
        return Promise.resolve(over.findings === null
          ? { data: null, provider: null, attempts: [], error: "503" }
          : { data: { findings: over.findings ?? [f({})] } as Any, provider: "claude", attempts: ATT, error: null });
      },
      enqueue: (...a) => { enqueued.push(a); return Promise.resolve("job"); },
    },
    mode: () => Promise.resolve(over.mode ?? "shadow"),
    reply: (...a) => { replies.push(a); return Promise.resolve({ result: { message_id: 77 } }); },
    now: () => NOW,
  };
  return { d, calls: fake.calls, enqueued, replies, prompts };
}

Deno.test("runGroupAnalysis: off — hech narsa qilinmaydi", async () => {
  const t = deps({ mode: "off" });
  assertEquals(await runGroupAnalysis(t.d, MSG, AUTHOR, "matn"), undefined);
  assertEquals(t.calls, []);
  assertEquals(t.prompts, []);
});

Deno.test("runGroupAnalysis: none ham bot_analyses'ga yoziladi", async () => {
  const t = deps();
  await runGroupAnalysis(t.d, MSG, AUTHOR, "salom hammaga");
  const ins = t.calls.filter((c) => c.op === "insert");
  assertEquals(ins.map((c) => c.table), ["bot_analyses"]);
  const row = ins[0].args[0] as Any;
  assertEquals([row.chat_id, row.message_id, row.user_id, row.provider, row.model, row.mode], [-100, 50, A, "claude", "claude-haiku-5-5", "shadow"]);
  assertEquals(row.kinds, ["none"]);
  assertEquals(row.result.proposals, []);
});

Deno.test("runGroupAnalysis: new_task (shadow) → bot_proposals + bot_analyses, guruhga chiqmaydi", async () => {
  const t = deps({
    findings: [f({ kind: "new_task", assignee: "Bobur", title: "Mijoz chatini yakunlash" })],
    respond: (c) => c.table === "bot_proposals" && c.op === "insert" ? { data: { id: "p1" } } : c.table === "bot_proposals" ? { data: [] } : {},
  });
  await runGroupAnalysis(t.d, MSG, AUTHOR, "Bobur mijoz chatini yakunlab qo'y");
  const prop = t.calls.find((c) => c.table === "bot_proposals" && c.op === "insert")!.args[0] as Any;
  assertEquals([prop.kind, prop.status, prop.mode, prop.assignee_user_id, prop.source_message_id], ["create", "shadow", "shadow", B, 50]);
  const an = t.calls.find((c) => c.table === "bot_analyses")!.args[0] as Any;
  assertEquals(an.kinds, ["new_task"]);
  assertEquals(an.result.proposals, [{ kind: "create", id: "p1" }]);
  assertEquals(t.replies, []);
});

Deno.test("runGroupAnalysis: on → taklif kartasi, card_message_id saqlanadi", async () => {
  const t = deps({
    mode: "on",
    findings: [f({ kind: "close_task", task_ref: 1 })],
    respond: (c) => c.op === "insert" && c.table === "bot_proposals" ? { data: { id: "p2" } } : c.op === "select" && c.table === "bot_proposals" ? { count: 0 } : {},
  });
  await runGroupAnalysis(t.d, MSG, AUTHOR, "apostil tayyor bo'ldi");
  assertEquals(t.replies.length, 1);
  const upd = t.calls.find((c) => c.table === "bot_proposals" && c.op === "update")!;
  assertEquals(upd.args[0], { card_message_id: 77 });
});

Deno.test("runGroupAnalysis: on, lekin ishonch ON_CONFIDENCE'dan past → shadow kabi yoziladi, guruhga chiqmaydi", async () => {
  const t = deps({
    mode: "on",
    findings: [f({ kind: "close_task", task_ref: 1, confidence: 0.78 })],
    respond: (c) => c.op === "insert" && c.table === "bot_proposals" ? { data: { id: "p3" } } : c.op === "select" && c.table === "bot_proposals" ? { count: 0 } : {},
  });
  await runGroupAnalysis(t.d, MSG, AUTHOR, "apostil tayyor bo'ldi");
  assertEquals(t.replies, []);
  const prop = t.calls.find((c) => c.table === "bot_proposals" && c.op === "insert")!.args[0] as Any;
  assertEquals([prop.mode, prop.status], ["on", "shadow"]);
});

Deno.test("runGroupAnalysis: update_task on, yuqori ishonch → taklif kartasi «O'zgartirish» tugmasi bilan", async () => {
  const t = deps({
    mode: "on",
    findings: [f({ kind: "update_task", task_ref: 1, due_text: "ertaga 15:00", confidence: 0.9 })],
    respond: (c) => c.op === "insert" && c.table === "bot_proposals" ? { data: { id: "p4" } } : c.op === "select" && c.table === "bot_proposals" ? { count: 0 } : {},
  });
  await runGroupAnalysis(t.d, MSG, AUTHOR, "muddatni ertaga 15:00 ga suring");
  assertEquals(t.replies.length, 1);
  const extra = (t.replies[0] as Any[])[3] as Any;
  assertEquals(extra.reply_markup.inline_keyboard[0][0].text, "✅ Ha, o'zgartirish");
  const prop = t.calls.find((c) => c.table === "bot_proposals" && c.op === "insert")!.args[0] as Any;
  assertEquals([prop.kind, prop.status], ["update", "pending"]);
});

Deno.test("runGroupAnalysis: dublikat — kutilayotgan yopish taklifi bo'lsa yangisi yo'q, sababi tahlilda", async () => {
  const t = deps({
    findings: [f({ kind: "close_task", task_ref: 1 })],
    respond: (c) => c.table === "bot_proposals" && c.op === "select" ? { count: 1 } : {},
  });
  await runGroupAnalysis(t.d, MSG, AUTHOR, "apostil tayyor bo'ldi");
  assertEquals(t.calls.filter((c) => c.table === "bot_proposals" && c.op === "insert"), []);
  const an = t.calls.find((c) => c.table === "bot_analyses")!.args[0] as Any;
  assertEquals(an.result.findings[0].proposed, false);
  assertEquals(an.result.findings[0].skip, "shu vazifaga yopish taklifi kutilmoqda");
});

Deno.test("runGroupAnalysis: 24 soatdagi o'xshash create taklifi takrorlanmaydi", async () => {
  const t = deps({
    findings: [f({ kind: "new_task", assignee: "Bobur", title: "Mijoz chatini yakunlash" })],
    respond: (c) => c.table === "bot_proposals" && c.op === "select" ? { data: [{ title: "Mijoz chatini yakunlash" }] } : {},
  });
  await runGroupAnalysis(t.d, MSG, AUTHOR, "Bobur chatni yakunla");
  assertEquals(t.calls.filter((c) => c.table === "bot_proposals" && c.op === "insert"), []);
});

Deno.test("runGroupAnalysis: provayder xatosi → navbat (jonli), navbatdan — qayta navbat yo'q", async () => {
  const t = deps({ findings: null });
  assertEquals(await runGroupAnalysis(t.d, MSG, AUTHOR, "matn"), "503");
  assertEquals(t.enqueued.length, 1);
  assertEquals((t.enqueued[0] as unknown[])[1], "ga:-100:50");
  assertEquals(t.calls.filter((c) => c.op === "insert"), []);
  const j = deps({ findings: null });
  assertEquals(await runGroupAnalysis(j.d, MSG, AUTHOR, "matn", "job-1"), "503");
  assertEquals(j.enqueued, []);
});

Deno.test("runGroupAnalysis: bot_analysis_context yo'q bo'lsa eski kontekst, ikkalasi ham xato — xato qaytadi", async () => {
  const t = deps({ rpc: { bot_group_context: { data: [{ user_id: A, name: "Aziz", username: null, tasks: [] }], error: null } } });
  await runGroupAnalysis(t.d, MSG, AUTHOR, "matn");
  assert(t.prompts[0].includes("- Aziz"));
  const bad = deps({ rpc: {} });
  assert((await runGroupAnalysis(bad.d, MSG, AUTHOR, "matn"))?.startsWith("bot_group_context"));
});

Deno.test("runGroupAnalysis: maqsad nomi group_analysis va javob berilgan xabar so'rovda", async () => {
  const purposes: string[] = [];
  const t = deps({
    respond: (c) => c.table === "staff_group_messages" && c.filters.some(([k, v]) => k === "message_id" && v === 50)
      ? { data: { message_id: 50, user_id: A, text: "x", media: "photo", reply_to_message_id: 40 } }
      : c.table === "staff_group_messages" && c.filters.some(([k, v]) => k === "message_id" && v === 40)
      ? { data: { message_id: 40, user_id: B, text: "eski savol", media: null, reply_to_message_id: null } }
      : c.table === "staff_group_messages" ? { data: [] } : {},
  });
  const orig = t.d.ai.structured;
  t.d.ai.structured = (p, a, j) => { purposes.push(p); return orig(p, a, j); };
  await runGroupAnalysis(t.d, MSG, AUTHOR, "shu rasm izohi");
  assertEquals(purposes, ["group_analysis"]);
  assert(t.prompts[0].includes("Javob berilgan xabar:\n[#40] Bobur Aliyev: eski savol"));
  assert(t.prompts[0].endsWith("[#50 ↩#40] Aziz Karimov: [rasm] shu rasm izohi"));
});
