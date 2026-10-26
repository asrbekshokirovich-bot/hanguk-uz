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
