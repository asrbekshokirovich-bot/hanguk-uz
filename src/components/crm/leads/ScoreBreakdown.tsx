import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { FACTOR_ORDER, factorStrength } from './leadScore';
import type { LeadVM } from './types';

const BAR: Record<ReturnType<typeof factorStrength>, string> = {
  strong: 'bg-accent',
  partial: 'bg-warning',
  weak: 'bg-muted-foreground/50',
};

/**
 * The score, its tier, and the five weighted factors behind it.
 *
 * The per-factor bars are the point: a bare 62 tells an operator nothing they
 * can act on, whereas "budget: Weak" tells them exactly what to ask about on
 * the call. Strength is written out as text next to each bar, so the reading
 * never depends on colour alone.
 */
export function ScoreBreakdown({ lead }: { lead: LeadVM }) {
  const { t } = useTranslation();
  const tierText =
    lead.tier === 'hot' ? 'text-spring' : lead.tier === 'warm' ? 'text-warning' : 'text-muted-foreground';

  return (
    <section className="border-b border-border px-4 py-4">
      <div className="flex items-end gap-3">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            {t('leads.detail.scoreTitle')}
          </h3>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn('font-mono text-[34px] font-extrabold leading-none', tierText)}>
              {lead.score}
            </span>
            <span className={cn('text-[11px] font-bold uppercase tracking-[0.06em]', tierText)}>
              {t(`leads.worklist.tier.${lead.tier}`)}
            </span>
          </div>
        </div>
        <p className="ml-auto max-w-[150px] text-right text-[11.5px] text-muted-foreground">
          {t(`leads.detail.scoreNote.${lead.tier}`)}
        </p>
      </div>

      <dl className="mt-3.5 flex flex-col gap-2">
        {FACTOR_ORDER.map((key) => {
          const value = lead.factors[key];
          const strength = factorStrength(value);
          return (
            <div key={key} className="flex items-center gap-2.5">
              <dt className="w-24 shrink-0 text-[11.5px] font-medium text-muted-foreground">
                {t(`leads.factors.${key}`)}
              </dt>
              <div
                role="meter"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t(`leads.factors.${key}`)}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              >
                <div className={cn('h-full rounded-full', BAR[strength])} style={{ width: `${value}%` }} />
              </div>
              <dd className="w-[74px] shrink-0 text-right text-[11px] text-muted-foreground">
                {t(`leads.detail.strength.${strength}`)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
