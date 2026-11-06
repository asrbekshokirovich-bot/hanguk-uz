// Xodim boti B4-3: KPI paneli (owner uchun). Haftalik (yoki istalgan oraliqdagi) har xodim bo'yicha
// bajarilgan/kechikkan vazifalar va hisobot topshirish foizi. Shanba kuni guruh/DM xulosasi sifatida
// yuborish uchun matn tayyor (runWeeklyKpi) — cron hali ulanmagan (keyingi bosqich), lekin funksiya tayyor.
//
// Migratsiya: 20261106151000_staff_bot_discipline_kpi.sql (bot_kpi_weekly).

import { escapeHtml } from "./core.ts";

export interface KpiRow {
  user_id: string;
  full_name: string;
  completed: number;
  overdue_now: number;
  reports_submitted: number;
  workdays: number;
  report_rate: number;
}

// deno-lint-ignore no-explicit-any
type Db = any;

export interface KpiDeps {
  db: Db;
  send: (chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  from?: string | null;
  to?: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Haftalik KPI matni (owner uchun). */
export function renderKpiWeekly(rows: KpiRow[], from: string, to: string): string {
  if (!rows.length) return `📈 <b>KPI (${from} — ${to})</b>\n\nXodimlar ro'yxati bo'sh.`;
  const sorted = [...rows].sort((a, b) => b.completed - a.completed || a.full_name.localeCompare(b.full_name));
  const lines = [`📈 <b>Haftalik KPI (${from} — ${to})</b>`, ""];
  for (const r of sorted) {
    const overdue = r.overdue_now ? ` · hozir kechikkan: ${r.overdue_now}` : "";
    lines.push(`• <b>${escapeHtml(r.full_name)}</b> — bajarilgan: ${r.completed}${overdue}, hisobot: ${r.reports_submitted}/${r.workdays} (${r.report_rate}%)`);
  }
  const avgRate = Math.round(rows.reduce((s, r) => s + r.report_rate, 0) / rows.length);
  lines.push("", `O'rtacha hisobot topshirish: ${avgRate}%`);
  return lines.join("\n");
}

/** `?action=report&kind=kpi` — owner'larga haftalik KPI. `&from=&to=` (YYYY-MM-DD) bilan oraliqni berish mumkin. */
export async function runWeeklyKpi(deps: KpiDeps): Promise<Record<string, unknown>> {
  const p_from = deps.from && DATE_RE.test(deps.from) ? deps.from : null;
  const p_to = deps.to && DATE_RE.test(deps.to) ? deps.to : null;
  const { data, error } = await deps.db.rpc("bot_kpi_weekly", { p_from, p_to });
  if (error) { console.error("bot_kpi_weekly:", error.message); return { ok: false, error: error.message }; }
  const rows = (data ?? []) as KpiRow[];
  const { data: owners, error: oErr } = await deps.db.rpc("bot_owner_chats");
  if (oErr) console.error("bot_owner_chats:", oErr.message);
  const text = renderKpiWeekly(rows, p_from ?? "oxirgi 7 kun", p_to ?? "kecha");
  let sent = 0;
  for (const o of (owners ?? []) as { dm_chat_id: number }[]) { await deps.send(o.dm_chat_id, text); sent++; }
  return { ok: true, staff: rows.length, sent };
}
