// staff-bot — guruh suhbati tahlili 2.0 (reja B2-2; migratsiya 20261106100000_staff_bot_analysis.sql).
//
// Bitta xabar oldingi 20 ta xabar konteksti (javob bog'lanishi, rasm/ovoz belgisi bilan) va jamoaning
// ochiq vazifalari ro'yxati (ko'pi bilan 40, faqat xodimlarniki, test akkauntlarsiz — bot_analysis_context)
// bilan tahlil qilinadi. AI bir nechta topilma qaytaradi:
//   new_task    — aniq xodimga yangi vazifa berildi;
//   close_task  — ro'yxatdagi ochiq vazifa bajarildi;
//   update_task — ro'yxatdagi vazifaning muddati yoki mas'uli o'zgardi;
//   question    — hamkasbga/jamoaga javob talab qiladigan ish savoli;
//   decision    — qaror yoki qoida e'lon qilindi;
//   none        — hech narsa.
// Har tahlil natijasi (none ham) bot_analyses'ga yoziladi: nima topildi, nega taklif qilindi yoki qilinmadi.
// new_task/close_task avvalgidek bot_proposals'ga (rejim off/shadow/on, ishonch ≥ 0.75, dublikat himoyasi);
// update_task/question/decision hozircha faqat bot_analyses'da (keyingi bosqich).
// AI faqat aiOps.structured("group_analysis") orqali; provayderlar xato bersa ish bot_jobs navbatiga.

import {
  type CtxStaff,
  MIN_CONFIDENCE,
  ON_CONFIDENCE,
  matchStaff,
  parseTaskText,
  type Priority,
  type Proposal,
  renderProposal,
  similarTitle,
} from "./core.ts";
import type { AiAttempt, StructuredArgs, StructuredResult } from "./ai.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

export const HISTORY_LIMIT = 20;
export const TASKS_LIMIT = 40;
export const MAX_FINDINGS = 4;

export const FINDING_KINDS = ["new_task", "close_task", "update_task", "question", "decision", "none"] as const;
export type FindingKind = typeof FINDING_KINDS[number];

/** AI javobidagi bitta topilma (sxema bilan bir xil). */
export interface AiFinding {
  kind: FindingKind;
  confidence: number;
  reason: string;
  /** Xodim ismi yoki @username: new_task/update_task — mas'ul (yangi), question — kimga berilgan savol. */
  assignee: string;
  /** Ochiq vazifalar ro'yxatidagi raqam (1 dan), yo'q bo'lsa 0. */
  task_ref: number;
  title: string;
  due_text: string;
  priority: string;
}

export interface AiResult {
  findings: AiFinding[];
}

export interface AnalysisStaff { user_id: string; name: string; username: string | null }
export interface AnalysisTask {
  id: string;
  title: string;
  assignee: string;
  assignee_name?: string | null;
  created_by?: string | null;
  due_date?: string | null;
  status?: string | null;
}
export interface AnalysisContext { staff: AnalysisStaff[]; tasks: AnalysisTask[] }

export interface HistoryRow {
  message_id: number;
  user_id: string | null;
  text: string | null;
  media: string | null;
  reply_to_message_id: number | null;
}

/** bot_analyses.result ichidagi tozalangan topilma. */
export interface CleanFinding {
  kind: FindingKind;
  confidence: number;
  reason: string;
  task_id: string | null;
  task_title: string | null;
  assignee_user_id: string | null;
  title: string | null;
  due: string | null;
  priority: Priority | null;
  /** Taklif bo'ldimi (bot_proposals). */
  proposed: boolean;
  /** Taklif qilinmagan bo'lsa — nega (new_task/close_task uchun). */
  skip: string | null;
}

export interface Interpreted {
  kinds: FindingKind[];
  confidence: number;
  findings: CleanFinding[];
  /** bot_proposals'ga ketadiganlar: har turdan ko'pi bilan bittasi (eng ishonchlisi). index — findings'dagi o'rni. */
  proposals: { index: number; proposal: Proposal }[];
}

// ── kontekst ──────────────────────────────────────────────────────────────

