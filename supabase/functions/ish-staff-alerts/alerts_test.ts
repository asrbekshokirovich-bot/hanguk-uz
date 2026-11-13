// ish-staff-alerts: the messages the staff get, and how the outbox is worked
// (no network, no database).
// deno-lint-ignore-file no-explicit-any require-await
import { assertEquals } from "jsr:@std/assert@1";
import { type Alert, alertText, html, type Outbox, outboxStore, runAlerts, seoulTime } from "./alerts.ts";

const opened = (data: Record<string, unknown>, id = 1): Alert => ({ id, kind: "business_opened", attempts: 1, data });
const report = (data: Record<string, unknown>, id = 2): Alert => ({ id, kind: "report", attempts: 1, data });

Deno.test("a business the app opened: its name, kind, and where to act on it", () => {
  assertEquals(
    alertText(opened({ name: "사업장 7F3A", category: "other", status: "verified" })),
    [
      "🆕 <b>Hanguk Ish</b> — sajangnim ilovasida yangi biznes",
      "<b>사업장 7F3A</b> · Boshqa",
      "Haqiqiy nomi va manzilini qo'ying, shubhali bo'lsa to'xtating: CRM → Hanguk Ish → «Ilovadagi bizneslar».",
      "https://hanguk.uz/crm/ish?tab=appBusinesses",
    ].join("\n"),
  );
  // Registered with a number that 국세청 has not answered for yet (BA1).
  assertEquals(
    alertText(
      opened({ name: "달빛카페 신촌점", name_uz: "Dalbit Kafe · Sinchon", category: "cafe", status: "pending" }),
    )
      ?.split("\n")[1],
    "<b>달빛카페 신촌점 (Dalbit Kafe · Sinchon)</b> · Kafe · Tekshiruvda",
  );
});

Deno.test("a complaint: subject, worker, business, shift, the text", () => {
  assertEquals(
    alertText(report({
      reason: "payment",
      body: "Ish haqi hali to'lanmadi",
      worker: { first_name: "Aziz", last_name: "Karimov" },
      business: { name: "달빛카페 신촌점", name_uz: "Dalbit Kafe · Sinchon" },
      shift: { title: "홀·카운터 보조", starts_at: "2026-11-14T05:00:00Z" },
    })),
    [
      "⚠️ <b>Hanguk Ish</b> — yangi shikoyat: <b>Maosh</b>",
      "Ishchi: Aziz Karimov",
      "Biznes: 달빛카페 신촌점 (Dalbit Kafe · Sinchon)",
      "Smena: 홀·카운터 보조 · 14-noyabr, 14:00",
      "«Ish haqi hali to'lanmadi»",
      "CRM → Hanguk Ish → «Shikoyatlar»:",
      "https://hanguk.uz/crm/ish?tab=reports",
    ].join("\n"),
  );
});

Deno.test("a complaint with little in it: no name, no business, no shift, no text", () => {
  assertEquals(
    alertText(report({ reason: "other", body: "", worker: null, business: null, shift: null })),
    [
      "⚠️ <b>Hanguk Ish</b> — yangi shikoyat: <b>Boshqa</b>",
      "Ishchi: Ismi kiritilmagan",
      "CRM → Hanguk Ish → «Shikoyatlar»:",
      "https://hanguk.uz/crm/ish?tab=reports",
    ].join("\n"),
  );
});

Deno.test("what people typed cannot break the message (HTML), and a long text is cut", () => {
  const text = alertText(report({
    reason: "safety",
    body: "<b>xavfli</b> & " + "x".repeat(700),
    worker: { first_name: "<i>Ali</i>", last_name: "" },
  }))!;
  assertEquals(text.includes("Ishchi: &lt;i&gt;Ali&lt;/i&gt;"), true);
  assertEquals(text.includes("«&lt;b&gt;xavfli&lt;/b&gt; &amp; x"), true);
  assertEquals(text.includes("x".repeat(600)), false);
  assertEquals(text.includes("…»"), true);
  assertEquals(html("a<b>&c"), "a&lt;b&gt;&amp;c");
});

