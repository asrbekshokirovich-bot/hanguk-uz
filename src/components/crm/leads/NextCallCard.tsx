import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MANUAL_GOALS, MANUAL_TIMINGS } from './aiPlanner';
import type { AiPlan, GoalKey, TimingKey } from './aiPlanner';
import { formatDue } from './useDueLabel';
import { isGoalKey } from './nextCall';
import type { ResolvedNextCall } from './nextCall';
import { minutesUntil } from './worklistLogic';

interface NextCallCardProps {
  plan: ResolvedNextCall;
  now: Date;
  operatorName: string;
  onPickGoal: (goal: GoalKey) => void;
  onPickTiming: (timing: TimingKey) => void;
  onUseAiPlan: (suggestion: AiPlan) => void;
  busy: boolean;
}

/** Goals may be stored as a planner key or as free text from an older record. */
function GoalText({ goal }: { goal: string }) {
  const { t } = useTranslation();
  return <>{isGoalKey(goal) ? t(`leads.nextCall.goals.${goal}`) : goal}</>;
}

/**
 * The next call: what it is for, when it is, who decided, and why.
 *
 * Hanguk AI assigns it automatically from the lead's own record, and shows its
 * reasoning — an assignment an operator cannot interrogate is one they will
 * ignore. Manual assignment is always one tap away, and choosing either a goal
 * or a timing flips authorship to the operator. The AI keeps its opinion
 * visible after an override, with a one-click revert, so overriding never
 * means losing the recommendation.
 */
export function NextCallCard({
  plan,
  now,
  operatorName,
  onPickGoal,
  onPickTiming,
  onUseAiPlan,
  busy,
}: NextCallCardProps) {
  const { t } = useTranslation();
  const { current, suggestion, aiInForce } = plan;
  const dueMinutes = minutesUntil(current.dueAt, now);
  const overdue = dueMinutes !== null && dueMinutes < 0;

  const why = current.reason || t(suggestion.reasonKey, suggestion.reasonVars);

  return (
    <section className="border-b border-border px-4 py-4">
      <div className="mb-2.5 flex items-center gap-2">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          {t('leads.nextCall.title')}
        </h3>
        <span
          className={cn(
            'ml-auto whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold',
            aiInForce ? 'bg-spring/15 text-spring' : 'bg-muted text-muted-foreground',
          )}
        >
          {aiInForce ? t('leads.nextCall.setByAi') : t('leads.nextCall.setByOperator', { name: operatorName })}
        </span>
      </div>

      <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
        <p className="text-[13.5px] font-semibold text-foreground">
          <GoalText goal={current.goal} />
        </p>
        <p
          className={cn(
            'mt-1 text-[11.5px] font-semibold',
            overdue ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {t('leads.nextCall.scheduled', { when: formatDue(dueMinutes, t) })}
        </p>
      </div>

      {aiInForce ? (
        <div className="mt-2.5 flex gap-2.5 rounded-md border border-accent bg-accent/10 px-3 py-2.5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-spring" aria-hidden />
          <div className="min-w-0">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-spring">
              {t('leads.nextCall.whyTitle')}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{why}</p>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 rounded-md border border-primary bg-primary/10 px-3 py-2.5">
          <div className="flex gap-2.5">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-primary">
                {t('leads.nextCall.suggestsInstead')}
              </p>
              <p className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                {t(`leads.nextCall.goals.${suggestion.goal}`)} ·{' '}
                {formatDue(suggestion.dueInMinutes, t)}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {t(suggestion.reasonKey, suggestion.reasonVars)}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onUseAiPlan(suggestion)}
            className="mt-2.5 h-11 w-full rounded-md bg-primary text-[12px] font-semibold text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            {t('leads.nextCall.useAiPlan')}
          </button>
        </div>
      )}

      <h4 className="mb-1.5 mt-3.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {t('leads.nextCall.assignManually')}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {MANUAL_GOALS.map((goal) => {
          const active = current.goal === goal;
          return (
            <button
              key={goal}
              type="button"
              aria-pressed={active}
              disabled={busy}
              onClick={() => onPickGoal(goal)}
              className={cn(
                'h-8 shrink-0 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-semibold transition-colors disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary',
              )}
            >
              {t(`leads.nextCall.goals.${goal}`)}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {MANUAL_TIMINGS.map((timing) => (
          <button
            key={timing}
            type="button"
            disabled={busy}
            onClick={() => onPickTiming(timing)}
            className="h-8 shrink-0 whitespace-nowrap rounded-full border border-border px-2.5 font-mono text-[11.5px] font-semibold text-muted-foreground transition-colors hover:border-primary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            {t(`leads.nextCall.timings.${timing}`)}
          </button>
        ))}
      </div>
    </section>
  );
}
