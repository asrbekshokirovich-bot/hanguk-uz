// staff-bot — vazifa kartasiga javob (reja B1-3): izoh, yangi muddat yoki boshqa xodimga o'tkazish.
// Sof funksiyalar (tarmoq/bazasiz), testlari cards_test.ts. Bajarilishi (RPC, xabarlar) — card_actions.ts.
//
// Qoidalar:
//  - vazifa bergan (created_by) yoki owner javobi faqat muddat iborasidan iborat bo'lsa («ertaga 15:00»,
//    «05.11», «juma») — muddat o'zgaradi; faqat bitta @username (yoki username'siz odam eslatmasi) bo'lsa —
//    vazifa o'sha xodimga o'tadi; ikkalasi birga ham mumkin: «@diyora ertaga 15:00»;
//  - qolgan har qanday javob — izoh (CRM «Faollik», task_comments). Izohni mas'ul, bergan va owner qo'shadi;
//  - «✅»/«bajarildi» bu yerga kirmaydi: yopish avvalgidek faqat mas'ulda (bot_set_task_status).
// Muddat parseTaskText (core.ts) bilan hisoblanadi. Matnda boshqa so'z qolsa (masalan «ertaga kelaman»)
// — bu buyruq emas, izoh: shubhali holatda hech narsa jim o'zgarmaydi.

import {
  escapeHtml,
  fmtDue,
  isDoneReply,
  parseGroupCommand,
  parseTaskText,
  renderTaskCard,
  type TaskRow,
  type TgEntity,
} from "./core.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bot kartasining tugmalaridan vazifa id'si (DM'da kartaga javob uchun):
 * td:/ts: — mas'ul kartasi (▶ Boshladim / ✅ Bajardim), tr: — «💬 Javob yozish» (bergan odamga).
 */
export function taskIdFromMarkup(markup: unknown): string | null {
  const rows = (markup as { inline_keyboard?: unknown } | null)?.inline_keyboard;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (const b of row) {
      const data = (b as { callback_data?: unknown } | null)?.callback_data;
      const m = typeof data === "string" ? /^(?:td|ts|tr):(.+)$/.exec(data) : null;
      if (m && UUID_RE.test(m[1])) return m[1];
    }
  }
  return null;
}

/** Bergan odamga boradigan xabar tugmasi: id'ni olib yuradi, bosilsa CARD_HINT ko'rsatiladi. */
export function replyKeyboard(taskId: string) {
  return { inline_keyboard: [[{ text: "💬 Javob yozish", callback_data: `tr:${taskId}` }]] };
}

/** «💬 Javob yozish» bosilganda (answerCallbackQuery, ≤ 200 belgi). */
export const CARD_HINT =
  "Shu xabarga javob (reply) yozing: oddiy matn — izoh; vazifa bergan yoki owner: «ertaga 15:00» — yangi muddat, @username — boshqa xodimga o'tkazish.";

/** Kartaga javob sifatida ko'riladigan matnmi: bo'sh emas, buyruq (/…, #vazifa) va «✅» emas. */
export function isCardReplyText(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t || t.startsWith("/") || isDoneReply(t)) return false;
  return parseGroupCommand(t) === null;
}

export type CardAssignee = { username: string } | { tgUserId: number };

export interface CardIntent {
  /** Izoh matni (asl, chetlari tozalangan). */
  text: string;
  /** Javob faqat muddat (va/yoki @odam) bo'lsa — yangi muddat (UTC ISO), aks holda null. */
  due: string | null;
  /** Javob faqat bitta @odam (va/yoki muddat) bo'lsa — kimga o'tkazish, aks holda null. */
  assignee: CardAssignee | null;
}

/** Botlar (@…bot) — vazifa oluvchi emas, eslatmasi e'tiborsiz. */
const isBotName = (u: string) => /bot$/i.test(u);

/** Eslatmalarni ajratish (UTF-16 offset — JS satri bilan bir xil) va matndan kesish. */
function extractMentions(text: string, entities: TgEntity[]): { people: CardAssignee[]; rest: string } {
  const people: CardAssignee[] = [];
  const cut: [number, number][] = [];
  for (const e of entities ?? []) {
    if (e.type === "mention") {
      const u = text.slice(e.offset + 1, e.offset + e.length);
      if (!isBotName(u)) people.push({ username: u });
      cut.push([e.offset, e.offset + e.length]);
    } else if (e.type === "text_mention" && e.user) {
      people.push({ tgUserId: e.user.id });
      cut.push([e.offset, e.offset + e.length]);
    }
  }
  if (!cut.length) {
    // Entity kelmagan bo'lsa (kam uchraydi) — @username'ni matndan topamiz.
    for (const m of text.matchAll(/(^|[^\w@])@([A-Za-z][A-Za-z0-9_]{4,31})\b/g)) {
      const at = (m.index ?? 0) + m[1].length;
      if (!isBotName(m[2])) people.push({ username: m[2] });
      cut.push([at, at + 1 + m[2].length]);
    }
  }
  let rest = "";
  let pos = 0;
  for (const [a, b] of cut.sort((x, y) => x[0] - y[0])) {
    rest += text.slice(pos, Math.max(pos, a)) + " ";
    pos = Math.max(pos, b);
  }
  rest += text.slice(pos);
  return { people, rest };
}