/** bot_analysis_context javobini tekshirish; vazifalar 40 tadan oshmaydi. */
export function parseContext(data: unknown): AnalysisContext {
  const d = (data ?? {}) as Any;
  const staff = (Array.isArray(d.staff) ? d.staff : [])
    .filter((s: Any) => s && typeof s.user_id === "string")
    .map((s: Any) => ({ user_id: s.user_id, name: String(s.name ?? "—"), username: s.username ?? null }));
  const tasks = (Array.isArray(d.tasks) ? d.tasks : [])
    .filter((t: Any) => t && typeof t.id === "string" && typeof t.assignee === "string")
    .slice(0, TASKS_LIMIT)
    .map((t: Any) => ({
      id: t.id, title: String(t.title ?? ""), assignee: t.assignee, assignee_name: t.assignee_name ?? null,
      created_by: t.created_by ?? null, due_date: t.due_date ?? null, status: t.status ?? null,
    }));
  return { staff, tasks };
}

/** Eski bot_group_context (migratsiya hali qo'llanmagan bo'lsa): har xodim + uning vazifalari → umumiy ro'yxat. */
export function contextFromLegacy(rows: CtxStaff[] | null | undefined): AnalysisContext {
  const staff: AnalysisStaff[] = [];
  const tasks: AnalysisTask[] = [];
  for (const r of rows ?? []) {
    staff.push({ user_id: r.user_id, name: r.name, username: r.username });
    for (const t of r.tasks ?? []) tasks.push({ id: t.id, title: t.title, assignee: r.user_id, assignee_name: r.name });
  }
  return { staff, tasks: tasks.slice(0, TASKS_LIMIT) };
}

/** matchStaff (core.ts) uchun: xodim + uning ro'yxatdagi vazifalari. */
export function ctxStaff(ctx: AnalysisContext): CtxStaff[] {
  return ctx.staff.map((s) => ({
    user_id: s.user_id, name: s.name, username: s.username,
    tasks: ctx.tasks.filter((t) => t.assignee === s.user_id).map((t) => ({ id: t.id, title: t.title })),
  }));
}

// ── so'rov ────────────────────────────────────────────────────────────────

const MEDIA_UZ: Record<string, string> = {
  photo: "rasm", document: "fayl", video: "video", audio: "audio", sticker: "stiker", voice: "ovoz",
};

/** Tarixdagi bitta qator: «[#12 ↩#10] Ism: [rasm] matn». Matnsiz ovoz — «[ovoz, matnga aylanmagan]». */
export function historyLine(row: HistoryRow, names: Map<string, string>): string {
  const who = (row.user_id && names.get(row.user_id)) || "Noma'lum (botga ulanmagan)";
  const head = `[#${row.message_id}${row.reply_to_message_id ? ` ↩#${row.reply_to_message_id}` : ""}]`;
  const text = (row.text ?? "").trim().slice(0, 500);
  const media = row.media ? MEDIA_UZ[row.media] ?? row.media : null;
  let body: string;
  if (row.media === "voice") body = text || "[ovoz, matnga aylanmagan]"; // «🎤 …» matnning o'zida
  else if (media) body = text ? `[${media}] ${text}` : `[${media}]`;
  else body = text;
  return `${head} ${who}: ${body}`;
}

const fmtDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

export function buildPrompt(
  ctx: AnalysisContext,
  history: HistoryRow[],
  target: HistoryRow & { name: string },
  repliedTo: HistoryRow | null,
): string {
  const names = new Map(ctx.staff.map((s) => [s.user_id, s.name]));
  const people = ctx.staff.map((s) => `- ${s.name}${s.username ? ` (@${s.username})` : ""}`).join("\n") || "(yo'q)";
  const tasks = ctx.tasks.map((t, i) => {
    const who = names.get(t.assignee) ?? t.assignee_name ?? "?";
    const due = fmtDate(t.due_date);
    return `${i + 1}. ${t.title} — mas'ul: ${who}${due ? `, muddat ${due}` : ""}${t.status === "in_progress" ? ", boshlangan" : ""}`;
  }).join("\n") || "(ochiq vazifa yo'q)";
  const inHistory = repliedTo && history.some((h) => h.message_id === repliedTo.message_id);
  const replied = repliedTo && !inHistory ? `\n\nJavob berilgan xabar:\n${historyLine(repliedTo, names)}` : "";
  const hist = history.map((h) => historyLine(h, names)).join("\n") || "(yo'q)";
  const t = historyLine({ ...target, text: (target.text ?? "").slice(0, 2000) }, new Map([[target.user_id ?? "", target.name]]));
  return `Xodimlar:\n${people}\n\nOchiq vazifalar (task_ref — shu raqam):\n${tasks}\n\n` +
    `Oldingi xabarlar (eskidan yangiga):\n${hist}${replied}\n\nTAHLIL QILINADIGAN XABAR:\n${t}`;
}

