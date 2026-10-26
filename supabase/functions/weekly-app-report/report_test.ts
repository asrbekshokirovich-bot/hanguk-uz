// deno test supabase/functions/weekly-app-report/report_test.ts
import { assertEquals } from "jsr:@std/assert@1";

import {
  aiFacts,
  allowedNumbers,
  biggestStop,
  cleanComment,
  composeReport,
  lastWeek,
  topChannel,
  weekLabel,
  type Marketing,
} from "./report.ts";

function m(over: Partial<Marketing> = {}): Marketing {
  return {
    from: "2026-10-19",
    to: "2026-10-25",
    kpi: {
      new_devices: 63, new_active: 49, requests: 2, requests_form: 1, requests_telegram: 1,
      new_leads: 120, contracts: 3, app_contracts: 1,
    },
    channels: [
      { key: "instagram", new_devices: 10, active: 8, requests: 2, contracts: 1 },
      { key: "telegram", new_devices: 4, active: 3, requests: 2, contracts: 0 },
      { key: "unknown", new_devices: 49, active: 38, requests: 0, contracts: 0 },
    ],
    stops: {
      language_exits: 8,
      client_code_seen: 28,
      client_code_left: 18,
      locked_tabs: [{ tab: "prepare", devices: 9 }],
      lead_form: { opened: 4, field_error: 1, submitted: 2 },
    },
    ...over,
  };
}
const names = { instagram: "Instagram", telegram: "Telegram" };

Deno.test("the last whole week, Monday to Sunday, in Tashkent", () => {
  // Monday 09:30 Tashkent = 04:30 UTC
  assertEquals(lastWeek(new Date("2026-10-26T04:30:00Z")), {
    from: "2026-10-19", to: "2026-10-25", prevFrom: "2026-10-12", prevTo: "2026-10-18",
  });
  // Sunday 23:30 Tashkent is still that week's Sunday
  assertEquals(lastWeek(new Date("2026-10-25T18:30:00Z")).from, "2026-10-12");
  // Monday 00:10 Tashkent is already Monday (Sunday 19:10 UTC)
  assertEquals(lastWeek(new Date("2026-10-25T19:10:00Z")).from, "2026-10-19");
});

Deno.test("week label", () => {
  assertEquals(weekLabel("2026-10-19", "2026-10-25"), "19–25-oktabr");
  assertEquals(weekLabel("2026-09-28", "2026-10-04"), "28-sentabr – 4-oktabr");
});

Deno.test("top channel: most requests, then contracts; none when nobody asked", () => {
  assertEquals(topChannel(m())?.key, "instagram");
  const none = m({ channels: m().channels.map((c) => ({ ...c, requests: 0 })) });
  assertEquals(topChannel(none), null);
});

Deno.test("biggest stop among the plan's four", () => {
  assertEquals(biggestStop(m()), { kind: "client_code", n: 18, seen: 28 });
  const form = m({ stops: { ...m().stops, client_code_left: 0, lead_form: { opened: 30, field_error: 3, submitted: 5 } } });
  assertEquals(biggestStop(form), { kind: "form", n: 25, opened: 30, sent: 5 });
  const zero = m({
    stops: { language_exits: 0, client_code_seen: 0, client_code_left: 0, locked_tabs: [], lead_form: { opened: 0, field_error: 0, submitted: 0 } },
  });
  assertEquals(biggestStop(zero), null);
});

Deno.test("the message: five lines, the comment, the link", () => {
  const prev = m({ kpi: { ...m().kpi, new_devices: 41, requests: 0, app_contracts: 0 } });
  const text = composeReport({
    week: lastWeek(new Date("2026-10-26T04:30:00Z")),
    cur: m(),
    prev,
    names,
    comment: ["Bu hafta 2 murojaat keldi.", "Mijoz kodi ekranida 18 qurilma chiqib ketdi.", "Instagram postlarida kodni tushuntiring."],
    link: "https://hanguk.uz/crm/app-analytics",
  });
  assertEquals(text.split("\n"), [
    "📱 Ilova · haftalik hisobot",
    "19–25-oktabr · test qurilmalarsiz",
    "",
    "1. Yangi faol qurilma: 63 (oldingi hafta: 41)",
    "2. Ilovadan murojaat: 2 — forma 1 · kodli Telegram 1 · ulushi 2% (oldingi hafta: 0)",
    "3. Ilova ishtirokidagi shartnoma: 1 (jami shartnoma: 3; oldingi hafta: 0)",
    "4. Eng ko'p murojaat bergan kanal: Instagram — 2",
    "5. Eng katta to'xtash joyi: mijoz kodi ekrani — 18 qurilma kodsiz chiqdi (28 tadan)",
    "",
    "🤖 AI izohi:",
    "— Bu hafta 2 murojaat keldi.",
    "— Mijoz kodi ekranida 18 qurilma chiqib ketdi.",
    "— Instagram postlarida kodni tushuntiring.",
    "",
    "Batafsil — CRM → Ilova analitikasi → Marketing:",
    "https://hanguk.uz/crm/app-analytics",
  ]);
});

Deno.test("no requests, no leads: no share, a dash for the channel; no comment block", () => {
  const quiet = m({
    kpi: { new_devices: 5, new_active: 2, requests: 0, requests_form: 0, requests_telegram: 0, new_leads: 0, contracts: 0, app_contracts: 0 },
    channels: [{ key: "unknown", new_devices: 5, active: 2, requests: 0, contracts: 0 }],
  });
  const text = composeReport({ week: lastWeek(new Date("2026-10-26T04:30:00Z")), cur: quiet, prev: quiet, names, comment: null, link: "x" });
  assertEquals(text.includes("ulushi"), false);
  assertEquals(text.includes("4. Eng ko'p murojaat bergan kanal: — (murojaat bo'lmadi)"), true);
  assertEquals(text.includes("AI izohi"), false);
});

Deno.test("the comment may only repeat numbers it was given", () => {
  const facts = aiFacts(lastWeek(new Date("2026-10-26T04:30:00Z")), m(), m({ kpi: { ...m().kpi, new_devices: 41 } }), names);
  const ok = allowedNumbers(facts);
  assertEquals(cleanComment(["1. Yangi qurilmalar 63 ta, oldingi hafta 41 edi.", "— Mijoz kodi ekranida 18 qurilma to'xtadi.", "Kodni tushuntiring."], ok), [
    "Yangi qurilmalar 63 ta, oldingi hafta 41 edi.",
    "Mijoz kodi ekranida 18 qurilma to'xtadi.",
    "Kodni tushuntiring.",
  ]);
  // 22 is a difference it worked out itself — the comment is dropped
  assertEquals(cleanComment(["Yangi qurilmalar 22 taga ko'paydi.", "a", "b"], ok), null);
  assertEquals(cleanComment("not a list", ok), null);
  // a leading number is a number, not a list mark
  assertEquals(cleanComment(["63 ta yangi qurilma."], ok), ["63 ta yangi qurilma."]);
});