/** parseTaskText bilan bir xil ko'rinish: kichik harf, apostrof, «15:00gacha» → «15:00 gacha». */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[ʻʼ‘’`]/g, "'")
    .replace(/(\d)(\p{L})/gu, "$1 $2").replace(/(\p{L})(\d)/gu, "$1 $2")
    .replace(/\bertagacha\b/g, "ertaga").replace(/\bindingacha\b/g, "indinga").replace(/\bbugungacha\b/g, "bugun")
    .replace(/\s+/g, " ").trim();
}

const DATE_RE = /\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/g;
const TIME_RE = /\b(?:soat\s*)?(?:[01]?\d|2[0-3])[:.][0-5]\d\b/g;
const SOAT_RE = /\bsoat\s*(?:[01]?\d|2[0-3])\b/g;
const DAY_RE =
  /\b(?:indin(?:ga)?|ertaga|ertangi|bugun|bugungi|(?:dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba)(?:ga|gacha|kuni)?)\b/g;

/**
 * Muddat bo'laklarini olib tashlaydi (parseTaskText qoidalari bilan): kun (sana, ertaga, juma…) va
 * vaqt (15:00, soat 15) soni ham qaytadi — ikkitadan ko'p bo'lsa ibora noaniq.
 */
function stripDue(low: string): { rest: string; days: number; times: number } {
  const dateStarts = new Set([...low.matchAll(DATE_RE)].map((m) => m.index));
  let days = 0, times = 0;
  // «05.11» kabi sanaga o'xshash bo'lak bilan bir joydan boshlangan moslik vaqt emas (core.ts bilan bir xil).
  let rest = low.replace(TIME_RE, (m: string, off: number) => dateStarts.has(off) ? m : (times++, " "));
  rest = rest.replace(DATE_RE, (m: string, d: string, mo: string) =>
    +d >= 1 && +d <= 31 && +mo >= 1 && +mo <= 12 ? (days++, " ") : m);
  rest = rest.replace(SOAT_RE, () => (times++, " "));
  rest = rest.replace(DAY_RE, () => (days++, " "));
  return { rest, days, times };
}

/** Buyruqdagi yordamchi so'zlar: «muddatni … ga o'zgartiring», «@ali ga o'tkazing». */
const FILLER = new Set([
  "muddat", "muddati", "muddatni", "muddatini", "muddatga", "muddatgacha", "srok", "deadline", "dedlayn",
  "gacha", "ga", "da", "dan", "kuni", "kun", "soat", "soatda", "soatga", "qadar", "oldin", "yangi",
  "o'zgartir", "o'zgartiring", "o'zgartirildi", "o'zgartirdim", "o'zgarsin", "o'zgardi",
  "qil", "qiling", "qilib", "qilindi", "qo'y", "qo'ying", "qo'yildi", "qo'ydim", "bo'lsin",
  "belgila", "belgilang", "belgilandi", "sur", "suring", "surildi", "surdim",
  "ko'chir", "ko'chiring", "ko'chirildi", "uzaytir", "uzaytiring", "uzaytirildi", "yangila", "yangilang",
  "o'tkaz", "o'tkazing", "o'tkazildi", "o'tkazdim", "ber", "bering", "berildi", "berdim",
  "topshir", "topshiring", "biriktir", "biriktiring", "biriktirildi", "qilsin", "bajarsin",
  "mas'ul", "masul", "javobgar", "vazifa", "vazifani", "shu", "bu", "uchun", "endi", "iltimos",
]);

function onlyFiller(s: string): boolean {
  for (const w of s.split(/[^\p{L}\p{N}']+/u)) {
    const word = w.replace(/^'+|'+$/g, "");
    if (word && !FILLER.has(word)) return false;
  }
  return true;
}

/** Kartaga javobni ajratish: muddat va/yoki @odam buyrug'imi, yoki oddiy izoh. */
export function parseCardReply(text: string, entities: TgEntity[], nowMs: number): CardIntent {
  const clean = text.trim();
  const { people, rest } = extractMentions(text, entities);
  const low = normalize(rest);
  const s = stripDue(low);
  const pure = s.days <= 1 && s.times <= 1 && people.length <= 1 && onlyFiller(s.rest);
  if (!pure) return { text: clean, due: null, assignee: null };
  const due = s.days || s.times ? parseTaskText(low, nowMs).due : null;
  return { text: clean, due, assignee: people[0] ?? null };
}

export interface CardRole {
  assignee: boolean;
  creator: boolean;
  owner: boolean;
}

export type CardAction =
  | { kind: "manage"; due: string | null; assignee: CardAssignee | null }
  | { kind: "comment"; text: string }
  /** Muddat sifatida o'tib ketgan vaqt yozilgan. */
  | { kind: "past" }
  /** Mas'ul ham, bergan ham, owner ham emas — izoh ham qo'sha olmaydi. */
  | { kind: "denied" };

/** Kim nima qila oladi: muddat va @odam — bergan yoki owner; izoh — mas'ul, bergan yoki owner. */
export function decideCardAction(intent: CardIntent, role: CardRole, nowMs: number): CardAction {
  const canManage = role.creator || role.owner;
  if (canManage && (intent.due || intent.assignee)) {
    if (intent.due && Date.parse(intent.due) <= nowMs) return { kind: "past" };
    return { kind: "manage", due: intent.due, assignee: intent.assignee };
  }
  if (!(role.assignee || canManage) || !intent.text) return { kind: "denied" };
  return { kind: "comment", text: intent.text };
}

/** Izoh kimga boradi: mas'ul ↔ bergan; uchinchi odam (owner) yozsa — ikkalasiga. O'zi chiqariladi. */
export function commentRecipients(actorId: string, assignedTo: string | null, createdBy: string | null): string[] {
  const out = new Set<string>();
  if (actorId === assignedTo) {
    if (createdBy) out.add(createdBy);
  } else if (actorId === createdBy) {
    if (assignedTo) out.add(assignedTo);
  } else {
    if (assignedTo) out.add(assignedTo);
    if (createdBy) out.add(createdBy);
  }
  out.delete(actorId);
  return [...out];
}

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function renderCommentNotice(actor: string, title: string, comment: string): string {
  return `💬 <b>${escapeHtml(actor)}</b> izoh yozdi:\n${escapeHtml(short(comment, 1500))}\n\n📌 ${escapeHtml(title)}`;
}

/** Eski muddat: CRM sana tanlagichi 00:00 UTC saqlaydi — bu «faqat sana», soati ko'rsatilmaydi. */
function oldDueLabel(iso: string | null): string {
  if (!iso) return "—";
  return /T00:00(:00(\.0+)?)?(Z|\+00(:00)?)$/.test(iso) ? fmtDue(iso).split(" ")[0] : fmtDue(iso) || "—";
}

export function renderDueNotice(actor: string, title: string, oldDue: string | null, newDue: string): string {
  return `⏰ <b>${escapeHtml(actor)}</b> muddatni o'zgartirdi: ${oldDueLabel(oldDue)} → <b>${fmtDue(newDue)}</b>\n` +
    `📌 ${escapeHtml(title)}`;
}

