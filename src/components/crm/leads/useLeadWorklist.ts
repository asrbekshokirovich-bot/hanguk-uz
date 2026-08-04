import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLeads } from '@/hooks/useLeads';
import { leadScore, scoreFactors, tierFor } from './leadScore';
import { minutesUntil } from './worklistLogic';
import type { LeadRecord, LeadStage, LeadVM, TouchEntry } from './types';

/**
 * Supabase adapter for the Leads worklist.
 *
 * Takes the leads already loaded by `LeadsContext`, pulls their call history
 * out of `lead_notes` in one grouped read, and derives everything the worklist
 * needs that the schema does not store outright: attempt counts, the operator
 * stage, the score factors, and duplicate phone matches.
 */

/** Outcomes that mean the phone was not answered. */
const UNANSWERED = new Set(['no_answer', 'busy', 'voicemail']);

interface NoteRow {
  id: string;
  lead_id: string;
  content: string;
  outcome: string | null;
  contact_type: string | null;
  contacted_at: string | null;
  created_at: string;
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Last 9 digits — enough to match `+998 90 …` against `90…` reliably. */
function normalisePhone(phone: string | null): string {
  return phone ? phone.replace(/\D/g, '').slice(-9) : '';
}

/**
 * Operator stage, derived rather than stored.
 *
 * The `leads.status` column tracks the sales pipeline; the worklist needs the
 * call state, which is a function of the pipeline status and what the last
 * call actually did. `qualified` is treated as booked because that is the only
 * status the app sets when a consultation is arranged.
 */
export function deriveStage(lead: LeadRecord, notes: NoteRow[]): LeadStage {
  if (lead.status === 'new' && notes.length === 0) return 'new';
  if (lead.status === 'qualified') return 'booked';
  const lastCall = notes.find((note) => note.contact_type === 'call' || note.contact_type === 'meeting');
  if (lastCall?.contact_type === 'meeting') return 'booked';
  if (lastCall?.outcome && UNANSWERED.has(lastCall.outcome)) return 'attempting';
  if (notes.length === 0) return 'new';
  return 'contacted';
}

export interface LeadWorklist {
  rows: LeadVM[];
  loading: boolean;
  /** Re-reads `lead_notes`. The lead rows themselves refresh via LeadsContext. */
  refreshHistory: () => Promise<void>;
}

export function useLeadWorklist(now: Date): LeadWorklist {
  const { leads, loading } = useLeads();
  const [notesByLead, setNotesByLead] = useState<Record<string, NoteRow[]>>({});
  const [notesLoading, setNotesLoading] = useState(true);

  // Only refetch when the *set* of lead ids changes, not on every lead edit.
  const leadIds = useMemo(() => leads.map((lead) => lead.id).sort().join(','), [leads]);
  const leadIdsRef = useRef(leadIds);
  leadIdsRef.current = leadIds;

  const fetchNotes = useCallback(async () => {
    const ids = leadIdsRef.current ? leadIdsRef.current.split(',') : [];
    if (ids.length === 0) {
      setNotesByLead({});
      setNotesLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('lead_notes')
      .select('id, lead_id, content, outcome, contact_type, contacted_at, created_at')
      .in('lead_id', ids)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load lead call history:', error);
      setNotesLoading(false);
      return;
    }
    const grouped: Record<string, NoteRow[]> = {};
    for (const note of (data ?? []) as NoteRow[]) {
      (grouped[note.lead_id] ??= []).push(note);
    }
    setNotesByLead(grouped);
    setNotesLoading(false);
  }, []);

  useEffect(() => {
    setNotesLoading(true);
    void fetchNotes();
  }, [leadIds, fetchNotes]);

  const rows = useMemo<LeadVM[]>(() => {
    // Converted and lost leads are finished work — they leave the worklist.
    const open = (leads as LeadRecord[]).filter(
      (lead) =>
        lead.status !== 'converted' &&
        lead.status !== 'lost' &&
        !lead.converted_to_student_id &&
        !lead.isAlreadyStudent,
    );

    // Earliest record wins, so a later inbound is the one flagged as the copy.
    const firstByPhone = new Map<string, LeadRecord>();
    for (const lead of [...open].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )) {
      const key = normalisePhone(lead.phone);
      if (key && !firstByPhone.has(key)) firstByPhone.set(key, lead);
    }

    return open.map((lead) => {
      const notes = notesByLead[lead.id] ?? [];
      const factors = scoreFactors(lead, now);
      const score = leadScore(factors);
      const history: TouchEntry[] = notes.map((note) => ({
        id: note.id,
        text: note.content,
        at: note.contacted_at ?? note.created_at,
        outcome: note.outcome,
      }));
      const original = firstByPhone.get(normalisePhone(lead.phone));
      const isCopy = !!original && original.id !== lead.id;

      return {
        id: lead.id,
        name: lead.full_name,
        initials: initialsOf(lead.full_name),
        phone: lead.phone,
        city: lead.city,
        source: lead.source,
        referred: !!lead.referred_by_student_id,
        owner: lead.assignee?.full_name ?? null,
        createdAt: lead.created_at,
        stage: deriveStage(lead, notes),
        attempts: notes.filter((note) => note.contact_type === 'call').length,
        score,
        tier: tierFor(score),
        factors,
        // The next call's goal and author land in step 3; the worklist only
        // needs its timing, which `next_follow_up` already carries.
        nextCall: null,
        dueInMinutes: minutesUntil(lead.next_follow_up, now),
        history,
        duplicateOfId: isCopy ? original.id : null,
        duplicateNote: isCopy ? original.full_name : null,
        lead,
      } satisfies LeadVM;
    });
  }, [leads, notesByLead, now]);

  return { rows, loading: loading || notesLoading, refreshHistory: fetchNotes };
}
