import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ContactType = 'call' | 'message' | 'meeting' | 'email' | 'whatsapp' | 'telegram';
export type ContactOutcome = 'answered' | 'no_answer' | 'busy' | 'callback_requested' | 'interested' | 'not_interested' | 'voicemail' | 'contracted';

export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  contacted_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // New fields from Phase 1
  contact_type: ContactType | null;
  outcome: ContactOutcome | null;
  duration_minutes: number | null;
  ai_analysis: string | null;
  author?: {
    full_name: string | null;
  };
}

export interface AddNoteData {
  content: string;
  contactedAt?: string;
  contactType?: ContactType;
  outcome?: ContactOutcome;
  durationMinutes?: number;
}

export const useLeadNotes = (leadId: string | null) => {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Subscribe to realtime updates for lead notes
  useEffect(() => {
    if (!leadId) return;

    const channel = supabase
      .channel(`lead-notes-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_notes',
          filter: `lead_id=eq.${leadId}`,
        },
        (payload) => {
          console.log('Lead notes realtime update:', payload.eventType);
          // Refetch notes on any change
          fetchNotesInternal();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId]);

  const fetchNotesInternal = async () => {
    if (!leadId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lead_notes')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch author names
      const notesWithAuthors = await Promise.all(
        (data || []).map(async (note) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', note.created_by)
            .maybeSingle();
          return { ...note, author: profile } as LeadNote;
        })
      );

      setNotes(notesWithAuthors);
    } catch (error) {
      console.error('Error fetching lead notes:', error);
      toast.error('Failed to fetch notes');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = useCallback(() => {
    fetchNotesInternal();
  }, [leadId]);

  const addNote = async (data: AddNoteData | string, contactedAt?: string) => {
    if (!leadId || !user) return;

    // Support both old signature (content, contactedAt) and new (AddNoteData)
    const noteData: AddNoteData = typeof data === 'string' 
      ? { content: data, contactedAt } 
      : data;

    try {
      const { error } = await supabase
        .from('lead_notes')
        .insert({
          lead_id: leadId,
          content: noteData.content,
          contacted_at: noteData.contactedAt || null,
          contact_type: noteData.contactType || 'call',
          outcome: noteData.outcome || null,
          duration_minutes: noteData.durationMinutes || null,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success('Contact logged');
      await fetchNotes();
      
      // Trigger AI analysis of this lead
      try {
        await supabase.functions.invoke('analyze-lead', {
          body: { lead_id: leadId },
        });
      } catch (aiError) {
        console.error('AI analysis failed:', aiError);
        // Don't show error to user, this is a background task
      }
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
      throw error;
    }
  };

  const updateNote = async (
    noteId: string, 
    content: string, 
    contactedAt?: string,
    contactType?: ContactType,
    outcome?: ContactOutcome,
    durationMinutes?: number
  ) => {
    try {
      const { error } = await supabase
        .from('lead_notes')
        .update({ 
          content,
          contacted_at: contactedAt || null,
          contact_type: contactType || null,
          outcome: outcome || null,
          duration_minutes: durationMinutes || null,
        })
        .eq('id', noteId);

      if (error) throw error;

      toast.success('Note updated');
      await fetchNotes();
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
      throw error;
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('lead_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast.success('Note deleted');
      await fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
      throw error;
    }
  };

  // Get contact statistics
  const getContactStats = useCallback(() => {
    const answered = notes.filter(n => n.outcome === 'answered' || n.outcome === 'interested').length;
    const noAnswer = notes.filter(n => n.outcome === 'no_answer' || n.outcome === 'busy').length;
    const totalCalls = notes.filter(n => n.contact_type === 'call').length;
    const totalDuration = notes.reduce((sum, n) => sum + (n.duration_minutes || 0), 0);
    
    return {
      total: notes.length,
      answered,
      noAnswer,
      totalCalls,
      totalDuration,
      answerRate: notes.length > 0 ? Math.round((answered / notes.length) * 100) : 0,
    };
  }, [notes]);

  return {
    notes,
    loading,
    fetchNotes,
    addNote,
    updateNote,
    deleteNote,
    getContactStats,
  };
};
