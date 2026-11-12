// The text of the app's quality alarms (fn_app_quality_scan). Pure, so
// alerts_test.ts runs it as is.

export interface Alert {
  id?: number;
  kind: "version_zero" | "daily_volume" | "voice_down";
  key: string;
  day: string;
  detail: Record<string, unknown>;
}

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const group = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}-${MONTHS[m - 1]}`;
}

/** One Telegram message per alarm; [describe] names an event in Uzbek (the registry). */
export function alertText(a: Alert, describe: (event: string) => string | undefined, link: string): string {
  const d = a.detail;
  if (a.kind === "version_zero") {
    const event = String(d.event ?? "");
    const what = describe(event);
    return [
      `⚠️ Ilova sifati: ${d.new_build}-build «${event}» hodisasini yubormayapti${what ? ` (${what})` : ""}.`,
      ``,
      `Oldingi ${d.old_build}-build: ${num(d.old_devices)} qurilmadan ${num(d.old_event_devices)} tasida bor edi.`,
      `Yangi build: ${num(d.new_devices)} qurilma, shu nisbatda taxminan ${num(d.expected)} ta kutilgan edi — 0 keldi.`,
      ``,
      `Tekshirish: CRM → Ilova analitikasi → Sifat`,
      link,
    ].join("\n");
  }
  if (a.kind === "voice_down") {
    // The provider's own words when it refused the call (builds from 2108);
    // older builds only say that the call did not start.
    const reason = String(d.reason ?? "").trim();
    const status = d.status == null || d.status === "" ? "" : `, ${d.status}`;
    return [
      `🔴 Ilova: ovozli suhbat boshlanmayapti.`,
      ``,
      `Oxirgi ${num(d.hours)} soatda ${num(d.fails)} ta urinish xato bilan tugadi (${num(d.devices)} ta qurilma), shundan beri birortasi ham ulanmadi.`,
      reason
        ? `Sabab (xizmat javobi${status}): ${reason}`
        : `Sababi ilovadan kelmadi (eski build). Avval Vapi kabinetida balans va xizmat holatini tekshiring.`,
      ``,
      `Tekshirish: CRM → Ilova analitikasi → Sifat`,
      link,
    ].join("\n");
  }
  const events = num(d.events);
  const avg = num(d.average);
  return [
    `${events < avg ? "📉" : "📈"} Ilova sifati: ${dayLabel(String(d.day ?? a.day))} kuni ${group(events)} ta hodisa keldi — oldingi 7 kun o'rtachasi ${group(avg)} ta.`,
    ``,
    `Test qurilmalarsiz. Tekshirish: CRM → Ilova analitikasi → Sifat`,
    link,
  ].join("\n");
}
