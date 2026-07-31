import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
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
        </div>

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
          </div>
        ) : (
          visible.map((c) => (
            <ConversationRow
              key={c.threadId}
              conversation={c}
              selected={c.threadId === selectedThreadId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </section>
  );
}
