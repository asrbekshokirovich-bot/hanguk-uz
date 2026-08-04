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
import { HandoffBanner } from '@/components/crm/leads/HandoffBanner';
import { BOOK_EFFECT, dispositionEffect } from '@/components/crm/leads/dispositions';
import { aiPlan } from '@/components/crm/leads/aiPlanner';
import { resolveTiming } from '@/components/crm/leads/aiPlanner';
import type { AiPlan, GoalKey, TimingKey } from '@/components/crm/leads/aiPlanner';
import { buildBands, filterLeads, worklistStats } from '@/components/crm/leads/worklistLogic';
import type { QualificationKey } from '@/components/crm/leads/qualification';
import type { Disposition, LeadVM, SourceFilter } from '@/components/crm/leads/types';
import type { DispositionEffect } from '@/components/crm/leads/dispositions';
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
  const { createLead, refetch, convertToStudent } = useLeads();
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
  // The lime strip that explains why a row just vanished from the worklist.
  const [handoff, setHandoff] = useState<string | null>(null);
  // "Keep both" has no column to be stored in, so the dismissal lasts for the
  // session. The decision itself is logged to the touch history either way.
  const [dismissedDuplicates, setDismissedDuplicates] = useState<string[]>([]);
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

  // Click-to-call has no telephony binding in this app, so the row's Call
  // button opens the lead ready to log the outcome rather than dialling.
  const handleCall = (lead: LeadVM) => {
    setSelectedId(lead.id);
    detail.show();
  };

  /** One `lead_notes` row. Every state change on this page leaves a trace. */
  const logTouch = async (leadId: string, content: string, outcome?: string, type = 'note') => {
    if (!user) return;
    const { error } = await supabase.from('lead_notes').insert({
      lead_id: leadId,
      content,
      contact_type: type,
      outcome: outcome ?? null,
      contacted_at: new Date().toISOString().split('T')[0],
      created_by: user.id,
    });
    if (error) console.error('Failed to write the touch history:', error);
  };

  /**
   * Applies a call outcome: move the stage, count the attempt, write the
   * history, then let Hanguk AI re-plan the next call from the new state.
   *
   * The AI's plan is written as part of the same action rather than left for
   * the operator, because a logged call with no next step is exactly how a
   * lead goes quiet.
   */
  const applyOutcome = async (lead: LeadVM, effect: DispositionEffect, note: string) => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status: effect.status,
          last_contacted_at: new Date().toISOString(),
        })
        .eq('id', lead.id);
      if (error) throw error;

      await logTouch(lead.id, note, effect.outcome, 'call');

      if (effect.plan) {
        const plan = aiPlan({
          lead: lead.lead,
          attempts: lead.attempts,
          outcome: effect.plan,
          now: new Date(),
        });
        const reason = t(plan.reasonKey, plan.reasonVars);
        await nextCallWriter.write({
          leadId: lead.id,
          goal: plan.goal,
          dueAt: plan.dueAt,
          reason,
          operatorId: null,
        });
        await logTouch(
          lead.id,
          t('leads.dispositions.aiReplanNote', {
            goal: t(`leads.nextCall.goals.${plan.goal}`),
          }),
        );
      }

      if (effect.removes) {
        setSelectedId(null);
        setHandoff(t('leads.handoff.removed', { name: lead.name }));
      }
      await Promise.all([refetch(), refreshHistory()]);
    } catch (error) {
      console.error('Failed to log the call:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleLogCall = (lead: LeadVM, disposition: Disposition) => {
    const effect = dispositionEffect(disposition);
    return applyOutcome(
      lead,
      effect,
      t(`leads.dispositions.notes.${disposition}`, { n: lead.attempts + 1 }),
    );
  };

  const handleBook = (lead: LeadVM) =>
    applyOutcome(lead, BOOK_EFFECT, t('leads.dispositions.notes.booked'));

  /**
   * Merge marks the newer record lost and points it at the original, so the
   * earlier history stays the one the office works from. A real field-level
   * merge belongs in a server function; this is the conservative half of it.
   */
  const handleMerge = async (lead: LeadVM) => {
    if (!lead.duplicateOfId) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'lost', notes: `Merged into lead ${lead.duplicateOfId}` })
        .eq('id', lead.id);
      if (error) throw error;
      await logTouch(lead.id, t('leads.duplicate.mergedNote', { name: lead.duplicateNote }));
      await logTouch(lead.duplicateOfId, t('leads.duplicate.mergedIntoNote', { name: lead.name }));
      setSelectedId(null);
      setHandoff(t('leads.handoff.merged', { name: lead.name }));
      await Promise.all([refetch(), refreshHistory()]);
    } catch (error) {
      console.error('Failed to merge the duplicate:', error);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Keep both is a judgement, not a no-op — two siblings can share a phone —
   * so it is logged, even though nothing on the record changes.
   */
  const handleKeepBoth = async (lead: LeadVM) => {
    setBusy(true);
    try {
      await logTouch(lead.id, t('leads.duplicate.keptBothNote'));
      setDismissedDuplicates((prev) => [...prev, lead.id]);
      await refreshHistory();
    } finally {
      setBusy(false);
    }
  };

  /**
   * Convert hands the lead to the existing `convertToStudent` flow, which
   * creates the student record and the contract. The lime strip then names the
   * document pack the preparers pick up — the same handoff Documents consumes.
   */
  const handleConvert = async (lead: LeadVM) => {
    setBusy(true);
    try {
      const result = await convertToStudent(lead.id);
      if (!result.success) return;
      await logTouch(lead.id, t('leads.convertPanel.convertedNote'));
      setSelectedId(null);
      setHandoff(t('leads.handoff.converted', { name: lead.name }));
      await Promise.all([refetch(), refreshHistory()]);
    } catch (error) {
      console.error('Failed to convert the lead:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleLost = async (lead: LeadVM) => {
    setBusy(true);
    try {
      const { error } = await supabase.from('leads').update({ status: 'lost' }).eq('id', lead.id);
      if (error) throw error;
      await logTouch(lead.id, t('leads.convertPanel.lostNote'));
      setSelectedId(null);
      setHandoff(t('leads.handoff.lost', { name: lead.name }));
      await Promise.all([refetch(), refreshHistory()]);
    } catch (error) {
      console.error('Failed to mark the lead lost:', error);
    } finally {
      setBusy(false);
    }
  };

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
          {handoff && <HandoffBanner message={handoff} onDismiss={() => setHandoff(null)} />}
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
            showDuplicate={!!selected && !dismissedDuplicates.includes(selected.id)}
            onLogCall={handleLogCall}
            onMerge={handleMerge}
            onKeepBoth={handleKeepBoth}
            onBook={handleBook}
            onConvert={handleConvert}
            onLost={handleLost}
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
