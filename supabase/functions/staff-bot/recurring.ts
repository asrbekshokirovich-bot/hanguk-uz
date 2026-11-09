// staff-bot — takroriy vazifalar (reja B5-2, oxirgi qolgan qism; talaba biriktirish allaqachon bajarilgan,
// student_link.ts). Xodim (yoki owner) "/takror" bilan har kuni yoki har hafta avtomatik qayta yaratiladigan
// vazifa belgilaydi; cron (?action=recurring, har kuni 07:00 Toshkent) bot_recurring_run RPC'ni chaqiradi.
// Yaratilgan vazifa haqida xabar mavjud trg_task_events → bot_notify_claim (notify.ts, kind='created')
// zanjiri orqali mas'ulga o'zi boradi — bu yerda alohida DM yuborilmaydi.

import { escapeHtml, PRIORITY_UZ } from "./core.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

export const RECURRING_USAGE =
  "Format: <code>/takror Ism Familiya | Sarlavha | har kuni | 18:00</code>\n" +
  "yoki: <code>/takror Ism Familiya | Sarlavha | har hafta Du,Chor | 18:00</code>\n" +
  "(vaqt — ixtiyoriy, bo'lmasa muddatsiz; kunlar: Du,Se,Chor,Pay,Juma,Shan,Yak)";

const WEEKDAY_ABBR: Record<string, number> = {
  du: 1, dush: 1, dushanba: 1,
  se: 2, sesh: 2, seshanba: 2,
  chor: 3, chorshanba: 3,
  pay: 4, paysh: 4, payshanba: 4,
  juma: 5,
  shan: 6, shanba: 6,
  yak: 7, yaksh: 7, yakshanba: 7,
};

export interface ParsedRecurring {
  nameQuery: string;
  title: string;
  freq: "daily" | "weekly";
  weekdays: string | null; // "1,3" ISO
  dueTime: string | null; // "HH:MM"
}

/** `/takror <ism> | <sarlavha> | har kuni|har hafta <kunlar> | <HH:MM>` → bo'laklar, yoki xato matni. */
export function parseRecurringCommand(arg: string): ParsedRecurring | { error: string } {
  const parts = arg.split("|").map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length < 3) return { error: RECURRING_USAGE };
  const [nameQuery, title, freqPart, timePart] = parts;
  if (!nameQuery || !title) return { error: RECURRING_USAGE };

  const low = freqPart.toLowerCase().replace(/[ʻʼ‘’`]/g, "'");
  let freq: "daily" | "weekly";
  let weekdays: string | null = null;
  if (/^har\s+kuni$/.test(low)) {
    freq = "daily";
  } else if (/^har\s+hafta\b/.test(low)) {
    freq = "weekly";
    const rest = low.replace(/^har\s+hafta\b/, "").trim();
    const days = rest.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
      .map((s) => WEEKDAY_ABBR[s]).filter((n): n is number => !!n);
    if (!days.length) return { error: "Hafta kunlarini ko'rsating, masalan: har hafta Du,Chor" };
    weekdays = [...new Set(days)].sort((a, b) => a - b).join(",");
  } else {
    return { error: RECURRING_USAGE };
  }

  let dueTime: string | null = null;
  if (timePart) {
    const tm = timePart.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
    if (!tm) return { error: "Vaqtni soat:daqiqa shaklida yozing, masalan 18:00" };
    dueTime = `${tm[1].padStart(2, "0")}:${tm[2]}`;
  }

  return { nameQuery, title: title.slice(0, 200), freq, weekdays, dueTime };
}

const DOW_UZ = ["", "Du", "Se", "Chor", "Pay", "Juma", "Shan", "Yak"];

export function renderWeekdays(weekdays: string | null): string {
  if (!weekdays) return "har kuni";
  return weekdays.split(",").map((s) => DOW_UZ[+s] ?? s).join(",");
}

export interface RecurringRow {
  id: string;
  title: string;
  assigned_to: string;
  assignee_name: string;
  priority: string;
  freq: "daily" | "weekly";
  weekdays: string | null;
  due_time: string | null;
}

/** "/takrorlarim" ro'yxati. */
export function renderRecurringList(rows: RecurringRow[]): string {
  if (!rows.length) return "Faol takroriy vazifa yo'q.";
  const lines = ["🔁 <b>Takroriy vazifalar</b>", ""];
  for (const r of rows) {
    const when = r.freq === "daily" ? "har kuni" : `har hafta ${renderWeekdays(r.weekdays)}`;
    const time = r.due_time ? ` ${r.due_time}` : "";
    lines.push(`• ${escapeHtml(r.title)} — <b>${escapeHtml(r.assignee_name)}</b>, ${when}${time} (${PRIORITY_UZ[r.priority] ?? r.priority})`);
  }
  return lines.join("\n");
}

export const RECURRING_CREATED = (title: string, assigneeName: string, freq: string, weekdays: string | null, dueTime: string | null) => {
  const when = freq === "daily" ? "har kuni" : `har hafta ${renderWeekdays(weekdays)}`;
  const time = dueTime ? ` ${dueTime}` : "";
  return `🔁 Takroriy vazifa saqlandi: <b>${escapeHtml(title)}</b>\n👤 ${escapeHtml(assigneeName)} · ${when}${time}`;
};

export interface RecurringDeps {
  db: Any;
}

/** `?action=recurring` cron: bugungi takroriy vazifalarni yaratadi. */
export async function runRecurringTasks(deps: RecurringDeps): Promise<Record<string, unknown>> {
  const { data, error } = await deps.db.rpc("bot_recurring_run");
  if (error) {
    console.error("bot_recurring_run:", error.message);
    return { ok: false, error: error.message };
  }
  const created = (data ?? 0) as number;
  if (created) console.log("staff-bot: recurring", JSON.stringify({ created }));
  return { ok: true, created };
}
