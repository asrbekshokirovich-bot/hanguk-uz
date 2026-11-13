// ish-push: what a push says (as A12 / 알림 would), and how the queue is
// worked (no network, no database: a fake store and FCM).
// deno-lint-ignore-file no-explicit-any require-await
import { assertEquals } from "jsr:@std/assert@1";
import {
  businessName,
  countdown,
  fcmMessage,
  icu,
  pluralCategory,
  type PushJob,
  type PushStore,
  pushStore,
  pushText,
  runPush,
  tokenGone,
  ttlSeconds,
} from "./push.ts";

const dalbit = {
  id: "b1",
  name: "달빛카페 신촌점",
  name_i18n: { uz: "Dalbit Kafe", en: "Dalbit Cafe" },
  area: "신촌",
  translations: { uz: { area: "Sinchon" }, ru: { area: "Синчхон" }, en: { area: "Sinchon" } },
};
const card = (kind: string, data: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  id: 1,
  kind,
  data,
  business: dalbit,
  shift: { id: "s1", title: "홀 서빙", starts_at: "2026-11-14T05:00:00Z", ends_at: "2026-11-14T10:00:00Z" },
  ...extra,
});

Deno.test("ICU as gen-l10n writes it: placeholders, and plurals by each language's rules", () => {
  assertEquals(icu("{worker} «{shift}» smenasiga ariza berdi", { worker: "Aziz", shift: "홀 서빙" }, "uz"),
               "Aziz «홀 서빙» smenasiga ariza berdi");
  const ru = "{n, plural, one{Рядом с {area} {n} новая смена} few{Рядом с {area} {n} новые смены} other{Рядом с {area} {n} новых смен}}";
  assertEquals(icu(ru, { n: 1, area: "Мапхо-гу" }, "ru"), "Рядом с Мапхо-гу 1 новая смена");
  assertEquals(icu(ru, { n: 3, area: "Мапхо-гу" }, "ru"), "Рядом с Мапхо-гу 3 новые смены");
  assertEquals(icu(ru, { n: 5, area: "Мапхо-гу" }, "ru"), "Рядом с Мапхо-гу 5 новых смен", "many → other");
  assertEquals(icu(ru, { n: 11, area: "X" }, "ru"), "Рядом с X 11 новых смен");
  assertEquals(icu(ru, { n: 21, area: "X" }, "ru"), "Рядом с X 21 новая смена");
  const en = "{n, plural, one{{n} new shift near {area}} other{{n} new shifts near {area}}}";
  assertEquals(icu(en, { n: 1, area: "Mapo-gu" }, "en"), "1 new shift near Mapo-gu");
  assertEquals(icu(en, { n: 2, area: "Mapo-gu" }, "en"), "2 new shifts near Mapo-gu");
  assertEquals(icu("{n, plural, =0{none} other{{n}}}", { n: 0 }, "en"), "none", "an exact case first");
  assertEquals(icu("{unknown} stays", {}, "uz"), "{unknown} stays");
  assertEquals([1, 2, 5, 12, 22].map((n) => pluralCategory(n, "ru")), ["one", "few", "many", "many", "few"]);
  assertEquals(pluralCategory(1, "ko"), "other");
});

Deno.test("countdown as HiDates writes it", () => {
  assertEquals(countdown(29 * 60, "uz"), "1 kun 5 soat");
  assertEquals(countdown(160, "uz"), "2 soat 40 daq");
  assertEquals(countdown(4, "uz"), "4 daq");
  assertEquals(countdown(120, "ru"), "2 ч");
  assertEquals(countdown(24 * 60, "en"), "1 d");
  assertEquals(countdown(150, "ko"), "2시간 30분");
});

Deno.test("the business as A12 names it: the workers' name and area in the language, else the Korean", () => {
  assertEquals(businessName(dalbit, "uz"), "Dalbit Kafe · Sinchon");
  assertEquals(businessName(dalbit, "ru"), "Dalbit Cafe · Синчхон", "no Russian name: the English one");
  assertEquals(businessName(dalbit, "ko"), "달빛카페 신촌점 · 신촌");
  assertEquals(businessName({ name: "사업장 7F3A", name_i18n: {}, area: "" }, "uz"), "사업장 7F3A");
  assertEquals(businessName(null, "uz"), "");
});