export const ANALYSIS_SYSTEM =
  "You watch the internal Telegram work group of an Uzbek education consulting company (study in Korea). " +
  "Staff write informal Uzbek (Latin, often with typos, no apostrophes), sometimes Russian; forwarded letters from " +
  "Korean universities may be in Korean or English. Analyse ONLY the LAST message, using earlier messages and replies " +
  "(↩#id = reply to message #id) as context. Return findings (usually one; at most 4):\n" +
  "- new_task: the message gives a concrete job to a specific staff member. Typical form: the boss addresses a person " +
  "by first name or @username with an imperative (…-ib qo'y, …-ib ber, tugatib qo'y, aniqlashtir, tekshir, to'xtat, " +
  "yubor, qo'ng'iroq qil), often as a reply to a screenshot/photo or another message — then write the title from " +
  "that context (e.g. 'Rasmdagi mijoz chatini yakunlash'). A reply 'xo'p'/'hop'/'ok' only accepts an earlier task — " +
  "that is none. A person promising to do something themselves ('bugun aniqlashtirib aytaman') is new_task with " +
  "assignee = the author and confidence at most 0.6.\n" +
  "- close_task: the message says an open task from the list is done (e.g. 'tayyor', 'qildim', 'to'landi', " +
  "'yuborildi') and it clearly matches that task; task_ref = its number.\n" +
  "- update_task: the deadline or the responsible person of a listed open task changes; task_ref = its number, " +
  "due_text = new deadline words, assignee = new person (or empty).\n" +
  "- question: a work question to a colleague or the team that needs an answer (e.g. 'X, javob keldimi?', " +
  "'... bo'ladimi?'); assignee = who is asked (empty if the whole team). Greetings, rhetorical '??' alone, and " +
  "answers are not questions.\n" +
  "- decision: a decision, rule or policy for the team (e.g. 'faqat shu tarif ishlaydi, boshqasini aytmang', " +
  "'biz buni qilmaymiz').\n" +
  "- none: chit-chat, greetings, acknowledgements, status/info updates (late to work, payment info, forwarded letters), " +
  "answers to questions, past events. If nothing applies return a single none finding.\n" +
  "Be conservative: when unsure prefer none or a low confidence. Never invent a task_ref — use 0 if no listed task " +
  "clearly matches. assignee: the staff member's name or @username exactly as listed (empty if none). title: short " +
  "imperative task in the message's language, no dates (empty if not new_task). due_text: deadline words from the " +
  "message ('ertaga 15:00', 'bugun', 'juma') or empty. priority: urgent|high|normal|low. confidence 0..1. " +
  "reason: one short sentence in Uzbek.";

export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...FINDING_KINDS] },
          confidence: { type: "number" },
          reason: { type: "string" },
          assignee: { type: "string" },
          task_ref: { type: "integer" },
          title: { type: "string" },
          due_text: { type: "string" },
          priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
        },
        required: ["kind", "confidence", "reason", "assignee", "task_ref", "title", "due_text", "priority"],
      },
    },
  },
  required: ["findings"],
};

// ── natijani tekshirish (sof) ─────────────────────────────────────────────

const clamp01 = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const cleanTitle = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

/**
 * AI javobini tozalab, taklif qilinadiganlarini ajratadi. Vazifa id'si AI'dan emas, berilgan ro'yxatdagi raqamdan
 * olinadi (o'ylab topilgan id bo'lmaydi). Xodim aniq mos kelmasa — taklif yo'q.
 */
