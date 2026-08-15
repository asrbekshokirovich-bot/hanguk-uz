import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useLeads } from '@/hooks/useLeads';
import { LeadsTable } from '@/components/crm/leads/intake/LeadsTable';
import { LeadIntakeScreen } from '@/components/crm/leads/intake/LeadIntakeScreen';
import {
  LeadOutcomeDialog,
  type OutcomeMode,
} from '@/components/crm/leads/intake/LeadOutcomeDialog';
import {
  EMPTY_FORM,
  type IntakeForm,
  formFromLead,
  isLeadComplete,
  leadDataFromForm,
} from '@/components/crm/leads/intake/intakeForm';
import {
  type LeadOutcome,
  leadOutcome,
  noteWithRejection,
  noteWithoutRejection,
} from '@/components/crm/leads/intake/outcome';
import type { Lead } from '@/contexts/LeadsContext';

const TABS: LeadOutcome[] = ['active', 'converted', 'rejected'];

/**
 * CRM → Leads: the intake list.
 *
 * The page answers one question — *whose record is still missing answers* — and
 * gives the operator the form to fix it, plus the two ways a record leaves the
 * list: converted into a student, or rejected as not worth working. Rows are
 * ordered by completeness before recency: the list exists to be emptied of
 * half-filled records, and sorting the finished ones to the top would hide the
 * work.
 *
 * The form's rules live in `leads/intake/intakeForm`, the answer lists in
 * `leads/intake/options`, what counts as converted or rejected in
 * `leads/intake/outcome`, and the writes go through the existing `useLeads`
 * context so intake scoping, toasts and refetching behave as everywhere else.
 */
const LeadsContent = () => {
  const { t } = useTranslation();
  const { leads, loading, createLead, updateLead, convertToStudent, refetch } = useLeads();

  // One clock for the render pass, so the table's "3 days ago", the form's
  // "tomorrow" button and the semester list all agree with each other.
  const [now] = useState(() => new Date());
  // `null` = closed, `'new'` = a blank sheet, otherwise the lead being edited.
  const [editing, setEditing] = useState<Lead | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<LeadOutcome>('active');
  // The convert/reject confirmation, or `null` when nothing is pending.
  const [pending, setPending] = useState<{ mode: OutcomeMode; lead: Lead } | null>(null);

  const byOutcome = useMemo(() => {
    const groups: Record<LeadOutcome, Lead[]> = { active: [], converted: [], rejected: [] };
    for (const lead of leads) groups[leadOutcome(lead)].push(lead);
    for (const group of Object.values(groups)) {
      group.sort((a, b) => {
        const aComplete = isLeadComplete(a);
        const bComplete = isLeadComplete(b);
        if (aComplete !== bComplete) return aComplete ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return groups;
  }, [leads]);

  const shown = byOutcome[tab];

  // Held as a memo rather than copied into the screen's state on open, so
  // reopening the same lead after a save starts from what was actually stored.
  const initialForm: IntakeForm = useMemo(
    () => (editing && editing !== 'new' ? formFromLead(editing) : EMPTY_FORM),
    [editing],
  );

  const handleSave = async (form: IntakeForm) => {
    setBusy(true);
    try {
      const payload = leadDataFromForm(form);
      if (editing === 'new') {
        await createLead(payload);
      } else if (editing) {
        await updateLead(editing.id, payload);
        await refetch();
      }
      setEditing(null);
    } catch (error) {
      // `createLead`/`updateLead` surface their own toast; keep the sheet open
      // so the operator does not lose what they typed.
      console.error('Failed to save the lead:', error);
    } finally {
      setBusy(false);
    }
  };

  /** Confirmed convert or reject. Both toast through the context on failure. */
  const handleConfirm = async (reason: string, detail: string) => {
    if (!pending) return;
    const { mode, lead } = pending;
    setBusy(true);
    try {
      if (mode === 'convert') {
        const { success } = await convertToStudent(lead.id);
        if (!success) return;
        setTab('converted');
      } else {
        await updateLead(lead.id, {
          status: 'lost',
          notes: noteWithRejection(lead.notes, reason, detail),
        });
        await refetch();
      }
      setPending(null);
    } catch (error) {
      console.error('Failed to update the lead outcome:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (lead: Lead) => {
    setBusy(true);
    try {
      await updateLead(lead.id, {
        status: 'new',
        // `updateLead` treats `undefined` as "leave alone", so an emptied note
        // is written as a blank string rather than silently kept.
        notes: noteWithoutRejection(lead.notes),
      });
      await refetch();
    } catch (error) {
      console.error('Failed to restore the lead:', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1360px] px-1 pb-16 pt-1">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-[28px] font-bold tracking-[-0.015em]">{t('navigation.leads')}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t('leads.intake.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="min-h-11 rounded-[10px] bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('leads.intake.newLead')}
          </button>
        </div>

        <div
          role="tablist"
          aria-label={t('leads.intake.tabs.label')}
          className="mb-5 flex flex-wrap gap-2"
        >
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'min-h-10 rounded-full border px-4 text-[13px] font-semibold transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab === key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {t(`leads.intake.tabs.${key}`)}
              <span className="ml-1.5 tabular-nums opacity-80">{byOutcome[key].length}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">{t(`leads.intake.emptyBy.${tab}`)}</p>
          </div>
        ) : (
          <LeadsTable
            leads={shown}
            onOpen={setEditing}
            onConvert={(lead) => setPending({ mode: 'convert', lead })}
            onReject={(lead) => setPending({ mode: 'reject', lead })}
            onRestore={handleRestore}
            now={now}
          />
        )}
      </div>

      {editing && (
        <LeadIntakeScreen
          initial={initialForm}
          isNew={editing === 'new'}
          now={now}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {pending && (
        <LeadOutcomeDialog
          mode={pending.mode}
          lead={pending.lead}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
};

export default LeadsContent;