Deno.test("the worker's pushes: the A12 title, the business under it", () => {
  assertEquals(pushText(card("application_confirmed"), "uz"), { title: "Smena tasdiqlandi", body: "Dalbit Kafe · Sinchon" });
  assertEquals(pushText(card("application_confirmed"), "ko"), { title: "근무가 확정됐어요", body: "달빛카페 신촌점 · 신촌" });
  assertEquals(pushText(card("shift_reminder", { minutes_before: 120 }), "uz")?.title, "Smenangizga 2 soat qoldi");
  assertEquals(pushText(card("shift_reminder", { minutes_before: 30 }), "en")?.title, "Your shift starts in 30 min");
  assertEquals(pushText(card("application_rejected", { reason: "shift_cancelled" }), "en")?.title, "Shift cancelled");
  assertEquals(pushText(card("application_rejected", { reason: "time_changed" }), "en")?.title, "Shift time changed");
  assertEquals(pushText(card("application_rejected", { reason: "expired" }), "en")?.title, "Request declined");
  assertEquals(pushText(card("application_rejected"), "en")?.title, "Request declined");
  assertEquals(pushText(card("payment_marked", { paid: true }), "en")?.title, "Pay received");
  assertEquals(pushText(card("payment_marked", { paid: false }), "en"), null, "not news (A12 does not show it)");
  assertEquals(pushText(card("chat_message", { business_id: "b1" }), "en"), { title: "New message", body: "Dalbit Cafe · Sinchon" });
  assertEquals(pushText(card("new_shift_match"), "en")?.title, "A new shift for you");
  assertEquals(pushText(card("request_again"), "en")?.title, "A new shift for you");
  assertEquals(pushText(card("job_offer"), "en")?.title, "You've been offered a job");
  assertEquals(pushText(card("something_new"), "en"), null);
});

Deno.test("the evening digest: how many near the worker's district (A02), by plural rules", () => {
  const digest = (data: Record<string, unknown>) => card("nearby_digest", data, { business: null, shift: null });
  assertEquals(pushText(digest({ count: 3, area_code: "mapo" }), "ru"), { title: "Рядом с Мапхо-гу, Сеул 3 новые смены", body: "" });
  assertEquals(pushText(digest({ count: 1, area_code: "mapo" }), "en")?.title, "1 new shift near Mapo-gu, Seoul");
  assertEquals(pushText(digest({ count: 4, area_code: "mapo" }), "uz")?.title, "Mapo-gu, Seul yaqinida 4 ta yangi smena");
  assertEquals(pushText(digest({ count: 2, area_code: "mapo" }), "ko")?.title, "서울 마포구 근처 새 근무 2개");
  assertEquals(pushText(digest({ count: 2, area_code: "Ansan" }), "en")?.title, "2 new shifts near Ansan", "a district typed");
  assertEquals(pushText(digest({ count: 2, area: "합정", area_i18n: { en: "Hapjeong" } }), "en")?.title, "2 new shifts near Hapjeong");
});

Deno.test("the 사장님's pushes: the 알림 title and line", () => {
  const owner = (kind: string, data: Record<string, unknown> = {}) =>
    card(kind, { worker_id: "w1", ...data }, { worker: { first_name: "Aziz", last_name: "Karimov" } });
  assertEquals(pushText(owner("new_applicant"), "ko"), { title: "새 지원자", body: "Aziz Karimov님이 홀 서빙에 지원했어요" });
  assertEquals(pushText(owner("new_applicant"), "ru")?.body, "Aziz Karimov: заявка на «홀 서빙»");
  assertEquals(pushText(owner("new_applicant", { auto_confirmed: true }), "ru")?.title, "Автоподтверждение");
  assertEquals(pushText(owner("worker_cancelled"), "ru")?.body, "Aziz Karimov отменил(а) смену «홀 서빙»");
  assertEquals(pushText(owner("no_show"), "ru")?.title, "Не пришёл");
  assertEquals(pushText(owner("chat_message"), "ru")?.title, "Новое сообщение");
  assertEquals(pushText(owner("new_applicant"), "xx")?.title, pushText(owner("new_applicant"), "uz")?.title, "unknown language: Uzbek");
});

class FakeStore implements PushStore {
  claims = 0;
  doneIds: number[] = [];
  failures: [number, string][] = [];
  dropped: string[] = [];
  constructor(private queue: PushJob[][]) {}
  async claim(_limit: number) {
    this.claims++;
    return this.queue.shift() ?? [];
  }
  async done(job: PushJob) {
    this.doneIds.push(job.id);
  }
  async fail(job: PushJob, error: string) {
    this.failures.push([job.id, error]);
  }
  async dropToken(token: string) {
    this.dropped.push(token);
  }
}

const job = (id: number, tokens: string[], c = card("application_confirmed"), lang = "uz"): PushJob => ({
  id,
  attempts: 1,
  app: "worker",
  lang,
  tokens,
  card: c,
});

Deno.test("a run sends each push to each of the person's phones, with where to open it", async () => {
  const store = new FakeStore([[job(1, ["t1", "t2"])], [job(2, ["t3"], card("payment_marked", { paid: false }))]]);
  const sent: [string, string, Record<string, string>, number][] = [];
  const stats = await runPush(store, async (token, text, data, ttl) => {
    sent.push([token, text.title, data, ttl]);
    return { ok: true, gone: false };
  });
  assertEquals(stats, { sent: 1, failed: 0, dropped: 0, silent: 1 });
  assertEquals(sent.map((s) => s[0]), ["t1", "t2"]);
  assertEquals(sent[0][2], { kind: "application_confirmed", notification_id: "1", app: "worker" });
  assertEquals(sent[0][3], 86_400);
  assertEquals(store.doneIds, [1, 2], "the silent one leaves the queue too");
  assertEquals(store.claims, 3);
});

