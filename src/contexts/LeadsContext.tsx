import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { applyIntake } from '@/lib/intakeQuery';
import { edgeFunctionError } from '@/lib/edgeFunctionError';
import { edgeFunctionStatus } from '@/lib/sessionCheck';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { applyLeadChanges, buildLeadLookups, enrichLead, LEAD_PARTIAL_REFRESH_MAX, type LeadLookups } from '@/lib/leadsSync';

/** How long the names of staff and students are reused between partial re-reads. */
const LOOKUPS_TTL_MS = 5 * 60 * 1000;
/** A tab hidden this long re-reads the whole list when it comes back: it may have missed changes. */
const HIDDEN_REFRESH_MS = 5 * 60 * 1000;

export interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  /** ISO country of the lead ('UZ' / 'KG'); null — Uzbekistan. */
  country?: string | null;
  email: string | null;
  source: 'manual' | 'telegram' | 'instagram' | 'call' | 'ai_detected' | 'learning_center';
  source_id: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  interest_level: 'low' | 'medium' | 'high';
  notes: string | null;
  ai_summary: string | null;
  assigned_to: string | null;
  referred_by_student_id: string | null;
  converted_to_student_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  preferred_university: string | null;
  preferred_program: string | null;
  budget_range: string | null;
  city: string | null;
  birth_date: string | null;
  education_level: string | null;
  english_level: string | null;
  korean_level: string | null;
  preferred_start_date: string | null;
  how_heard: string | null;
  /** Intake fields — see the `leads_intake_fields` migration. */
  age: number | null;
  cert_level: string | null;
  contact_channel: string | null;
  source_note: string | null;
  target_intake: string | null;
  priority_score: number | null;
  next_follow_up: string | null;
  last_contacted_at: string | null;
  contract_number: string | null;
  contract_date: string | null;
  payment_plan: string | null;
  call_result: string | null;
  /** When an Instagram/Telegram lead's phone and name arrived — see the "Yangi lid" section. */
  new_lead_at?: string | null;
  /** When the 10-minute countdown starts: `new_lead_at` in working hours, the
   * next working 10:00 (Tashkent) for a chat that arrived off hours. */
  sla_start_at?: string | null;
  /** When the person first wrote back in a chat Hanguk started: "Bugungi lidlar", never "Yangi lid". */
  replied_chat_at?: string | null;
  assignee?: {
    full_name: string | null;
  };
  referrer?: {
    full_name: string | null;
  } | null;
  isAlreadyStudent?: boolean;
}

export interface CreateLeadData {
  full_name: string;
  phone?: string;
  email?: string;
  source?: Lead['source'];
  source_id?: string;
  status?: Lead['status'];
  interest_level?: Lead['interest_level'];
  notes?: string;
  ai_summary?: string;
  assigned_to?: string;
  referred_by_student_id?: string;
  preferred_university?: string;
  preferred_program?: string;
  budget_range?: string;
  city?: string;
  birth_date?: string;
  education_level?: string;
  english_level?: string;
  korean_level?: string;
  preferred_start_date?: string;
  how_heard?: string;
  age?: number | null;
  cert_level?: string | null;
  contact_channel?: string | null;
  source_note?: string | null;
  target_intake?: string | null;
  call_result?: string | null;
  next_follow_up?: string;
  last_contacted_at?: string;
  contract_number?: string;
  contract_date?: string;
  payment_plan?: string;
}