export function renderReassignNew(actor: string, card: TaskRow): string {
  return `🔁 <b>${escapeHtml(actor)}</b> vazifani sizga o'tkazdi:\n\n${renderTaskCard(card)}`;
}

export function renderReassignOld(actor: string, newName: string, title: string): string {
  return `🔁 Vazifa <b>${escapeHtml(newName)}</b>ga o'tkazildi (${escapeHtml(actor)}):\n${escapeHtml(title)}`;
}

/** Amalni bajargan odamga qisqa tasdiq. */
export function renderManageDone(r: { newName: string | null; due: string | null; dueError: string | null }): string {
  const lines: string[] = [];
  if (r.newName) lines.push(`🔁 Vazifa <b>${escapeHtml(r.newName)}</b>ga o'tkazildi`);
  if (r.due) lines.push(r.newName ? `⏰ Muddat: <b>${fmtDue(r.due)}</b>` : `⏰ Muddat o'zgardi: <b>${fmtDue(r.due)}</b>`);
  if (r.dueError) lines.push(r.dueError);
  return lines.join("\n");
}

export const COMMENT_ADDED = "💬 Izoh qo'shildi";

/** RPC natijasi (yoki "error") → foydalanuvchiga tushunarli matn. */
export function cardErrorText(result: string, what: "due" | "assignee" | "comment"): string {
  switch (result) {
    case "not_found":
      return "Vazifa topilmadi — o'chirilgan bo'lishi mumkin.";
    case "not_allowed":
      return what === "comment"
        ? "Izohni faqat mas'ul, vazifa bergan yoki owner qo'sha oladi."
        : "Muddat va mas'ulni faqat vazifa bergan yoki owner o'zgartiradi.";
    case "closed":
      return "Vazifa yopilgan — muddat va mas'ulni o'zgartirib bo'lmaydi.";
    case "same":
      return what === "due" ? "Muddat allaqachon shunday." : "Vazifa allaqachon shu xodimda.";
    case "past":
      return "⏰ Bu vaqt o'tib ketgan. Masalan: «ertaga 15:00».";
    case "bad_assignee":
      return "Bu odam xodim emas — vazifani unga o'tkazib bo'lmaydi.";
    default:
      return "Saqlab bo'lmadi, birozdan keyin qayta urinib ko'ring.";
  }
}

/** @username topilmadi (ulanmagan yoki xodim emas). */
export function unknownPersonText(a: CardAssignee): string {
  const who = "username" in a ? `@${escapeHtml(a.username)}` : "Bu odam";
  return `${who} botga ulanmagan yoki xodim emas. Avval CRM → Xodimlar → Telegram orqali ulang.`;
}
