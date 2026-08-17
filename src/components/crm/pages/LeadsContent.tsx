import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
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
  matchesLeadQuery,
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
  const { leads, loading, createLead, updateLead, convertToStudent, deleteLead, refetch } =
    useLeads();

  // One clock for the render pass, so the table's "3 days ago", the form's
  // "tomorrow" button and the semester list all agree with each other.
  const [now] = useState(() => new Date());
  // `null` = closed, `'new'` = a blank sheet, otherwise the lead being edited.
  const [editing, setEditing] = useState<Lead | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<LeadOutcome>('active');
  // The convert/reject confirmation, or `null` when nothing is pending.
  const [pending, setPending] = useState<{ mode: OutcomeMode; lead: Lead } | null>(null);
  const [query, setQuery] = useState('');

  // The search narrows the groups BEFORE they are counted, so the tab badges
  // answer "which list is this person in" rather than staying at their
  // unfiltered totals. Someone who searches a phone number and finds nothing
  // under Active can see at a glance that the match sits under Converted.
  const byOutcome = useMemo(() => {
    const groups: Record<LeadOutcome, Lead[]> = { active: [], converted: [], rejected: [] };
    for (const lead of leads) {
      if (!matchesLeadQuery(lead, query)) continue;
      groups[leadOutcome(lead)].push(lead);
    }
    for (const group of Object.values(groups)) {
      group.sort((a, b) => {
        const aComplete = isLeadComplete(a);
        const bComplete = isLeadComplete(b);
        if (aComplete !== bComplete) return aComplete ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return groups;
  }, [leads, query]);

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
        setEditing(null);
        setTab('converted');
      } else if (mode === 'delete') {
        await deleteLead(lead.id);
        setEditing(null);
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

  /**
   * Convert straight from the open sheet.
   *
   * The form is saved first because `convertToStudent` reads the STORED
   * record: converting off unsaved edits would open a student account from the
   * previous, emptier version of the lead — and the operator would have no way
   * to tell, because the screen in front of them shows the newer one.
   */
  const handleConvertFromSheet = async (lead: Lead, form: IntakeForm) => {
    setBusy(true);
    try {
      await updateLead(lead.id, leadDataFromForm(form));
      await refetch();
    } catch (error) {
      // Do not offer to convert a record we failed to write.
      console.error('Failed to save before converting:', error);
      return;
    } finally {
      setBusy(false);
    }
    setPending({ mode: 'convert', lead });
  };

  const handleRestore = async (lead: Lead) => {
    setBusy(true);
    try {
      await updateLead(lead.id, {
        // Back to where the lead was before it was rejected: a record someone
        // had already spoken to is not a new lead, and calling it one would put
        // it back at the top of the call list.
        status: lead.last_contacted_at ? 'contacted' : 'new',
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

        {/* Toggle buttons rather than a tablist: there is one list below them
            that they filter, not three panels to switch between. The search box
            sits with them because it filters that same list. */}
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="relative min-w-[240px] flex-1 sm:max-w-[340px]">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('leads.intake.searchPlaceholder')}
              aria-label={t('leads.intake.searchLabel')}
              className="h-10 w-full rounded-full border border-input bg-background pl-9 pr-3 text-[13px] outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/35"
            />
          </div>
          <div
            role="group"
            aria-label={t('leads.intake.tabs.label')}
            className="flex flex-wrap gap-2"
          >
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
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
        </div>

        {loading ? (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {query.trim()
                ? t('leads.intake.noMatches', { query: query.trim() })
                : t(`leads.intake.emptyBy.${tab}`)}
            </p>
          </div>
        ) : (
          <LeadsTable
            leads={shown}
            onOpen={setEditing}
            onConvert={(lead) => setPending({ mode: 'convert', lead })}
            onReject={(lead) => setPending({ mode: 'reject', lead })}
            onRestore={handleRestore}
            busy={busy}
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
          onConvert={
            editing === 'new' ? undefined : (form) => void handleConvertFromSheet(editing, form)
          }
          // Offered to every role that may work a lead — the operator on the
          // call is the one who learns there will be no contract. The database
          // agrees ("Staff can delete leads", migration 20260817060000); a
          // button the row-level check would refuse is a dead end dressed as a
          // choice, so the two have to say the same thing.
          onDelete={
            editing === 'new' ? undefined : () => setPending({ mode: 'delete', lead: editing })
          }
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
