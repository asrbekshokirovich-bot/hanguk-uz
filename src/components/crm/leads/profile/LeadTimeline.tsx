import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneCall } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHANNEL_STYLE } from './channelStyle';
import { CHANNELS, type Channel, type TimelineEntry } from './useLeadProfile';

interface LeadTimelineProps {
  entries: TimelineEntry[];
  /** Scroll target set by clicking a proposal's evidence. */
  highlightId: string | null;
}

/** How many of the newest entries to render before the operator asks for more. */
const PAGE = 40;

function dayKey(at: string) {
  return at.slice(0, 10);
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Every channel in one feed, oldest at the top.
 *
 * Three separate panes would be the obvious build and the wrong one: a customer
 * asks on Instagram and gets answered by phone, and split panes hide that the
 * two are the same exchange. The channel badge on each row carries what the
 * separation would have told you, without breaking the order.
 *
 * The filter exists for the narrow case of auditing one channel, and defaults
 * to off — the merged view is the point.
 */
export function LeadTimeline({ entries, highlightId }: LeadTimelineProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Channel | 'all'>('all');
  const [shown, setShown] = useState(PAGE);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: entries.length };
    for (const channel of CHANNELS) {
      map[channel] = entries.filter((e) => e.channel === channel).length;
    }
    return map;
  }, [entries]);

  // `entries` arrives newest first. Slice the newest N, then flip so the feed
  // reads as a conversation; paging must keep the RECENT end, not the old one.
  const visible = useMemo(() => {
    const filtered = filter === 'all' ? entries : entries.filter((e) => e.channel === filter);
    return filtered.slice(0, shown).reverse();
  }, [entries, filter, shown]);

  const hiddenCount =
    (filter === 'all' ? entries.length : counts[filter] ?? 0) - visible.length;

  if (!entries.length) {
    return (
      <section className="rounded-lg border border-border bg-card px-5 py-12 text-center">
        <p className="text-[14px] font-bold text-foreground">{t('leads.profile.timeline.emptyTitle')}</p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
          {t('leads.profile.timeline.emptyBody')}
        </p>
      </section>
    );
  }

  let lastDay = '';

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-bold text-foreground">{t('leads.profile.timeline.title')}</h2>
        <span className="text-[11.5px] text-muted-foreground">
          {t('leads.profile.timeline.count', { count: entries.length })}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {(['all', ...CHANNELS] as const).map((key) => {
            const isChannel = key !== 'all';
            const active = filter === key;
            const disabled = isChannel && !counts[key];
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setFilter(key as Channel | 'all');
                  setShown(PAGE);
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted',
                  disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent',
                )}
              >
                {isChannel ? (
                  <span
                    className={cn('h-1.5 w-1.5 rounded-full', CHANNEL_STYLE[key as Channel].dot)}
                    aria-hidden
                  />
                ) : null}
                {isChannel ? t(`leads.profile.channels.${key}`) : t('leads.profile.timeline.all')}
                <span className={cn(active ? 'opacity-80' : 'opacity-70')}>{counts[key] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="max-h-[540px] overflow-y-auto px-4 py-3">
        {hiddenCount > 0 && (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="rounded-full border border-border px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted"
            >
              {t('leads.profile.timeline.loadMore', { count: Math.min(hiddenCount, PAGE) })}
            </button>
          </div>
        )}

        {visible.map((entry) => {
          const style = CHANNEL_STYLE[entry.channel];
          const Icon = style.icon;
          const incoming = entry.direction === 'incoming';
          const day = dayKey(entry.at);
          const newDay = day !== lastDay;
          lastDay = day;
          const isCall = entry.channel === 'phone';
          const highlighted = entry.id === highlightId;

          return (
            <div key={entry.id}>
              {newDay && (
                <div className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                    {new Date(entry.at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                      weekday: 'short',
                    })}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}

              <div
                id={`tl-${entry.id}`}
                className={cn('flex scroll-mt-24', incoming ? 'justify-start' : 'justify-end')}
              >
                <div className={cn('max-w-[78%] min-w-0', incoming ? 'items-start' : 'items-end')}>
                  <div
                    className={cn(
                      'mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em]',
                      incoming ? 'justify-start' : 'justify-end',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden />
                    <span className={style.text}>{t(`leads.profile.channels.${entry.channel}`)}</span>
                    <span className="text-muted-foreground">
                      {incoming ? t('leads.profile.timeline.client') : t('leads.profile.timeline.us')}
                    </span>
                    <span className="font-medium normal-case tracking-normal text-muted-foreground">
                      {new Date(entry.at).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div
                    className={cn(
                      'rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed',
                      incoming ? 'border-border bg-muted/50' : 'border-primary/25 bg-primary/5',
                      highlighted && 'ring-2 ring-amber-400',
                    )}
                  >
                    {isCall && (
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                        <PhoneCall className="h-3.5 w-3.5" aria-hidden />
                        {t('leads.profile.timeline.callLine', {
                          duration: formatDuration(entry.seconds ?? 0),
                          status: entry.status ?? '',
                        })}
                      </p>
                    )}
                    {entry.body ? (
                      <p className="whitespace-pre-wrap break-words text-foreground">{entry.body}</p>
                    ) : (
                      <p className="italic text-muted-foreground">
                        {isCall
                          ? t('leads.profile.timeline.noTranscript')
                          : t('leads.profile.timeline.noText')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
