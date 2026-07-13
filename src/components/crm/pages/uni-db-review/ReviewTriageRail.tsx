import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { itemConfidence } from '../reviewLogic';
import {
  openRollup,
  institutionName,
  type GuidelineGroup,
  type DecidedMap,
} from './reviewGroups';
import type { ReliabilityColor } from '../reliability';

/**
 * Left triage rail (design §A): one card per guideline group, sorted
 * red → amber → green → done by the parent, with pending-count dots in the
 * header. Pure presentation — selection state lives in ReviewApprovalQueue.
 */

const DOT: Record<ReliabilityColor, string> = {
  red: 'bg-destructive',
  amber: 'bg-warning',
  green: 'bg-success',
};

const CHIP: Record<ReliabilityColor, string> = {
  red: 'bg-destructive/10 text-destructive',
  amber: 'bg-warning/10 text-warning',
  green: 'bg-success/10 text-success',
};

function chipLabelKey(color: ReliabilityColor | null): string {
  if (color === 'red') return 'uniReview.rail.chipRed';
  if (color === 'amber') return 'uniReview.rail.chipAmber';
  return 'uniReview.rail.chipGreen';
}

export function ReviewTriageRail({
  groups,
  decided,
  selectedKey,
  onSelect,
}: {
  groups: GuidelineGroup[];
  decided: DecidedMap;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation();

  const counts = { red: 0, amber: 0, green: 0 };
  for (const g of groups) {
    const r = openRollup(g, decided);
    if (!r.done) counts[r.color ?? 'green'] += 1;
  }

  return (
    <div className="sticky top-4 flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
          {t('uniReview.rail.header', { n: groups.length })}
        </span>
        <span className="flex items-center gap-2 text-[11.5px] font-semibold text-muted-foreground/80">
          {(['red', 'amber', 'green'] as const).map((c) => (
            <span key={c} className="flex items-center gap-1">
              <span className={cn('h-[7px] w-[7px] rounded-full', DOT[c])} />
              {counts[c]}
            </span>
          ))}
        </span>
      </div>

      {groups.map((g) => {
        const r = openRollup(g, decided);
        const selected = g.key === selectedKey;
        const confs = r.open
          .map((row) => itemConfidence(row))
          .filter((c): c is number => typeof c === 'number');
        const minConf = confs.length ? Math.round(Math.min(...confs) * 100) : null;
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onSelect(g.key)}
            className={cn(
              'flex flex-col gap-1.5 rounded-xl border bg-card p-3 px-3.5 text-left transition-[border-color,box-shadow]',
              'hover:border-info/60',
              selected ? 'border-info/60 ring-[3px] ring-ring/30' : 'border-border',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                {institutionName(g)}
              </span>
              {r.done ? (
                <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={2.5} />
              ) : (
                <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT[r.color ?? 'green'])} />
              )}
            </div>
            {g.nameKo && g.nameEn ? (
              <div className="truncate text-xs text-muted-foreground/80" lang="ko">
                {g.nameKo}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {r.done ? (
                <span className="inline-flex h-5 items-center rounded-full bg-success/10 px-2 text-[11px] font-semibold text-success">
                  {t('uniReview.rail.done')}
                </span>
              ) : (
                <>
                  <span
                    className={cn(
                      'inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold',
                      CHIP[r.color ?? 'green'],
                    )}
                  >
                    {t(chipLabelKey(r.color))}
                  </span>
                  <span className="text-[11.5px] font-medium text-muted-foreground/80">
                    {minConf !== null
                      ? t('uniReview.rail.sub', { n: r.open.length, p: minConf })
                      : t('uniReview.rail.subNoConf', { n: r.open.length })}
                  </span>
                </>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
