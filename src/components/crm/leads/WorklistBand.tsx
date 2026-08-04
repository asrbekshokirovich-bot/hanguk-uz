import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { BandKey } from './types';

const DOT: Record<BandKey, string> = {
  overdue: 'bg-destructive',
  new: 'bg-primary',
  booked: 'bg-accent',
  working: 'bg-muted-foreground',
};

interface WorklistBandProps {
  band: BandKey;
  count: number;
  children: React.ReactNode;
}

/**
 * An urgency band: coloured dot, label, count and a one-line hint telling the
 * operator why this group is grouped. The hint is the point — a band header
 * without it is just a colour the operator has to learn.
 */
export function WorklistBand({ band, count, children }: WorklistBandProps) {
  const { t } = useTranslation();
  return (
    <section aria-label={t(`leads.bands.${band}.label`)} className="mb-5">
      <div className="flex items-center gap-2 px-0.5 pb-2 pt-1.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT[band])} aria-hidden />
        <h2 className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
          {t(`leads.bands.${band}.label`)}
        </h2>
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
          {count}
        </span>
        <span className="ml-1 truncate text-[11.5px] text-muted-foreground">
          {t(`leads.bands.${band}.hint`)}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}
