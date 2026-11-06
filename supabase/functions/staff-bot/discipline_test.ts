import { assertEquals } from "jsr:@std/assert@1";
import { missedRows, MISSED_THRESHOLD, renderDiscipline, renderMissedAlert, runReportDiscipline } from "./discipline.ts";

const row = (name: string, missed: number, last: string | null = "2026-11-01") => ({
  user_id: name, full_name: name, dm_chat_id: 1, last_report_date: last, missed_workdays: missed,
});

Deno.test("missedRows — chegaradan oshganlar", () => {
  const rows = [row("A", 0), row("B", 1), row("C", 2), row("D", 3)];
  assertEquals(missedRows(rows).map((r) => r.full_name), ["C", "D"]);
});

Deno.test("MISSED_THRESHOLD = 2", () => {
  assertEquals(MISSED_THRESHOLD, 2);
});

Deno.test("renderDiscipline — bo'sh ro'yxat", () => {
  assertEquals(/bo'sh/.test(renderDiscipline([])), true);
});

Deno.test("renderDiscipline — belgilar", () => {
  const text = renderDiscipline([row("Ali", 3), row("Vali", 0)]);
  assertEquals(/Ali.*🔴/.test(text), true);
  assertEquals(/Vali.*✅/.test(text), true);
});

Deno.test("renderMissedAlert — ismlar chiqadi", () => {
  const text = renderMissedAlert([row("Kimdir", 3)]);
  assertEquals(/Kimdir/.test(text), true);
  assertEquals(/3 ish kun/.test(text), true);
});

Deno.test("runReportDiscipline — jadval ownerlarga, yangi alert faqat band qilinganlarga", async () => {
  const sent: { chat: number; text: string }[] = [];
  const claimed: Record<string, boolean> = { A: true, B: false };
  const deps = {
    db: {
      rpc: async (fn: string, args?: Record<string, unknown>) => {
        if (fn === "bot_report_discipline") return { data: [row("A", 3), row("B", 3), row("C", 0)], error: null };
        if (fn === "bot_owner_chats") return { data: [{ dm_chat_id: 10 }], error: null };
        if (fn === "bot_report_alert_claim") return { data: claimed[(args!.p_user as string)] ?? false, error: null };
        throw new Error("unexpected rpc " + fn);
      },
    },
    send: async (chat: number, text: string) => { sent.push({ chat, text }); },
    workdays: async () => "1,2,3,4,5,6",
  };
  const r = await runReportDiscipline(deps as any);
  assertEquals(r.staff, 3);
  assertEquals(r.missed, 2);
  assertEquals(r.new_alerts, 1);
  // 1 jadval + 1 alert = 2 xabar owner'ga
  assertEquals(sent.length, 2);
  assertEquals(/A/.test(sent[1].text), true);
  assertEquals(/B/.test(sent[1].text), false);
});
