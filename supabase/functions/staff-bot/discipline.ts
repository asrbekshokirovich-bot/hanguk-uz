// Xodim boti B4-2: intizom kuzatuvi. Haftalik jadval (owner uchun, ?action=report&kind=discipline yoki
// 18:15 xulosaga qo'shimcha chaqiriladi) va 2 ish kundan ortiq hisobot topshirmaganlar uchun ownerlarga
// bitta xabar (dublikat yubormaslik uchun report_alerts, notify.ts/task_reminders bilan bir xil andoza).
//
// Migratsiya: 20261106151000_staff_bot_discipline_kpi.sql (bot_report_discipline, bot_report_alert_claim).

import type { DbError } from "./aiops.ts";
import { escapeHtml } from "./core.ts";

export const MISSED_THRESHOLD = 2;

export interface DisciplineRow {
  user_id: string;
  full_name: string;
  dm_chat_id: number | null;
  last_report_date: string | null;
  missed_workdays: number;
}

// deno-lint-ignore no-explicit-any
type Db = any;

export interface DisciplineDeps {
  db: Db;
  send: (chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  /** bot_settings.workdays (notify.ts bilan bir xil format). */
  workdays: () => Promise<string>;
}

/** Haftalik jadval matni (owner uchun). */
export function renderDiscipline(rows: DisciplineRow[]): string {
  if (!rows.length) return "📋 <b>Hisobot intizomi</b>\n\nXodimlar ro'yxati bo'sh.";
  const sorted = [...rows].sort((a, b) => b.missed_workdays - a.missed_workdays || a.full_name.localeCompare(b.full_name));
  const lines = ["📋 <b>Hisobot intizomi</b>", ""];
  for (const r of sorted) {
    const last = r.last_report_date ?? "hech qachon";
    const flag = r.missed_workdays >= MISSED_THRESHOLD ? " 🔴" : r.missed_workdays > 0 ? " 🟡" : " ✅";
    lines.push(`• ${escapeHtml(r.full_name)}${flag} — oxirgi hisobot: ${last}, ${r.missed_workdays} ish kun topshirmagan`);
  }
  return lines.join("\n");
}

/** Owner'larga yuboriladigan qisqa ogohlantirish (bir necha xodim bo'lsa bitta xabarda). */
export function renderMissedAlert(rows: DisciplineRow[]): string {
  const lines = [`⚠️ <b>Hisobot topshirmaganlar (≥ ${MISSED_THRESHOLD} ish kun)</b>`, ""];
  for (const r of rows) {
    const last = r.last_report_date ?? "hech qachon";
    lines.push(`• ${escapeHtml(r.full_name)} — oxirgi hisobot: ${last} (${r.missed_workdays} ish kun)`);
  }
  return lines.join("\n");
}

export function missedRows(rows: DisciplineRow[]): DisciplineRow[] {
  return rows.filter((r) => r.missed_workdays >= MISSED_THRESHOLD);
}

/** `?action=report&kind=discipline` — haftalik jadval owner'larga, va dublikatsiz ogohlantirish. */
export async function runReportDiscipline(deps: DisciplineDeps): Promise<Record<string, unknown>> {
  const workdays = await deps.workdays().catch(() => "");
  const { data, error } = await deps.db.rpc("bot_report_discipline", { p_workdays: workdays });
  if (error) { console.error("bot_report_discipline:", error.message); return { ok: false, error: error.message }; }
  const rows = (data ?? []) as DisciplineRow[];

  const { data: owners, error: oErr } = await deps.db.rpc("bot_owner_chats");
  if (oErr) console.error("bot_owner_chats:", oErr.message);
  const ownerChats = ((owners ?? []) as { dm_chat_id: number }[]).map((o) => o.dm_chat_id);

  let tableSent = 0;
  const table = renderDiscipline(rows);
  for (const chat of ownerChats) { await deps.send(chat, table); tableSent++; }

  const missed = missedRows(rows);
  const toAlert: DisciplineRow[] = [];
  for (const r of missed) {
    const { data: claimed, error: cErr } = await deps.db.rpc("bot_report_alert_claim", { p_user: r.user_id, p_missed: r.missed_workdays });
    if (cErr) { console.error("bot_report_alert_claim:", cErr.message); continue; }
    if (claimed) toAlert.push(r);
  }
  let alerted = 0;
  if (toAlert.length) {
    const text = renderMissedAlert(toAlert);
    for (const chat of ownerChats) { await deps.send(chat, text); alerted++; }
  }
  return { ok: true, staff: rows.length, missed: missed.length, new_alerts: toAlert.length, owners: ownerChats.length, table_sent: tableSent, alert_sent: alerted };
}
