/**
 * Every month from the season start (or the earliest month with money, if
 * earlier) up to the current month or the season end, whichever comes first,
 * so the investor chart shows a quiet month as zero instead of skipping it.
 */
export interface MonthRow {
  month: string; // YYYY-MM-DD, first of the month
  revenue: number;
  net: number;
}

const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export function fillSeasonMonths(
  rows: { month: string; revenue: number | string; net: number | string }[],
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
  today: Date = new Date(),
): MonthRow[] {
  const byMonth = new Map<string, MonthRow>();
  for (const r of rows) {
    byMonth.set(r.month.slice(0, 7), { month: r.month, revenue: Number(r.revenue), net: Number(r.net) });
  }
  if (!startsOn) return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));

  // Revenue belongs to the semester, not to its dates: money paid before the
  // season opened still counts, so the chart starts at the earliest such month.
  let start = new Date(`${startsOn.slice(0, 7)}-01T00:00:00Z`);
  for (const k of byMonth.keys()) {
    const d = new Date(`${k}-01T00:00:00Z`);
    if (d < start) start = d;
  }
  const todayMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  let last = todayMonth;
  if (endsOn) {
    const end = new Date(`${endsOn.slice(0, 7)}-01T00:00:00Z`);
    if (end < last) last = end;
  }
  // Data outside the window (should not happen) still shows.
  for (const k of byMonth.keys()) {
    const d = new Date(`${k}-01T00:00:00Z`);
    if (d > last) last = d;
  }

  const out: MonthRow[] = [];
  for (let d = new Date(start); d <= last; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const k = key(d);
    out.push(byMonth.get(k) ?? { month: `${k}-01`, revenue: 0, net: 0 });
  }
  return out;
}
