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

export interface MorningBrief {
  new_leads: number;
  my_new_leads: number;
  my_overdue_tasks: number;
  /** Faol mavsum, tekshirilmagan hujjatlar jami (20261105100000). */
  docs_waiting: number;
  /** Shulardan talaba yuklagani. Eski RPC bermasa — undefined. */
  docs_waiting_student?: number;
  /** Shulardan AI tarjima qoralamasi. */
  docs_waiting_ai?: number;
  deadlines: { university: string; date: string; days_left: number; students: number }[];
}

/** "2026-11-11" → "11.11". */
function ddmm(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}` : iso;
}

/**
 * Ertalabki brifing (bot_morning_brief, 20261103160000): yangi lidlar,
 * kechikkan vazifalar, 7 kunlik onlayn ariza muddatlari, kutayotgan
 * hujjatlar. Faqat RPC bergan sonlar; nol bo'lgan qatorlar ko'rsatilmaydi.
 */
export function renderBrief(b: MorningBrief): string {
  const lines: string[] = ["📊 <b>Bugungi brifing</b>"];
  if (b.new_leads > 0) {
    lines.push(`• Yangi lidlar (24 soat): <b>${b.new_leads}</b>${b.my_new_leads > 0 ? `, sizga: <b>${b.my_new_leads}</b>` : ""}`);
  }
  if (b.my_overdue_tasks > 0) lines.push(`• Muddati o'tgan vazifalaringiz: <b>${b.my_overdue_tasks}</b>`);
  if (b.docs_waiting > 0) {
    // Faqat faol mavsum; talaba yuklagani va AI tarjima alohida (2026-11-05).
    const split = b.docs_waiting_student !== undefined && b.docs_waiting_ai !== undefined
      ? ` (talaba yuklagan: ${b.docs_waiting_student}, AI tarjima: ${b.docs_waiting_ai})`
      : "";
    lines.push(`• Tekshiruvni kutayotgan hujjatlar: <b>${b.docs_waiting}</b>${split}`);
  }
  lines.push(...deadlineLines(b.deadlines));
  if (lines.length === 1) lines.push("Hammasi joyida: yangi lid, kechikkan vazifa va yaqin muddat yo'q.");
  return lines.join("\n");
}

function deadlineLines(deadlines: MorningBrief["deadlines"]): string[] {
  if (!deadlines.length) return [];
  const out = ["", "⏰ <b>7 kun ichida onlayn ariza muddati</b>"];
  for (const d of deadlines) {
    const when = d.days_left === 0 ? "bugun" : d.days_left === 1 ? "ertaga" : `${d.days_left} kun`;
    out.push(`• ${escapeHtml(d.university)} — ${ddmm(d.date)} (${when}), talabalar: ${d.students}`);
  }
  return out;
}

// ── Guruhga ertalabki jamoa xulosasi (bot_group_digest, 20261105130000) ──

export interface DigestTask {
  title: string;
  due: string | null;
  kind: "overdue" | "today";
  late_days: number;
  wip: boolean;
  hi: boolean;
}

export interface DigestPerson {
  name: string;
  overdue: number;
  today: number;
  tasks: DigestTask[];
}

export interface GroupDigest {
  date: string;
  /** ISO hafta kuni, 1 = dushanba. */
  weekday: number;
  /** Oxirgi ish kuni (bot_settings.workdays). */
  prev_date: string;
  counts: { open: number; overdue: number; today: number; done: number };
  people: DigestPerson[];
  brief: Omit<MorningBrief, "my_new_leads" | "my_overdue_tasks"> | null;
  /** Oxirgi ish kunidagi kunlik hisobot; hisobot o'chirilgan bo'lsa null. */
  reports: { submitted: number; expected: number; missing?: string[] } | null;
}

export const WEEKDAYS_UZ = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

/** "2026-11-05" → kun raqami (UTC), sanalar ayirmasi uchun. */
function dayNum(iso: string): number {
  return Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / 86_400_000);
}

/** ISO hafta kuni (1–7) sana bo'yicha. */
function isoWeekday(iso: string): number {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z").getUTCDay();
  return d === 0 ? 7 : d;
}

function shortTitle(s: string, max = 80): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

/**
 * Toshkent vaqtida HH:MM. Faqat sana qo'yilgan muddat (Toshkent yoki UTC yarim tuni —
 * CRM sana tanlagichi 00:00 UTC saqlaydi) uchun bo'sh.
 */
