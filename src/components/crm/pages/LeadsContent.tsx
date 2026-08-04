import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AddLeadWizard } from '@/components/leads/AddLeadWizard';
import { LeadsFilterStrip } from '@/components/crm/leads/LeadsFilterStrip';
import { LeadRow } from '@/components/crm/leads/LeadRow';
import { WorklistBand } from '@/components/crm/leads/WorklistBand';
import { WorklistEmpty } from '@/components/crm/leads/WorklistEmpty';
import { LeadDetailPane } from '@/components/crm/leads/LeadDetailPane';
import { useLeadWorklist } from '@/components/crm/leads/useLeadWorklist';
import { useDetailDock } from '@/components/crm/leads/useDetailDock';
import { useNextCallWriter } from '@/components/crm/leads/useNextCallWriter';
import { resolveTiming } from '@/components/crm/leads/aiPlanner';
import type { AiPlan, GoalKey, TimingKey } from '@/components/crm/leads/aiPlanner';
import { buildBands, filterLeads, worklistStats } from '@/components/crm/leads/worklistLogic';
import type { QualificationKey } from '@/components/crm/leads/qualification';
import type { LeadVM, SourceFilter } from '@/components/crm/leads/types';
import type { ContactOutcome, ContactType } from '@/hooks/useLeadNotes';
import type { CreateLeadData } from '@/contexts/LeadsContext';

/**
 * CRM → Leads: an urgency-banded call worklist for call operators.
 *
 * The queue is banded by *urgency* rather than by pipeline stage, because the
 * question an operator answers on a shift is "who do I ring next", not "what
 * stage is everyone at". Overdue promises come first, then leads whose
 * first-response clock is still running, then booked consultations, then
 * everything in conversation.
 *
 * This file is orchestration only: the scoring lives in `leads/leadScore`, the
 * filtering and banding in `leads/worklistLogic`, the Supabase reads in
 * `leads/useLeadWorklist`, and every pixel in the `leads/*` components.
 */
