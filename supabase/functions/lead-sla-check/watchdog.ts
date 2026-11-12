// Watchdogs on "Yangi lid", sent to the owner only (lead_alert_recipients
// where watchdog) — see 20260930140000_lead_watchdog.sql.
//
//   * A new lead marked answered within 30 seconds of arriving: almost always
//     an automatic message nobody at Hanguk wrote (the Instagram form template
//     hid leads for a day before anyone noticed). One alert per lead.
//   * At 09:30 Tashkent, yesterday's count: new leads, answered, unanswered —
//     and yesterday's Instagram comments with the ones nobody answered (the
//     CRM has no page for comments, so this is the only place they show).
// deno-lint-ignore-file no-explicit-any

/** The service-role client lead-sla-check already holds. */
type Admin = any;
type Send = (chatId: string, text: string) => Promise<boolean>;

interface QuickExit {
  id: string;
  full_name: string | null;
  source: string | null;
  seconds: number;
  closed_by: string | null;
}

interface DailyReport {
  report_day: string;
  new_leads: number;
  answered: number;
  unanswered: number;
}

/** fn_instagram_comments_daily: one day's comments under Hanguk's posts, reels and ads. */
export interface CommentDigest {
  total: number;
  unanswered: number;
  /** The latest of those still waiting, five at most. */
  items: { username?: string | null; text?: string | null; media?: string | null }[];
}

/** Where the comment was left (instagram_comments.media_product_type). */
const MEDIA: Record<string, string> = { AD: "reklama", REELS: "reels", FEED: "post", STORY: "story" };

/** What the SQL cuts a comment's text to; one that long is shown as cut. */
const COMMENT_TEXT_MAX = 160;

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

export async function watchdogChats(supabase: Admin): Promise<string[]> {
  const { data, error } = await supabase
    .from("lead_alert_recipients")
    .select("chat_id")
    .eq("enabled", true)
    .eq("watchdog", true);
  if (error) console.error("lead-sla-check: watchdog recipients:", error.message);
  return [...new Set(((data ?? []) as { chat_id: string }[]).map((r) => String(r.chat_id).trim()).filter(Boolean))];
}

function composeQuickExit(l: QuickExit): string {
  const text = (l.closed_by ?? "").trim();
  const quoted = text ? `"${text.length > 200 ? text.slice(0, 200) + "…" : text}"` : "(xabar topilmadi)";
  return [
    `⚠️ Shubhali: yangi lid ${l.seconds} soniyada "javob berildi" bo'lib, Yangi lid bo'limidan chiqdi.`,
    ``,
    `${l.full_name || "(ismsiz lid)"}${l.source ? `\nManba: ${l.source}` : ""}`,
    `Chiqargan xabar: ${quoted}`,
    ``,
    `Buni xodim yozmagan bo'lsa, bu avtomatik xabar — tekshirish kerak.`,
  ].join("\n");
}

/** The comments part of the morning report; nothing on a day nobody commented. */
export function composeComments(c: CommentDigest | null | undefined): string[] {
  if (!c || !(Number(c.total) > 0)) return [];
  const waiting = Number(c.unanswered) || 0;
  const items = Array.isArray(c.items) ? c.items : [];
  const lines = [``, `💬 Instagram izohlari: ${c.total} ta, javob kutayotgani: ${waiting} ta`];
  for (const it of items) {
    const who = it.username ? `@${it.username}` : "(noma'lum)";
    const where = it.media ? MEDIA[it.media] : undefined;
    const text = (it.text ?? "").trim();
    lines.push(`• ${who}${where ? ` (${where})` : ""}: «${text}${text.length >= COMMENT_TEXT_MAX ? "…" : ""}»`);
  }
  if (waiting > items.length) lines.push(`…va yana ${waiting - items.length} ta`);
  if (waiting > 0) lines.push(`Javob Instagram ilovasidan yoziladi — CRM'da izohlar bo'limi yo'q.`);
  return lines;
}

export function composeReport(r: DailyReport, comments?: CommentDigest | null): string {
  const [, m, d] = r.report_day.split("-").map(Number);
  return [
    `📊 Kechagi lidlar (${d}-${MONTHS[m - 1]})`,
    ``,
    `Yangi lidlar: ${r.new_leads}`,
    `Xodim javob bergan: ${r.answered}`,
    `Javobsiz: ${r.unanswered}`,
    ...composeComments(comments),
  ].join("\n");
}

/** That day's comments; null (and the report goes out without them) when the query fails. */
async function commentsOf(supabase: Admin, day: string): Promise<CommentDigest | null> {
  const { data, error } = await supabase.rpc("fn_instagram_comments_daily", { p_day: day });
  if (error) {
    console.error("lead-sla-check: instagram comments:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as CommentDigest) : null;
}

export async function runWatchdogs(
  supabase: Admin,
  dry: boolean,
  send: Send,
): Promise<{ quick_exits: number; report_sent: boolean; dry?: unknown }> {
  const [quick, report] = await Promise.all([
    supabase.rpc("fn_lead_quick_contact_scan", { p_dry: dry }),
    supabase.rpc("fn_lead_daily_report_claim", { p_dry: dry }),
  ]);
  if (quick.error) console.error("lead-sla-check: quick-exit scan:", quick.error.message);
  if (report.error) console.error("lead-sla-check: daily report:", report.error.message);

  const exits = (quick.data ?? []) as QuickExit[];
  const reports = (report.data ?? []) as DailyReport[];

  const comments = new Map<string, CommentDigest | null>();
  for (const r of reports) comments.set(r.report_day, await commentsOf(supabase, r.report_day));

  if (dry) {
    return {
      quick_exits: exits.length,
      report_sent: false,
      dry: { exits, reports, texts: reports.map((r) => composeReport(r, comments.get(r.report_day))) },
    };
  }
  if (!exits.length && !reports.length) return { quick_exits: 0, report_sent: false };

  const chats = await watchdogChats(supabase);
  if (!chats.length) {
    console.warn("lead-sla-check: no watchdog recipient configured");
    return { quick_exits: exits.length, report_sent: false };
  }

  for (const l of exits) {
    for (const chat of chats) await send(chat, composeQuickExit(l));
  }
  let reportSent = false;
  for (const r of reports) {
    const text = composeReport(r, comments.get(r.report_day));
    for (const chat of chats) if (await send(chat, text)) reportSent = true;
  }
  return { quick_exits: exits.length, report_sent: reportSent };
}
