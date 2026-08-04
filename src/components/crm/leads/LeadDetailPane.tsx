import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, User } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScoreBreakdown } from './ScoreBreakdown';
import { CallDispositions } from './CallDispositions';
import { DuplicateBanner } from './DuplicateBanner';
import { ConvertPanel } from './ConvertPanel';
import { NextCallCard } from './NextCallCard';
import { QualificationList } from './QualificationList';
import { TouchHistory } from './TouchHistory';
import type { QualificationKey } from './qualification';
import type { AiPlan, GoalKey, TimingKey } from './aiPlanner';
import type { Disposition, LeadVM } from './types';

interface LeadDetailPaneProps {
  lead: LeadVM | null;
  docked: boolean;
  onClose: () => void;
  onAsk: (lead: LeadVM, key: QualificationKey) => void;
  onPickGoal: (lead: LeadVM, goal: GoalKey) => void;
  onPickTiming: (lead: LeadVM, timing: TimingKey) => void;
  onUseAiPlan: (lead: LeadVM, suggestion: AiPlan) => void;
  /** False once the operator has answered the duplicate question. */
  showDuplicate: boolean;
  onLogCall: (lead: LeadVM, disposition: Disposition) => void;
  onMerge: (lead: LeadVM) => void;
  onKeepBoth: (lead: LeadVM) => void;
  onBook: (lead: LeadVM) => void;
  onConvert: (lead: LeadVM) => void;
  onLost: (lead: LeadVM) => void;
  operatorName: string;
  now: Date;
  busy: boolean;
}

/**
 * The lead detail pane: score breakdown, qualification gate and touch history.
 *
 * Docked above 1440px it is a plain third column. Below that it becomes an
 * overlay pinned to the right edge with a scrim behind it (rendered by the
 * page), closing on the scrim, the close button, or Escape. Focus moves into
 * the pane when it opens as an overlay so a keyboard user is not left behind
 * on the worklist.
 */
export function LeadDetailPane({
  lead,
  docked,
  onClose,
  onAsk,
  onPickGoal,
  onPickTiming,
  onUseAiPlan,
  showDuplicate,
  onLogCall,
  onMerge,
  onKeepBoth,
  onBook,
  onConvert,
  onLost,
  operatorName,
  now,
  busy,
}: LeadDetailPaneProps) {
  const { t } = useTranslation();
  const paneRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (docked) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    paneRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [docked, onClose]);

  const shell = cn(
    'w-[400px] min-w-[360px] shrink-0 overflow-y-auto border-l border-border bg-card',
    !docked && 'absolute inset-y-0 right-0 z-30 shadow-raised',
  );

  if (!lead) {
    return (
      <aside
        ref={paneRef}
        tabIndex={-1}
        aria-label={t('leads.detail.paneLabel')}
        className={cn(shell, 'flex flex-col items-center justify-center gap-3 px-7 py-10 text-center')}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <User className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <div>
          <p className="text-[15px] font-bold text-foreground">{t('leads.detail.emptyTitle')}</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{t('leads.detail.emptyBody')}</p>
        </div>
      </aside>
    );
  }

  const pills = [
    t(`leads.sources.${lead.source}`),
    lead.city,
    t('leads.detail.ownerPill', { name: lead.owner ?? t('leads.unassigned') }),
    t('leads.detail.agePill', {
      age: formatDistanceToNowStrict(new Date(lead.createdAt)),
    }),
  ].filter(Boolean) as string[];

  return (
    <aside
      ref={paneRef}
      tabIndex={-1}
      aria-label={t('leads.detail.paneLabel')}
      className={cn(shell, 'focus-visible:outline-none')}
    >
      <header className="border-b border-border px-4 pb-4 pt-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarFallback
              className={cn(
                'text-sm font-semibold',
                lead.tier === 'hot' ? 'bg-accent/30 text-accent-foreground' : 'bg-primary/10 text-primary',
              )}
            >
              {lead.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-foreground">{lead.name}</h2>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{lead.phone ?? '—'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('leads.detail.close')}
            aria-label={t('leads.detail.close')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pills.map((pill) => (
            <span
              key={pill}
              className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
            >
              {pill}
            </span>
          ))}
        </div>
      </header>

      {lead.duplicateOfId && showDuplicate && (
        <DuplicateBanner lead={lead} onMerge={onMerge} onKeepBoth={onKeepBoth} busy={busy} />
      )}
      <ScoreBreakdown lead={lead} />
      <CallDispositions lead={lead} onLog={onLogCall} busy={busy} />
      <NextCallCard
        plan={{ current: lead.nextCall, suggestion: lead.aiSuggestion, aiInForce: lead.aiInForce }}
        now={now}
        operatorName={operatorName}
        onPickGoal={(goal) => onPickGoal(lead, goal)}
        onPickTiming={(timing) => onPickTiming(lead, timing)}
        onUseAiPlan={(suggestion) => onUseAiPlan(lead, suggestion)}
        busy={busy}
      />
      <QualificationList lead={lead} onAsk={(key) => onAsk(lead, key)} busy={busy} />
      <TouchHistory lead={lead} />
      <ConvertPanel lead={lead} onBook={onBook} onConvert={onConvert} onLost={onLost} busy={busy} />
    </aside>
  );
}
