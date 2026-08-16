import type { Metric } from "@/data/types";

/**
 * Oʻzbek yozuvida minglar boʻsh joy bilan, kasr esa vergul bilan ajratiladi.
 * `Intl` "uz-UZ" uchun vergulli minglarni beradi — bu 1,620 ni "bir butun olti"
 * deb oʻqishga olib keladi, shuning uchun ajratgich qoʻlda qoʻyiladi.
 */
const THIN_SPACE = " ";

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
}

export function formatInt(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "−" : "";
  return sign + group(String(Math.abs(rounded)));
}

function decimal(n: number, digits: number): string {
  const sign = n < 0 ? "−" : "";
  const [whole, frac] = Math.abs(n).toFixed(digits).split(".");
  return sign + group(whole) + (frac ? `,${frac}` : "");
}

/**
 * Katta pul raqamlari toʻliq yozilmaydi — panelda ular oʻqilmaydi.
 * 1 240 000 000 → "1,24 mlrd soʻm".
 */
export function formatMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${decimal(n / 1_000_000_000, 2)} mlrd soʻm`;
  if (abs >= 1_000_000) return `${decimal(n / 1_000_000, 1)} mln soʻm`;
  return `${formatInt(n)} soʻm`;
}

/** Grafik oʻqi uchun — birlik nomisiz, faqat kattalik. */
export function formatMoneyShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${decimal(n / 1_000_000_000, 1)} mlrd`;
  if (abs >= 1_000_000) return `${decimal(n / 1_000_000, 1)} mln`;
  if (abs >= 1_000) return `${decimal(n / 1_000, 0)} ming`;
  return formatInt(n);
}

/** Kartochkadagi toʻliq narx — bu yerda qisqartirilmaydi. */
export function formatPrice(n: number): string {
  return `${formatInt(n)} soʻm`;
}

/**
 * Taxminiy raqam oldiga `~` qoʻyiladi. Bu belgi tasodifiy emas: aylanma va
 * qoldiqdan hisoblangan sotuv hech qachon aniq deb koʻrsatilmasligi kerak.
 */
export function withTilde(text: string, certainty: Metric["certainty"]): string {
  return certainty === "approx" ? `~${text}` : text;
}

export function formatPercent(n: number, digits = 0): string {
  return `${decimal(n, digits)}%`;
}

export function formatRankShort(position: number, outOf: number): string {
  return `#${formatInt(position)} / ${formatInt(outOf)}`;
}
