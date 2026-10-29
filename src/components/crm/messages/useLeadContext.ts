import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** What the right rail shows for a conversation that belongs to a lead. */
export interface LeadContextVM {
  id: string;
  name: string;
  phone: string | null;
  status: string | null;
  source: string | null;
  city: string | null;
  program: string | null;
  education: string | null;
  nextFollowUp: string | null;
  notes: string | null;
  createdAt: string | null;
  assigneeName: string | null;
  convertedStudentId: string | null;
}

/**
 * Loads the lead behind a conversation (audit 2026-10-29, finding 4: 79% of
 * conversations belong to a lead and the rail used to say "not linked").
 * Read-only; editing stays on the lead profile, one click away.
 */
export function useLeadContext(leadId: string | null) {
  const [data, setData] = useState<LeadContextVM | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const { data: lead, error } = await supabase
      .from('leads')
      .select(
        'id, full_name, phone, status, source, contact_channel, city, preferred_program, education_level, next_follow_up, notes, created_at, assigned_to, converted_to_student_id',
      )
      .eq('id', id)
      .maybeSingle();
    if (error || !lead) {
      setData(null);
      setLoading(false);
      return;
    }
    let assigneeName: string | null = null;
    if (lead.assigned_to) {
      const { data: p } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', lead.assigned_to)
        .maybeSingle();
      assigneeName = p?.full_name ?? null;
    }
    setData({
      id: lead.id,
      name: lead.full_name ?? '',
      phone: lead.phone ?? null,
      status: lead.status ?? null,
      source: lead.contact_channel ?? lead.source ?? null,
      city: lead.city ?? null,
      program: lead.preferred_program ?? null,
      education: lead.education_level ?? null,
      nextFollowUp: lead.next_follow_up ?? null,
      notes: lead.notes ?? null,
      createdAt: lead.created_at ?? null,
      assigneeName,
      convertedStudentId: lead.converted_to_student_id ?? null,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!leadId) {
      setData(null);
      setLoading(false);
      return;
    }
    void load(leadId);
  }, [leadId, load]);

  return { lead: data, loading, reload: () => (leadId ? load(leadId) : Promise.resolve()) };
}
