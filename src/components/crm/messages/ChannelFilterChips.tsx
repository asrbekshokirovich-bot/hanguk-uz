import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CHANNELS, CHANNEL_IDS } from './channels';
import type { ChannelFilter } from './types';

interface ChannelFilterChipsProps {
  value: ChannelFilter;
  onChange: (value: ChannelFilter) => void;
  /** "12 shown" counter rendered at the end of the row. */
  visibleCount: number;
}

export function ChannelFilterChips({ value, onChange, visibleCount }: ChannelFilterChipsProps) {
  const { t } = useTranslation();
  const options: { id: ChannelFilter; label: string }[] = [
    { id: 'all', label: t('messages.channels.all') },
    ...CHANNEL_IDS.map((id) => ({ id: id as ChannelFilter, label: t(CHANNELS[id].labelKey) })),
  ];

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'h-8 min-h-0 min-w-0 whitespace-nowrap rounded-pill border px-2.5 text-[11.5px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card',
              active
                ? 'border-primary bg-primary/10 font-semibold text-primary'
                : 'border-border font-medium text-muted-foreground hover:bg-muted hover:text-foreground/80',
            )}
          >
            {opt.label}
          </button>
        );
      })}
      <span className="ml-auto shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">
        {t('messages.queue.shown', { count: visibleCount })}
      </span>
    </div>
  );
}