Deno.test("a phone FCM no longer knows is dropped; a refusal waits for its next try", async () => {
  const store = new FakeStore([[job(1, ["gone", "ok"]), job(2, ["down"]), job(3, ["gone2"])]]);
  const stats = await runPush(store, async (token) => {
    if (token.startsWith("gone")) return { ok: false, gone: true, error: "UNREGISTERED" };
    if (token === "down") return { ok: false, gone: false, error: "FCM 503" };
    return { ok: true, gone: false };
  });
  assertEquals(store.dropped.sort(), ["gone", "gone2"]);
  assertEquals(store.doneIds.sort(), [1, 3], "sent to the other phone; nothing left to send to");
  assertEquals(store.failures, [[2, "FCM 503"]]);
  assertEquals(stats, { sent: 1, failed: 1, dropped: 2, silent: 0 });
});

Deno.test("a batch goes out together; a run stops taking when its time is up", async () => {
  let clock = 0;
  let open = 0;
  let most = 0;
  const store = new FakeStore([
    [job(1, ["a"]), job(2, ["b"]), job(3, ["c"])],
    [job(4, ["d"])],
  ]);
  const stats = await runPush(store, async () => {
    open++;
    most = Math.max(most, open);
    await new Promise((r) => setTimeout(r, 5));
    open--;
    clock += 30_000;
    return { ok: true, gone: false };
  }, { now: () => clock, budgetMs: 40_000 });
  assertEquals(most, 3, "the three of the first batch at once");
  assertEquals(stats.sent, 3);
  assertEquals(store.claims, 1, "90 s of a 40 s budget gone: the rest is the next run's");
});

Deno.test("how long FCM keeps a push: a reminder until the shift starts, the rest a day", () => {
  assertEquals(ttlSeconds(card("shift_reminder", { minutes_before: 120 })), 7200);
  assertEquals(ttlSeconds(card("shift_reminder", { minutes_before: 0 })), 60);
  assertEquals(ttlSeconds(card("shift_reminder", { minutes_before: 4320 })), 86_400);
  assertEquals(ttlSeconds(card("shift_reminder")), 86_400);
  assertEquals(ttlSeconds(card("application_confirmed")), 86_400);
});

Deno.test("the FCM message: the title and line, where to open it, kept for [ttl]", () => {
  const m = fcmMessage("tok", { title: "Smena tasdiqlandi", body: "Dalbit Kafe · Sinchon" }, { kind: "x" }, 7200);
  assertEquals(m.token, "tok");
  assertEquals(m.notification, { title: "Smena tasdiqlandi", body: "Dalbit Kafe · Sinchon" });
  assertEquals(m.data, { kind: "x" });
  assertEquals(m.android, { priority: "high", ttl: "7200s", notification: { sound: "default" } });
  assertEquals(Number(m.apns.headers["apns-expiration"]) - Math.floor(Date.now() / 1000) <= 7200, true);
  assertEquals(fcmMessage("t", { title: "T", body: "" }, {}, 60).notification, { title: "T" }, "no empty line");
});

Deno.test("which refusals mean the phone is gone", () => {
  assertEquals(tokenGone(404, '{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}'), true);
  assertEquals(tokenGone(400, '{"error":{"message":"The registration token is not a valid FCM registration token"}}'), true);
  assertEquals(tokenGone(403, '{"error":{"details":[{"errorCode":"SENDER_ID_MISMATCH"}]}}'), false, "our key, not the phone");
  assertEquals(tokenGone(400, '{"error":{"message":"Invalid value at \'message.android.ttl\'"}}'), false, "our mistake");
  assertEquals(tokenGone(401, "THIRD_PARTY_AUTH_ERROR"), false);
  assertEquals(tokenGone(429, "QUOTA_EXCEEDED"), false);
  assertEquals(tokenGone(503, "UNAVAILABLE"), false);
});

Deno.test("a sender that throws is a refusal like any other", async () => {
  const store = new FakeStore([[job(1, ["t1"])]]);
  const stats = await runPush(store, () => Promise.reject(new Error("network down")));
  assertEquals(stats.failed, 1);
  assertEquals(store.failures, [[1, "network down"]]);
});

Deno.test("the store calls the database's functions with their parameter names", async () => {
  const calls: [string, any][] = [];
  const store = pushStore({
    rpc: (fn, params) => {
      calls.push([fn, params]);
      if (fn === "push_claim") {
        return Promise.resolve({
          data: [{ id: "7", attempts: 1, app: "employer", lang: "ko", tokens: ["t", 5], card: { kind: "no_show" } }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  });
  const [j] = await store.claim(20);
  assertEquals(j, { id: 7, attempts: 1, app: "employer", lang: "ko", tokens: ["t"], card: { kind: "no_show" } });
  await store.done(j);
  await store.fail(j, "why");
  await store.dropToken("t");
  assertEquals(calls, [
    ["push_claim", { p_limit: 20 }],
    ["push_done", { p_id: 7 }],
    ["push_fail", { p_id: 7, p_error: "why" }],
    ["push_drop_token", { p_token: "t" }],
  ]);
});
