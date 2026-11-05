// staff-bot — bildirishnomalar navbati (B1-1) va muddat nazorati (B1-2).
//
// B1-1: task_events → trigger fn_task_events_notify → bot_notifications (outbox) → darhol
//   net.http_post(?action=notify); zaxira cron staff-bot-notify (har 5 daqiqa, 08:00–21:55).
//   CRM'da berilgan / boshqa odamga o'tkazilgan / muddati o'zgargan / bekor qilingan vazifa — mas'ulga,
//   «▶ Boshladi» (bot yoki CRM) va CRM'da yopilgani — beruvchiga. Bot DM/guruhda bergan va yopgan
//   vazifalar haqida index.ts o'zi darhol yozadi — bu yerda takrorlanmaydi (trigger qoidalari).
// B1-2: cron staff-bot-deadlines (har 15 daqiqa, 08:00–21:45) → ?action=deadlines:
//   due_soon — soati qo'yilgan vazifa 60 daqiqa ichida muddatga yetsa, mas'ulga;
//   overdue — muddat o'tdi (faqat sana bo'lsa — o'sha Toshkent kunining oxiridan keyin): mas'ul va beruvchiga;
//   escalation — 2 kundan ortiq kechikdi (D6): ownerlarga bitta yig'ma xabar.
//   Har biri bir marta: task_reminders(task_id, kind, due_date) — muddat o'zgarsa qayta ishlaydi.
// Tungi soatlar (22:00–08:00 Toshkent) — hech narsa yuborilmaydi, navbat ertalab yuboriladi.
// Sof qismlar (matnlar, tanlash qoidalari) notify_test.ts bilan sinaladi.

import { escapeHtml, fmtDue, renderTaskCard, splitMessage, tashkentDayStart, type TaskRow, TZ_OFFSET_MIN } from "./core.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

export interface SendResult {
  ok: boolean;
  error_code?: number;
  description?: string;
}

export interface NotifyDeps {
  db: Db;
  send: (chatId: number, text: string, extra?: Record<string, unknown>) => Promise<SendResult>;
  /** index.ts'dagi ▶/✅ tugmalari. */
  taskButtons: (t: TaskRow) => unknown;
  now?: () => number;
}

const DAY_MS = 86_400_000;
export const SOON_MS = 60 * 60_000;
export const ESCALATE_MS = 2 * DAY_MS;
/** Navbatda shundan uzoq yotgan xabar eskirgan — yuborilmaydi (masalan, funksiya joylanmay turgan bo'lsa). */
export const STALE_MS = DAY_MS;
export const MAX_ATTEMPTS = 3;
const OPEN = new Set(["todo", "in_progress"]);

// ── umumiy qoidalar ───────────────────────────────────────────────────────

/** 22:00–08:00 Toshkent — xabar yuborilmaydi (D6). */
export function isQuietHours(nowMs: number): boolean {
  const h = new Date(nowMs + TZ_OFFSET_MIN * 60_000).getUTCHours();
  return h >= 22 || h < 8;
}

const isUtcMidnight = (t: number) => t % DAY_MS === 0;
const isTashkentMidnight = (t: number) => (t + TZ_OFFSET_MIN * 60_000) % DAY_MS === 0;

/** Muddatda soat aniq qo'yilganmi. 00:00 UTC (CRM sana tanlagichi) yoki 00:00 Toshkent — faqat sana. */
export function dueHasTime(iso: string | null | undefined): boolean {
  const t = Date.parse(iso ?? "");
  if (Number.isNaN(t)) return false;
  return !isUtcMidnight(t) && !isTashkentMidnight(t);
}

/** Qachondan kechikkan: soatli — muddatning o'zi; faqat sana — o'sha Toshkent kunining oxiri. */
export function overdueAt(iso: string): number {
  const t = Date.parse(iso);
  return dueHasTime(iso) ? t : tashkentDayStart(t) + DAY_MS;
}