export function interpretFindings(ai: AiResult | null, ctx: AnalysisContext, nowMs: number): Interpreted {
  const staff = ctxStaff(ctx);
  const raw = (Array.isArray(ai?.findings) ? ai!.findings : []).slice(0, MAX_FINDINGS);
  const findings: CleanFinding[] = [];
  const proposals: { index: number; proposal: Proposal }[] = [];

  for (const f of raw) {
    if (!f || !FINDING_KINDS.includes(f.kind)) continue;
    const confidence = clamp01(f.confidence);
    const reason = String(f.reason ?? "").slice(0, 300);
    const ref = Math.trunc(Number(f.task_ref) || 0);
    const task = ref >= 1 && ref <= ctx.tasks.length ? ctx.tasks[ref - 1] : null;
    const who = f.assignee ? matchStaff(f.assignee, staff) : null;
    const due = f.due_text?.trim() ? parseTaskText(`x ${f.due_text}`, nowMs).due : null;
    const pr = ["urgent", "high", "normal", "low"].includes(f.priority) ? f.priority as Priority : null;
    const c: CleanFinding = {
      kind: f.kind, confidence, reason, task_id: task?.id ?? null, task_title: task?.title ?? null,
      assignee_user_id: who?.user_id ?? null, title: null, due, priority: pr, proposed: false, skip: null,
    };

    if (f.kind === "new_task") {
      const title = cleanTitle(f.title);
      c.title = title || null;
      if (!who) c.skip = "mas'ul aniqlanmadi";
      else if (title.length < 4) c.skip = "sarlavha yo'q";
      else if (confidence < MIN_CONFIDENCE) c.skip = "ishonch past";
      else if (who.tasks.some((t) => similarTitle(t.title, title))) c.skip = "o'xshash ochiq vazifa bor";
      else {
        const parsed = parseTaskText(`${title} ${f.due_text ?? ""}`, nowMs);
        c.due = parsed.due;
        c.priority = pr ?? parsed.priority;
        c.proposed = true;
        proposals.push({ index: findings.length, proposal: {
          kind: "create", assignee_user_id: who.user_id, assignee_name: who.name, task_id: null, title,
          due: parsed.due, priority: c.priority, confidence, reason,
        } });
      }
    } else if (f.kind === "close_task") {
      if (!task) c.skip = "vazifa ro'yxatda topilmadi";
      else if (confidence < MIN_CONFIDENCE) c.skip = "ishonch past";
      else {
        c.assignee_user_id = task.assignee;
        c.proposed = true;
        const name = ctx.staff.find((s) => s.user_id === task.assignee)?.name ?? task.assignee_name ?? "";
        proposals.push({ index: findings.length, proposal: {
          kind: "close", assignee_user_id: task.assignee, assignee_name: name, task_id: task.id, title: task.title,
          due: null, priority: "normal", confidence, reason,
        } });
      }
    } else if (f.kind === "update_task") {
      if (!task) c.skip = "vazifa ro'yxatda topilmadi";
      else if (confidence < MIN_CONFIDENCE) c.skip = "ishonch past";
      else if (!due) c.skip = "muddat aniqlanmadi"; // B5-1: hozircha faqat muddat o'zgarishi (mas'ul o'zgarishi — qolgan taklif turlari kabi keyingi bosqich)
      else {
        c.proposed = true;
        const name = ctx.staff.find((s) => s.user_id === task.assignee)?.name ?? task.assignee_name ?? "";
        proposals.push({ index: findings.length, proposal: {
          kind: "update", assignee_user_id: task.assignee, assignee_name: name, task_id: task.id, title: task.title,
          due, priority: "normal", confidence, reason,
        } });
      }
    }
    findings.push(c);
  }

  // Har turdan bitta taklif (bot_proposals: chat + xabar + tur yagona) — eng ishonchlisi.
  const best = new Map<string, { index: number; proposal: Proposal }>();
  for (const p of proposals) {
    const cur = best.get(p.proposal.kind);
    if (!cur || p.proposal.confidence > cur.proposal.confidence) best.set(p.proposal.kind, p);
  }
  for (const p of proposals) {
    if (best.get(p.proposal.kind) !== p) { findings[p.index].proposed = false; findings[p.index].skip = "shu turdagi boshqa taklif ishonchliroq"; }
  }

  const real = [...new Set(findings.filter((f) => f.kind !== "none").map((f) => f.kind))];
  return {
    kinds: real.length ? real : ["none"],
    confidence: findings.reduce((m, f) => Math.max(m, f.confidence), 0),
    findings,
    proposals: [...best.values()],
  };
}

/** Javob bergan provayderning modeli (ai_calls bilan bir xil). */
export function okModel(attempts: AiAttempt[] | null | undefined): string | null {
  const ok = (attempts ?? []).filter((a) => a.ok);
  return ok.length ? ok[ok.length - 1].model : null;
}