interface LeadsContextType {
  leads: Lead[];
  loading: boolean;
  stats: any;
  createLead: (data: CreateLeadData) => Promise<any>;
  updateLead: (id: string, data: Partial<CreateLeadData>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  convertToStudent: (id: string) => Promise<{ success: boolean; magicCode?: string }>;
  analyzeLead: (id?: string) => Promise<any>;
  callTodayLeads: Lead[];
  refetch: () => Promise<void>;
}

const LeadsContext = createContext<LeadsContextType | undefined>(undefined);

export const LeadsProvider = ({ children }: { children: ReactNode }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, verifySession } = useAuth();
  const { activeIntakeId } = useActiveIntake();
  const convertingIds = useRef(new Set<string>());
  const fetchLeadsRef = useRef<() => Promise<void>>();
  // True once the list has rendered real data at least once. The realtime
  // subscription below re-fetches after *every* write to `leads` — including
  // an operator's own edit, a second later, through its own debounce — so
  // without this a single call-result click on a long list flips `loading`
  // back to true, the table unmounts for the skeleton, and the operator's
  // scroll position (and the row they were on) is gone: the list reappears
  // at the top, which reads as "marking it jumped the row to #1". The
  // skeleton is worth showing exactly once, before there is anything to lose.
  const hasLoadedOnceRef = useRef(false);