/** Ko'rsatish uchun: 00:00 UTC → o'sha sananing 00:00 Toshkent (fmtDue faqat sanani yozadi). */
export function displayDue(iso: string | null): string | null {
  const t = Date.parse(iso ?? "");
  if (Number.isNaN(t)) return iso;
  return isUtcMidnight(t) ? new Date(t - TZ_OFFSET_MIN * 60_000).toISOString() : iso;
}

export const showDue = (iso: string | null) => fmtDue(displayDue(iso));

const dayNum = (ms: number) => Math.floor((ms + TZ_OFFSET_MIN * 60_000) / DAY_MS);

/** Necha kun kechikdi — Toshkent kalendar kunlari (guruh xulosasi bilan bir xil). */
export function lateDays(dueIso: string, nowMs: number): number {
  return Math.max(0, dayNum(nowMs) - dayNum(Date.parse(dueIso)));
}

const name = (s: string | null | undefined) => escapeHtml((s ?? "").trim() || "Kimdir");

function short(s: string, max = 80): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

// ── B1-1: navbat (bot_notifications) ──────────────────────────────────────

export type NotifyKind = "created" | "assigned" | "unassigned" | "started" | "completed" | "cancelled" | "due_changed";

/** bot_notify_claim qatori: navbat + vazifaning hozirgi holati + ismlar. */
export interface OutboxRow {
  id: string;
  kind: NotifyKind;
  recipient: string;
  /** task_events.payload + actor, via. */
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
  dm_chat_id: number | null;
  task_id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  actor_name: string | null;
  assignee_name: string | null;
  /** assigned/unassigned: eski va yangi mas'ul ismi. */
  from_name: string | null;
  to_name: string | null;
}

/** Mas'ulga boradigan, ▶/✅ tugmali karta bilan. */
const CARD_KINDS = new Set<NotifyKind>(["created", "assigned", "due_changed"]);

const cardOf = (t: { task_id?: string; id?: string; title: string; status: string; priority: string; due_date: string | null }): TaskRow => ({
  id: String(t.task_id ?? t.id), title: t.title, status: t.status, priority: t.priority, due_date: displayDue(t.due_date),
});

/** Xabar matni (HTML) va mas'ul uchun karta (tugmalar index.ts'da). */
export function renderOutbox(r: OutboxRow): { text: string; card: TaskRow | null } {
  const actor = name(r.actor_name);
  const title = escapeHtml(r.title);
  const p = r.payload ?? {};
  const actorId = String(p.actor ?? "");
  const card = cardOf(r);
  switch (r.kind) {
    case "created":
      return { text: `🆕 <b>${actor}</b> CRM'da vazifa berdi:\n\n${renderTaskCard(card)}`, card };
    case "assigned":
      return { text: `👤 <b>${actor}</b> vazifani sizga biriktirdi:\n\n${renderTaskCard(card)}`, card };
    case "unassigned": {
      const toId = String(p.to ?? "");
      if (toId && toId === actorId) return { text: `↪️ <b>${actor}</b> vazifani o'ziga oldi:\n${title}`, card: null };
      const to = r.to_name?.trim() ? `, <b>${escapeHtml(r.to_name.trim())}</b>ga berdi` : "";
      return { text: `↪️ <b>${actor}</b> vazifani sizdan oldi${to}:\n${title}`, card: null };
    }
    case "started": {
      const self = !r.assigned_to || r.assigned_to === actorId;
      return {
        text: self
          ? `▶ <b>${actor}</b> vazifani boshladi:\n${title}`
          : `▶ <b>${actor}</b> vazifani «boshlandi» deb belgiladi (mas'ul: <b>${name(r.assignee_name)}</b>):\n${title}`,
        card: null,
      };
    }
    case "completed": {
      const self = !r.assigned_to || r.assigned_to === actorId;
      return { text: `✅ <b>${actor}</b> ${self ? "vazifani bajardi" : "vazifani bajarildi deb belgiladi"}:\n${title}`, card: null };
    }
    case "cancelled":
      return { text: `🚫 <b>${actor}</b> vazifani bekor qildi:\n<s>${title}</s>`, card: null };
    case "due_changed": {
      const from = showDue((p.from as string | null) ?? null);
      const to = showDue((p.to as string | null) ?? null);
      const head = from && to
        ? `⏰ <b>${actor}</b> muddatni o'zgartirdi: ${from} → <b>${to}</b>`
        : to
        ? `⏰ <b>${actor}</b> muddat qo'ydi: <b>${to}</b>`
        : `⏰ <b>${actor}</b> muddatni olib tashladi${from ? ` (edi: ${from})` : ""}`;
      return { text: `${head}\n\n${renderTaskCard(card)}`, card };
    }
  }
  return { text: title, card: null };
}

