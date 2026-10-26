// The Monday app report's arithmetic and wording (plan v2, section 8,
// «Dushanba 09:30 hisoboti»): which week, the five numbers out of
// analytics_marketing, the message, and the check on the model's comment.
// Nothing here touches Deno or the network, so report_test.ts runs it as is.

export interface Kpi {
  new_devices: number;
  new_active: number;
  requests: number;
  requests_form: number;
  requests_telegram: number;
  new_leads: number;
  contracts: number;
  app_contracts: number;
}

export interface Channel {
  key: string;
  new_devices: number;
  active: number;
  requests: number;
  contracts: number;
}

export interface Stops {
  language_exits: number;
  client_code_seen: number;
  client_code_left: number;
  locked_tabs: { tab: string; devices: number }[];
  lead_form: { opened: number; field_error: number; submitted: number };
}

/** The part of analytics_marketing the report reads. */
export interface Marketing {
  from: string;
  to: string;
  kpi: Kpi;
  channels: Channel[];
  stops: Stops;
}

export interface Week {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The last whole week, Monday to Sunday, before [now]'s day in Tashkent, and the one before it. */
export function lastWeek(now: Date): Week {
  const today = new Date(now.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);
  const sinceMonday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const from = addDays(today, -sinceMonday - 7);
  return { from, to: addDays(from, 6), prevFrom: addDays(from, -7), prevTo: addDays(from, -1) };
}

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

/** «19–25-oktabr», «28-sentabr – 4-oktabr». */
export function weekLabel(from: string, to: string): string {
  const [, fm, fd] = from.split("-").map(Number);
  const [, tm, td] = to.split("-").map(Number);
  if (fm === tm) return `${fd}–${td}-${MONTHS[tm - 1]}`;
  return `${fd}-${MONTHS[fm - 1]} – ${td}-${MONTHS[tm - 1]}`;
}

/** The panel's share: requests among all new leads, in whole per cent. */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** The channel with the most requests (then contracts, then new devices); none when nobody asked. */
export function topChannel(m: Marketing): Channel | null {
  const best = [...m.channels]
    .filter((c) => c.requests > 0)
    .sort((a, b) => b.requests - a.requests || b.contracts - a.contracts || b.new_devices - a.new_devices);
  return best[0] ?? null;
}

export type Stop =
  | { kind: "language"; n: number }
  | { kind: "client_code"; n: number; seen: number }
  | { kind: "locked"; n: number; tab: string }
  | { kind: "form"; n: number; opened: number; sent: number };

/**
 * The place most people stopped, among those the panel's «To'xtash joylari»
 * names (the marketing plan: the language screen, the client-code screen, a
 * locked tab, the consultant form): sessions that ended on the language
 * screen, devices that left the client-code screen without a code, guests
 * who pressed a locked tab, devices that opened the form and did not send
 * it. Ties go to the first in that order; none when all are zero.
 */
export function biggestStop(m: Marketing): Stop | null {
  const s = m.stops;
  const all: Stop[] = [
    { kind: "language", n: s.language_exits },
    { kind: "client_code", n: s.client_code_left, seen: s.client_code_seen },
    ...s.locked_tabs.map((t) => ({ kind: "locked" as const, n: t.devices, tab: t.tab })),
    {
      kind: "form",
      n: Math.max(0, s.lead_form.opened - s.lead_form.submitted),
      opened: s.lead_form.opened,
      sent: s.lead_form.submitted,
    },
  ];
  let best: Stop | null = null;
  for (const x of all) if (x.n > 0 && (!best || x.n > best.n)) best = x;
  return best;
}

const TABS: Record<string, string> = { prepare: "Tayyorgarlik", application: "Ariza", documents: "Hujjatlar" };

export function stopText(s: Stop): string {
  switch (s.kind) {
    case "language":
      return `til tanlash ekrani — ${s.n} sessiya shu yerda tugadi`;
    case "client_code":
      return `mijoz kodi ekrani — ${s.n} qurilma kodsiz chiqdi (${s.seen} tadan)`;
    case "locked":
      return `yopiq «${TABS[s.tab] ?? s.tab}» bo'limi — ${s.n} mehmon bosdi`;
    case "form":
      return `konsultant formasi — ${s.opened} qurilma ochdi, ${s.sent} tasi yubordi`;
  }
}

export function channelName(key: string, names: Record<string, string>): string {
  return key === "unknown" ? "Noma'lum (javobsiz)" : names[key] ?? key;
}

const prevNote = (n: number) => `oldingi hafta: ${n}`;

/** The five lines (the plan's order). */
export function fiveLines(cur: Marketing, prev: Marketing, names: Record<string, string>): string[] {
  const k = cur.kpi;
  const pct = share(k.requests, k.new_leads);
  const top = topChannel(cur);
  const stop = biggestStop(cur);
  return [
    `1. Yangi faol qurilma: ${k.new_devices} (${prevNote(prev.kpi.new_devices)})`,
    `2. Ilovadan murojaat: ${k.requests} — forma ${k.requests_form} · kodli Telegram ${k.requests_telegram}` +
      (pct != null ? ` · ulushi ${pct}%` : "") +
      ` (${prevNote(prev.kpi.requests)})`,
    `3. Ilova ishtirokidagi shartnoma: ${k.app_contracts} (jami shartnoma: ${k.contracts}; ${prevNote(prev.kpi.app_contracts)})`,
    `4. Eng ko'p murojaat bergan kanal: ` + (top ? `${channelName(top.key, names)} — ${top.requests}` : "— (murojaat bo'lmadi)"),
    `5. Eng katta to'xtash joyi: ` + (stop ? stopText(stop) : "—"),
  ];
}

export function composeReport(args: {
  week: Week;
  cur: Marketing;
  prev: Marketing;
  names: Record<string, string>;
  comment: string[] | null;
  link: string;
}): string {
  const { week, cur, prev, names, comment, link } = args;
  return [
    `📱 Ilova · haftalik hisobot`,
    `${weekLabel(week.from, week.to)} · test qurilmalarsiz`,
    ``,
    ...fiveLines(cur, prev, names),
    ...(comment?.length ? [``, `🤖 AI izohi:`, ...comment.map((l) => `— ${l}`)] : []),
    ``,
    `Batafsil — CRM → Ilova analitikasi → Marketing:`,
    link,
  ].join("\n");
}

/** What the model is told: these numbers and nothing else. */
export function aiFacts(week: Week, cur: Marketing, prev: Marketing, names: Record<string, string>) {
  const top = topChannel(cur);
  const stop = biggestStop(cur);
  const kpi = (m: Marketing) => ({
    yangi_faol_qurilma: m.kpi.new_devices,
    ilovadan_murojaat: m.kpi.requests,
    murojaat_forma: m.kpi.requests_form,
    murojaat_kodli_telegram: m.kpi.requests_telegram,
    barcha_yangi_lidlar: m.kpi.new_leads,
    murojaat_ulushi_foiz: share(m.kpi.requests, m.kpi.new_leads),
    ilova_ishtirokidagi_shartnoma: m.kpi.app_contracts,
    jami_shartnoma: m.kpi.contracts,
  });
  return {
    hafta: weekLabel(week.from, week.to),
    shu_hafta: kpi(cur),
    oldingi_hafta: kpi(prev),
    kanallar: cur.channels
      .filter((c) => c.new_devices || c.requests || c.contracts)
      .map((c) => ({ kanal: channelName(c.key, names), yangi_qurilma: c.new_devices, murojaat: c.requests, shartnoma: c.contracts })),
    eng_kop_murojaat_kanali: top ? channelName(top.key, names) : null,
    eng_katta_toxtash_joyi: stop ? stopText(stop) : null,
    toxtash_joylari: {
      til_ekranida_tugagan_sessiya: cur.stops.language_exits,
      mijoz_kodi_ekranini_ochgan: cur.stops.client_code_seen,
      kodsiz_chiqqan: cur.stops.client_code_left,
      yopiq_bolimni_bosgan: cur.stops.locked_tabs.map((t) => ({ bolim: TABS[t.tab] ?? t.tab, mehmon: t.devices })),
      forma_ochgan: cur.stops.lead_form.opened,
      formada_xato: cur.stops.lead_form.field_error,
      forma_yuborgan: cur.stops.lead_form.submitted,
    },
  };
}

/** Every number the facts hold (and the week's days), as written. */
export function allowedNumbers(facts: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "number") out.add(String(v));
    else if (typeof v === "string") for (const m of v.match(/\d+/g) ?? []) out.add(m);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(facts);
  return out;
}

/**
 * The model's three lines, or null: no number it was not given (a made-up
 * difference or percentage is not sent), at most three short lines.
 */
export function cleanComment(lines: unknown, allowed: Set<string>): string[] | null {
  if (!Array.isArray(lines)) return null;
  const out = lines
    .filter((l): l is string => typeof l === "string")
    // a list mark the model may add («1.», «—», «•»), not a number it says
    .map((l) => l.replace(/^\s*(?:[•\-—*]|\d+[.)])\s+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!out.length) return null;
  for (const l of out) {
    if (l.length > 220) return null;
    for (const n of l.match(/\d+(?:[.,]\d+)?/g) ?? []) if (!allowed.has(n)) return null;
  }
  return out;
}
