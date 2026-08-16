/**
 * Sana yordamchilari.
 *
 * Maʻlumot boshlanish sanasi qatʻiy emas — u ombordagi eng eski oʻlchovdan
 * olinadi. Undan oldingi sanalar interfeysda oʻchirilgan boʻlishi kerak:
 * ochiq qoldirilsa, panel "nol buyurtma" degan yolgʻon javob beradi.
 */
let dataStartKey = "2026-07-28";

export function setDataStart(key: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) dataStartKey = key;
}

export function dataStart(): string {
  return dataStartKey;
}

/** Sanani mahalliy vaqt zonasida YYYY-MM-DD ga aylantiradi. */
export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function daysBetween(from: string, to: string): number {
  const a = fromKey(from).getTime();
  const b = fromKey(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Ikki sana orasidagi barcha kunlar, ikkalasi ham kiradi. */
export function rangeKeys(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Bugungi kun — maʻlumot boshlanishidan oldin boʻlolmaydi. */
export function today(): string {
  const now = toKey(new Date());
  return now < dataStart() ? dataStart() : now;
}

const MONTHS_UZ = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

/** "3-avgust" koʻrinishi — hodisalar roʻyxati uchun. */
export function formatDayMonth(key: string): string {
  const d = fromKey(key);
  return `${d.getDate()}-${MONTHS_UZ[d.getMonth()]}`;
}

/** "03.08.2026" koʻrinishi. */
export function formatDate(key: string): string {
  const d = fromKey(key);
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join(".");
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(toKey(d))} ${hh}:${mm}`;
}
