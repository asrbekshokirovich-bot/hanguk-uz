import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { fieldClass } from './FilterControls';
import {
  FUNNEL_LABELS,
  adTotals,
  formatPct,
  parseSpend,
  spendKey,
  type AdRow,
  type FunnelRow,
  type GenerationStats,
  type LostShare,
} from './reportMath';

/** A plain CSS bar: the number is always printed next to it, the bar is decoration. */
export function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <span className={cn('block h-full rounded-full bg-primary', className)} style={{ width: `${w}%` }} />
    </span>
  );
}

export function Panel({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-md border bg-background', className)}>
      <header className="border-b px-3 py-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Tile({ label, value, sub, strong }: { label: string; value: string | number; sub?: string; strong?: boolean }) {
  return (
    <div data-testid={`tile-${label}`} className={cn('rounded-md border bg-background px-3 py-2.5', strong && 'border-primary/40 bg-primary/5')}>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 font-semibold leading-none tabular-nums', strong ? 'text-3xl' : 'text-2xl')}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-4 text-center text-[13px] text-muted-foreground">{children}</p>;

// ---- funnel -------------------------------------------------------------------

export function FunnelTable({ rows, total, sourceLabel }: { rows: FunnelRow[]; total: FunnelRow; sourceLabel: (s: string) => string }) {
  if (rows.length === 0) return <Empty>Bu davrda lid yo'q</Empty>;
  const keys = total.steps.map((s) => s.key);
  const all = [total, ...rows];
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[720px] text-[13px]" aria-label="Manba bo'yicha voronka">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-2 py-1.5 font-semibold">
              Manba
            </th>
            {keys.map((k) => (
              <th key={k} scope="col" className="px-2 py-1.5 font-semibold">
                {FUNNEL_LABELS[k]}
              </th>
            ))}
            <th scope="col" className="px-2 py-1.5 text-right font-semibold">
              Konversiya
            </th>
          </tr>
        </thead>
        <tbody>
          {all.map((r, i) => (
            <tr key={r.source} className={cn('border-t align-top', i === 0 && 'bg-muted/40 font-medium')}>
              <th scope="row" className="px-2 py-1.5 text-left font-medium">
                {i === 0 ? r.source : sourceLabel(r.source)}
              </th>
              {r.steps.map((s) => (
                <td key={s.key} className="min-w-[5.5rem] px-2 py-1.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="tabular-nums">{s.count}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{s.key === 'leads' ? '' : formatPct(s.pct)}</span>
                  </div>
                  <Bar value={s.count} max={r.leads} className={s.key === 'students' ? 'bg-success' : undefined} />
                </td>
              ))}
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatPct(r.conversion, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- ads ----------------------------------------------------------------------

const fmtMoney = (n: number | null): string => (n == null ? '—' : Math.round(n).toLocaleString('ru-RU'));

interface AdTableProps {
  rows: AdRow[];
  from: string;
  to: string;
  onSpend: (key: string, value: number | null) => void;
}

/** lid · shartnoma · konversiya · sarf (typed) · shartnoma narxi (computed). */
export function AdTable({ rows, from, to, onSpend }: AdTableProps) {
  // what is typed, so "1 200" is not reformatted under the cursor
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (rows.length === 0) return <Empty>Bu davrda reklama / forma bilan kelgan lid yo'q</Empty>;
  const totals = adTotals(rows);
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[640px] text-[13px]" aria-label="Reklama samarasi">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-2 py-1.5 font-semibold">
              Reklama / forma
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-semibold">
              Lid
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-semibold">
              Shartnoma
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-semibold">
              Konversiya
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-semibold">
              Sarf (qo'lda)
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-semibold">
              Shartnoma narxi
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const key = spendKey(from, to, r.ad);
            const value = drafts[key] ?? (r.spend != null ? String(r.spend) : '');
            return (
              <tr key={r.ad} className="border-t">
                <th scope="row" className="max-w-[16rem] truncate px-2 py-1.5 text-left font-medium" title={r.ad}>
                  {r.ad}
                </th>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.leads}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.students}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatPct(r.conversion, 1)}</td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    inputMode="decimal"
                    aria-label={`Sarf: ${r.ad}`}
                    placeholder="0"
                    value={value}
                    onChange={(e) => {
                      const text = e.target.value;
                      setDrafts((d) => ({ ...d, [key]: text }));
                      onSpend(key, parseSpend(text));
                    }}
                    className={cn(fieldClass, 'w-28 text-right tabular-nums')}
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums" data-testid={`cpc-${r.ad}`}>
                  {fmtMoney(r.costPerContract)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40 text-[12px]">
            <th scope="row" className="px-2 py-1.5 text-left font-medium">
              Sarf kiritilganlar bo'yicha
            </th>
            <td />
            <td className="px-2 py-1.5 text-right tabular-nums">{totals.students}</td>
            <td />
            <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(totals.spend)}</td>
            <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{fmtMoney(totals.costPerContract)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Sarf shu davr uchun shu brauzerda saqlanadi (Meta kabinetidagi summani yozing). Shartnoma narxi = sarf ÷ shartnoma.
      </p>
    </div>
  );
}

// ---- lost / operators ----------------------------------------------------------

export function LostBars({ shares }: { shares: LostShare[] }) {
  if (shares.length === 0) return <Empty>Bu davrda yo'qotilgan lid yo'q</Empty>;
  const max = Math.max(...shares.map((s) => s.n));
  return (
    <ul className="space-y-2" aria-label="Yo'qotish sabablari">
      {shares.map((s) => (
        <li key={s.reason ?? 'none'} className="grid grid-cols-[minmax(0,12rem)_1fr_6.5rem] items-center gap-3 text-[13px]">
          <span className="truncate" title={s.label}>
            {s.label}
          </span>
          <Bar value={s.n} max={max} className="bg-destructive/70" />
          <span className="text-right tabular-nums">
            {s.n} · {formatPct(s.share)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function OperatorBars({ rows }: { rows: { id: string; name: string; students: number }[] }) {
  if (rows.length === 0) return <Empty>Bu davrda operator bo'yicha shartnoma yo'q</Empty>;
  const max = Math.max(...rows.map((r) => r.students));
  return (
    <ul className="space-y-2" aria-label="Operatorlar">
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[minmax(0,12rem)_1fr_3rem] items-center gap-3 text-[13px]">
          <span className="truncate" title={r.name}>
            {r.name}
          </span>
          <Bar value={r.students} max={max} className="bg-success" />
          <span className="text-right font-medium tabular-nums">{r.students}</span>
        </li>
      ))}
    </ul>
  );
}

// ---- old vs new ---------------------------------------------------------------

export function GenerationCompare({ old, current }: { old: GenerationStats; current: GenerationStats }) {
  const rows: { label: string; a: string; b: string }[] = [
    { label: 'Lidlar', a: String(old.leads), b: String(current.leads) },
    { label: 'Javob %', a: formatPct(old.answeredPct, 1), b: formatPct(current.answeredPct, 1) },
    { label: 'Shartnomalar', a: String(old.students), b: String(current.students) },
    { label: 'Konversiya %', a: formatPct(old.conversion, 1), b: formatPct(current.conversion, 1) },
  ];
  return (
    <table className="w-full text-[13px]" aria-label="Eski va yangi">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
          <th scope="col" className="px-2 py-1.5 text-left font-semibold" />
          <th scope="col" className="px-2 py-1.5 text-right font-semibold">
            Eski CRM
          </th>
          <th scope="col" className="px-2 py-1.5 text-right font-semibold">
            Yangi tizim
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-t">
            <th scope="row" className="px-2 py-1.5 text-left font-medium">
              {r.label}
            </th>
            <td className="px-2 py-1.5 text-right tabular-nums">{r.a}</td>
            <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{r.b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