export type Plan = { action: "send"; text: string; card: TaskRow | null } | { action: "skip"; reason: string };

/** Navbatdagi xabar: yuboriladimi yoki nega o'tkazib yuboriladi. */
export function planOutbox(r: OutboxRow, nowMs: number): Plan {
  if (!r.dm_chat_id) return { action: "skip", reason: "not_linked" };
  if (nowMs - Date.parse(r.created_at) > STALE_MS) return { action: "skip", reason: "stale" };
  // Kartali xabar endi mas'ul bo'lmagan odamga yoki yopilgan vazifa bo'yicha — eskirgan.
  if (CARD_KINDS.has(r.kind) && (!OPEN.has(r.status) || r.assigned_to !== r.recipient)) {
    return { action: "skip", reason: "outdated" };
  }
  return { action: "send", ...renderOutbox(r) };
}

/** Telegram xatosi: vaqtinchalik (429, 5xx, tarmoq) — qayta; aks holda (403 bloklagan, 400) — failed. */
export function failureOutcome(res: SendResult | null | undefined, attempts: number): "retry" | "failed" {
  const code = res?.error_code ?? 0;
  const transient = code === 0 || code === 429 || code >= 500;
  return transient && attempts < MAX_ATTEMPTS ? "retry" : "failed";
}

async function finish(db: Db, id: string, status: "sent" | "skipped" | "failed", error: string | null) {
  const { error: e } = await db.from("bot_notifications").update({
    status, error, claimed_at: null, sent_at: status === "sent" ? new Date().toISOString() : null,
  }).eq("id", id);
  if (e) console.error("bot_notifications update:", e.message);
}

/** ?action=notify — navbatdagi (eng ko'pi 50) xabarni yuborish. */
export async function runNotify(deps: NotifyDeps): Promise<Record<string, unknown>> {
  const now = (deps.now ?? Date.now)();
  if (isQuietHours(now)) return { ok: true, quiet: true };
  const { data, error } = await deps.db.rpc("bot_notify_claim", { p_limit: 50 });
  if (error) {
    console.error("bot_notify_claim:", error.message);
    return { ok: false, error: error.message };
  }
  const c = { sent: 0, skipped: 0, failed: 0, retry: 0 };
  for (const row of (data ?? []) as OutboxRow[]) {
    const plan = planOutbox(row, now);
    if (plan.action === "skip") {
      await finish(deps.db, row.id, "skipped", plan.reason);
      c.skipped++;
      continue;
    }
    const res = await deps.send(row.dm_chat_id!, plan.text, plan.card ? { reply_markup: deps.taskButtons(plan.card) } : {});
    if (res?.ok) {
      await finish(deps.db, row.id, "sent", null);
      c.sent++;
      continue;
    }
    const err = `${res?.error_code ?? "network"}: ${res?.description ?? ""}`.slice(0, 300);
    if (failureOutcome(res, row.attempts) === "retry") {
      // pending qoladi; band (claimed_at) saqlanadi — 5 daqiqadan keyin qayta olinadi (429'da darhol urinmaslik uchun)
      const { error: e } = await deps.db.from("bot_notifications").update({ error: err }).eq("id", row.id);
      if (e) console.error("bot_notifications retry:", e.message);
      c.retry++;
    } else {
      await finish(deps.db, row.id, "failed", err);
      c.failed++;
    }
  }
  if (c.sent || c.skipped || c.failed || c.retry) console.log("staff-bot: notify", JSON.stringify(c));
  return { ok: true, ...c };
}

