// What notify-guest-reminders sends, decided without the network so it can
// be tested (plan_test.ts). Rules (Asrbek, QU2, 6-noy): one message a day per
// phone, at most two in 7 days, nothing 22:00–08:00 Tashkent. Several
// universities due the same day go as one message.

export type Lang = "uz" | "ru" | "en" | "ko" | "vi" | "ky";
export type Kind = "deadline_7" | "deadline_3" | "deadline_1" | "guideline_new";
export type Mode = "off" | "test" | "all";

export interface PendingRow {
  queue_id: number;
  install_id: string;
  kind: Kind;
  institution_id: string;
  ref_date: string;
  lang: string | null;
  tokens: string[];
  /** P16: the Telegram chat, when the phone subscribed in the bot */
  tg_chat?: string | null;
  is_test: boolean;
  sent_today: number;
  sent_7d: number;
}

export interface Message {
  install_id: string;
  /** push when the phone has a token, else the Telegram subscription (P16) */
  channel: "fcm" | "telegram";
  tg_chat: string | null;
  kind: Kind;
  lang: Lang;
  tokens: string[];
  is_test: boolean;
  queue_ids: number[];
  institution_ids: string[];
  ref_date: string;
}

export interface Plan {
  send: Message[];
  /** rows closed without a message, with the reason */
  skip: { queue_id: number; note: string }[];
  /** rows left pending for a later run */
  wait: number;
}

export const WEEK_CAP = 2;

/** Hour in Tashkent (UTC+5, no daylight saving). */
export function tashkentHour(now: Date): number {
  return (now.getUTCHours() + 5) % 24;
}

export function isQuiet(now: Date): boolean {
  const h = tashkentHour(now);
  return h >= 22 || h < 8;
}

export function normalizeLang(raw: string | null | undefined): Lang {
  const l = (raw ?? "").toLowerCase().slice(0, 2);
  return (["uz", "ru", "en", "ko", "vi", "ky"] as const).includes(l as Lang) ? (l as Lang) : "uz";
}

export function parseMode(raw: string | undefined | null): Mode {
  const m = (raw ?? "").trim().toLowerCase();
  if (m === "all" || m === "true" || m === "1") return "all";
  if (m === "test") return "test";
  return "off";
}

// Most urgent first: the message is named after it.
const URGENCY: Record<Kind, number> = { deadline_1: 0, deadline_3: 1, deadline_7: 2, guideline_new: 3 };

export function planBatch(rows: PendingRow[], mode: Mode): Plan {
  const plan: Plan = { send: [], skip: [], wait: 0 };
  const byPhone = new Map<string, PendingRow[]>();
  for (const r of rows) {
    const list = byPhone.get(r.install_id) ?? [];
    list.push(r);
    byPhone.set(r.install_id, list);
  }
  for (const [install, list] of byPhone) {
    const first = list[0];
    if (mode === "off" || (mode === "test" && !first.is_test) || (first.tokens.length === 0 && !first.tg_chat)) {
      plan.wait += list.length;
      continue;
    }
    // already one today: the rest waits (a deadline row expires tomorrow)
    if (first.sent_today >= 1) {
      plan.wait += list.length;
      continue;
    }
    list.sort((a, b) => URGENCY[a.kind] - URGENCY[b.kind] || a.ref_date.localeCompare(b.ref_date));
    const top = list[0];
    // The week allows two: the 3-day reminder does not use the last one, so
    // the 1-day reminder (7 → 1) still has room.
    const cap = first.sent_7d >= WEEK_CAP || (top.kind === "deadline_3" && first.sent_7d >= WEEK_CAP - 1);
    if (cap) {
      for (const r of list) plan.skip.push({ queue_id: r.queue_id, note: "week_cap" });
      continue;
    }
    const same = list.filter((r) => r.kind === top.kind);
    const rest = list.filter((r) => r.kind !== top.kind);
    plan.send.push({
      install_id: install,
      channel: first.tokens.length ? "fcm" : "telegram",
      tg_chat: first.tg_chat ?? null,
      kind: top.kind,
      lang: normalizeLang(first.lang),
      tokens: first.tokens,
      is_test: first.is_test,
      queue_ids: same.map((r) => r.queue_id),
      institution_ids: [...new Set(same.map((r) => r.institution_id))],
      ref_date: top.ref_date,
    });
    // a less urgent deadline the same day is covered by this message
    for (const r of rest) {
      if (r.kind === "guideline_new") plan.wait++;
      else plan.skip.push({ queue_id: r.queue_id, note: "merged" });
    }
  }
  return plan;
}
