import { useTranslation } from 'react-i18next';
import { CheckCheck, Languages, PanelRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHANNELS } from './channels';
import { ChannelAvatar } from './ChannelAvatar';
import { formatWait } from './queueLogic';
import type { ConversationVM } from './types';

interface ThreadHeaderProps {
  conversation: ConversationVM;
  autoTranslate: boolean;
  contextOpen: boolean;
  claiming: boolean;
  onClaim: () => void;
  onToggleAutoTranslate: () => void;
  onMarkDone: () => void;
  onToggleContext: () => void;
}

/**
 * Thread header. The Claim button is the single lime action on the screen —
 * the accent token is reserved for exactly one call to action per view, which
 * is why Mark Done and Auto-translate stay as neutral outline buttons.
 */
export function ThreadHeader({
  conversation: c,
  autoTranslate,
  contextOpen,
  claiming,
  onClaim,
  onToggleAutoTranslate,
  onMarkDone,
  onToggleContext,
}: ThreadHeaderProps) {
  const { t } = useTranslation();
  const meta = `${t(CHANNELS[c.channel].labelKey)} · ${c.handle} · ${c.stage}`;

  return (
    <header className="flex h-[68px] shrink-0 items-center gap-3 border-b border-border bg-card px-5">
      <ChannelAvatar channel={c.channel} initials={c.initials} avatarUrl={c.avatarUrl} size={40} />

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-bold text-foreground">{c.name}</h2>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!c.isAssigned && !c.isDone ? (
          <div className="flex items-center gap-2 rounded-pill bg-warning/10 py-1 pl-3 pr-1">
            {/* Full "Unassigned · 12m waiting" when there is room; the wait
                alone once the header gets tight — the Claim button next to it
                already communicates the unassigned state. */}
            <span className="hidden whitespace-nowrap text-xs font-semibold text-warning 2xl:inline">
              {c.waitingMinutes > 0
                ? t('messages.thread.unassignedWaiting', { time: formatWait(c.waitingMinutes) })
                : t('messages.thread.unassigned')}
            </span>
            <span className="whitespace-nowrap text-xs font-semibold text-warning 2xl:hidden">
              {c.waitingMinutes > 0 ? formatWait(c.waitingMinutes) : t('messages.thread.unassigned')}
            </span>
            <button
              type="button"
              onClick={onClaim}
              disabled={claiming}
              className={cn(
                'h-9 min-h-0 rounded-pill bg-accent px-4 text-xs font-bold text-accent-foreground transition',
                'hover:brightness-105 disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
              )}
            >
              {t('messages.thread.claim')}
            </button>
          </div>
        ) : c.isMine ? (
          <span className="whitespace-nowrap rounded-pill bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
            {t('messages.thread.assignedToYou')}
          </span>
        ) : c.isAssigned && !c.isDone ? (
          <span className="whitespace-nowrap rounded-pill bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {t('messages.thread.assignedToOther')}
          </span>
        ) : null}

        <button
          type="button"
          onClick={onToggleAutoTranslate}
          aria-pressed={autoTranslate}
          title={autoTranslate ? t('messages.thread.autoTranslateOn') : t('messages.thread.autoTranslateOff')}
          className={cn(
            'flex h-9 min-h-0 min-w-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            autoTranslate ? 'bg-primary/10 text-primary' : 'bg-card text-foreground/75',
          )}
        >
          <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {/* Label collapses to the icon on narrow layouts; the state stays in
              the accessible name via the sr-only span below. */}
          <span className="hidden whitespace-nowrap 2xl:inline">
            {autoTranslate ? t('messages.thread.autoTranslateOn') : t('messages.thread.autoTranslateOff')}
          </span>
          <span className="sr-only 2xl:hidden">
            {autoTranslate ? t('messages.thread.autoTranslateOn') : t('messages.thread.autoTranslateOff')}
          </span>
        </button>

        {!c.isDone && (
          <button
            type="button"
            onClick={onMarkDone}
            title={t('messages.thread.markDone')}
            className="flex h-9 min-h-0 min-w-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground/75 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CheckCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden whitespace-nowrap xl:inline">{t('messages.thread.markDone')}</span>
            <span className="sr-only xl:hidden">{t('messages.thread.markDone')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleContext}
          aria-pressed={contextOpen}
          aria-label={t('messages.thread.toggleContext')}
          className="hidden h-9 w-9 min-h-0 min-w-0 items-center justify-center rounded-md border border-border bg-card text-foreground/75 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex"
        >
          <PanelRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
