import { useTranslation } from 'react-i18next';
import { CheckCheck, Languages, PanelRight, UserPlus } from 'lucide-react';
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
  /** Opens the attach-to-person dialog. Absent for channels we cannot key on. */
  onLinkContact?: () => void;
}

/**
 * Thread header.
 *
 * The secondary actions are icon-only by design rather than by breakpoint.
 * The thread pane is roughly 520–600px wide inside the CRM shell, and the UI
 * language is the operator's choice — "Avto-tarjima yoqilgan" and "Yakunlash"
 * are far wider than "Auto-translate On" and "Mark Done", so any width-based
 * rule tuned on English overflows in Uzbek and clips the header. Fixed-width
 * icon buttons fit in every language; the full label lives in the tooltip and
 * in the accessible name, so nothing is lost to a screen reader.
 *
 * Claim keeps its text and its lime fill — it is the one call to action here.
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
  onLinkContact,
}: ThreadHeaderProps) {
  const { t } = useTranslation();
  const meta = `${t(CHANNELS[c.channel].labelKey)} · ${c.handle} · ${c.stage}`;
  const autoTrLabel = autoTranslate
    ? t('messages.thread.autoTranslateOn')
    : t('messages.thread.autoTranslateOff');
  const unassignedLabel =
    c.waitingMinutes > 0
      ? t('messages.thread.unassignedWaiting', { time: formatWait(c.waitingMinutes) })
      : t('messages.thread.unassigned');

  return (
    <header className="flex h-[68px] shrink-0 items-center gap-3 overflow-hidden border-b border-border bg-card px-4">
      <ChannelAvatar channel={c.channel} initials={c.initials} avatarUrl={c.avatarUrl} size={40} />

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-bold text-foreground">{c.name}</h2>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!c.isAssigned && !c.isDone ? (
          <div
            className="flex items-center gap-1.5 rounded-pill bg-warning/10 py-1 pl-2.5 pr-1"
            title={unassignedLabel}
          >
            <span className="whitespace-nowrap text-xs font-semibold text-warning">
              {c.waitingMinutes > 0 ? formatWait(c.waitingMinutes) : t('messages.thread.unassigned')}
            </span>
            <button
              type="button"
              onClick={onClaim}
              disabled={claiming}
              className={cn(
                'h-9 min-h-0 whitespace-nowrap rounded-pill bg-accent px-3.5 text-xs font-bold text-accent-foreground transition',
                'hover:brightness-105 disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
              )}
            >
              {t('messages.thread.claim')}
            </button>
          </div>
        ) : c.isMine ? (
          <span
            className="max-w-[140px] truncate rounded-pill bg-success/10 px-2.5 py-1.5 text-xs font-semibold text-success"
            title={t('messages.thread.assignedToYou')}
          >
            {t('messages.thread.assignedToYou')}
          </span>
        ) : c.isAssigned && !c.isDone ? (
          <span className="whitespace-nowrap rounded-pill bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
            {t('messages.thread.assignedToOther')}
          </span>
        ) : null}

        {onLinkContact && (
          <IconAction
            label={
              c.studentId
                ? t('messages.thread.relinkContact')
                : t('messages.thread.linkContact')
            }
            active={!c.studentId}
            onClick={onLinkContact}
            icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
          />
        )}

        <IconAction
          label={autoTrLabel}
          active={autoTranslate}
          pressed={autoTranslate}
          onClick={onToggleAutoTranslate}
          icon={<Languages className="h-4 w-4" aria-hidden="true" />}
        />

        {!c.isDone && (
          <IconAction
            label={t('messages.thread.markDone')}
            onClick={onMarkDone}
            icon={<CheckCheck className="h-4 w-4" aria-hidden="true" />}
          />
        )}

        <span className="hidden xl:inline-flex">
          <IconAction
            label={t('messages.thread.toggleContext')}
            pressed={contextOpen}
            onClick={onToggleContext}
            icon={<PanelRight className="h-4 w-4" aria-hidden="true" />}
          />
        </span>
      </div>
    </header>
  );
}

/**
 * Square 36px action. The visible affordance is the icon; the label is carried
 * by `title` (hover) and an `sr-only` span (assistive tech), so the control
 * stays a fixed width no matter how long the translation is.
 */
function IconAction({
  label,
  icon,
  onClick,
  pressed,
  active,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={pressed}
      className={cn(
        'flex h-9 w-9 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-md border border-border transition-colors',
        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-primary/10 text-primary' : 'bg-card text-foreground/75',
      )}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
}
