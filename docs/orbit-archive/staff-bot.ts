// Orbit staff bot @OrbitFSBOT — Hanguk staff: own tasks, mark done, assign to colleagues.
// Access = one-time invite codes. Staff NEVER see the dashboard, finance, or other businesses.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const HANGUK_SYNC_URL = "https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/orbit-sync";

const json = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { "content-type": "application/json" } });

async function cfg(keys: string[]): Promise<Record<string, string>> {
  const { data } = await db.from("app_config").select("key,value").in("key", keys);
  const out: Record<string, string> = {};
  for (const r of data || []) out[r.key] = r.value;
  return out;
}

async function tg(token: string, method: string, payload: Record<string, unknown>) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    return await r.json();
  } catch (e) { console.error("tg", method, e); return null; }
}

const MENU = {
  keyboard: [[{ text: "\u{1F4CB} Vazifalarim" }], [{ text: "➕ Vazifa berish" }]],
  resize_keyboard: true, is_persistent: true,
};

function firstName(full: string): string { return String(full || "").trim().split(/\s+/)[0] || ""; }
function fmtDue(d: string | null): string {
  if (!d) return "";
  const t = new Date(d);
  return ` ⏰ ${String(t.getDate()).padStart(2, "0")}.${String(t.getMonth() + 1).padStart(2, "0")}`;
}

async function hangukBiz(): Promise<string> {
  const { data } = await db.from("businesses").select("id").eq("slug", "hanguk").single();
  return data!.id;
}

async function myOpenTasks(biz: string, person: { id: string; full_name: string }) {
  const fn = firstName(person.full_name);
  const { data } = await db.from("tasks")
    .select("id,title,due_at,priority,status,source,external_ref,assignee_id,assignee_hint")
    .eq("business_id", biz).in("status", ["open", "in_progress"])
    .or(`assignee_id.eq.${person.id},assignee_hint.ilike.${fn}%`)
    .order("due_at", { ascending: true, nullsFirst: false }).limit(10);
  return data || [];
}

function ownsTask(t: { assignee_id: string | null; assignee_hint: string | null }, person: { id: string; full_name: string }): boolean {
  if (t.assignee_id === person.id) return true;
  const fn = firstName(person.full_name).toLowerCase();
  return !!fn && String(t.assignee_hint || "").toLowerCase().startsWith(fn);
}