// ── B1-2: muddat nazorati ─────────────────────────────────────────────────

export type ReminderKind = "due_soon" | "overdue" | "escalation";

/** bot_deadline_candidates qatori. */
export interface DeadlineTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string;
  assigned_to: string | null;
  created_by: string;
  assignee_name: string | null;
  assignee_chat: number | null;
  /** mas'ul xodimmi (test akkauntlar vazifasi ro'yxatga umuman kirmaydi). */
  assignee_ok: boolean;
  creator_name: string | null;
  creator_chat: number | null;
  /** beruvchi xodimmi va test akkaunt emasmi. */
  creator_ok: boolean;
  created_at: string;
  /** Shu muddat uchun allaqachon yozilgan eslatmalar. */
  sent: string[];
}

/**
 * Hozir qaysi eslatmalar kerak (hali yuborilmaganlari). Muddati o'tib bo'lgandan keyin yaratilgan vazifa
 * (eski sana bilan kiritilgan) uchun «muddat o'tdi» yuborilmaydi — beruvchi buni biladi; owner'ga esa
 * yaratilganidan 2 kun o'tib ham ochiq bo'lsa boradi.
 */
export function dueReminders(t: { due_date: string; created_at?: string | null; sent?: string[] | null }, nowMs: number): ReminderKind[] {
  const due = Date.parse(t.due_date);
  if (Number.isNaN(due)) return [];
  const sent = t.sent ?? [];
  const out: ReminderKind[] = [];
  const late = overdueAt(t.due_date);
  const created = Date.parse(t.created_at ?? "") || 0;
  if (nowMs >= late) {
    if (created < late && !sent.includes("overdue")) out.push("overdue");
    if (nowMs >= Math.max(late, created) + ESCALATE_MS && !sent.includes("escalation")) out.push("escalation");
  } else if (dueHasTime(t.due_date) && due > nowMs && due - nowMs <= SOON_MS && !sent.includes("due_soon")) {
    out.push("due_soon");
  }
  return out;
}

export function renderDueSoon(t: DeadlineTask, nowMs: number): string {
  const mins = Math.max(1, Math.ceil((Date.parse(t.due_date) - nowMs) / 60_000));
  const left = mins >= 60 ? "1 soat" : `${mins} daqiqa`;
  return `⏳ <b>Muddatga ${left} qoldi</b>\n\n${renderTaskCard(cardOf(t))}`;
}

export function renderOverdueAssignee(t: DeadlineTask): string {
  return `🔴 <b>Vazifa muddati o'tdi</b>\n\n${renderTaskCard(cardOf(t))}`;
}

export function renderOverdueCreator(t: DeadlineTask): string {
  const who = t.assigned_to ? `Mas'ul: <b>${name(t.assignee_name)}</b>` : "Mas'ul belgilanmagan";
  return `🔴 <b>Siz bergan vazifa muddati o'tdi</b>\n${who}\n\n${escapeHtml(t.title)}\n⏰ ${showDue(t.due_date)}`;
}

/** Owner'ga: o'zi mas'ul bo'lgan vazifalar kirmaydi (ularni overdue xabarida olgan). */
export function escalationFor(ownerId: string, tasks: DeadlineTask[]): DeadlineTask[] {
  return tasks.filter((t) => t.assigned_to !== ownerId);
}