// ── bajarish ──────────────────────────────────────────────────────────────

export interface AnalysisAuthor { user_id: string; full_name: string }

export interface AnalysisDeps {
  db: Any;
  ai: {
    structured<T>(purpose: string, args: StructuredArgs, jobId?: string | null): Promise<StructuredResult<T>>;
    enqueue(kind: string, key: string, payload: Record<string, unknown>, error: string | null): Promise<string | null>;
  };
  /** bot_settings.group_ai_mode. */
  mode: () => Promise<string>;
  /** Guruhga javob (HTML) — rejim «on» da taklif kartasi. */
  reply: (chatId: number, replyTo: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  now?: () => number;
}

async function loadContext(db: Any): Promise<AnalysisContext | string> {
  const { data, error } = await db.rpc("bot_analysis_context", { p_limit: TASKS_LIMIT });
  if (!error) return parseContext(data);
  // Migratsiya hali qo'llanmagan — eski kontekst
  console.warn("bot_analysis_context:", error.message);
  const { data: old, error: oldErr } = await db.rpc("bot_group_context");
  if (oldErr) return `bot_group_context: ${oldErr.message}`;
  return contextFromLegacy(old as CtxStaff[]);
}

async function loadHistory(db: Any, chatId: number, messageId: number) {
  const cols = "message_id, user_id, text, media, reply_to_message_id";
  const { data: hist } = await db.from("staff_group_messages").select(cols)
    .eq("chat_id", chatId).lt("message_id", messageId)
    .order("message_id", { ascending: false }).limit(HISTORY_LIMIT);
  const history = ((hist ?? []) as HistoryRow[]).reverse();
  const { data: self } = await db.from("staff_group_messages").select(cols)
    .eq("chat_id", chatId).eq("message_id", messageId).maybeSingle();
  const target = (self ?? null) as HistoryRow | null;
  let repliedTo: HistoryRow | null = null;
  const re = target?.reply_to_message_id;
  if (re) {
    repliedTo = history.find((h) => h.message_id === re) ?? null;
    if (!repliedTo) {
      const { data: r } = await db.from("staff_group_messages").select(cols)
        .eq("chat_id", chatId).eq("message_id", re).maybeSingle();
      repliedTo = (r ?? null) as HistoryRow | null;
    }
  }
  return { history, target, repliedTo };
}

/** Taklifni bot_proposals'ga (dublikat himoyasi bilan). Natija: id yoki o'tkazib yuborish sababi. */
async function saveProposal(
  deps: AnalysisDeps, msg: Any, author: AnalysisAuthor, p: Proposal, mode: string,
): Promise<{ id: string } | { skip: string }> {
  const { db } = deps;
  if (p.kind === "close" || p.kind === "update") {
    const { count } = await db.from("bot_proposals").select("id", { count: "exact", head: true })
      .eq("task_id", p.task_id).eq("kind", p.kind).eq("status", "pending");
    if (count) return { skip: p.kind === "close" ? "shu vazifaga yopish taklifi kutilmoqda" : "shu vazifaga muddat taklifi kutilmoqda" };
  } else {
    // Oxirgi 24 soatda shu xodimga o'xshash taklif bo'lgan bo'lsa — takrorlamaymiz.
    const since = new Date((deps.now ?? Date.now)() - 24 * 3600_000).toISOString();
    const { data: recent } = await db.from("bot_proposals").select("title")
      .eq("kind", "create").eq("assignee_user_id", p.assignee_user_id)
      .in("status", ["pending", "shadow", "accepted"]).gte("created_at", since).limit(50);
    if (((recent ?? []) as { title: string }[]).some((r) => similarTitle(r.title, p.title))) {
      return { skip: "24 soat ichida o'xshash taklif bor" };
    }
  }
  // `on` rejimida ham faqat yuqori ishonchli topilma guruhga chiqadi (ON_CONFIDENCE) — qolgani shadow kabi yoziladi.
  const sendCard = mode === "on" && p.confidence >= ON_CONFIDENCE;
  const { data: row, error } = await db.from("bot_proposals").insert({
    chat_id: msg.chat.id, source_message_id: msg.message_id, kind: p.kind,
    author_user_id: author.user_id, assignee_user_id: p.assignee_user_id, task_id: p.task_id,
    title: p.title, due_date: p.due, priority: p.priority, confidence: p.confidence, reason: p.reason,
    mode, status: sendCard ? "pending" : "shadow",
  }).select("id").single();
  if (error || !row) {
    if (error?.code === "23505") return { skip: "bu xabar bo'yicha taklif allaqachon bor" };
    console.error("bot_proposals:", error?.message);
    return { skip: "saqlab bo'lmadi" };
  }
  console.log(`staff-bot: proposal ${p.kind} (${mode}) conf=${p.confidence} for ${p.assignee_name}`);
  if (sendCard) {
    const yesText = p.kind === "close" ? "✅ Ha, bajarildi" : p.kind === "update" ? "✅ Ha, o'zgartirish" : "✅ Yaratish";
    const sent = await deps.reply(msg.chat.id, msg.message_id, renderProposal(p, author.full_name), {
      reply_markup: { inline_keyboard: [[
        { text: yesText, callback_data: `pr:y:${row.id}` },
        { text: "❌ Yo'q", callback_data: `pr:n:${row.id}` },
      ]] },
    });
    const cardId = (sent as Any)?.result?.message_id;
    if (cardId) await db.from("bot_proposals").update({ card_message_id: cardId }).eq("id", row.id);
  }
  return { id: String(row.id) };
}

/**
 * Guruh xabarini tahlil qilish. Provayderlar xato bersa — xato matni qaytadi va (jonli chaqiriqda) ish
 * bot_jobs navbatiga tushadi; navbatdan (jobId bilan) qayta bajarilganda mantiq o'sha.
 */
export async function runGroupAnalysis(
  deps: AnalysisDeps, msg: Any, author: AnalysisAuthor, text: string, jobId: string | null = null,
): Promise<string | undefined> {
  const { db } = deps;
  const mode = (await deps.mode()) || "shadow";
  if (mode === "off") return;

  const ctx = await loadContext(db);
  if (typeof ctx === "string") { console.error(ctx); return ctx; }
  const { history, target, repliedTo } = await loadHistory(db, msg.chat.id, msg.message_id);
  const tgt = {
    message_id: msg.message_id, user_id: author.user_id, name: author.full_name,
    media: target?.media ?? null, reply_to_message_id: target?.reply_to_message_id ?? null,
    text: text.slice(0, 2000),
  };

  const r = await deps.ai.structured<AiResult>("group_analysis", {
    system: ANALYSIS_SYSTEM,
    prompt: buildPrompt(ctx, history, tgt, repliedTo),
    schema: ANALYSIS_SCHEMA,
    temperature: 0,
  }, jobId);
  if (!r.data) {
    // Provayderlar xato berdi (AI «hech narsa yo'q» degani emas) — cron 5 daqiqadan keyin qayta urinadi.
    if (!jobId) {
      await deps.ai.enqueue("group_analysis", `ga:${msg.chat.id}:${msg.message_id}`, {
        chat_id: msg.chat.id, message_id: msg.message_id, date: msg.date ?? null,
        user_id: author.user_id, author_name: author.full_name, text: text.slice(0, 2000),
      }, r.error);
    }
    return r.error ?? "AI xato";
  }

  // Muddat («ertaga 15:00») xabar yozilgan vaqtga nisbatan — navbatdan kechroq bajarilsa ham.
  const it = interpretFindings(r.data, ctx, msg.date ? msg.date * 1000 : (deps.now ?? Date.now)());
  const proposals: { kind: string; id?: string; skip?: string }[] = [];
  for (const { index, proposal } of it.proposals) {
    const res = await saveProposal(deps, msg, author, proposal, mode);
    if ("id" in res) proposals.push({ kind: proposal.kind, id: res.id });
    else {
      proposals.push({ kind: proposal.kind, skip: res.skip });
      it.findings[index].proposed = false;
      it.findings[index].skip = res.skip;
    }
  }

  const { error } = await db.from("bot_analyses").insert({
    chat_id: msg.chat.id, message_id: msg.message_id, user_id: author.user_id,
    provider: r.provider, model: okModel(r.attempts), mode, kinds: it.kinds,
    confidence: Math.round(it.confidence * 1000) / 1000,
    result: { findings: it.findings, proposals, job_id: jobId },
  });
  if (error && error.code !== "23505") console.error("bot_analyses:", error.message);
  console.log(`staff-bot: analysis ${it.kinds.join(",")} via ${r.provider ?? "?"} (${mode})`);
}

