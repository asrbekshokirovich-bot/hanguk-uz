// staff-bot — guruhdan to'liq qabul (reja B2-1): xabar tahriri va reaksiyalar.
//
// - Tahrir (edited_message): staff_group_messages.text yangilanadi, edited_at qo'yiladi. AI qayta tahlil
//   qilmaydi, #vazifa qayta bajarilmaydi. Ovozli xabarda «🎤 …» (eshitilgan matn) saqlanadi, faqat izoh almashadi.
// - Reaksiya (message_reaction; bot guruhda admin bo'lishi va setWebhook allowed_updates'da
//   «message_reaction» bo'lishi kerak): staff_group_reactions'ga (xabar + odam bo'yicha bitta qator,
//   reaksiya olib tashlansa — o'chiriladi). Bot vazifa kartasiga qo'yilgan bo'lsa task_id ham yoziladi.
//   Hozircha faqat saqlanadi (masalan, mas'ulning ✅ reaksiyasi vazifani yopmaydi).
// Rasm: caption bo'lsa u matn sifatida saqlanadi va tahlil qilinadi (index.ts); caption'siz — faqat saqlanadi.

// deno-lint-ignore no-explicit-any
type Any = any;

const MAX_TEXT = 8000;

/** Tahrirdan keyingi matn. Ovozda birinchi qator — «🎤 eshitilgan», qolgani izoh (voiceMessageText). */
export function editedText(old: string | null | undefined, media: string | null | undefined, incoming: string | null | undefined): string | null {
  const next = (incoming ?? "").trim();
  if (media === "voice" && old?.startsWith("🎤")) {
    const heard = old.split("\n")[0];
    return (next ? `${heard}\n${next}` : heard).slice(0, MAX_TEXT);
  }
  return next ? next.slice(0, MAX_TEXT) : null;
}

/** Telegram ReactionType[] → belgilar: emoji o'zi, custom_emoji → «custom:<id>», paid → «⭐». */
export function reactionEmojis(list: unknown): string[] {
  const out: string[] = [];
  for (const r of Array.isArray(list) ? list : []) {
    const x = r as Any;
    const v = x?.type === "emoji" ? x.emoji : x?.type === "custom_emoji" ? `custom:${x.custom_emoji_id}` : x?.type === "paid" ? "⭐" : null;
    if (typeof v === "string" && v && !out.includes(v)) out.push(v);
  }
  return out;
}

export interface IntakeDeps {
  db: Any;
  /** bot_settings.group_chat_id. */
  groupId: () => Promise<string>;
  resolveStaff: (telegramUserId: number) => Promise<{ user_id: string } | null>;
}

/** edited_message: faqat sozlangan guruhdagi, avval saqlangan xabar yangilanadi. true — yangilandi. */
export async function onGroupEdit(deps: IntakeDeps, msg: Any): Promise<boolean> {
  if (!msg?.chat || !["group", "supergroup"].includes(msg.chat.type)) return false;
  if (String(msg.chat.id) !== await deps.groupId() || msg.from?.is_bot) return false;
  const { data: row, error } = await deps.db.from("staff_group_messages").select("text, media")
    .eq("chat_id", msg.chat.id).eq("message_id", msg.message_id).maybeSingle();
  if (error) { console.error("staff_group_messages (edit):", error.message); return false; }
  if (!row) return false; // saqlanmagan (tizim xabari yoki saqlash muddatidan oldingi)
  const text = editedText(row.text, row.media, msg.text ?? msg.caption ?? null);
  if (text === row.text) return false;
  const editedAt = msg.edit_date ? new Date(msg.edit_date * 1000).toISOString() : new Date().toISOString();
  const { error: upErr } = await deps.db.from("staff_group_messages").update({ text, edited_at: editedAt })
    .eq("chat_id", msg.chat.id).eq("message_id", msg.message_id);
  if (upErr) { console.error("staff_group_messages (edit):", upErr.message); return false; }
  return true;
}

/** message_reaction: odamning shu xabardagi joriy reaksiyalari saqlanadi. Natija: saved | removed | ignored. */
export async function onGroupReaction(deps: IntakeDeps, upd: Any): Promise<"saved" | "removed" | "ignored"> {
  const chat = upd?.chat;
  const user = upd?.user;
  if (!chat || !user?.id || user.is_bot || !upd.message_id) return "ignored"; // anonim admin — saqlanmaydi
  if (String(chat.id) !== await deps.groupId()) return "ignored";
  const key = { chat_id: chat.id, message_id: upd.message_id, tg_user_id: user.id };
  const emojis = reactionEmojis(upd.new_reaction);
  if (!emojis.length) {
    const { error } = await deps.db.from("staff_group_reactions").delete()
      .eq("chat_id", key.chat_id).eq("message_id", key.message_id).eq("tg_user_id", key.tg_user_id);
    if (error) console.error("staff_group_reactions:", error.message);
    return "removed";
  }
  const staff = await deps.resolveStaff(user.id);
  const { data: card } = await deps.db.from("bot_group_cards").select("task_id")
    .eq("chat_id", chat.id).eq("message_id", upd.message_id).maybeSingle();
  const { error } = await deps.db.from("staff_group_reactions").upsert({
    ...key, user_id: staff?.user_id ?? null, emojis, task_id: card?.task_id ?? null,
    updated_at: upd.date ? new Date(upd.date * 1000).toISOString() : new Date().toISOString(),
  }, { onConflict: "chat_id,message_id,tg_user_id" });
  if (error) { console.error("staff_group_reactions:", error.message); return "ignored"; }
  return "saved";
}
