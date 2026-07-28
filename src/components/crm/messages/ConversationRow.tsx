import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { ChannelAvatar } from './ChannelAvatar';
import { formatRowTime, formatWait, isOverdue } from './queueLogic';
import type { ConversationVM } from './types';

interface ConversationRowProps {
  conversation: ConversationVM;
  selected: boolean;
  onSelect: (conversation: ConversationVM) => void;
}

/**
 * One queue row: avatar + channel dot, name, time, one-line preview, then the
 * meta pill row (stage · waiting · Mine · unread).
 *
 * The waiting pill is the SLA signal — danger-tinted at or past the threshold
 * in `queueLogic.SLA_WARNING_MINUTES`, neutral below it. It is hidden entirely
 * once the operator has replied, because nothing is waiting then.
 */
export function ConversationRow({ conversation: c, selected, onSelect }: ConversationRowProps) {
  const { t, i18n } = useTranslation();
  const overdue = isOverdue(c);
  const showWait = c.waitingMinutes > 0 && !c.isDone;

  return (
    <button
      type="button"
      onClick={() => onSelect(c)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'relative flex w-full gap-2.5 rounded-lg p-3 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card',
        selected ? 'border border-primary bg-primary/10' : 'border border-transparent hover:bg-muted',
      )}
    >
      <ChannelAvatar
        channel={c.channel}
        initials={c.initials}
        avatarUrl={c.avatarUrl}
        ringClassName={selected ? 'ring-[hsl(var(--card))]' : 'ring-card'}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-[13.5px] font-semibold text-foreground">{c.name}</span>
          <span className="ml-auto shrink-0 text-[11px] font-medium text-muted-foreground">
            {formatRowTime(c.lastAt, i18n.language)}
          </span>
        </span>

        <span className="mt-0.5 block truncate text-[12.5px] text-foreground/75">
          {c.preview || t('messages.queue.noPreview')}
        </span>

        <span className="mt-1.5 flex items-center gap-1.5 overflow-hidden">
          <span className="max-w-[54%] truncate whitespace-nowrap rounded-pill bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            {c.stage}
          </span>

          {showWait && (
            <span
              className={cn(
                'whitespace-nowrap rounded-pill px-1.5 py-0.5 text-[10px] font-semibold',
                overdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
              )}
            >
              {t('messages.queue.waiting', { time: formatWait(c.waitingMinutes) })}
            </span>
          )}

          {c.isMine && !c.isDone && (
            <span className="whitespace-nowrap rounded-pill bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
              {t('messages.queue.mine')}
            </span>
          )}

          {c.unreadCount > 0 && (
            <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {c.unreadCount}
              <span className="sr-only"> {t('messages.unread')}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
