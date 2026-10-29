import { useTranslation } from 'react-i18next';
import { Loader2, Search } from 'lucide-react';
import type { ThreadSearchHit } from './useThreadSearch';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelFilterChips } from './ChannelFilterChips';
import { ConversationRow } from './ConversationRow';
import { QueueTabs } from './QueueTabs';
import type { ChannelFilter, ConversationVM, QueueTab } from './types';

interface MessagesQueueProps {
  conversations: ConversationVM[];
  visible: ConversationVM[];
  selectedThreadId: string | null;
  loading: boolean;
  tab: QueueTab;
  channel: ChannelFilter;
  query: string;
  /** Waiting rows older than STALE_AFTER_DAYS the list is not showing. */
  hiddenStale: number;
  onShowStale: () => void;
  /** Why the database matched a row (phone, message text…), by thread id. */
  searchHits: ReadonlyMap<string, ThreadSearchHit>;
  searching: boolean;
  onTabChange: (tab: QueueTab) => void;
  onChannelChange: (channel: ChannelFilter) => void;
  onQueryChange: (query: string) => void;
  onSelect: (conversation: ConversationVM) => void;
}

/**
 * Left pane: tabs, channel filter, search, and the conversation list.
 *
 * 352px at full width, 300px on narrower viewports — the workspace row scrolls
 * horizontally rather than crushing the thread pane.
 */
export function MessagesQueue({
  conversations,
  visible,
  selectedThreadId,
  loading,
  tab,
  channel,
  query,
  hiddenStale,
  onShowStale,
  searchHits,
  searching,
  onTabChange,
  onChannelChange,
  onQueryChange,
  onSelect,
}: MessagesQueueProps) {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t('messages.queue.label')}
      className="flex w-[320px] shrink-0 flex-col border-r border-border bg-card 2xl:w-[352px]"
    >
      <div className="border-b border-border/60 p-3.5 pb-2.5">
        <QueueTabs value={tab} onChange={onTabChange} conversations={conversations} />

        <div className="mt-2.5 flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('messages.queue.searchPlaceholder')}
            aria-label={t('messages.queue.searchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {searching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />}
        </div>
        {query.trim() && (
          <p className="mt-1.5 px-0.5 text-[11px] text-muted-foreground">{t('messages.queue.searchAllTabs')}</p>
        )}

        <ChannelFilterChips value={channel} onChange={onChannelChange} visibleCount={visible.length} />
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {loading && conversations.length === 0 ? (
          <div className="space-y-2 p-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[74px] w-full rounded-lg" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-foreground/75">{t('messages.queue.emptyTitle')}</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">{t('messages.queue.emptyBody')}</p>
            {hiddenStale > 0 && (
              <button
                type="button"
                onClick={onShowStale}
                className="mt-4 rounded-md border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('messages.queue.showStale', { count: hiddenStale })}
              </button>
            )}
          </div>
        ) : (
          <>
            {visible.map((c) => (
              <ConversationRow
                key={c.threadId}
                conversation={c}
                selected={c.threadId === selectedThreadId}
                onSelect={onSelect}
                searchHit={query.trim() ? searchHits.get(c.threadId) ?? null : null}
              />
            ))}
            {hiddenStale > 0 && (
              <button
                type="button"
                onClick={onShowStale}
                className="mt-1 flex w-full items-center justify-center rounded-md border border-dashed border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('messages.queue.showStale', { count: hiddenStale })}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
