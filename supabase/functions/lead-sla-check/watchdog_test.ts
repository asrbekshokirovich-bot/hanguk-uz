import { assertEquals } from "jsr:@std/assert@1";
import { type CommentDigest, composeComments, composeReport, runWatchdogs } from "./watchdog.ts";

const report = { report_day: "2026-11-11", new_leads: 18, answered: 15, unanswered: 3 };

Deno.test("the report without comments is the three counts, as before", () => {
  const plain = [
    "📊 Kechagi lidlar (11-noyabr)",
    "",
    "Yangi lidlar: 18",
    "Xodim javob bergan: 15",
    "Javobsiz: 3",
  ].join("\n");
  assertEquals(composeReport(report), plain);
  assertEquals(composeReport(report, null), plain);
  assertEquals(composeReport(report, { total: 0, unanswered: 0, items: [] }), plain);
});

Deno.test("yesterday's comments: the count, the ones waiting, where they were left", () => {
  const c: CommentDigest = {
    total: 6,
    unanswered: 2,
    items: [
      { username: "ali", text: "To'lov oldindanmi til kursi uchun", media: "AD" },
      { username: "vali", text: "+", media: "REELS" },
    ],
  };
  assertEquals(composeReport(report, c).split("\n").slice(5), [
    "",
    "💬 Instagram izohlari: 6 ta, javob kutayotgani: 2 ta",
    "• @ali (reklama): «To'lov oldindanmi til kursi uchun»",
    "• @vali (reels): «+»",
    "Javob Instagram ilovasidan yoziladi — CRM'da izohlar bo'limi yo'q.",
  ]);
});

Deno.test("more waiting than shown, an unknown author or place, a cut text", () => {
  const long = "a".repeat(160);
  assertEquals(
    composeComments({
      total: 9,
      unanswered: 7,
      items: [
        { username: null, text: long, media: "IGTV" },
        { username: "x", text: null, media: null },
      ],
    }),
    [
      "",
      "💬 Instagram izohlari: 9 ta, javob kutayotgani: 7 ta",
      `• (noma'lum): «${long}…»`,
      "• @x: «»",
      "…va yana 5 ta",
      "Javob Instagram ilovasidan yoziladi — CRM'da izohlar bo'limi yo'q.",
    ],
  );
});

Deno.test("all answered: the count alone, nothing to do", () => {
  assertEquals(composeComments({ total: 3, unanswered: 0, items: [] }), [
    "",
    "💬 Instagram izohlari: 3 ta, javob kutayotgani: 0 ta",
  ]);
});

/** A stand-in for the service client: the rpc results by name, and the watchdog recipients. */
function fakeSupabase(rpc: Record<string, { data?: unknown; error?: { message: string } }>, calls: string[] = []) {
  return {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push(`${name}:${JSON.stringify(args)}`);
      return Promise.resolve({ data: null, error: null, ...(rpc[name] ?? {}) });
    },
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => Promise.resolve({ data: [{ chat_id: "100" }], error: null }) }),
      }),
    }),
  };
}

Deno.test("the morning report carries that day's comments", async () => {
  const calls: string[] = [];
  const sent: string[] = [];
  const out = await runWatchdogs(
    fakeSupabase({
      fn_lead_quick_contact_scan: { data: [] },
      fn_lead_daily_report_claim: { data: [report] },
      fn_instagram_comments_daily: { data: [{ total: 1, unanswered: 1, items: [{ username: "ali", text: "Narxi qancha", media: "AD" }] }] },
    }, calls),
    false,
    (chat, text) => {
      sent.push(`${chat}|${text}`);
      return Promise.resolve(true);
    },
  );
  assertEquals(out, { quick_exits: 0, report_sent: true });
  assertEquals(calls.includes('fn_instagram_comments_daily:{"p_day":"2026-11-11"}'), true);
  assertEquals(sent.length, 1);
  assertEquals(sent[0].startsWith("100|📊 Kechagi lidlar (11-noyabr)"), true);
  assertEquals(sent[0].includes("• @ali (reklama): «Narxi qancha»"), true);
});

Deno.test("comments failing to load do not hold the lead report back", async () => {
  const sent: string[] = [];
  const out = await runWatchdogs(
    fakeSupabase({
      fn_lead_quick_contact_scan: { data: [] },
      fn_lead_daily_report_claim: { data: [report] },
      fn_instagram_comments_daily: { error: { message: "boom" } },
    }),
    false,
    (_chat, text) => {
      sent.push(text);
      return Promise.resolve(true);
    },
  );
  assertEquals(out.report_sent, true);
  assertEquals(sent, [composeReport(report)]);
});

Deno.test("no report due: comments are not even asked for", async () => {
  const calls: string[] = [];
  const out = await runWatchdogs(
    fakeSupabase({ fn_lead_quick_contact_scan: { data: [] }, fn_lead_daily_report_claim: { data: [] } }, calls),
    false,
    () => Promise.resolve(true),
  );
  assertEquals(out, { quick_exits: 0, report_sent: false });
  assertEquals(calls.some((c) => c.startsWith("fn_instagram_comments_daily")), false);
});

Deno.test("dry run shows the text that would go out", async () => {
  const out = await runWatchdogs(
    fakeSupabase({
      fn_lead_quick_contact_scan: { data: [] },
      fn_lead_daily_report_claim: { data: [report] },
      fn_instagram_comments_daily: { data: [{ total: 2, unanswered: 0, items: [] }] },
    }),
    true,
    () => Promise.reject(new Error("nothing is sent on a dry run")),
  );
  assertEquals(out.report_sent, false);
  assertEquals((out.dry as { texts: string[] }).texts, [composeReport(report, { total: 2, unanswered: 0, items: [] })]);
});
