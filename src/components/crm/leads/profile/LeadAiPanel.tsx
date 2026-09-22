import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SuggestionRow } from './SuggestionRow';
import { WORK_FIELDS, type Suggestion } from './useLeadProfile';

interface LeadAiPanelProps {
  suggestions: Suggestion[];
  analyzing: boolean;
  onAccept: (id: string, value?: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onAnalyze: () => Promise<void>;
  onShowEvidence: (suggestion: Suggestion) => void;
}

/**
 * What the AI made of the whole conversation, and what an operator does about it.
 *
 * The panel is split in three because the rows are not the same kind of thing.
 * The summary is orientation. The work items — an unanswered question, a
 * promise we made — are debts that someone has to clear. The rest are plain
 * attributes for the card. Filed as one list the debts read like trivia and get
 * skimmed, which is how they became debts in the first place.
 *
 * Nothing here writes to the lead on its own. Every row is a proposal until a
 * person accepts it, and an accepted value keeps the sentence it came from, so
 * a wrong one can be traced rather than argued about.
 */
export function LeadAiPanel({
  suggestions,
  analyzing,
  onAccept,
  onReject,
  onAnalyze,
  onShowEvidence,
}: LeadAiPanelProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const { summary, work, facts, pending } = useMemo(() => {
    const summaryRow = suggestions.find((s) => s.field === 'summary') ?? null;
    const rest = suggestions.filter((s) => s.field !== 'summary');
    return {
      summary: summaryRow,
      work: rest.filter((s) => WORK_FIELDS.has(s.field)),
      facts: rest.filter((s) => !WORK_FIELDS.has(s.field)),
      pending: rest.filter((s) => s.status === 'pending'),
    };
  }, [suggestions]);

  const guard = async (fn: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : failure);
    } finally {
      setBusy(false);
    }
  };

  const accept = (id: string, value?: string) =>
    guard(() => onAccept(id, value), t('leads.profile.ai.acceptFailed'));
  const reject = (id: string) => guard(() => onReject(id), t('leads.profile.ai.rejectFailed'));

  /**
   * Accept-all covers the plain attributes only.
   *
   * A work item is not accepted, it is done — clearing "we promised to call on
   * the 2nd" with a bulk button would mark the debt settled without anyone
   * having called. Those stay one at a time, on purpose.
   */
  const acceptAll = () =>
    guard(async () => {
      const targets = facts.filter((s) => s.status === 'pending');
      for (const row of targets) {
        await onAccept(row.id);
      }
      toast.success(t('leads.profile.ai.acceptedAll', { count: targets.length }));
    }, t('leads.profile.ai.acceptFailed'));

  const analyze = () =>
    guard(async () => {
      await onAnalyze();
      toast.success(t('leads.profile.ai.analyzed'));
    }, t('leads.profile.ai.analyzeFailed'));

  const pendingFacts = facts.filter((s) => s.status === 'pending').length;

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-[13px] font-bold text-foreground">{t('leads.profile.ai.title')}</h2>
        {suggestions.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {t('leads.profile.ai.count', { count: suggestions.length })}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={analyze}
            disabled={busy || analyzing}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', analyzing && 'animate-spin')} aria-hidden />
            {analyzing ? t('leads.profile.ai.analyzing') : t('leads.profile.ai.reanalyze')}
          </button>
          {pendingFacts > 1 && (
            <button
              type="button"
              onClick={acceptAll}
              disabled={busy}
              className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {t('leads.profile.ai.acceptAll', { count: pendingFacts })}
            </button>
          )}
        </div>
      </header>

      {suggestions.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-[14px] font-bold text-foreground">{t('leads.profile.ai.emptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-muted-foreground">
            {t('leads.profile.ai.emptyBody')}
          </p>
          <button
            type="button"
            onClick={analyze}
            disabled={busy || analyzing}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {analyzing ? t('leads.profile.ai.analyzing') : t('leads.profile.ai.analyzeNow')}
          </button>
        </div>
      ) : (
        <div className="space-y-4 px-4 py-4">
          {summary && (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                {t('leads.profile.ai.summary')}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                {summary.corrected_value ?? summary.suggested_value}
              </p>
              {summary.status === 'pending' && (
                <div className="mt-2.5 flex gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => accept(summary.id)}
                    className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {t('leads.profile.ai.saveToCard')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => reject(summary.id)}
                    className="rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {t('leads.profile.ai.reject')}
                  </button>
                </div>
              )}
            </div>
          )}

          {work.length > 0 && (
            <div>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-amber-700">
                {t('leads.profile.ai.workTitle')}
              </h3>
              <div className="space-y-2">
                {work.map((row) => (
                  <SuggestionRow
                    key={row.id}
                    suggestion={row}
                    emphasis
                    busy={busy}
                    onAccept={accept}
                    onReject={reject}
                    onShowEvidence={onShowEvidence}
                  />
                ))}
              </div>
            </div>
          )}

          {facts.length > 0 && (
            <div>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                {t('leads.profile.ai.factsTitle')}
              </h3>
              <div className="space-y-2">
                {facts.map((row) => (
                  <SuggestionRow
                    key={row.id}
                    suggestion={row}
                    emphasis={false}
                    busy={busy}
                    onAccept={accept}
                    onReject={reject}
                    onShowEvidence={onShowEvidence}
                  />
                ))}
              </div>
            </div>
          )}

          <p className="pt-1 text-center text-[11px] text-muted-foreground">
            {t('leads.profile.ai.footnote')}
          </p>
        </div>
      )}
    </section>
  );
}
