import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { plan } from './planUi';
import { DAYS, pct, rate, totalOf, useRetention, weeksOf, type Audience, type Day } from './retention';

// The cohort the plan's numbers start from (test devices and the 15-Oct
// launch cohort left out — 2026-11-06).
const FROM = '2026-10-16';
const LABEL: Record<Day, string> = { d1: '1', d3: '3', d7: '7', d14: '14', d30: '30' };

/**
 * «Qaytish» (ushlab qolish P02, Claude Design D1): day-N return of new
 * devices — cards, the curve against Adjust's education benchmark, and the
 * weekly cohort table.
 */
export default function RetentionTab() {
  const { t } = useTranslation();
  const [aud, setAud] = useState<Audience>('mehmon');
  const { data, error } = useRetention(FROM);

  if (error && !data) return <p className={cn('text-[13px]', plan.bad)}>{t('appActivity.error')}</p>;
  if (!data) return <p className={plan.note}>{t('appActivity.loading')}</p>;

  const total = totalOf(data, aud);
  const weeks = weeksOf(data, aud);
  const bench: Partial<Record<Day, number>> = { d1: data.benchmark.d1, d3: data.benchmark.d3, d7: data.benchmark.d7, d30: data.benchmark.d30 };
  const max = Math.max(1, ...DAYS.map((d) => Math.max(rate(total, d) ?? 0, bench[d] ?? 0)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        <span>{t('retention.range', { from: '16-okt', to: data.to })}</span>
        {(['mehmon', 'talaba'] as Audience[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAud(a)}
            className={cn(
              'rounded-full px-2.5 py-1 font-semibold',
              aud === a ? 'bg-[#E3EAF6] font-bold text-[#0F2690]' : 'border bg-background',
            )}
          >
            {t(`retention.audience.${a}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        {(['d1', 'd3', 'd7', 'd14'] as Day[]).map((d) => {
          const r = rate(total, d);
          const b = bench[d];
          const low = r !== null && b !== undefined && r < b / 2;
          return (
            <div key={d} className="rounded-[14px] border bg-background p-4">
              <div className="text-[12px] font-bold text-muted-foreground">{t('retention.day', { n: LABEL[d] })}</div>
              <div className={cn('mt-1 text-[28px] font-extrabold', (low || r === 0) && 'text-[#B91C1C]')}>{pct(r)}</div>
              <div className="mt-0.5 font-mono text-[12px] text-muted-foreground">
                {total ? `${total[d]} / ${total[`${d}_base` as const]}` : '—'}
                {b !== undefined ? ` · Adjust ${b}%` : ''}
              </div>
            </div>
          );
        })}
      </div>

      <section className="space-y-3 rounded-[14px] border bg-background p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="m-0 flex-1 text-[15px] font-extrabold">{t('retention.curve')}</h2>
          <span className="text-[12px] text-muted-foreground">{t('retention.curveNote')}</span>
        </div>
        <div className="grid h-[220px] grid-cols-5 items-end gap-3 border-b-[1.5px] border-[#0A1A34] px-2 dark:border-white/60">
          {DAYS.map((d) => {
            const r = rate(total, d);
            const b = bench[d];
            return (
              <div key={d} className="relative flex h-full flex-col items-center justify-end gap-1">
                <span className="text-[12px] font-bold">{pct(r)}</span>
                <div
                  className={cn('w-full max-w-[72px] rounded-t-md', r === null ? 'bg-[#D9DFE8]' : 'bg-[#2447D6]')}
                  style={{ height: `${Math.max(1, ((r ?? 0) / max) * 85)}%` }}
                />
                {b !== undefined && (
                  <div
                    aria-hidden="true"
                    className="absolute left-0 right-0 mx-auto w-full max-w-[72px] border-t-[3px] border-[#F59E0B]"
                    style={{ bottom: `${(b / max) * 85}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-5 gap-3 px-2 text-center text-[12px] font-bold text-muted-foreground">
          {DAYS.map((d) => (
            <span key={d}>
              {t('retention.day', { n: LABEL[d] })}
              {bench[d] !== undefined ? ` · Adjust ${bench[d]}%` : ''}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-2.5 rounded-[14px] border bg-background p-4">
        <h2 className="m-0 text-[15px] font-extrabold">{t('retention.cohort')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="border-b p-2">{t('retention.week')}</th>
                <th className="border-b p-2">{t('retention.new')}</th>
                {DAYS.map((d) => (
                  <th key={d} className="border-b p-2">{t('retention.day', { n: LABEL[d] })}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week}>
                  <td className="border-b p-2 font-bold">{w.week}</td>
                  <td className="border-b p-2 font-mono">{w.devices}</td>
                  {DAYS.map((d) => (
                    <td key={d} className={cn('border-b p-2', rate(w, d) === null && 'text-muted-foreground')}>
                      {rate(w, d) === null ? t('retention.early') : (
                        <span title={`${w[d]} / ${w[`${d}_base` as const]}`}>{pct(rate(w, d))}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {total && (
                <tr className="bg-muted/40 font-extrabold">
                  <td className="p-2">{t('retention.total')}</td>
                  <td className="p-2 font-mono">{total.devices}</td>
                  {DAYS.map((d) => (
                    <td key={d} className="p-2">{pct(rate(total, d))}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className={plan.note}>{t('retention.note')}</p>
      </section>
    </div>
  );
}
