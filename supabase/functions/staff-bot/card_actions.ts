// staff-bot — vazifa kartasiga javobni bajarish (reja B1-3). Ajratish qoidalari — cards.ts (sof).
//
// Guruh: bot kartasiga (bot_group_cards) javob; DM: bot yuborgan vazifa kartasiga javob — vazifa id'si
// kartaning tugmalaridan (td:/ts:/tr:) olinadi. O'zgarishlar faqat SECURITY DEFINER RPC'lar orqali
// (migratsiya 20261106062000): bot_set_task_due, bot_reassign_task, bot_add_task_comment. Ular ruxsatni
// qayta tekshiradi va app.task_via / app.task_actor qo'yadi — task_events'da via = dm|group, aktor = xodim.
// Izoh CRM'dagi vazifa panelining «Faollik» bo'limida ko'rinadi (task_comments, muallif = xodim).
//
// Xabarlar: izoh → ikkinchi tomonga (mas'ul ↔ bergan; owner yozsa ikkalasiga); muddat → mas'ulga;
// boshqa xodimga o'tkazilsa → yangi mas'ulga karta (▶/✅) va eski mas'ulga.

import { type TaskRow, type TgEntity } from "./core.ts";
import {
  cardErrorText,
  COMMENT_ADDED,
  commentRecipients,
  type CardAssignee,
  decideCardAction,
  isCardReplyText,
  parseCardReply,
  renderCommentNotice,
  renderDueNotice,
  renderManageDone,
  renderReassignNew,
  renderReassignOld,
  replyKeyboard,
  taskIdFromMarkup,
  unknownPersonText,
} from "./cards.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

export interface CardDeps {
  db: Any;
  /** Foydalanuvchi xabariga javob (shu chatda, HTML). */
  reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  /** Xodimga DM (ulanmagan bo'lsa jim). */
  notifyUser: (userId: string, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  /** Mas'ul kartasining tugmalari (▶ Boshladim / ✅ Bajardim) — index.ts'dagi taskButtons. */
  taskButtons: (t: TaskRow) => unknown;
  /** Username'siz odam eslatmasi (text_mention) → xodim. */
  resolveStaff: (telegramUserId: number) => Promise<{ user_id: string; full_name: string } | null>;
  now?: () => number;
}

export interface CardActor {
  user_id: string;
  full_name: string;
  roles?: string[];
}

export interface CardReply {
  taskId: string;
  staff: CardActor;
  text: string;
  entities?: TgEntity[];
  via: "dm" | "group";
}

/** manage — muddat/mas'ul (yoki shunga urinish), comment — izoh, denied — ruxsat yo'q, error — xato. */
export type CardOutcome = "manage" | "comment" | "denied" | "error";

interface TaskInfo {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
}

const isOpen = (status: string) => status === "todo" || status === "in_progress";

async function rpcRow<T>(db: Any, fn: string, args: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    console.error(`${fn}:`, error.message);
    return null;
  }
  return ((Array.isArray(data) ? data[0] : data) ?? null) as T | null;
}

async function personOf(d: CardDeps, a: CardAssignee): Promise<{ user_id: string; full_name: string } | null> {
  if ("tgUserId" in a) return await d.resolveStaff(a.tgUserId);
  return await rpcRow<{ user_id: string; full_name: string }>(d.db, "bot_resolve_username", { p_username: a.username });
}

/** Kartaga javob: vazifani o'qiydi, kimligiga qarab izoh/muddat/@odam bajaradi va xabar beradi. */
export async function handleCardReply(d: CardDeps, r: CardReply): Promise<CardOutcome> {
  const now = d.now?.() ?? Date.now();
  const { data: task, error } = await d.db.from("tasks")
    .select("id, title, status, priority, due_date, assigned_to, created_by")
    .eq("id", r.taskId).maybeSingle();
  if (error) {
    console.error("card task:", error.message);
    await d.reply(cardErrorText("error", "comment"));
    return "error";
  }
  if (!task) {
    await d.reply(cardErrorText("not_found", "comment"));
    return "error";
  }
  const t = task as TaskInfo;
  const role = {
    assignee: t.assigned_to === r.staff.user_id,
    creator: t.created_by === r.staff.user_id,
    owner: !!r.staff.roles?.includes("owner"),
  };
  const action = decideCardAction(parseCardReply(r.text, r.entities ?? [], now), role, now);
  switch (action.kind) {
    case "denied":
      // Guruhda bu oddiy suhbat bo'lib qoladi (chaqiruvchi davom ettiradi); DM'da tushuntiramiz.
      if (r.via === "dm") await d.reply(cardErrorText("not_allowed", "comment"));
      return "denied";
    case "past":
      await d.reply(cardErrorText("past", "due"));
      return "manage";
    case "comment":
      return await addComment(d, r, action.text);
    case "manage":
      return await manage(d, r, t, action.due, action.assignee);
  }
}

interface CommentRow {
  result: string;
  title: string;
  created_by: string | null;
  assigned_to: string | null;
  status: string;
  priority: string;
  due_date: string | null;
}

async function addComment(d: CardDeps, r: CardReply, text: string): Promise<CardOutcome> {
  const res = await rpcRow<CommentRow>(d.db, "bot_add_task_comment", {
    p_actor: r.staff.user_id, p_task: r.taskId, p_content: text, p_via: r.via,
  });
  if (!res || res.result !== "ok") {
    const code = res?.result ?? "error";
    if (code === "not_allowed" && r.via === "group") return "denied";
    await d.reply(cardErrorText(code, "comment"));
    return code === "not_allowed" ? "denied" : "error";
  }
  await d.reply(COMMENT_ADDED);
  const card: TaskRow = { id: r.taskId, title: res.title, status: res.status, priority: res.priority, due_date: res.due_date };
  for (const uid of commentRecipients(r.staff.user_id, res.assigned_to, res.created_by)) {
    // Mas'ulga — ochiq vazifa kartasi tugmalari, bergan odamga — «💬 Javob yozish» (javobi ham izoh bo'ladi).
    const kb = uid === res.assigned_to && isOpen(res.status) ? d.taskButtons(card) : replyKeyboard(r.taskId);
    await d.notifyUser(uid, renderCommentNotice(r.staff.full_name, res.title, text), { reply_markup: kb });
  }
  return "comment";
}

