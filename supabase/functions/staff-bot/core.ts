// staff-bot — sof yordamchilar (tarmoqsiz, bazasiz), core_test.ts bilan sinaladi.

export const TZ_OFFSET_MIN = 5 * 60; // Asia/Tashkent, DST yo'q

/** `/start KOD` yoki `/start` → kod (katta harf) yoki null. Deep link: t.me/bot?start=KOD */
export function parseStartCode(text: string | undefined | null): string | null {
  const m = String(text ?? "").trim().match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{4,64}))?\s*$/);
  if (!m) return null;
  return m[1] ? m[1].toUpperCase() : null;
}

/** `/buyruq@BotNomi arg` → { cmd: "buyruq", arg: "arg" } ; buyruq bo'lmasa null */
export function parseCommand(text: string | undefined | null): { cmd: string; arg: string } | null {
  const m = String(text ?? "").trim().match(/^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i);
  if (!m) return null;
  return { cmd: m[1].toLowerCase(), arg: (m[2] ?? "").trim() };
}

/** Toshkent bo'yicha kun boshi (UTC ms). */
export function tashkentDayStart(nowMs: number): number {
  const local = nowMs + TZ_OFFSET_MIN * 60_000;
  const dayStartLocal = Math.floor(local / 86_400_000) * 86_400_000;
  return dayStartLocal - TZ_OFFSET_MIN * 60_000;
}

/** Toshkent sanasi YYYY-MM-DD. */
export function tashkentDate(ms: number): string {
  return new Date(ms + TZ_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** Toshkent vaqtida DD.MM (va HH:MM, agar yarim tun bo'lmasa). */
export function fmtDue(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t + TZ_OFFSET_MIN * 60_000);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const hh = d.getUTCHours(), mi = d.getUTCMinutes();
  return hh === 0 && mi === 0 ? `${dd}.${mm}` : `${dd}.${mm} ${String(hh).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
}

export interface GroupedTasks {
  overdue: TaskRow[];
  today: TaskRow[];
  upcoming: TaskRow[];
  nodate: TaskRow[];
}

/** Ochiq vazifalarni Toshkent kuni bo'yicha guruhlash. */
export function groupTasks(tasks: TaskRow[], nowMs: number): GroupedTasks {
  const dayStart = tashkentDayStart(nowMs);
  const dayEnd = dayStart + 86_400_000;
  const g: GroupedTasks = { overdue: [], today: [], upcoming: [], nodate: [] };
  const byDue = (a: TaskRow, b: TaskRow) => (Date.parse(a.due_date ?? "") || 0) - (Date.parse(b.due_date ?? "") || 0);
  for (const t of tasks) {
    if (!t.due_date) { g.nodate.push(t); continue; }
    const due = Date.parse(t.due_date);
    if (Number.isNaN(due)) { g.nodate.push(t); continue; }
    if (due < dayStart) g.overdue.push(t);
    else if (due < dayEnd) g.today.push(t);
    else g.upcoming.push(t);
  }
  g.overdue.sort(byDue); g.today.sort(byDue); g.upcoming.sort(byDue);
  return g;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function taskLine(t: TaskRow): string {
  const pr = t.priority === "urgent" || t.priority === "high" ? " ❗" : "";
  const wip = t.status === "in_progress" ? " ▶" : "";
  const due = fmtDue(t.due_date);
  return `• ${escapeHtml(t.title)}${due ? ` — ${due}` : ""}${pr}${wip}`;
}

/** «Vazifalarim» matni (HTML parse_mode). */
export function renderTaskList(g: GroupedTasks): string {
  const total = g.overdue.length + g.today.length + g.upcoming.length + g.nodate.length;
  if (total === 0) return "✅ Ochiq vazifangiz yo'q.";
  const parts: string[] = [`📋 <b>Ochiq vazifalar: ${total}</b>`];
  const section = (title: string, rows: TaskRow[]) => {
    if (!rows.length) return;
    parts.push("", `<b>${title}</b>`, ...rows.slice(0, 15).map(taskLine));
    if (rows.length > 15) parts.push(`… va yana ${rows.length - 15} ta`);
  };
  section("🔴 Muddati o'tgan", g.overdue);
  section("🟡 Bugun", g.today);
  section("🟢 Keyingi", g.upcoming);
  section("⚪ Muddatsiz", g.nodate);
  return parts.join("\n");
}

/** Telegram bir xabarda 4096 belgi qabul qiladi; satr chegarasida bo'lamiz. */
export function splitMessage(text: string, limit = 3800): string[] {
  if (text.length <= limit) return [text];
  const out: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if ((cur + "\n" + line).length > limit && cur) { out.push(cur); cur = line; }
    else cur = cur ? cur + "\n" + line : line;
  }
  if (cur) out.push(cur);
  return out;
}

export const MENU = {
  tasks: "📋 Vazifalarim",
  assign: "➕ Vazifa berish",
  report: "📝 Hisobot",
  ask: "🤖 Savol",
} as const;

export const MENU_KEYBOARD = {
  keyboard: [[{ text: MENU.tasks }, { text: MENU.assign }], [{ text: MENU.report }, { text: MENU.ask }]],
  resize_keyboard: true,
  is_persistent: true,
};

/** Ulashdagi javob matnlari. */
export function linkResultText(status: string, fullName: string): string {
  switch (status) {
    case "linked":
      return `✅ Xush kelibsiz, ${escapeHtml(fullName || "")}!\n\nEndi bu yerda:\n${MENU.tasks} — sizga biriktirilgan vazifalar\n${MENU.assign} — hamkasbga vazifa berish\n${MENU.report} — kunlik hisobot (har kuni 17:00 da so'rayman)\n${MENU.ask} — Hanguk AI'ga savol`;
    case "expired":
      return "⌛ Havola muddati o'tgan (15 daqiqa). CRM → Xodimlar bo'limidan yangi havola oling.";
    case "used":
      return "Bu havola allaqachon ishlatilgan. CRM → Xodimlar bo'limidan yangi havola oling.";
    case "tg_taken":
      return "Bu Telegram akkaunti boshqa xodimga ulangan. Rahbaringizga ayting — u CRM'da uzib, qayta ulaydi.";
    case "not_staff":
      return "Bu akkaunt xodim sifatida ro'yxatdan o'tmagan.";
    default:
      return "Havola noto'g'ri. CRM → Xodimlar bo'limidan yangi havola oling.";
  }
}

export const NOT_LINKED_TEXT =
  "Bu bot Hanguk xodimlari uchun.\n\nUlanish uchun CRM (hanguk.uz) → Xodimlar sahifasidagi «Telegram'ga ulash» havolasini oching. Havolani rahbaringiz ham bera oladi.";

export const HELP_TEXT =
  `${MENU.tasks} — ochiq vazifalaringiz (muddati o'tgan / bugun / keyingi)\n${MENU.assign} — hamkasbga vazifa (matn yoki ovoz)\n${MENU.report} — kunlik hisobot; har ish kuni 17:00 da o'zim so'rayman\n${MENU.ask} — Hanguk AI'ga savol\n\n/bugun — bugungi va kechikkan vazifalar\n/cancel — boshlangan amalni bekor qilish`;