function timeOf(iso: string | null): string {
  if (!iso || /T00:00(:00(\.0+)?)?(Z|\+00:00)$/.test(iso)) return "";
  const m = / (\d{2}:\d{2})$/.exec(fmtDue(iso));
  return m ? m[1] : "";
}

function digestTaskLine(t: DigestTask): string {
  const pr = t.hi ? " ❗" : "";
  const wip = t.wip ? " ▶" : "";
  if (t.kind === "overdue") {
    const day = fmtDue(t.due).split(" ")[0];
    return `🔴 ${escapeHtml(shortTitle(t.title))} — ${day}, ${t.late_days} kun kechikdi${pr}${wip}`;
  }
  const time = timeOf(t.due);
  return `🟡 ${escapeHtml(shortTitle(t.title))}${time ? ` — ${time} gacha` : ""}${pr}${wip}`;
}

/**
 * «Staff» guruhiga ertalabki xulosa (HTML). Faqat RPC bergan sonlar;
 * har xodimning kechikkan va bugungi vazifalari hammasi (Asrbek, 2026-11-05).
 * Uzun bo'lsa sendLong satr chegarasida bo'lib yuboradi.
 */
export function renderGroupDigest(d: GroupDigest, maxPerPerson = Infinity): string {
  const lines: string[] = [
    `☀️ <b>Xayrli tong, jamoa!</b> ${WEEKDAYS_UZ[d.weekday] ?? ""}, ${ddmm(d.date)}`.trimEnd(),
    "",
  ];
  const c = d.counts;
  lines.push(`📋 <b>Vazifalar:</b> ochiq ${c.open} · 🔴 kechikkan ${c.overdue} · 🟡 bugun ${c.today}`);
  const yesterday = dayNum(d.date) - dayNum(d.prev_date) === 1;
  const prevLabel = yesterday ? "Kecha" : `${WEEKDAYS_UZ[isoWeekday(d.prev_date)]}dan beri`;
  lines.push(`✅ ${prevLabel} bajarildi: ${c.done}`);

  if (d.people.length) {
    for (const p of d.people) {
      const head = [p.overdue ? `🔴 ${p.overdue}` : "", p.today ? `🟡 ${p.today}` : ""].filter(Boolean).join(" · ");
      lines.push("", `👤 <b>${escapeHtml(p.name)}</b> — ${head}`);
      lines.push(...p.tasks.slice(0, maxPerPerson).map(digestTaskLine));
      if (p.tasks.length > maxPerPerson) lines.push(`… yana ${p.tasks.length - maxPerPerson} ta`);
    }
  } else {
    lines.push("", "Kechikkan va bugungi vazifa yo'q 👍");
  }

  const b = d.brief;
  if (b) {
    const info: string[] = [];
    if (b.new_leads > 0) info.push(`• Yangi lidlar (24 soat): <b>${b.new_leads}</b>`);
    if (b.docs_waiting > 0) {
      const split = b.docs_waiting_student !== undefined && b.docs_waiting_ai !== undefined
        ? ` (talaba yuklagan: ${b.docs_waiting_student}, AI tarjima: ${b.docs_waiting_ai})`
        : "";
      info.push(`• Tekshiruvni kutayotgan hujjatlar: <b>${b.docs_waiting}</b>${split}`);
    }
    if (info.length) lines.push("", "📊 <b>Ish holati</b>", ...info);
    lines.push(...deadlineLines(b.deadlines ?? []));
  }

  if (d.reports && d.reports.expected > 0) {
    const label = yesterday ? "Kechagi" : `${WEEKDAYS_UZ[isoWeekday(d.prev_date)]} kungi`;
    lines.push("", `📝 ${label} kunlik hisobot: <b>${d.reports.submitted}/${d.reports.expected}</b> xodim topshirdi`);
    const missing = d.reports.missing ?? [];
    if (missing.length) lines.push(`Topshirmaganlar: ${missing.map(escapeHtml).join(", ")}`);
  }
  return lines.join("\n");
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

/** /help — to'liq qo'llanma (HTML). */
export const HELP_GUIDE = [
  "📖 <b>Hanguk xodim boti — qo'llanma</b>",
  "",
  `<b>${MENU.tasks}</b>`,
  "Ochiq vazifalaringiz: kechikkan, bugungi, keyingi. Har birida ▶ <i>Boshladim</i> va ✅ <i>Bajardim</i> tugmasi bor — CRM'da ham shu zahoti yangilanadi.",
  "",
  `<b>${MENU.assign}</b>`,
  "Hamkasbni tanlang → vazifani yozing yoki ovozli xabar yuboring → tekshirib ✅ <i>Yaratish</i>.",
  "Muddat va muhimlikni gapning o'zida ayting: «ertaga soat 15:00», «juma», «05.11», «indinga», «zarur», «muhim».",
  "Vazifa olgan odamga darhol xabar boradi; bajarilganda sizga xabar keladi.",
  "",
  `<b>${MENU.report}</b>`,
  "Har ish kuni 17:00 da so'rayman (topshirmasangiz 17:30 va 18:00 da eslataman). Bitta xabarda yozing: bugun nima qildingiz, muammo bormi, ertaga nima qilasiz. Qayta yozsangiz — yangilanadi.",
  "",
  `<b>${MENU.ask}</b>`,
  "Hanguk AI'ga savol: talabalar, lidlar, arizalar, vazifalar, universitetlar. Faqat CRM'da sizga ochiq ma'lumot bo'yicha javob beradi.",
  "",
  "<b>Guruhda</b>",
  "<code>#vazifa @username nima qilish kerak, ertaga 15:00</code> — vazifa beradi (yoki odamning xabariga javob qilib <code>#vazifa matn</code>).",
  "Bot kartasiga mas'ul «✅» yoki «bajarildi» deb javob yozsa — vazifa yopiladi (boshqalar yopa olmaydi; CRM'dan yopish mumkin).",
  "Har ish kuni 09:00 da guruhga jamoa xulosasi chiqadi: kechikkan va bugungi vazifalar, yangi lidlar, hujjatlar, ariza muddatlari.",
  "",
  "<b>Buyruqlar</b>",
  "/bugun — bugungi va kechikkan vazifalar",
  "/cancel — boshlangan amalni bekor qilish",
  "/help — shu qo'llanma",
  "",
  "Har kuni 09:00 da (Du–Sha) kechikkan va bugungi vazifalaringizni yuboraman.",
  "🔔 CRM'da sizga vazifa berilsa yoki muddati o'zgarsa, bergan vazifangiz boshlansa yoki CRM'da yopilsa, muddatga 1 soat qolganda va muddat o'tganda ham yozaman (22:00–08:00 da yozmayman).",
].join("\n");

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

// ── PR-7: guruhdagi aniq buyruqlar ────────────────────────────────────────

export interface TgEntity {
  type: string;
  offset: number;
  length: number;
  user?: { id: number };
}

export interface GroupCommand {
  /** Buyruq va eslatmalardan tozalangan vazifa matni. */
  body: string;
  /** @username'lar (@ siz). */
  usernames: string[];
  /** Username'i yo'q odamlar (text_mention) — Telegram user id. */
  userIds: number[];
}

const CMD_RE = /^\s*(?:#vazifa|\/vazifa(?:@\w+)?)(?=\s|$|[:,.])/i;

/** «#vazifa @diyora apostil ertaga» yoki «/vazifa ...». Buyruq bo'lmasa null. */
export function parseGroupCommand(text: string | null | undefined, entities: TgEntity[] = []): GroupCommand | null {
  if (!text || !CMD_RE.test(text)) return null;
  const usernames: string[] = [];
  const userIds: number[] = [];
  // Eslatmalarni kesish uchun belgilar oralig'i (UTF-16 offset — JS satri bilan bir xil).
  const cut: [number, number][] = [];
  for (const e of entities) {
    if (e.type === "mention") {
      usernames.push(text.substr(e.offset + 1, e.length - 1));
      cut.push([e.offset, e.offset + e.length]);
    } else if (e.type === "text_mention" && e.user) {
      userIds.push(e.user.id);
      cut.push([e.offset, e.offset + e.length]);
    }
  }
  let body = "";
  let pos = 0;
  for (const [a, b] of cut.sort((x, y) => x[0] - y[0])) {
    body += text.slice(pos, a);
    pos = b;
  }
  body += text.slice(pos);
  body = body.replace(CMD_RE, "").replace(/^[\s:,.\-—]+/, "").replace(/\s+/g, " ").trim();
  return { body, usernames, userIds };
}

/** Bot kartasiga javob: vazifa bajarildi deb belgilashmi. */
export function isDoneReply(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim().toLowerCase().replace(/[ʻʼ‘’`]/g, "'");
  if (/^[✅✔️☑️👍+]+$/u.test(t.replace(/\s/g, ""))) return true;
  return /^(✅\s*)?(bajarildi|bajardim|tayyor|qildim|bo'ldi|done|готово|сделано|выполнено)[!.\s]*$/u.test(t);
}

export const GROUP_HELP =
  "Guruhda vazifa berish:\n<code>#vazifa @username nima qilish kerak, ertaga 15:00, zarur</code>\n" +
  "yoki odamning xabariga javob qilib: <code>#vazifa matn</code>\n" +
  "Bajarilganda bot kartasiga «✅» yoki «bajarildi» deb javob yozing.\n" +
  "Har ish kuni ertalab bot shu guruhga jamoa xulosasini yuboradi.";

// ── PR-8: guruh suhbati AI tahlili (faqat taklif) ─────────────────────────

export interface CtxStaff {
  user_id: string;
  name: string;
  username: string | null;
  tasks: { id: string; title: string }[];
}

export interface AiAnalysis {
  action: "none" | "create_task" | "close_task";
  assignee: string; // ism yoki @username
  title: string;
  due_text: string;
  priority: string;
  task_ref: number; // close_task: ochiq vazifalar ro'yxatidagi raqam (1 dan)
  confidence: number;
  reason: string;
}

export interface Proposal {
  kind: "create" | "close";
  assignee_user_id: string;
  assignee_name: string;
  task_id: string | null;
  title: string;
  due: string | null;
  priority: Priority;
  confidence: number;
  reason: string;
}

export const MIN_CONFIDENCE = 0.75;

/** Tahlilga arziydimi: buyruq emas, juda qisqa emas, faqat emoji emas. */
export function shouldAnalyze(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 12 || t.startsWith("/") || /^#vazifa/i.test(t)) return false;
  return /\p{L}{3,}/u.test(t);
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[ʻʼ‘’`']/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/** Ism yoki @username bo'yicha xodimni topish (aniq moslik; noaniq bo'lsa null). */
export function matchStaff(ref: string, staff: CtxStaff[]): CtxStaff | null {
  const r = norm(ref.replace(/^@/, ""));
  if (!r) return null;
  const byUser = staff.filter((s) => s.username && norm(s.username) === r);
  if (byUser.length === 1) return byUser[0];
  const byName = staff.filter((s) => norm(s.name) === r || norm(s.name).split(" ")[0] === r);
  return byName.length === 1 ? byName[0] : null;
}

/** Sarlavhalar deyarli bir xilmi (so'zlar ustma-ust tushishi ≥ 0.7). */
export function similarTitle(a: string, b: string): boolean {
  const wa = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const wb = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return norm(a) === norm(b);
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.min(wa.size, wb.size) >= 0.7;
}

/**
 * AI javobini tekshirib, ishonchli taklifga aylantiradi. Har qanday shubha — null.
 * Vazifa id'si AI'dan emas, berilgan ro'yxatdagi raqamdan olinadi (o'ylab topilgan id bo'lmaydi).
 */
export function interpretAnalysis(ai: AiAnalysis | null, staff: CtxStaff[], nowMs: number): Proposal | null {
  if (!ai || ai.action === "none") return null;
  if (typeof ai.confidence !== "number" || ai.confidence < MIN_CONFIDENCE) return null;
  const who = matchStaff(ai.assignee ?? "", staff);
  if (!who) return null;
  const reason = String(ai.reason ?? "").slice(0, 300);

  if (ai.action === "close_task") {
    const t = who.tasks[Math.trunc(ai.task_ref) - 1];
    if (!t) return null;
    return { kind: "close", assignee_user_id: who.user_id, assignee_name: who.name, task_id: t.id, title: t.title,
      due: null, priority: "normal", confidence: ai.confidence, reason };
  }
  if (ai.action !== "create_task") return null;
  const title = String(ai.title ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (title.length < 4) return null;
  if (who.tasks.some((t) => similarTitle(t.title, title))) return null; // allaqachon bor
  const parsed = parseTaskText(`${title} ${ai.due_text ?? ""}`, nowMs);
  const pr = ["urgent", "high", "normal", "low"].includes(ai.priority) ? ai.priority as Priority : parsed.priority;
  return { kind: "create", assignee_user_id: who.user_id, assignee_name: who.name, task_id: null, title,
    due: parsed.due, priority: pr, confidence: ai.confidence, reason };
}

/** AI uchun so'rov matni. */
export function buildAnalysisPrompt(staff: CtxStaff[], history: { name: string; text: string }[], target: { name: string; text: string }): string {
  const people = staff.map((s) => {
    const tasks = s.tasks.map((t, i) => `    ${i + 1}. ${t.title}`).join("\n") || "    (ochiq vazifa yo'q)";
    return `- ${s.name}${s.username ? ` (@${s.username})` : ""}\n${tasks}`;
  }).join("\n");
  const hist = history.map((m) => `${m.name}: ${m.text}`).join("\n");
  return `Xodimlar va ularning ochiq vazifalari:\n${people}\n\nOldingi xabarlar:\n${hist || "(yo'q)"}\n\nTAHLIL QILINADIGAN XABAR:\n${target.name}: ${target.text}`;
}

export const ANALYSIS_SYSTEM =
  "You watch a Telegram work group of an Uzbek education consulting company (staff write in Uzbek, sometimes Russian). " +
  "Decide if the LAST message clearly (1) assigns a concrete new task to a specific staff member, or (2) says a specific " +
  "existing open task of a staff member is finished. Be conservative: questions, discussions, chit-chat, vague plans, " +
  "past events and tasks someone gives to themselves without a clear owner are action=none. " +
  "assignee: the staff member's name or @username exactly as listed. title: short imperative task in the message's language, " +
  "no dates. due_text: the deadline words from the message (e.g. 'ertaga 15:00') or empty. priority: urgent|high|normal|low. " +
  "task_ref: for close_task, the number of the task in that person's list, else 0. confidence 0..1. reason: one short sentence.";

export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["none", "create_task", "close_task"] },
    assignee: { type: "string" },
    title: { type: "string" },
    due_text: { type: "string" },
    priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
    task_ref: { type: "integer" },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
  required: ["action", "assignee", "title", "due_text", "priority", "task_ref", "confidence", "reason"],
};

/** Guruhdagi taklif kartasi. */
export function renderProposal(p: Proposal, authorName: string): string {
  if (p.kind === "close") {
    return `🤖 <b>Taklif:</b> «${escapeHtml(p.title)}» vazifasi (${escapeHtml(p.assignee_name)}) bajarildimi?\n` +
      `<i>Tasdiqlash: ${escapeHtml(p.assignee_name)}, vazifa bergan yoki owner.</i>`;
  }
  const meta = [p.due ? `muddat ${fmtDue(p.due)}` : "", p.priority !== "normal" ? PRIORITY_UZ[p.priority] : ""].filter(Boolean).join(" · ");
  return `🤖 <b>Taklif:</b> ${escapeHtml(p.assignee_name)} uchun vazifa\n• ${escapeHtml(p.title)}${meta ? `\n${meta}` : ""}\n` +
    `<i>Yaratish uchun ${escapeHtml(authorName)} tasdiqlasin.</i>`;
}

// ── PR-10: Hanguk AI («🤖 Savol») ──────────────────────────────────────────

/** hanguk-ai-chat SSE oqimidan javob matnini yig'ish (hanguk voqealari tashlanadi). */
export function parseAiStream(raw: string): string {
  let out = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const j = JSON.parse(payload);
      const piece = j?.choices?.[0]?.delta?.content;
      if (typeof piece === "string") out += piece;
    } catch { /* qisman qator — tashlanadi */ }
  }
  return out.trim();
}

/** Markdown'ni Telegram oddiy matniga yaqinlashtirish (** va ## belgilarini olib tashlash). */
export function mdToPlain(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)")
    .trim();
}

export const ASK_PROMPT =
  "🤖 <b>Hanguk AI</b>\nSavolingizni yozing yoki ovozli xabar yuboring — talabalar, lidlar, arizalar, vazifalar, universitetlar bo'yicha.\n" +
  "Javobdan keyin yana savol berishingiz mumkin. Chiqish: /cancel yoki menyu tugmasi.";