Deno.test("nothing to say: a business without a name, an unknown kind", () => {
  assertEquals(alertText(opened({ name: "" })), null);
  assertEquals(alertText({ id: 1, kind: "other" as any, attempts: 1, data: {} }), null);
});

Deno.test("Seoul's clock, in Uzbek", () => {
  assertEquals(seoulTime("2026-11-14T05:00:00Z"), "14-noyabr, 14:00");
  assertEquals(seoulTime("2026-12-31T15:30:00Z"), "1-yanvar, 00:30");
  assertEquals(seoulTime("not a date"), "");
});

class FakeOutbox implements Outbox {
  claims = 0;
  doneIds: number[] = [];
  failures: [number, string][] = [];
  constructor(private queue: Alert[][]) {}
  async claim(_limit: number) {
    this.claims++;
    return this.queue.shift() ?? [];
  }
  async done(alert: Alert) {
    this.doneIds.push(alert.id);
  }
  async fail(alert: Alert, error: string) {
    this.failures.push([alert.id, error]);
  }
}

Deno.test("a run sends what is due, marks it, and asks again until nothing is due", async () => {
  const outbox = new FakeOutbox([[opened({ name: "A" }, 1), report({ reason: "payment" }, 2)], [
    opened({ name: "B" }, 3),
  ]]);
  const sent: string[] = [];
  const stats = await runAlerts(outbox, async (t) => {
    sent.push(t);
    return { ok: true };
  });
  assertEquals(stats, { sent: 3, failed: 0 });
  assertEquals(outbox.doneIds, [1, 2, 3]);
  assertEquals(outbox.claims, 3);
  assertEquals(sent.length, 3);
});

Deno.test("a message that does not go: why is kept, and the run stops (the rest wait for their try)", async () => {
  const outbox = new FakeOutbox([[opened({ name: "A" }, 1), opened({ name: "B" }, 2)], [opened({ name: "C" }, 3)]]);
  let calls = 0;
  const stats = await runAlerts(outbox, async () => {
    calls++;
    return { ok: false, description: "Telegram 400 Bad Request: chat not found" };
  });
  assertEquals(calls, 1);
  assertEquals(stats, { sent: 0, failed: 1 });
  assertEquals(outbox.failures, [[1, "Telegram 400 Bad Request: chat not found"]]);
  assertEquals(outbox.claims, 1);
});

Deno.test("a sender that throws is a failure like any other", async () => {
  const outbox = new FakeOutbox([[opened({ name: "A" }, 1)]]);
  const stats = await runAlerts(outbox, () => Promise.reject(new Error("network down")));
  assertEquals(stats.failed, 1);
  assertEquals(outbox.failures, [[1, "network down"]]);
});

Deno.test("nothing to say: closed without a message", async () => {
  const outbox = new FakeOutbox([[opened({ name: "" }, 7)]]);
  const stats = await runAlerts(outbox, () => Promise.reject(new Error("must not send")));
  assertEquals(stats, { sent: 0, failed: 0 });
  assertEquals(outbox.doneIds, [7]);
});

Deno.test("the outbox calls the database's functions with their parameter names", async () => {
  const calls: [string, any][] = [];
  const store = outboxStore({
    rpc: (fn, params) => {
      calls.push([fn, params]);
      if (fn === "staff_alerts_claim") {
        return Promise.resolve({
          data: [{ id: "5", kind: "report", attempts: 1, data: { reason: "other" } }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  });
  const [alert] = await store.claim(10);
  assertEquals(alert, { id: 5, kind: "report", attempts: 1, data: { reason: "other" } });
  await store.done(alert);
  await store.fail(alert, "why");
  assertEquals(calls, [
    ["staff_alerts_claim", { p_limit: 10 }],
    ["staff_alerts_done", { p_id: 5 }],
    ["staff_alerts_fail", { p_id: 5, p_error: "why" }],
  ]);
});
