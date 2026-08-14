import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeads } from '@/hooks/useLeads';
import { LeadsTable } from '@/components/crm/leads/intake/LeadsTable';
import { LeadIntakeScreen } from '@/components/crm/leads/intake/LeadIntakeScreen';
import {
  EMPTY_FORM,
  type IntakeForm,
  formFromLead,
  isLeadComplete,
  leadDataFromForm,
} from '@/components/crm/leads/intake/intakeForm';
import type { Lead } from '@/contexts/LeadsContext';

/**
 * CRM → Leads: the intake list.
 *
 * The page answers one question — *whose record is still missing answers* — and
 * gives the operator the form to fix it. Rows are therefore ordered by
 * completeness before recency: the list exists to be emptied of half-filled
 * records, and sorting the finished ones to the top would hide the work.
 *
 * The form's rules live in `leads/intake/intakeForm`, the answer lists in
 * `leads/intake/options`, and the writes go through the existing `useLeads`
 * context so intake scoping, toasts and refetching behave as everywhere else.
 */
const LeadsContent = () => {
  const { t } = useTranslation();
  const { leads, loading, createLead, updateLead } = useLeads();

  // One clock for the render pass, so the table's "3 days ago", the form's
  // "tomorrow" button and the semester list all agree with each other.
  const [now] = useState(() => new Date());
  // `null` = closed, `'new'` = a blank sheet, otherwise the lead being edited.
  const [editing, setEditing] = useState<Lead | 'new' | null>(null);
  const [busy, setBusy] = useState(false);

  const ordered = useMemo(() => {
    const withFlag = leads.map((lead) => ({ lead, complete: isLeadComplete(lead) }));
    return withFlag
      .sort((a, b) => {
        if (a.complete !== b.complete) return a.complete ? 1 : -1;
        return new Date(b.lead.created_at).getTime() - new Date(a.lead.created_at).getTime();
      })
      .map((entry) => entry.lead);
  }, [leads]);

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

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1180px] px-1 pb-16 pt-1">
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

        {loading ? (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : ordered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">{t('leads.intake.empty')}</p>
          </div>
        ) : (
          <LeadsTable leads={ordered} onOpen={setEditing} now={now} />
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
    </div>
  );
};

export default LeadsContent;
