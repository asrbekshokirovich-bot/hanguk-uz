import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: 'manual' | 'telegram' | 'instagram' | 'call' | 'ai_detected';
  source_id: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  interest_level: 'low' | 'medium' | 'high';
  notes: string | null;
  ai_summary: string | null;
  assigned_to: string | null;
  converted_to_student_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // New fields from Phase 1
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
  priority_score: number | null;
  next_follow_up: string | null;
  last_contacted_at: string | null;
  contract_number: string | null;
  contract_date: string | null;
  payment_plan: string | null;
  assignee?: {
    full_name: string | null;
  };
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
  // New fields
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
  // Contact tracking fields
  next_follow_up?: string;
  last_contacted_at?: string;
  // Contract fields
  contract_number?: string;
  contract_date?: string;
  payment_plan?: string;
}

export const useLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Smart sorting: prioritize never-contacted, then by priority score, then by status urgency
  const sortLeads = (leadsToSort: Lead[]): Lead[] => {
    return [...leadsToSort].sort((a, b) => {
      // 1. Never contacted leads first (no last_contacted_at)
      const aContacted = !!a.last_contacted_at;
      const bContacted = !!b.last_contacted_at;
      if (!aContacted && bContacted) return -1;
      if (aContacted && !bContacted) return 1;

      // 2. New status leads before others (within never-contacted group)
      if (a.status === 'new' && b.status !== 'new') return -1;
      if (a.status !== 'new' && b.status === 'new') return 1;

      // 3. Overdue follow-ups (past next_follow_up dates)
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const aOverdue = a.next_follow_up && new Date(a.next_follow_up) < now;
      const bOverdue = b.next_follow_up && new Date(b.next_follow_up) < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // 4. Higher priority score
      const aPriority = a.priority_score || 0;
      const bPriority = b.priority_score || 0;
      if (aPriority !== bPriority) return bPriority - aPriority;

      // 5. Status urgency: new > contacted > qualified > converted/lost
      const statusOrder = { new: 0, contacted: 1, qualified: 2, converted: 3, lost: 4 };
      const aStatusOrder = statusOrder[a.status] ?? 5;
      const bStatusOrder = statusOrder[b.status] ?? 5;
      if (aStatusOrder !== bStatusOrder) return aStatusOrder - bStatusOrder;

      // 6. Most recent created_at last (oldest first for equal priority)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);

      // Fetch leads and all needed profiles in parallel (2 queries instead of N+1)
      const [{ data, error }, { data: studentProfiles }, { data: allProfiles }] = await Promise.all([
        supabase.from('leads').select('*'),
        supabase.from('profiles').select('full_name, phone, magic_code').not('magic_code', 'is', null),
        supabase.from('profiles').select('user_id, full_name'),
      ]);

      if (error) throw error;

      // Build assignee lookup map
      const assigneeMap = new Map<string, { full_name: string | null }>();
      (allProfiles || []).forEach(p => assigneeMap.set(p.user_id, { full_name: p.full_name }));

      // Build student lookup sets for cross-checking
      const normalizePhone = (p: string | null) => p ? p.replace(/\D/g, '').slice(-9) : '';
      const studentNames = new Set(
        (studentProfiles || []).map(p => (p.full_name || '').toLowerCase().trim())
      );
      const studentPhones = new Set(
        (studentProfiles || []).filter(p => p.phone).map(p => normalizePhone(p.phone))
      );

      // Enrich leads with assignee + student check in a single pass
      const enrichedLeads = (data || []).map(lead => ({
        ...lead,
        assignee: lead.assigned_to ? (assigneeMap.get(lead.assigned_to) || null) : null,
        isAlreadyStudent:
          studentNames.has(lead.full_name.toLowerCase().trim()) ||
          (lead.phone ? studentPhones.has(normalizePhone(lead.phone)) : false),
      }));

      // Apply smart sorting
      setLeads(sortLeads(enrichedLeads as Lead[]));
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  const createLead = async (leadData: CreateLeadData) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          ...leadData,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Lead created successfully');
      await fetchLeads();
      return data;
    } catch (error) {
      console.error('Error creating lead:', error);
      toast.error('Failed to create lead');
      throw error;
    }
  };

  const updateLead = async (id: string, updates: Partial<CreateLeadData>) => {
    try {
      const cleanedUpdates = { ...updates };
      
      // Clean UUID fields
      if (cleanedUpdates.assigned_to === '' || cleanedUpdates.assigned_to === 'unassigned') {
        cleanedUpdates.assigned_to = undefined;
      }

      // Clean date fields — empty strings must become null
      const dateFields = ['birth_date', 'contract_date', 'next_follow_up', 'last_contacted_at', 'preferred_start_date'] as const;
      for (const field of dateFields) {
        if ((cleanedUpdates as Record<string, unknown>)[field] === '') {
          (cleanedUpdates as Record<string, unknown>)[field] = undefined;
        }
      }
      
      // Remove undefined values
      const finalUpdates = Object.fromEntries(
        Object.entries(cleanedUpdates).filter(([_, v]) => v !== undefined)
      );
      
      // Explicitly set null for fields that need clearing
      if (updates.assigned_to === '' || updates.assigned_to === 'unassigned') {
        (finalUpdates as Record<string, unknown>).assigned_to = null;
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

      toast.success('Lead updated successfully');
      await fetchLeads();
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Failed to update lead');
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

      toast.success('Lead deleted successfully');
      await fetchLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error('Failed to delete lead');
      throw error;
    }
  };

  const convertingIds = useRef(new Set<string>());

  const convertToStudent = async (leadId: string): Promise<{ success: boolean; magicCode?: string }> => {
    if (convertingIds.current.has(leadId)) {
      toast.info('Conversion already in progress...');
      return { success: false };
    }
    convertingIds.current.add(leadId);

    const lead = leads.find(l => l.id === leadId);
    if (!lead) {
      toast.error('Lead not found');
      return { success: false };
    }

    // Check if already converted
    if (lead.converted_to_student_id) {
      toast.error('This lead has already been converted to a student');
      return { success: false };
    }

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
        },
      });
      return { data, error };
    };

    try {
      // First attempt with phone
      let result = await tryCreateStudent(!!lead.phone);

      // Check for phone duplicate error from both data and error objects
      const errorMsg = result.data?.error || (result.error as any)?.message || '';
      if (typeof errorMsg === 'string' && (errorMsg.includes('phone number already exists') || errorMsg.includes('phone number belongs'))) {
        toast.info('Phone number already in use, creating without phone...');
        result = await tryCreateStudent(false);
      }

      // Re-check after retry
      if (result.error) throw result.error;

      if (!result.data?.success) {
        throw new Error(result.data?.error || 'Failed to create student');
      }

      // Update lead to mark as converted
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          status: 'converted',
          converted_to_student_id: result.data.userId,
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      toast.success(`Lead converted to student! Magic code: ${result.data.magicCode}`);
      await fetchLeads();
      return { success: true, magicCode: result.data.magicCode };
    } catch (error) {
      console.error('Error converting lead:', error);
      const message = error instanceof Error ? error.message : 'Failed to convert lead';
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

      toast.success(leadId ? 'Lead analyzed successfully' : 'All leads analyzed');
      await fetchLeads();
      return response.data;
    } catch (error) {
      console.error('Error analyzing lead:', error);
      toast.error('Failed to analyze lead');
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

  const fetchLeadsRef = useRef(fetchLeads);
  fetchLeadsRef.current = fetchLeads;

  useEffect(() => {
    fetchLeadsRef.current();

    // Subscribe to realtime changes with debounce
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        (payload) => {
          console.log('Leads realtime update:', payload.eventType);
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchLeadsRef.current();
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

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

  return {
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
  };
};