const LeadsContent = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { createLead, refetch } = useLeads();
  // The operator's display name, for the "Set by …" badge on a manual override.
  const operatorName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? t('leads.unassigned');

  // One clock for the whole render pass, so the score, the bands and every due
  // line agree with each other. Re-created only when the component re-mounts.
  const [now] = useState(() => new Date());
  const { rows, loading, refreshHistory } = useLeadWorklist(now, operatorName);
  const detail = useDetailDock();
  const nextCallWriter = useNextCallWriter();

  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [callToday, setCallToday] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [students, setStudents] = useState<{ user_id: string; full_name: string | null }[]>([]);

  const visible = useMemo(
    () => filterLeads(rows, source, callToday, query),
    [rows, source, callToday, query],
  );
  const bands = useMemo(() => buildBands(visible), [visible]);
  // Stats read the whole worklist, not the filtered view — narrowing to one
  // source must not hide how much work is actually overdue.
  const stats = useMemo(() => worklistStats(rows), [rows]);

  // The selected lead is resolved out of the live rows rather than held as an
  // object, so the pane re-renders from fresh data after every write.
  const selected = useMemo(
    () => visible.find((lead) => lead.id === selectedId) ?? null,
    [visible, selectedId],
  );

  const handleSelect = (lead: LeadVM) => {
    setSelectedId(lead.id);
    // Picking a row is a deliberate act, so it opens the pane at any width.
    // Only *first paint* defaults closed in overlay mode, so no row's Call
    // button is ever covered before the operator has asked for the pane.
    detail.show();
  };

  // Click-to-call is not wired to telephony yet; selecting the lead is what the
  // Call button can honestly do until the dispositions land in step 4.
  const handleCall = (lead: LeadVM) => setSelectedId(lead.id);

  /**
   * Saves a next-call assignment and logs it, then refreshes both the lead
   * rows and the history so the pane reflects what was actually written.
   */
  const saveNextCall = async (
    lead: LeadVM,
    goal: string,
    dueAt: string,
    reason: string,
    byAi: boolean,
    note: string,
  ) => {
    if (!user) return;
    setBusy(true);
    try {
      const saved = await nextCallWriter.write({
        leadId: lead.id,
        goal,
        dueAt,
        reason,
        operatorId: byAi ? null : user.id,
      });
      if (!saved) return;
      await supabase.from('lead_notes').insert({
        lead_id: lead.id,
        content: note,
        contact_type: 'note',
        created_by: user.id,
      });
      await Promise.all([refetch(), refreshHistory()]);
    } catch (error) {
      console.error('Failed to set the next call:', error);
    } finally {
      setBusy(false);
    }
  };

  /** Manual goal: keeps whatever timing is already on the board. */
  const handlePickGoal = (lead: LeadVM, goal: GoalKey) =>
    saveNextCall(
      lead,
      goal,
      lead.nextCall.dueAt ?? lead.aiSuggestion.dueAt,
      t('leads.nextCall.manualReason', { name: operatorName }),
      false,
      t('leads.nextCall.goalSetNote', { goal: t(`leads.nextCall.goals.${goal}`) }),
    );

  /** Manual timing: keeps whatever goal is already on the board. */
  const handlePickTiming = (lead: LeadVM, timing: TimingKey) =>
    saveNextCall(
      lead,
      lead.nextCall.goal,
      resolveTiming(timing, new Date()),
      t('leads.nextCall.manualReason', { name: operatorName }),
      false,
      t('leads.nextCall.timingSetNote', { when: t(`leads.nextCall.timings.${timing}`) }),
    );

  /** Revert to the AI's plan, goal and timing together. */
  const handleUseAiPlan = (lead: LeadVM, suggestion: AiPlan) =>
    saveNextCall(
      lead,
      suggestion.goal,
      suggestion.dueAt,
      t(suggestion.reasonKey, suggestion.reasonVars),
      true,
      t('leads.nextCall.adoptedNote', { goal: t(`leads.nextCall.goals.${suggestion.goal}`) }),
    );

  /** Writes an unanswered qualification field into the touch history. */
  const handleAsk = async (lead: LeadVM, key: QualificationKey) => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('lead_notes').insert({
        lead_id: lead.id,
        content: t('leads.detail.askedNote', { field: t(`leads.qualification.${key}`) }),
        contact_type: 'note',
        created_by: user.id,
      });
      if (error) throw error;
      await refreshHistory();
    } catch (error) {
      console.error('Failed to flag a qualification field:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateLead = async (
    data: CreateLeadData,
    initialNote?: { content: string; contactType: ContactType; outcome: ContactOutcome },
  ) => {
    const newLead = await createLead(data);
    if (newLead && initialNote && user) {
      await supabase.from('lead_notes').insert({
        lead_id: newLead.id,
        content: initialNote.content,
        contact_type: initialNote.contactType,
        outcome: initialNote.outcome,
        contacted_at: new Date().toISOString().split('T')[0],
        created_by: user.id,
      });
    }
  };

  const openAddWizard = async () => {
    setAddOpen(true);
    if (students.length > 0) return;
    const [{ data: profiles }, { data: staffRoles }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').not('full_name', 'is', null),
      supabase.from('user_roles').select('user_id'),
    ]);
    const staffIds = new Set((staffRoles ?? []).map((role) => role.user_id));
    setStudents((profiles ?? []).filter((profile) => !staffIds.has(profile.user_id)));
  };

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[520px] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <h1 className="sr-only">{t('navigation.leads')}</h1>

      <LeadsFilterStrip
        query={query}
        onQueryChange={setQuery}
        source={source}
        onSourceChange={setSource}
        callToday={callToday}
        onCallTodayToggle={() => setCallToday((prev) => !prev)}
        stats={stats}
        onAddLead={openAddWizard}
        detailOpen={detail.open}
        onToggleDetail={detail.toggle}
      />

      <div className="relative flex min-h-0 flex-1 overflow-x-auto">
        <section className="min-w-[866px] flex-1 overflow-y-auto bg-background px-4 py-3.5">
          {loading ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : bands.length === 0 ? (
            <WorklistEmpty onAddLead={openAddWizard} />
          ) : (
            bands.map((band) => (
              <WorklistBand key={band.key} band={band.key} count={band.rows.length}>
                {band.rows.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    selected={lead.id === selectedId}
                    onSelect={handleSelect}
                    onCall={handleCall}
                  />
                ))}
              </WorklistBand>
            ))
          )}
        </section>

        {/* Scrim, overlay mode only. Clicking it closes the pane; Escape does
            the same, handled inside the pane. */}
        {!detail.docked && detail.open && (
          <div
            role="presentation"
            onClick={detail.close}
            className="absolute inset-0 z-20 cursor-pointer bg-foreground/30"
          />
        )}

        {detail.open && (
          <LeadDetailPane
            lead={selected}
            docked={detail.docked}
            onClose={detail.close}
            onAsk={handleAsk}
            onPickGoal={handlePickGoal}
            onPickTiming={handlePickTiming}
            onUseAiPlan={handleUseAiPlan}
            operatorName={operatorName}
            now={now}
            busy={busy || nextCallWriter.saving}
          />
        )}
      </div>

      <AddLeadWizard
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={handleCreateLead}
        students={students}
      />
    </div>
  );
};

export default LeadsContent;
