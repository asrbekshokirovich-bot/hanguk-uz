// deno test supabase/functions/staff-bot/intake_test.ts — guruhdan qabul (B2-1): tahrir va reaksiya.
import { assertEquals } from "jsr:@std/assert@1";
import { editedText, type IntakeDeps, onGroupEdit, onGroupReaction, reactionEmojis } from "./intake.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

Deno.test("editedText: oddiy matn va rasm izohi almashadi", () => {
  assertEquals(editedText("eski", null, " yangi "), "yangi");
  assertEquals(editedText("eski izoh", "photo", "yangi izoh"), "yangi izoh");
  assertEquals(editedText("eski", null, ""), null);
  assertEquals(editedText(null, null, "x".repeat(9000))?.length, 8000);
});

Deno.test("editedText: ovozda eshitilgan matn saqlanadi, faqat izoh almashadi", () => {
  assertEquals(editedText("🎤 salom\neski izoh", "voice", "yangi izoh"), "🎤 salom\nyangi izoh");
  assertEquals(editedText("🎤 salom\neski izoh", "voice", null), "🎤 salom");
  assertEquals(editedText(null, "voice", "izoh"), "izoh"); // matnga aylanmagan ovoz
});

Deno.test("reactionEmojis: emoji, custom, paid; takrorlar yo'q", () => {
  assertEquals(reactionEmojis([{ type: "emoji", emoji: "👍" }, { type: "emoji", emoji: "👍" }, { type: "custom_emoji", custom_emoji_id: "9" }, { type: "paid" }]),
    ["👍", "custom:9", "⭐"]);
  assertEquals(reactionEmojis(undefined), []);
});

interface Call { table: string; op: string; args: unknown[]; filters: [string, unknown][] }

function fake(respond: (c: Call) => Any = () => ({})) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: "", args: [], filters: [] };
    const done = () => { calls.push(call); return Promise.resolve({ data: null, error: null, ...respond(call) }); };
    const q: Any = {
      select: (...a: unknown[]) => { if (!call.op) { call.op = "select"; call.args = a; } return q; },
      update: (r: unknown) => { call.op = "update"; call.args = [r]; return q; },
      upsert: (r: unknown, o: unknown) => { call.op = "upsert"; call.args = [r, o]; return q; },
      delete: () => { call.op = "delete"; return q; },
      eq: (k: string, v: unknown) => { call.filters.push([k, v]); return q; },
      maybeSingle: done,
      then: (res: Any, rej: Any) => done().then(res, rej),
    };
    return q;
  };
  const deps: IntakeDeps = {
    db: { from },
    groupId: () => Promise.resolve("-100"),
    resolveStaff: (id) => Promise.resolve(id === 7 ? { user_id: "u7" } : null),
  };
  return { deps, calls };
}

const GROUP = { id: -100, type: "supergroup" };

Deno.test("onGroupEdit: saqlangan xabar yangilanadi, edited_at bilan", async () => {
  const t = fake((c) => c.op === "select" ? { data: { text: "eski", media: null } } : {});
  const ok = await onGroupEdit(t.deps, { chat: GROUP, message_id: 5, from: { id: 7 }, text: "yangi", edit_date: 1_700_000_000 });
  assertEquals(ok, true);
  const up = t.calls.find((c) => c.op === "update")!;
  assertEquals(up.args[0], { text: "yangi", edited_at: new Date(1_700_000_000_000).toISOString() });
  assertEquals(up.filters, [["chat_id", -100], ["message_id", 5]]);
});

Deno.test("onGroupEdit: boshqa guruh, DM, saqlanmagan xabar yoki o'zgarmagan matn — hech narsa", async () => {
  const t = fake((c) => c.op === "select" ? { data: null } : {});
  assertEquals(await onGroupEdit(t.deps, { chat: { id: -5, type: "group" }, message_id: 1, text: "x" }), false);
  assertEquals(await onGroupEdit(t.deps, { chat: { id: 7, type: "private" }, message_id: 1, text: "x" }), false);
  assertEquals(await onGroupEdit(t.deps, { chat: GROUP, message_id: 1, from: { id: 7 }, text: "x" }), false);
  const same = fake((c) => c.op === "select" ? { data: { text: "x", media: null } } : {});
  assertEquals(await onGroupEdit(same.deps, { chat: GROUP, message_id: 1, from: { id: 7 }, text: "x" }), false);
  assertEquals(same.calls.filter((c) => c.op === "update"), []);
});

Deno.test("onGroupReaction: 👍 saqlanadi; bot kartasiga bo'lsa task_id bilan", async () => {
  const t = fake((c) => c.table === "bot_group_cards" ? { data: { task_id: "t1" } } : {});
  const r = await onGroupReaction(t.deps, { chat: GROUP, message_id: 9, user: { id: 7 }, date: 1_700_000_000, new_reaction: [{ type: "emoji", emoji: "✅" }] });
  assertEquals(r, "saved");
  const up = t.calls.find((c) => c.op === "upsert")!;
  assertEquals(up.args[0], { chat_id: -100, message_id: 9, tg_user_id: 7, user_id: "u7", emojis: ["✅"], task_id: "t1", updated_at: new Date(1_700_000_000_000).toISOString() });
  assertEquals(up.args[1], { onConflict: "chat_id,message_id,tg_user_id" });
});

Deno.test("onGroupReaction: olib tashlansa o'chiriladi; anonim, bot va boshqa guruh e'tiborsiz", async () => {
  const t = fake();
  assertEquals(await onGroupReaction(t.deps, { chat: GROUP, message_id: 9, user: { id: 8 }, new_reaction: [] }), "removed");
  const del = t.calls.find((c) => c.op === "delete")!;
  assertEquals(del.filters, [["chat_id", -100], ["message_id", 9], ["tg_user_id", 8]]);
  assertEquals(await onGroupReaction(t.deps, { chat: GROUP, message_id: 9, actor_chat: { id: -100 }, new_reaction: [{ type: "emoji", emoji: "👍" }] }), "ignored");
  assertEquals(await onGroupReaction(t.deps, { chat: GROUP, message_id: 9, user: { id: 1, is_bot: true }, new_reaction: [] }), "ignored");
  assertEquals(await onGroupReaction(t.deps, { chat: { id: -1 }, message_id: 9, user: { id: 7 }, new_reaction: [] }), "ignored");
});
