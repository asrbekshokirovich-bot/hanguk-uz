import { assertEquals } from "jsr:@std/assert@1";
import { renderKpiWeekly, runWeeklyKpi } from "./kpi.ts";

const row = (name: string, completed: number, overdue: number, submitted: number, workdays: number, rate: number) => ({
  user_id: name, full_name: name, completed, overdue_now: overdue, reports_submitted: submitted, workdays, report_rate: rate,
});

Deno.test("renderKpiWeekly — bo'sh ro'yxat", () => {
  assertEquals(/bo'sh/.test(renderKpiWeekly([], "2026-10-30", "2026-11-05")), true);
});

Deno.test("renderKpiWeekly — tartib va foiz", () => {
  const text = renderKpiWeekly([row("Ali", 2, 0, 5, 6, 83), row("Vali", 5, 1, 6, 6, 100)], "a", "b");
  // ko'proq bajargan birinchi
  const aliIdx = text.indexOf("Ali");
  const valiIdx = text.indexOf("Vali");
  assertEquals(valiIdx < aliIdx, true);
  assertEquals(/O'rtacha hisobot topshirish: \d+%/.test(text), true);
});

Deno.test("runWeeklyKpi — owner'larga yuboriladi", async () => {
  const sent: { chat: number; text: string }[] = [];
  const deps = {
    db: {
      rpc: async (fn: string) => {
        if (fn === "bot_kpi_weekly") return { data: [row("Ali", 3, 0, 4, 6, 67)], error: null };
        if (fn === "bot_owner_chats") return { data: [{ dm_chat_id: 1 }, { dm_chat_id: 2 }], error: null };
        throw new Error("unexpected " + fn);
      },
    },
    send: async (chat: number, text: string) => { sent.push({ chat, text }); },
  };
  const r = await runWeeklyKpi(deps as any);
  assertEquals(r.staff, 1);
  assertEquals(r.sent, 2);
  assertEquals(sent.length, 2);
});