export function renderEscalation(tasks: DeadlineTask[], nowMs: number, max = 30): string {
  const lines = [`🚨 <b>Muddatidan 2 kundan ortiq o'tgan vazifalar: ${tasks.length}</b>`, ""];
  for (const t of tasks.slice(0, max)) {
    const who = t.assigned_to ? name(t.assignee_name) : "mas'ul yo'q";
    lines.push(`• ${escapeHtml(short(t.title))} — <b>${who}</b>, ${showDue(t.due_date)} (${lateDays(t.due_date, nowMs)} kun)`);
  }
  if (tasks.length > max) lines.push(`… yana ${tasks.length - max} ta`);
  lines.push("", "<i>Mas'ul va vazifa bergan odam muddat o'tganda xabar olgan.</i>");
  return lines.join("\n");
}

/** ?action=deadlines — muddat eslatmalari (har biri bir marta). */
export async function runDeadlines(deps: NotifyDeps): Promise<Record<string, unknown>> {
  const now = (deps.now ?? Date.now)();
  if (isQuietHours(now)) return { ok: true, quiet: true };
  const { data, error } = await deps.db.rpc("bot_deadline_candidates");
  if (error) {
    console.error("bot_deadline_candidates:", error.message);
    return { ok: false, error: error.message };
  }
  const tasks = (data ?? []) as DeadlineTask[];
  const wanted = tasks.flatMap((t) => dueReminders(t, now).map((kind) => ({ t, kind })));
  if (!wanted.length) return { ok: true, candidates: tasks.length, claimed: 0, sent: 0 };

  // Atomik band qilish: faqat haqiqatan yangi yozilganlar qaytadi — parallel chaqiruvda ham bir marta.
  const { data: claimed, error: cErr } = await deps.db.from("task_reminders")
    .upsert(wanted.map((w) => ({ task_id: w.t.id, kind: w.kind, due_date: w.t.due_date })),
      { onConflict: "task_id,kind,due_date", ignoreDuplicates: true })
    .select("task_id, kind");
  if (cErr) {
    console.error("task_reminders:", cErr.message);
    return { ok: false, error: cErr.message };
  }
  const got = new Set(((claimed ?? []) as { task_id: string; kind: string }[]).map((r) => `${r.task_id}:${r.kind}`));
  const mine = wanted.filter((w) => got.has(`${w.t.id}:${w.kind}`));

  let sent = 0;
  const deliver = async (chat: number | null, ok: boolean, text: string, card: TaskRow | null) => {
    if (!ok || !chat) return;
    const res = await deps.send(chat, text, card ? { reply_markup: deps.taskButtons(card) } : {});
    if (res?.ok) sent++;
  };
  for (const { t, kind } of mine) {
    const open = OPEN.has(t.status);
    if (kind === "due_soon") {
      await deliver(t.assignee_chat, t.assignee_ok, renderDueSoon(t, now), open ? cardOf(t) : null);
    } else if (kind === "overdue") {
      await deliver(t.assignee_chat, t.assignee_ok, renderOverdueAssignee(t), open ? cardOf(t) : null);
      if (t.created_by !== t.assigned_to) await deliver(t.creator_chat, t.creator_ok, renderOverdueCreator(t), null);
    }
  }

  const esc = mine.filter((w) => w.kind === "escalation").map((w) => w.t);
  let owners = 0;
  if (esc.length) {
    const { data: rows, error: oErr } = await deps.db.rpc("bot_owner_chats");
    if (oErr) console.error("bot_owner_chats:", oErr.message);
    for (const o of (rows ?? []) as { user_id: string; dm_chat_id: number }[]) {
      const list = escalationFor(o.user_id, esc);
      if (!list.length || !o.dm_chat_id) continue;
      for (const part of splitMessage(renderEscalation(list, now))) await deps.send(o.dm_chat_id, part);
      owners++;
    }
  }
  const result = { ok: true, candidates: tasks.length, claimed: mine.length, sent, escalated: esc.length, owners };
  console.log("staff-bot: deadlines", JSON.stringify(result));
  return result;
}
