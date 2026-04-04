import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Call {
  id: string;
  student_id: string | null;
  staff_id: string | null;
  lead_id: string | null;
  phone_number: string;
  direction: 'incoming' | 'outgoing';
  status: 'completed' | 'missed' | 'busy' | 'no_answer' | 'failed';
  duration: number;
  recording_url: string | null;
  notes: string | null;
  external_call_id: string | null;
  voip_provider: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  student?: { full_name: string | null };
  staff?: { full_name: string | null };
}

interface CallInput {
  student_id?: string;
  lead_id?: string;
  phone_number: string;
  direction: 'incoming' | 'outgoing';
  status?: string;
  duration?: number;
  recording_url?: string;
  notes?: string;
  external_call_id?: string;
  voip_provider?: string;
  started_at?: string;
  ended_at?: string;
}

interface CallsContextType {
  calls: Call[];
  loading: boolean;
  createCall: (input: CallInput) => Promise<boolean>;
  updateCall: (callId: string, updates: Partial<CallInput>) => Promise<boolean>;
  deleteCall: (callId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const CallsContext = createContext<CallsContextType | undefined>(undefined);

export function CallsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchCallsRef = useRef<() => Promise<void>>();

  const fetchCalls = async () => {
    setLoading(true);
    
    const { data: callsData, error: callsError } = await supabase
      .from('calls')
      .select('*')
      .order('started_at', { ascending: false });

    if (callsError) {
      console.error('Error fetching calls:', callsError);
      setLoading(false);
      return;
    }

    const studentIds = [...new Set(callsData?.filter(c => c.student_id).map(c => c.student_id) || [])];
    const staffIds = [...new Set(callsData?.filter(c => c.staff_id).map(c => c.staff_id) || [])];
    const allUserIds = [...new Set([...studentIds, ...staffIds])];

    let profilesMap: Record<string, { full_name: string | null }> = {};
    
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', allUserIds);
      
      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => {
          acc[p.user_id] = { full_name: p.full_name };
          return acc;
        }, {} as Record<string, { full_name: string | null }>);
      }
    }

    const enrichedCalls = callsData?.map(call => ({
      ...call,
      direction: call.direction as 'incoming' | 'outgoing',
      status: call.status as Call['status'],
      student: call.student_id ? profilesMap[call.student_id] : undefined,
      staff: call.staff_id ? profilesMap[call.staff_id] : undefined,
    })) || [];

    setCalls(enrichedCalls);
    setLoading(false);
  };
  
  fetchCallsRef.current = fetchCalls;

  const createCall = async (input: CallInput) => {
    if (!user) return false;

    const { error } = await supabase
      .from('calls')
      .insert({
        ...input,
        staff_id: user.id,
      });

    if (error) {
      toast({ title: 'Error', description: 'Failed to log call', variant: 'destructive' });
      return false;
    }

    toast({ title: 'Success', description: 'Call logged successfully' });
    return true;
  };

  const updateCall = async (callId: string, updates: Partial<CallInput>) => {
    const { error } = await supabase
      .from('calls')
      .update(updates)
      .eq('id', callId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update call', variant: 'destructive' });
      return false;
    }

    toast({ title: 'Success', description: 'Call updated successfully' });
    return true;
  };

  const deleteCall = async (callId: string) => {
    const { error } = await supabase
      .from('calls')
      .delete()
      .eq('id', callId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete call', variant: 'destructive' });
      return false;
    }

    toast({ title: 'Success', description: 'Call deleted successfully' });
    return true;
  };

  useEffect(() => {
    fetchCallsRef.current?.();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channelId = `calls-realtime-globalctx`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchCallsRef.current?.();
          }, 1500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <CallsContext.Provider value={{
      calls,
      loading,
      createCall,
      updateCall,
      deleteCall,
      refetch: fetchCalls,
    }}>
      {children}
    </CallsContext.Provider>
  );
}

export function useCallsContext() {
  const context = useContext(CallsContext);
  if (context === undefined) {
    throw new Error('useCallsContext must be used within a CallsProvider');
  }
  return context;
}