interface ReassignRow {
  result: string;
  title: string;
  created_by: string | null;
  old_assignee: string | null;
  new_assignee: string | null;
  status: string;
  priority: string;
  due_date: string | null;
}

interface DueRow {
  result: string;
  title: string;
  created_by: string | null;
  assigned_to: string | null;
  status: string;
  priority: string;
  old_due: string | null;
  new_due: string | null;
}

async function manage(
  d: CardDeps, r: CardReply, t: TaskInfo, due: string | null, who: CardAssignee | null,
): Promise<CardOutcome> {
  const actor = r.staff;
  let moved: { res: ReassignRow; name: string } | null = null;

  if (who) {
    const person = await personOf(d, who);
    if (!person) {
      await d.reply(unknownPersonText(who));
      return "manage";
    }
    const res = await rpcRow<ReassignRow>(d.db, "bot_reassign_task", {
      p_actor: actor.user_id, p_task: t.id, p_assignee: person.user_id, p_via: r.via,
    });
    if (res?.result === "ok") moved = { res, name: person.full_name };
    else if (!(res?.result === "same" && due)) {
      // «@o'sha_odam ertaga 15:00» — mas'ul allaqachon shu odam bo'lsa, faqat muddat o'zgaradi
      await d.reply(cardErrorText(res?.result ?? "error", "assignee"));
      return "manage";
    }
  }

  let newDue: string | null = null;
  let dueError: string | null = null;
  let oldDue = t.due_date;
  if (due) {
    const res = await rpcRow<DueRow>(d.db, "bot_set_task_due", {
      p_actor: actor.user_id, p_task: t.id, p_due: due, p_via: r.via,
    });
    if (res?.result === "ok") {
      newDue = res.new_due ?? due;
      oldDue = res.old_due;
    } else if (!moved || res?.result !== "same") {
      dueError = cardErrorText(res?.result ?? "error", "due");
    }
    if (!moved && !newDue) {
      await d.reply(dueError ?? cardErrorText("error", "due"));
      return "manage";
    }
  }

  await d.reply(renderManageDone({ newName: moved?.name ?? null, due: newDue, dueError }));

  if (moved) {
    const m = moved.res;
    const card: TaskRow = {
      id: t.id, title: m.title, status: m.status, priority: m.priority, due_date: newDue ?? m.due_date,
    };
    if (m.new_assignee && m.new_assignee !== actor.user_id) {
      await d.notifyUser(m.new_assignee, renderReassignNew(actor.full_name, card),
        isOpen(card.status) ? { reply_markup: d.taskButtons(card) } : {});
    }
    if (m.old_assignee && m.old_assignee !== actor.user_id && m.old_assignee !== m.new_assignee) {
      await d.notifyUser(m.old_assignee, renderReassignOld(actor.full_name, moved.name, m.title));
    }
  } else if (newDue && t.assigned_to && t.assigned_to !== actor.user_id) {
    const card: TaskRow = { id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: newDue };
    await d.notifyUser(t.assigned_to, renderDueNotice(actor.full_name, t.title, oldDue, newDue),
      isOpen(t.status) ? { reply_markup: d.taskButtons(card) } : {});
  }
  return "manage";
}

/**
 * Guruh: bot kartasiga (bot_group_cards) «✅» bo'lmagan javob. Amal bajarilsa — saqlash uchun
 * { taskId, kind }; karta bo'lmasa, matn buyruq bo'lsa yoki xodimning izohga ham ruxsati yo'q bo'lsa —
 * null (xabar oddiy guruh xabari sifatida davom etadi: saqlanadi va tahlil qilinadi).
 */
export async function groupCardReply(
  d: CardDeps, msg: Any, staff: CardActor,
): Promise<{ taskId: string; kind: "message" | "command" } | null> {
  const text: string = msg.text ?? msg.caption ?? "";
  const replyTo = msg.reply_to_message;
  if (!replyTo?.from?.is_bot || !isCardReplyText(text)) return null;
  const { data: card, error } = await d.db.from("bot_group_cards").select("task_id")
    .eq("chat_id", msg.chat.id).eq("message_id", replyTo.message_id).maybeSingle();
  if (error) console.error("bot_group_cards:", error.message);
  if (!card?.task_id) return null;
  const out = await handleCardReply(d, {
    taskId: String(card.task_id), staff, text, entities: msg.entities ?? msg.caption_entities ?? [], via: "group",
  });
  if (out === "denied") return null;
  return { taskId: String(card.task_id), kind: out === "manage" ? "command" : "message" };
}

/** DM: bot yuborgan vazifa kartasiga javob. Karta bo'lmasa false (oddiy DM oqimi davom etadi). */
export async function dmCardReply(d: CardDeps, msg: Any, staff: CardActor): Promise<boolean> {
  const text: string = msg.text ?? msg.caption ?? "";
  const replyTo = msg.reply_to_message;
  if (!replyTo?.from?.is_bot || !isCardReplyText(text)) return false;
  const taskId = taskIdFromMarkup(replyTo.reply_markup);
  if (!taskId) return false;
  await handleCardReply(d, { taskId, staff, text, entities: msg.entities ?? msg.caption_entities ?? [], via: "dm" });
  return true;
}
