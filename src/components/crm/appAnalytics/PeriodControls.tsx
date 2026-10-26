import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { periodLabel, type PeriodKey } from './marketing';

const PERIODS: PeriodKey[] = ['today', '7', '30', '90', 'range'];

/** Bugun / 7 / 30 / 90 kun / Oraliq (S8), the dates for «Oraliq», and what it is compared with. */
export default function PeriodControls({
  period,
  onPeriod,
  range,
  onRange,
  today,
  compare,
}: {
  period: PeriodKey;
  onPeriod: (p: PeriodKey) => void;
  range: { from: string; to: string };
  onRange: (r: { from: string; to: string }) => void;
  today: string;
  /** The period before, when the page compares with it. */
  compare?: { from: string; to: string };
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex rounded-md border border-border p-0.5">
        {PERIODS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onPeriod(k)}
            className={cn(
              'rounded px-2.5 py-1 text-[12.5px] font-semibold',
              period === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {t(`marketing.periods.${k}`)}
          </button>
        ))}
      </div>
      {period === 'range' && (
        <div className="flex items-center gap-1.5">
          <Input type="date" value={range.from} max={today} onChange={(e) => onRange({ ...range, from: e.target.value })} className="h-8 w-[150px] text-[13px]" />
          <span className="text-muted-foreground">–</span>
          <Input type="date" value={range.to} max={today} onChange={(e) => onRange({ ...range, to: e.target.value })} className="h-8 w-[150px] text-[13px]" />
        </div>
      )}
      {compare && (
        <span className="text-[12px] text-muted-foreground">{t('marketing.compareWith', { period: periodLabel(compare.from, compare.to) })}</span>
      )}
    </>
  );
}
