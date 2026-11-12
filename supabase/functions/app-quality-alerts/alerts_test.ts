// deno test supabase/functions/app-quality-alerts/alerts_test.ts
import { assertEquals } from "jsr:@std/assert@1";

import { alertText } from "./alerts.ts";

const names: Record<string, string> = { filter_apply: "Filtr qo'lladi" };
const link = "https://hanguk.uz/crm/app-analytics/quality";

Deno.test("an event a new build stopped sending", () => {
  const text = alertText({
    kind: "version_zero",
    key: "41:filter_apply",
    day: "2026-10-26",
    detail: { event: "filter_apply", new_build: 41, old_build: 40, new_devices: 6, old_devices: 10, old_event_devices: 10, expected: 6 },
  }, (e) => names[e], link);
  assertEquals(text.split("\n"), [
    "⚠️ Ilova sifati: 41-build «filter_apply» hodisasini yubormayapti (Filtr qo'lladi).",
    "",
    "Oldingi 40-build: 10 qurilmadan 10 tasida bor edi.",
    "Yangi build: 6 qurilma, shu nisbatda taxminan 6 ta kutilgan edi — 0 keldi.",
    "",
    "Tekshirish: CRM → Ilova analitikasi → Sifat",
    link,
  ]);
});

Deno.test("a day far below or above the week before", () => {
  const low = alertText({ kind: "daily_volume", key: "events", day: "2026-10-25", detail: { day: "2026-10-25", events: 2340, average: 5100 } }, () => undefined, link);
  assertEquals(low.split("\n")[0], "📉 Ilova sifati: 25-oktabr kuni 2 340 ta hodisa keldi — oldingi 7 kun o'rtachasi 5 100 ta.");
  const high = alertText({ kind: "daily_volume", key: "events", day: "2026-10-25", detail: { day: "2026-10-25", events: 900, average: 300 } }, () => undefined, link);
  assertEquals(high.startsWith("📈"), true);
});

Deno.test("the voice interview cannot start", () => {
  const known = alertText({
    kind: "voice_down",
    key: "interview",
    day: "2026-11-12",
    detail: { fails: 7, devices: 1, hours: 6, status: "400", reason: "Your Wallet Balance is -0.21. Please Purchase More Credits or Upgrade Your Plan Before Proceeding." },
  }, () => undefined, link);
  assertEquals(known.split("\n"), [
    "🔴 Ilova: ovozli suhbat boshlanmayapti.",
    "",
    "Oxirgi 6 soatda 7 ta urinish xato bilan tugadi (1 ta qurilma), shundan beri birortasi ham ulanmadi.",
    "Sabab (xizmat javobi, 400): Your Wallet Balance is -0.21. Please Purchase More Credits or Upgrade Your Plan Before Proceeding.",
    "",
    "Tekshirish: CRM → Ilova analitikasi → Sifat",
    link,
  ]);
  // A build that does not say why: where to look first.
  const unknown = alertText({ kind: "voice_down", key: "interview", day: "2026-11-12", detail: { fails: 3, devices: 2, hours: 6 } }, () => undefined, link);
  assertEquals(
    unknown.split("\n")[3],
    "Sababi ilovadan kelmadi (eski build). Avval Vapi kabinetida balans va xizmat holatini tekshiring.",
  );
  // A reason without a status (the call failed below the provider's API).
  const noStatus = alertText({ kind: "voice_down", key: "interview", day: "2026-11-12", detail: { fails: 4, devices: 3, hours: 6, reason: "Call URL not found in response" } }, () => undefined, link);
  assertEquals(noStatus.split("\n")[3], "Sabab (xizmat javobi): Call URL not found in response");
});
