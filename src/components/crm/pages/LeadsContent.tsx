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
import { useLeadWorklist } from '@/components/crm/leads/useLeadWorklist';
import { buildBands, filterLeads, worklistStats } from '@/components/crm/leads/worklistLogic';
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
  const { createLead } = useLeads();

  // One clock for the whole render pass, so the score, the bands and every due
  // line agree with each other. Re-created only when the component re-mounts.
  const [now] = useState(() => new Date());
  const { rows, loading } = useLeadWorklist(now);

  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [callToday, setCallToday] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [students, setStudents] = useState<{ user_id: string; full_name: string | null }[]>([]);

  const visible = useMemo(
    () => filterLeads(rows, source, callToday, query),
    [rows, source, callToday, query],
  );
  const bands = useMemo(() => buildBands(visible), [visible]);
  // Stats read the whole worklist, not the filtered view — narrowing to one
  // source must not hide how much work is actually overdue.
  const stats = useMemo(() => worklistStats(rows), [rows]);

  const handleSelect = (lead: LeadVM) => setSelectedId(lead.id);

  // Click-to-call is not wired to telephony yet; selecting the lead is what the
  // Call button can honestly do until the dispositions land in step 4.
  const handleCall = (lead: LeadVM) => setSelectedId(lead.id);

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