  const sortLeads = (leadsToSort: Lead[]): Lead[] => {
    return [...leadsToSort].sort((a, b) => {
      const aContacted = !!a.last_contacted_at;
      const bContacted = !!b.last_contacted_at;
      if (!aContacted && bContacted) return -1;
      if (aContacted && !bContacted) return 1;

      if (a.status === 'new' && b.status !== 'new') return -1;
      if (a.status !== 'new' && b.status === 'new') return 1;

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const aOverdue = a.next_follow_up && new Date(a.next_follow_up) < now;
      const bOverdue = b.next_follow_up && new Date(b.next_follow_up) < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      const aPriority = a.priority_score || 0;
      const bPriority = b.priority_score || 0;
      if (aPriority !== bPriority) return bPriority - aPriority;

      const statusOrder = { new: 0, contacted: 1, qualified: 2, converted: 3, lost: 4 };
      const aStatusOrder = statusOrder[a.status] ?? 5;
      const bStatusOrder = statusOrder[b.status] ?? 5;
      if (aStatusOrder !== bStatusOrder) return aStatusOrder - bStatusOrder;

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  };

  // The season the list is for, readable from callbacks that outlive a render.
  const intakeRef = useRef(activeIntakeId);
  intakeRef.current = activeIntakeId;
  const lookupsRef = useRef<{ at: number; value: LeadLookups } | null>(null);
  // Every read of the list goes through this chain, one after another, so a
  // slow answer can never land on top of a newer one.
  const syncChainRef = useRef<Promise<void>>(Promise.resolve());
  const fullQueuedRef = useRef<Promise<void> | null>(null);

  /**
   * The list's own filter — the whole list and a partial re-read ask under it.
   * Only qualified rows — see leads.qualified: a phone number, a chat that
   * arrived as a new lead (new_lead_at, from 2026-10-12), or an answer in a
   * chat Hanguk started (replied_chat_at). Without this filter the 192
   * Instagram handles auto-created from older chats sit in the pipeline as
   * unworkable rows and distort every count on the page.
   */
  const leadsQuery = () => applyIntake(supabase.from('leads').select('*').eq('qualified', true), intakeRef.current);

  const loadLookups = async (force: boolean): Promise<LeadLookups> => {
    const cached = lookupsRef.current;
    if (!force && cached && Date.now() - cached.at < LOOKUPS_TTL_MS) return cached.value;
    const [students, everyone] = await Promise.all([
      supabase.from('profiles').select('full_name, phone, magic_code').not('magic_code', 'is', null),
      supabase.from('profiles').select('user_id, full_name'),
    ]);
    const value = buildLeadLookups(students.data, everyone.data);
    // A failed read is not remembered: the next one tries again.
    if (!students.error && !everyone.error) lookupsRef.current = { at: Date.now(), value };
    else if (cached) return cached.value;
    return value;
  };

  const readAllLeads = async () => {
    const isInitialLoad = !hasLoadedOnceRef.current;
    const intakeAtStart = intakeRef.current;
    try {
      if (isInitialLoad) setLoading(true);
      const [{ data, error }, lookups] = await Promise.all([
        // In pages: one request returns at most 1000 rows and does not say
        // when it stopped there (fetchAllRows). Ordered, so the pages tile.
        fetchAllRows<Record<string, unknown>>((from, to) =>
          leadsQuery().order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to)),
        loadLookups(true),
      ]);

      if (error) throw error;
      // The season changed while this was on its way: its own read follows.
      if (intakeRef.current !== intakeAtStart) return;

      setLeads(sortLeads(data.map((lead) => enrichLead(lead as unknown as Lead, lookups)) as Lead[]));
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  };

  /** Read the whole list. Calls made while one is already waiting share it. */
  const fetchLeads = (): Promise<void> => {
    if (fullQueuedRef.current) return fullQueuedRef.current;
    const run = syncChainRef.current.then(() => {
      fullQueuedRef.current = null;
      return readAllLeads();
    });
    fullQueuedRef.current = run;
    syncChainRef.current = run.catch(() => undefined);
    return run;
  };

  /**
   * Re-read only these leads and fold them into the list (applyLeadChanges):
   * a few kilobytes instead of the whole list on every change.
   */
  const syncLeads = (ids: string[]): Promise<void> => {
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0) return syncChainRef.current;
    if (unique.length > LEAD_PARTIAL_REFRESH_MAX || !hasLoadedOnceRef.current) return fetchLeads();
    const run = syncChainRef.current.then(async () => {
      const intakeAtStart = intakeRef.current;
      const { data, error } = await leadsQuery().in('id', unique);
      if (error) {
        console.error('Error refreshing leads:', error);
        return;
      }
      if (intakeRef.current !== intakeAtStart) return;
      const lookups = await loadLookups(false);
      const fresh = (data ?? []).map((lead) => enrichLead(lead as unknown as Lead, lookups)) as Lead[];
      setLeads((prev) => sortLeads(applyLeadChanges(prev, unique, fresh)));
    });
    syncChainRef.current = run.catch(() => undefined);
    return run;
  };

  fetchLeadsRef.current = fetchLeads;

  const createLead = async (leadData: CreateLeadData) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          ...leadData,
          created_by: user?.id,
          intake_id: activeIntakeId,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(i18n.t('leads.toasts.created'));
      await syncLeads([data.id]);
      return data;
    } catch (error) {
      console.error('Error creating lead:', error);
      toast.error(i18n.t('leads.toasts.createFailed'));
      throw error;
    }
  };

  const updateLead = async (id: string, updates: Partial<CreateLeadData>) => {
    try {
      const cleanedUpdates = { ...updates };
      
      if (cleanedUpdates.assigned_to === '' || cleanedUpdates.assigned_to === 'unassigned') {
        cleanedUpdates.assigned_to = undefined;
      }

      if (cleanedUpdates.referred_by_student_id === '' || cleanedUpdates.referred_by_student_id === 'none') {
        cleanedUpdates.referred_by_student_id = undefined;
      }

      const dateFields = ['birth_date', 'contract_date', 'next_follow_up', 'last_contacted_at', 'preferred_start_date'] as const;
      for (const field of dateFields) {
        if ((cleanedUpdates as Record<string, unknown>)[field] === '') {
          (cleanedUpdates as Record<string, unknown>)[field] = undefined;
        }
      }
      
      const finalUpdates = Object.fromEntries(
        Object.entries(cleanedUpdates).filter(([_, v]) => v !== undefined)
      );
      
      if (updates.assigned_to === '' || updates.assigned_to === 'unassigned') {
        (finalUpdates as Record<string, unknown>).assigned_to = null;
      }
      if (updates.referred_by_student_id === '' || updates.referred_by_student_id === 'none') {
        (finalUpdates as Record<string, unknown>).referred_by_student_id = null;
      }
      for (const field of dateFields) {
        if ((updates as Record<string, unknown>)[field] === '') {
          (finalUpdates as Record<string, unknown>)[field] = null;
        }
      }

      const { error } = await supabase
        .from('leads')
        .update(finalUpdates)
        .eq('id', id);

      if (error) throw error;

      toast.success(i18n.t('leads.toasts.updated'));
      // No fetchLeads() here, let the realtime listener handle it locally if possible
      // Actually wait, for 10 hooks we'll just implement the Phase 2 optimization inside the postgres_changes!
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error(i18n.t('leads.toasts.updateFailed'));
      throw error;
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(i18n.t('leads.toasts.deleted'));
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error(i18n.t('leads.toasts.deleteFailed'));
      throw error;
    }
  };

  const convertToStudent = async (leadId: string): Promise<{ success: boolean; magicCode?: string }> => {
    if (convertingIds.current.has(leadId)) {
      toast.info(i18n.t('leads.toasts.converting'));
      return { success: false };
    }

    // Both checks run before the lead is marked in-flight: returning early
    // after marking it would leave the id in the set for the rest of the
    // session, and every later attempt on that lead would be refused as
    // "already in progress".
    const lead = leads.find(l => l.id === leadId);
    if (!lead) {
      toast.error(i18n.t('leads.toasts.notFound'));
      return { success: false };
    }

    if (lead.converted_to_student_id) {
      toast.error(i18n.t('leads.toasts.alreadyConverted'));
      return { success: false };
    }

    convertingIds.current.add(leadId);

    const tryCreateStudent = async (includePhone: boolean) => {
      const { data, error } = await supabase.functions.invoke('create-student', {
        body: {
          fullName: lead.full_name,
          phone: includePhone ? (lead.phone || null) : null,
          birthDate: lead.birth_date || null,
          officeLocation: lead.city || null,
          paymentPlan: lead.payment_plan || null,
          paymentMode: 'one_time',
          contractDate: lead.contract_date || new Date().toISOString().split('T')[0],
          languageTrack: lead.korean_level ? 'korean' : lead.english_level ? 'english' : 'korean',
          intakeId: activeIntakeId,
        },
      });
      return { data, error };
    };

    try {
      let result = await tryCreateStudent(!!lead.phone);

      const errorMsg = result.data?.error || (result.error as any)?.message || '';
      if (typeof errorMsg === 'string' && (errorMsg.includes('phone number already exists') || errorMsg.includes('phone number belongs'))) {
        toast.info(i18n.t('leads.toasts.phoneInUse'));
        result = await tryCreateStudent(false);
      }

      if (result.error) {
        // 401 = session revoked elsewhere → show the "session ended" dialog.
        if (edgeFunctionStatus(result.error) === 401) void verifySession();
        throw await edgeFunctionError(result.error, 'Failed to create student');
      }

      if (!result.data?.success) {
        throw new Error(result.data?.error || 'Failed to create student');
      }

      const { error: updateError } = await supabase
        .from('leads')
        .update({
          status: 'converted',
          converted_to_student_id: result.data.userId,
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      toast.success(i18n.t('leads.toasts.converted', { code: result.data.magicCode }));
      await fetchLeads();
      return { success: true, magicCode: result.data.magicCode };
    } catch (error) {
      console.error('Error converting lead:', error);
      const message = error instanceof Error ? error.message : i18n.t('leads.toasts.convertFailed');
      toast.error(message);
      return { success: false };
    } finally {
      convertingIds.current.delete(leadId);
    }
  };

  const analyzeLead = async (leadId?: string) => {
    try {
      const response = await supabase.functions.invoke('analyze-lead', {
        body: { lead_id: leadId, analyze_all: !leadId },
      });

      if (response.error) throw response.error;

      toast.success(i18n.t(leadId ? 'leads.toasts.analyzed' : 'leads.toasts.analyzedAll'));
      await (leadId ? syncLeads([leadId]) : fetchLeads());
      return response.data;
    } catch (error) {
      console.error('Error analyzing lead:', error);
      toast.error(i18n.t('leads.toasts.analyzeFailed'));
      throw error;
    }
  };

  const callTodayLeads = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    return leads
      .filter(lead => {
        if (lead.status === 'converted' || lead.status === 'lost') return false;
        if (lead.converted_to_student_id) return false;
        if (lead.contract_number) return false;
        if (lead.isAlreadyStudent) return false;
        
        if (lead.next_follow_up) {
          const followUp = new Date(lead.next_follow_up);
          followUp.setHours(0, 0, 0, 0);
          if (followUp <= today) return true;
        }
        
        if (lead.status === 'new') return true;
        if (!lead.next_follow_up && lead.status === 'contacted') return true;
        
        if (lead.last_contacted_at) {
          const lastContact = new Date(lead.last_contacted_at);
          lastContact.setHours(0, 0, 0, 0);
          if (lastContact <= threeDaysAgo) return true;
        }
        
        return false;
      })
      .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
  }, [leads]);

  const syncLeadsRef = useRef(syncLeads);
  syncLeadsRef.current = syncLeads;

  // Realtime: a change names its row; only the rows that changed are read
  // again, a second and a half after the last change of a burst. The whole
  // list is read on sign-in, when the channel comes back after a drop, and
  // when the tab returns from a long time in the background — the moments a
  // change may have been missed.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;

    fetchLeadsRef.current?.();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingIds = new Set<string>();
    let pendingFull = false;
    let subscribedBefore = false;
    let hiddenAt: number | null = null;

    const flush = () => {
      debounceTimer = null;
      const ids = [...pendingIds];
      pendingIds.clear();
      if (pendingFull) {
        pendingFull = false;
        fetchLeadsRef.current?.();
      } else {
        syncLeadsRef.current?.(ids);
      }
    };

    const channelId = `leads-realtime-global`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        (payload) => {
          const id =
            (payload.new as { id?: string } | null)?.id ?? (payload.old as { id?: string } | null)?.id ?? null;
          if (id) pendingIds.add(id);
          else pendingFull = true;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(flush, 1500); // one read for a burst of saves
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        // Joined again after a drop: whatever changed meanwhile was not delivered.
        if (subscribedBefore) fetchLeadsRef.current?.();
        subscribedBefore = true;
      });

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        const away = Date.now() - hiddenAt;
        hiddenAt = null;
        if (away >= HIDDEN_REFRESH_MS) fetchLeadsRef.current?.();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Re-scope leads when the active intake changes.
  useEffect(() => {
    fetchLeadsRef.current?.();
  }, [activeIntakeId]);

  const stats = useMemo(() => ({
    total: leads.length,
    new: leads.filter(l => l.status === 'new' && !l.converted_to_student_id && !l.isAlreadyStudent && !l.contract_number).length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    converted: leads.filter(l => l.status === 'converted').length,
    lost: leads.filter(l => l.status === 'lost').length,
    highInterest: leads.filter(l => l.interest_level === 'high').length,
    aiDetected: leads.filter(l => l.source === 'ai_detected').length,
    highPriority: leads.filter(l => (l.priority_score || 0) >= 70).length,
    callToday: callTodayLeads.length,
  }), [leads, callTodayLeads]);

  return (
    <LeadsContext.Provider value={{
      leads,
      loading,
      stats,
      createLead,
      updateLead,
      deleteLead,
      convertToStudent,
      analyzeLead,
      callTodayLeads,
      refetch: fetchLeads,
    }}>
      {children}
    </LeadsContext.Provider>
  );
};

export const useLeadsContext = () => {
  const context = useContext(LeadsContext);
  if (context === undefined) {
    throw new Error('useLeadsContext must be used within a LeadsProvider');
  }
  return context;
};
