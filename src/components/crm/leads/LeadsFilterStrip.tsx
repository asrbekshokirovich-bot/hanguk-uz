import { useTranslation } from 'react-i18next';
import { Phone, Plus, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Lead } from '@/contexts/LeadsContext';
import type { SourceFilter } from './types';
import type { WorklistStats } from './worklistLogic';

const SOURCES: SourceFilter[] = ['all', 'manual', 'telegram', 'instagram', 'call', 'ai_detected'];

interface LeadsFilterStripProps {
  query: string;
  onQueryChange: (value: string) => void;
  source: SourceFilter;
  onSourceChange: (value: SourceFilter) => void;
  callToday: boolean;
  onCallTodayToggle: () => void;
  stats: WorklistStats;
  onAddLead: () => void;
  detailOpen: boolean;
  onToggleDetail: () => void;
}

/**
 * The filter strip above the worklist: scoped search, source chips, the
 * Call Today filter, and the right-aligned stat readout.
 *
 * Call Today is the primary filter, not one chip among many — it is the whole
 * job on a shift — so it is the only filled control in the row.
 */
export function LeadsFilterStrip({
  query,
  onQueryChange,
  source,
  onSourceChange,
  callToday,
  onCallTodayToggle,
  stats,
  onAddLead,
  detailOpen,
  onToggleDetail,
}: LeadsFilterStripProps) {
  const { t } = useTranslation();

  const readouts = [
    { key: 'uncalled', value: stats.uncalled, tone: 'text-foreground' },
    { key: 'overdue', value: stats.overdue, tone: 'text-destructive' },
    { key: 'booked', value: stats.booked, tone: 'text-foreground' },
    { key: 'avgScore', value: stats.avgScore, tone: 'text-foreground' },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
      <div className="flex h-9 w-60 items-center gap-2 rounded-md border border-border bg-background px-3">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('leads.worklist.searchPlaceholder')}
          aria-label={t('leads.worklist.searchPlaceholder')}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('leads.source')}>
        {SOURCES.map((value) => {
          const active = source === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onSourceChange(value)}
              className={cn(
                'h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                active
                  ? 'border-primary bg-primary/10 font-semibold text-primary'
                  : 'border-border font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {value === 'all' ? t('leads.allSources') : t(`leads.sources.${value as Lead['source']}`)}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-pressed={callToday}
        onClick={onCallTodayToggle}
        className={cn(
          'flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          callToday
            ? 'bg-accent font-bold text-accent-foreground'
            : 'border border-accent font-semibold text-spring hover:bg-accent/10',
        )}
      >
        <Phone className="h-3.5 w-3.5" aria-hidden />
        {t('leads.callToday')} · {stats.callToday}
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-4">
        {readouts.map((item) => (
          <div key={item.key} className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
            <span className={cn('font-mono text-base font-extrabold', item.tone)}>{item.value}</span>
            <span className="text-[11.5px] font-medium text-muted-foreground">
              {t(`leads.worklist.stats.${item.key}`)}
            </span>
          </div>
        ))}

        {/* Available at every width — docked or overlay, the pane is optional. */}
        <button
          type="button"
          aria-pressed={detailOpen}
          onClick={onToggleDetail}
          className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 text-[12.5px] font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {detailOpen ? t('leads.detail.hideToggle') : t('leads.detail.showToggle')}
        </button>

        <button
          type="button"
          onClick={onAddLead}
          className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-card transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('leads.addLead')}
        </button>
      </div>
    </div>
  );
}
