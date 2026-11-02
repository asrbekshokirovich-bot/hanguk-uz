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

// ── PR-3: vazifa matnini ajratish (deterministik; AI faqat sarlavhani tozalaydi) ──

export type Priority = "urgent" | "high" | "normal" | "low";

export interface ParsedTask {
  title: string;
  due: string | null; // ISO (UTC)
  priority: Priority;
}

const WEEKDAYS: Record<string, number> = {
  dushanba: 1, seshanba: 2, chorshanba: 3, payshanba: 4, juma: 5, shanba: 6, yakshanba: 7,
};

/** Toshkent mahalliy sana+vaqtni UTC ISO'ga. */
export function tashkentToIso(y: number, m: number, d: number, hh: number, mi: number): string {
  return new Date(Date.UTC(y, m - 1, d, hh, mi) - TZ_OFFSET_MIN * 60_000).toISOString();
}

/** Matndan muddat va muhimlikni topadi. Topilmasa due=null, priority=normal. */
export function parseTaskText(raw: string, nowMs: number): ParsedTask {
  const text = raw.replace(/\s+/g, " ").trim();
  const low = text.toLowerCase().replace(/[ʻʼ‘’`]/g, "'");
  const local = new Date(nowMs + TZ_OFFSET_MIN * 60_000);
  let y = local.getUTCFullYear(), m = local.getUTCMonth() + 1, d = local.getUTCDate();
  let found = false;

  const addDays = (n: number) => {
    const t = new Date(Date.UTC(y, m - 1, d + n));
    y = t.getUTCFullYear(); m = t.getUTCMonth() + 1; d = t.getUTCDate();
  };

  const dm = low.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
  if (dm) {
    const dd = +dm[1], mm = +dm[2];
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      let yy = dm[3] ? +dm[3] : y;
      if (yy < 100) yy += 2000;
      if (!dm[3] && (mm < m || (mm === m && dd < d))) yy += 1; // o'tib ketgan sana → keyingi yil
      y = yy; m = mm; d = dd; found = true;
    }
  }
  if (!found) {
    if (/\bindin(ga)?\b/.test(low)) { addDays(2); found = true; }
    else if (/\bertaga\b|\bertangi\b/.test(low)) { addDays(1); found = true; }
    else if (/\bbugun\b|\bbugungi\b/.test(low)) { found = true; }
    else {
      for (const [name, wd] of Object.entries(WEEKDAYS)) {
        if (new RegExp(`\\b${name}(ga|gacha|kuni)?\\b`).test(low)) {
          const cur = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
          let diff = (wd - cur + 7) % 7;
          if (diff === 0) diff = 7;
          addDays(diff); found = true; break;
        }
      }
    }
  }

  let hh = 18, mi = 0, hasTime = false;
  const tm = low.match(/\b(?:soat\s*)?([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (tm && !(dm && tm.index === dm.index)) { hh = +tm[1]; mi = +tm[2]; hasTime = true; }
  else {
    const sm = low.match(/\bsoat\s*([01]?\d|2[0-3])\b/);
    if (sm) { hh = +sm[1]; mi = 0; hasTime = true; }
  }
  if (hasTime && !found) found = true; // faqat vaqt aytilgan → bugun

  let priority: Priority = "normal";
  if (/\b(zarur|shoshilinch|tezda|tezroq|darhol|srochno|urgent)\b/.test(low)) priority = "urgent";
  else if (/\b(muhim|important)\b/.test(low)) priority = "high";

  return {
    title: text.slice(0, 200),
    due: found ? tashkentToIso(y, m, d, hh, mi) : null,
    priority,
  };
}

export const PRIORITY_UZ: Record<string, string> = { urgent: "zarur", high: "yuqori", normal: "o'rta", low: "past" };

/** Tasdiq kartasi matni (HTML). */
export function renderDraft(assigneeName: string, p: ParsedTask): string {
  const due = p.due ? fmtDue(p.due) : "—";
  return `📝 <b>${escapeHtml(assigneeName)}</b>ga vazifa\n\n${escapeHtml(p.title)}\n\nMuddat: ${due} · Muhimlik: ${PRIORITY_UZ[p.priority] ?? "o'rta"}`;
}

/** Bitta vazifa kartasi (tugmalar bilan yuboriladi). */
export function renderTaskCard(t: TaskRow): string {
  const due = fmtDue(t.due_date);
  const pr = t.priority === "urgent" || t.priority === "high" ? " ❗" : "";
  const st = t.status === "in_progress" ? "▶ " : "";
  return `${st}${escapeHtml(t.title)}${due ? `\n⏰ ${due}` : ""}${pr}`;
}

// ── kunlik hisobot (PR-4) ─────────────────────────────────────────────────

export const REPORT_PROMPT =
  "📝 <b>Kunlik hisobot</b>\n\nBitta xabarda (matn yoki ovoz) yozing:\n" +
  "1) Bugun nima qildingiz?\n2) Muammo yoki to'siq bormi?\n3) Ertaga nima qilasiz?\n\n/cancel — bekor qilish";

export interface ReportParts {
  done: string | null;
  blockers: string | null;
  plan: string | null;
}

/** Saqlangan hisobotni ko'rsatish. AI ajratmagan bo'lsa — asl matn. */
export function renderReport(raw: string, p: ReportParts | null): string {
  if (!p || (!p.done && !p.blockers && !p.plan)) return `📝 ${escapeHtml(raw)}`;
  const lines: string[] = [];
  if (p.done) lines.push(`✅ <b>Bajarildi:</b> ${escapeHtml(p.done)}`);
  if (p.blockers) lines.push(`⚠️ <b>To'siq:</b> ${escapeHtml(p.blockers)}`);
  if (p.plan) lines.push(`🗓 <b>Ertaga:</b> ${escapeHtml(p.plan)}`);
  return lines.join("\n");
}

export interface SummaryRow {
  full_name: string;
  is_linked: boolean;
  has_report: boolean;
  done: string | null;
  blockers: string | null;
  plan: string | null;
  raw_text: string | null;
  completed_today: number;
  overdue: number;
}

const short = (s: string, n = 300) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** 18:15 ownerlarga xulosa. */
export function renderSummary(rows: SummaryRow[], dateStr: string): string {
  const sorted = [...rows].sort((a, b) =>
    Number(b.has_report) - Number(a.has_report) || a.full_name.localeCompare(b.full_name)
  );
  const got = rows.filter((r) => r.has_report).length;
  const out = [`📊 <b>Kunlik hisobotlar — ${dateStr}</b>`, `Topshirdi: ${got} / ${rows.length}`];
  const blockers = rows.filter((r) => r.blockers);
  if (blockers.length) {
    out.push("", "⚠️ <b>To'siqlar</b>");
    for (const r of blockers) out.push(`• ${escapeHtml(r.full_name)}: ${escapeHtml(short(r.blockers!, 200))}`);
  }
  for (const r of sorted) {
    const stats = `bajarilgan vazifa: ${r.completed_today}` + (r.overdue ? ` · kechikkan: ${r.overdue}` : "");
    if (!r.has_report) {
      out.push("", `❌ <b>${escapeHtml(r.full_name)}</b> — hisobot yo'q${r.is_linked ? "" : " (botga ulanmagan)"}`, `   ${stats}`);
      continue;
    }
    out.push("", `✅ <b>${escapeHtml(r.full_name)}</b> — ${stats}`);
    if (r.done || r.plan) {
      if (r.done) out.push(`   Bajardi: ${escapeHtml(short(r.done))}`);
      if (r.plan) out.push(`   Ertaga: ${escapeHtml(short(r.plan, 200))}`);
    } else if (r.raw_text) {
      out.push(`   ${escapeHtml(short(r.raw_text))}`);
    }
  }
  return out.join("\n");
}
