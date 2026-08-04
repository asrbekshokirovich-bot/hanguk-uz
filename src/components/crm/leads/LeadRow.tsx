import { useTranslation } from 'react-i18next';
import { Phone, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ATTEMPT_ALARM, isOverdue } from './worklistLogic';
import { useDueLabel } from './useDueLabel';
import { isGoalKey } from './nextCall';
import { formatCity, formatPhone } from './format';
import type { LeadVM } from './types';

interface LeadRowProps {
  lead: LeadVM;
  selected: boolean;
  onSelect: (lead: LeadVM) => void;
  onCall: (lead: LeadVM) => void;
}

/**
 * One worklist row, in four zones: score · identity · next call · right cluster.
 *
 * The row never wraps and every sub-line truncates — an operator scanning the
 * queue reads down fixed columns, so a long name must not push the Call button
 * onto a second line. Below the worklist's min width the whole list scrolls
 * horizontally instead.
 *
 * The left border encodes urgency at a glance: danger when overdue, primary
 * when never called, accent when a consultation is booked.
 */
export function LeadRow({ lead, selected, onSelect, onCall }: LeadRowProps) {
  const { t } = useTranslation();
  const overdue = isOverdue(lead);
  const dueLabel = useDueLabel(lead.dueInMinutes);

  const tierText =
    lead.tier === 'hot' ? 'text-spring' : lead.tier === 'warm' ? 'text-warning' : 'text-muted-foreground';
  const edge = overdue
    ? 'border-l-destructive'
    : lead.stage === 'new'
      ? 'border-l-primary'
      : lead.stage === 'booked'
        ? 'border-l-accent'
        : 'border-l-border';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(lead)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(lead);
        }
      }}
      className={cn(
        'flex flex-nowrap items-center gap-3 rounded-lg border border-l-[3px] bg-card px-3 py-2.5 shadow-card transition-colors',
        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        edge,
        overdue ? 'border-destructive/50' : 'border-border',
        selected && 'border-primary ring-1 ring-primary',
      )}
    >
      {/* 1 — score + tier */}
      <div className="flex w-10 shrink-0 flex-col items-center gap-0.5">
        <span className={cn('font-mono text-lg font-extrabold leading-none', tierText)}>{lead.score}</span>
        <span className="text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground">
          {t(`leads.worklist.tier.${lead.tier}`)}
        </span>
      </div>

      {/* 2 — avatar, toned by tier */}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            'text-[11px] font-semibold',
            lead.tier === 'hot' ? 'bg-accent/30 text-accent-foreground' : 'bg-primary/10 text-primary',
          )}
        >
          {lead.initials}
        </AvatarFallback>
      </Avatar>

      {/* 3 — identity */}
      <div className="min-w-[190px] flex-[1.5] overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-foreground">{lead.name}</span>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {t(`leads.sources.${lead.source}`)}
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {[formatPhone(lead.phone), formatCity(lead.city)].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>

      {/* 4 — next call */}
      <div className="min-w-[200px] flex-[1.2] overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {lead.aiInForce && (
            <span
              title={t('leads.nextCall.setByAi')}
              className="flex shrink-0 items-center gap-0.5 rounded bg-spring/15 px-1 py-0.5 text-[8.5px] font-bold tracking-wide text-spring"
            >
              <Sparkles className="h-2.5 w-2.5" aria-hidden />
              {t('leads.nextCall.aiChip')}
            </span>
          )}
          <span className="truncate text-[12.5px] font-semibold text-muted-foreground">
            {isGoalKey(lead.nextCall.goal)
              ? t(`leads.nextCall.goals.${lead.nextCall.goal}`)
              : lead.nextCall.goal}
          </span>
        </div>
        <div
          className={cn(
            'mt-0.5 whitespace-nowrap text-[11px] font-semibold',
            overdue ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {dueLabel}
        </div>
      </div>

      {/* 5 — stage, attempts, Call */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="whitespace-nowrap rounded-full bg-muted px-2 py-1 text-[10.5px] font-semibold text-muted-foreground">
          {t(`leads.worklist.stage.${lead.stage}`)}
        </span>
        <span
          className={cn(
            'whitespace-nowrap rounded-full px-2 py-1 font-mono text-[10.5px] font-semibold',
            lead.attempts >= ATTEMPT_ALARM
              ? 'bg-destructive/10 text-destructive'
              : lead.attempts === 0
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {lead.attempts === 0
            ? t('leads.worklist.uncalled')
            : t('leads.worklist.attempts', { n: lead.attempts })}
        </span>
        <button
          type="button"
          title={t('leads.worklist.logCall')}
          onClick={(e) => {
            e.stopPropagation();
            onCall(lead);
          }}
          className="flex h-11 min-w-[44px] shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-semibold text-accent-foreground transition-[filter] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden />
          {t('leads.call')}
        </button>
      </div>
    </div>
  );
}