async function setState(tgId: number, state: Record<string, unknown> | null) {
  if (!state) { await db.from("staff_bot_state").delete().eq("telegram_id", tgId); return; }
  await db.from("staff_bot_state").upsert({ telegram_id: tgId, state, updated_at: new Date().toISOString() });
}
async function getState(tgId: number): Promise<Record<string, unknown> | null> {
  const { data } = await db.from("staff_bot_state").select("state,updated_at").eq("telegram_id", tgId).maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.updated_at).getTime() > 3600e3) { await setState(tgId, null); return null; }
  return data.state as Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: true });
  const c = await cfg(["staff_bot_token", "staff_bot_webhook_secret", "sync_secret"]);
  if (!c.staff_bot_webhook_secret || req.headers.get("x-telegram-bot-api-secret-token") !== c.staff_bot_webhook_secret) {
    return json({ error: "unauthorized" }, 401);
  }
  const token = c.staff_bot_token;
  let up: Record<string, any> = {};
  try { up = await req.json(); } catch { return json({ ok: true }); }

  try {
    // ---------- CALLBACK QUERIES ----------
    if (up.callback_query) {
      const cb = up.callback_query;
      const tgId = cb.from.id as number;
      const chatId = cb.message?.chat?.id ?? tgId;
      const data = String(cb.data || "");
      const { data: person } = await db.from("people").select("id,full_name,telegram_id").eq("telegram_id", tgId).eq("status", "active").maybeSingle();
      if (!person) {
        await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Avval taklif kodingizni yuboring." });
        return json({ ok: true });
      }
      const biz = await hangukBiz();

      if (data.startsWith("d:")) { // mark done
        const taskId = data.slice(2);
        const { data: t } = await db.from("tasks").select("id,title,status,source,external_ref,assignee_id,assignee_hint").eq("id", taskId).maybeSingle();
        if (!t || !ownsTask(t, person)) {
          await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Vazifa topilmadi." });
          return json({ ok: true });
        }
        if (t.status !== "done") {
          // CRM-native task: set status in Hanguk directly (sync won't push crm_sync rows)
          if (t.source === "crm_sync" && t.external_ref && c.sync_secret) {
            try {
              await fetch(HANGUK_SYNC_URL, {
                method: "POST", headers: { "content-type": "application/json", "x-sync-key": c.sync_secret },
                body: JSON.stringify({ op: "set_status", task_id: t.external_ref, status: "completed" }),
              });
            } catch (e) { console.error("set_status", e); }
            await db.from("tasks").update({ status: "done", synced_status: "done", updated_at: new Date().toISOString() }).eq("id", t.id);
          } else {
            await db.from("tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", t.id);
          }
          await db.from("task_events").insert({ task_id: t.id, actor_id: person.id, kind: "status_changed", payload: { to: "done", via: "staff_bot" } });
          await db.from("audit_log").insert({ actor_id: person.id, actor_telegram_id: tgId, action: "task_done", entity: "task", entity_id: t.id, detail: { via: "staff_bot" } });
        }
        await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "✓ Bajarildi!" });
        await tg(token, "editMessageText", { chat_id: chatId, message_id: cb.message.message_id, text: `✓ ${t.title}` });
        return json({ ok: true });
      }

      if (data.startsWith("a:")) { // colleague chosen
        const pid = data.slice(2);
        const { data: target } = await db.from("people").select("id,full_name").eq("id", pid).eq("status", "active").maybeSingle();
        if (!target) {
          await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Topilmadi." });
          return json({ ok: true });
        }
        await setState(tgId, { awaiting: "task_text", assignee: target.id, assignee_name: target.full_name });
        await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
        await tg(token, "sendMessage", { chat_id: chatId, text: `✍️ ${target.full_name} uchun vazifa matnini yozing:\n(bekor qilish: /cancel)` });
        return json({ ok: true });
      }

      if (data === "x") { // cancel assign
        await setState(tgId, null);
        await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Bekor qilindi." });
        return json({ ok: true });
      }
      await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
      return json({ ok: true });
    }

    // ---------- MESSAGES ----------
    const msg = up.message;
    if (!msg || !msg.from) return json({ ok: true });
    const tgId = msg.from.id as number;
    const chatId = msg.chat.id;
    const text = String(msg.text || "").trim();

    const { data: person } = await db.from("people").select("id,full_name,telegram_id,is_super_owner").eq("telegram_id", tgId).eq("status", "active").maybeSingle();

    // --- Not linked yet: expect invite code ---
    if (!person) {
      const code = text.toUpperCase().replace(/\s+/g, "");
      if (/^ORB-/.test(code)) {
        const { data: match } = await db.from("people").select("id,full_name").eq("invite_code", code).is("telegram_id", null).maybeSingle();
        if (match) {
          await db.from("people").update({ telegram_id: tgId, telegram_username: msg.from.username || null, invite_code: null }).eq("id", match.id);
          await db.from("audit_log").insert({ actor_id: match.id, actor_telegram_id: tgId, action: "staff_linked", entity: "person", entity_id: match.id, detail: { via: "invite_code" } });
          await tg(token, "sendMessage", { chat_id: chatId, text: `✅ Xush kelibsiz, ${match.full_name}!\n\n\u{1F4CB} Vazifalarim — sizga biriktirilgan vazifalar\n➕ Vazifa berish — hamkasbga vazifa biriktirish`, reply_markup: MENU });
          return json({ ok: true });
        }
        await tg(token, "sendMessage", { chat_id: chatId, text: "❌ Kod noto'g'ri yoki allaqachon ishlatilgan. Asrbekdan yangi kod so'rang." });
        return json({ ok: true });
      }
      await tg(token, "sendMessage", { chat_id: chatId, text: "\u{1F511} Botga kirish uchun taklif kodingizni yuboring.\nMasalan: ORB-ISM-1234\nKodni Asrbekdan olasiz." });
      return json({ ok: true });
    }

    const biz = await hangukBiz();
    const st = await getState(tgId);

    // --- Commands / menu ---
    if (text === "/cancel" || text === "Bekor qilish") {
      await setState(tgId, null);
      await tg(token, "sendMessage", { chat_id: chatId, text: "Bekor qilindi.", reply_markup: MENU });
      return json({ ok: true });
    }
    if (text === "/start" || text === "/help") {
      await setState(tgId, null);
      await tg(token, "sendMessage", { chat_id: chatId, text: `Salom, ${firstName(person.full_name)}!\n\n\u{1F4CB} Vazifalarim — sizga biriktirilgan vazifalar ro'yxati (✓ tugmasi bilan bajarildi deb belgilang)\n➕ Vazifa berish — hamkasbingizga vazifa biriktiring\n/cancel — bekor qilish`, reply_markup: MENU });
      return json({ ok: true });
    }

    // --- Awaiting task text for chosen colleague ---
    if (st && st.awaiting === "task_text" && text && !text.startsWith("/") && text !== "\u{1F4CB} Vazifalarim" && text !== "➕ Vazifa berish") {
      const assigneeId = String(st.assignee);
      const assigneeName = String(st.assignee_name || "");
      const title = text.slice(0, 200);
      const { data: ins, error } = await db.from("tasks").insert({
        business_id: biz, title, description: text.length > 200 ? text : null,
        creator_id: person.id, assignee_id: assigneeId, assignee_hint: firstName(assigneeName),
        source: "text", status: "open", priority: "normal",
      }).select("id").single();
      await setState(tgId, null);
      if (error || !ins) {
        await tg(token, "sendMessage", { chat_id: chatId, text: "⚠ Saqlashda xatolik. Qayta urinib ko'ring.", reply_markup: MENU });
        return json({ ok: true });
      }
      await db.from("task_events").insert({ task_id: ins.id, actor_id: person.id, kind: "created", payload: { via: "staff_bot", assignee: assigneeName } });
      await db.from("audit_log").insert({ actor_id: person.id, actor_telegram_id: tgId, action: "task_created", entity: "task", entity_id: ins.id, detail: { via: "staff_bot" } });
      await tg(token, "sendMessage", { chat_id: chatId, text: `✓ Saqlandi — ${assigneeName}ga biriktirildi:\n${title}`, reply_markup: MENU });
      // notify assignee
      const { data: tp } = await db.from("people").select("telegram_id").eq("id", assigneeId).maybeSingle();
      if (tp?.telegram_id && tp.telegram_id !== tgId) {
        await tg(token, "sendMessage", { chat_id: tp.telegram_id, text: `\u{1F195} Yangi vazifa (${firstName(person.full_name)}dan):\n${title}` });
      }
      return json({ ok: true });
    }

    // --- My tasks ---
    if (text === "\u{1F4CB} Vazifalarim" || text === "/tasks") {
      const tasks = await myOpenTasks(biz, person);
      if (!tasks.length) {
        await tg(token, "sendMessage", { chat_id: chatId, text: "✅ Ochiq vazifalaringiz yo'q.", reply_markup: MENU });
        return json({ ok: true });
      }
      await tg(token, "sendMessage", { chat_id: chatId, text: `\u{1F4CB} Sizda ${tasks.length} ta ochiq vazifa:`, reply_markup: MENU });
      for (const t of tasks) {
        const pr = t.priority === "urgent" || t.priority === "high" ? " ❗" : "";
        await tg(token, "sendMessage", {
          chat_id: chatId, text: `▸ ${t.title}${fmtDue(t.due_at)}${pr}`,
          reply_markup: { inline_keyboard: [[{ text: "✓ Bajarildi", callback_data: "d:" + t.id }]] },
        });
      }
      return json({ ok: true });
    }

    // --- Assign to colleague ---
    if (text === "➕ Vazifa berish") {
      const { data: mem } = await db.from("memberships").select("person_id").eq("business_id", biz);
      const ids = (mem || []).map((m) => m.person_id);
      const { data: ppl } = await db.from("people").select("id,full_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).eq("status", "active").order("full_name");
      const rows: Array<Array<{ text: string; callback_data: string }>> = [];
      let row: Array<{ text: string; callback_data: string }> = [];
      for (const p of ppl || []) {
        const label = p.id === person.id ? `${p.full_name} (o'zim)` : p.full_name;
        row.push({ text: label, callback_data: "a:" + p.id });
        if (row.length === 2) { rows.push(row); row = []; }
      }
      if (row.length) rows.push(row);
      rows.push([{ text: "✖ Bekor qilish", callback_data: "x" }]);
      await tg(token, "sendMessage", { chat_id: chatId, text: "Kimga vazifa berasiz?", reply_markup: { inline_keyboard: rows } });
      return json({ ok: true });
    }

    // --- Fallback ---
    await tg(token, "sendMessage", { chat_id: chatId, text: "Tugmalardan foydalaning: \u{1F4CB} Vazifalarim yoki ➕ Vazifa berish", reply_markup: MENU });
    return json({ ok: true });
  } catch (e) {
    console.error("staff-bot error", e);
    return json({ ok: true });
  }
});
