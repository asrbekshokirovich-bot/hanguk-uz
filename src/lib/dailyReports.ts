/**
 * CRM «Kunlik hisobotlar» uchun sof yordamchilar.
 * Baza: crm_daily_reports(p_date) — migratsiya 20261102170000_crm_daily_reports.sql.
 */

export interface DailyReportRow {
  user_id: string;
  full_name: string;
  is_linked: boolean;
  report_id: string | null;
  raw_text: string | null;
  done: string | null;
  blockers: string | null;
  plan: string | null;
  ai_parsed: boolean;
  submitted_at: string | null;
  updated_at: string | null;
  completed_count: number;
}

const TZ_OFFSET_MS = 5 * 60 * 60_000; // Asia/Tashkent, DST yo'q

/** Toshkent bo'yicha sana, YYYY-MM-DD. */
export function tashkentDate(ms = Date.now()): string {
  return new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** YYYY-MM-DD sanani n kunga siljitish. */
export function shiftDate(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/** Yakshanba — hisobot kuni emas. */
export function isWorkday(date: string): boolean {
  return new Date(`${date}T00:00:00Z`).getUTCDay() !== 0;
}

/** Topshirganlar oldin (ism bo'yicha), keyin topshirmaganlar. */
export function sortReports(rows: DailyReportRow[]): DailyReportRow[] {
  return [...rows].sort(
    (a, b) => Number(!!b.report_id) - Number(!!a.report_id) || a.full_name.localeCompare(b.full_name),
  );
}

export function reportStats(rows: DailyReportRow[]) {
  const submitted = rows.filter((r) => r.report_id).length;
  return {
    total: rows.length,
    submitted,
    missing: rows.length - submitted,
    blockers: rows.filter((r) => r.blockers).length,
  };
}

/** Topshirilgan vaqt Toshkent bo'yicha HH:MM. */
export function fmtTime(iso: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t + TZ_OFFSET_MS).toISOString().slice(11, 16);
}

/** Kech topshirildimi (18:00 dan keyin). */
export function isLate(iso: string | null): boolean {
  const hm = fmtTime(iso);
  return hm !== '' && hm >= '18:00';
}
