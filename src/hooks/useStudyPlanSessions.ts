import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface StudyPlanSession {
  id: string;
  student_id: string;
  document_type: 'study_plan' | 'personal_statement';
  target_institution_id: string | null;
  current_step: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  university?: {
    id: string;
    name_en: string | null;
    name_ko: string | null;
    name_uz: string | null;
  } | null;
}

export interface StudyPlanDraft {
  id: string;
  session_id: string;
  student_id: string;
  version: number;
  content: string;
  word_count: number | null;
  source: 'typed' | 'uploaded' | 'ai_generated';
  file_name: string | null;
  created_at: string;
}

export interface StudyPlanAnalysis {
  id: string;
  session_id: string;
  draft_id: string;
  overall_score: number | null;
  grammar_errors: Array<{ error: string; correction: string; type: string }>;
  content_feedback: string | null;
  strengths: string[];
  improvements: string[];
  ai_response: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export function useStudyPlanSessions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<StudyPlanSession[]>([]);
  const [currentSession, setCurrentSession] = useState<StudyPlanSession | null>(null);
  const [drafts, setDrafts] = useState<StudyPlanDraft[]>([]);
  const [analyses, setAnalyses] = useState<StudyPlanAnalysis[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);

  // Fetch all sessions for the current user
  const fetchSessions = useCallback(async () => {
    if (!user?.id) return;
    
    setIsSessionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('study_plan_sessions')
        .select(`
          *,
          university:target_institution_id (
            id,
            name_en,
            name_ko,
            name_uz
          )
        `)
        .eq('student_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setSessions((data || []) as StudyPlanSession[]);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setIsSessionsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Create a new session
  const createSession = useCallback(async (
    documentType: 'study_plan' | 'personal_statement',
    targetUniversityId?: string
  ): Promise<StudyPlanSession | null> => {
    if (!user?.id) return null;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('study_plan_sessions')
        .insert({
          student_id: user.id,
          document_type: documentType,
          target_institution_id: targetUniversityId || null,
          current_step: 1,
          status: 'in_progress',
        })
        .select(`
          *,
          university:target_institution_id (
            id,
            name_en,
            name_ko,
            name_uz
          )
        `)
        .single();

      if (error) throw error;
      
      const session = data as StudyPlanSession;
      setSessions(prev => [session, ...prev]);
      setCurrentSession(session);
      setDrafts([]);
      setAnalyses([]);
      setChatHistory([]);
      
      return session;
    } catch (err) {
      console.error('Failed to create session:', err);
      toast({
        title: 'Error',
        description: 'Failed to create training session',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  // Load a session with its data
  const loadSession = useCallback(async (sessionId: string) => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // Fetch session
      const { data: sessionData, error: sessionError } = await supabase
        .from('study_plan_sessions')
        .select(`
          *,
          university:target_institution_id (
            id,
            name_en,
            name_ko,
            name_uz
          )
        `)
        .eq('id', sessionId)
        .eq('student_id', user.id)
        .single();

      if (sessionError) throw sessionError;
      setCurrentSession(sessionData as StudyPlanSession);

      // Fetch drafts
      const { data: draftsData } = await supabase
        .from('study_plan_drafts')
        .select('*')
        .eq('session_id', sessionId)
        .order('version', { ascending: false });
      setDrafts((draftsData || []) as StudyPlanDraft[]);

      // Fetch analyses
      const { data: analysesData } = await supabase
        .from('study_plan_analyses')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      setAnalyses((analysesData || []) as StudyPlanAnalysis[]);

      // Fetch chat history
      const { data: chatData } = await supabase
        .from('study_plan_chat_history')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      setChatHistory((chatData || []) as ChatMessage[]);

    } catch (err) {
      console.error('Failed to load session:', err);
      toast({
        title: 'Error',
        description: 'Failed to load training session',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  // Update session step
  const updateSessionStep = useCallback(async (step: number) => {
    if (!currentSession) return;
    
    try {
      const { error } = await supabase
        .from('study_plan_sessions')
        .update({ 
          current_step: step,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSession.id);

      if (error) throw error;
      
      setCurrentSession(prev => prev ? { ...prev, current_step: step } : null);
      setSessions(prev => 
        prev.map(s => s.id === currentSession.id ? { ...s, current_step: step } : s)
      );
    } catch (err) {
      console.error('Failed to update session step:', err);
    }
  }, [currentSession]);

  // Complete session
  const completeSession = useCallback(async () => {
    if (!currentSession) return;
    
    try {
      const { error } = await supabase
        .from('study_plan_sessions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSession.id);

      if (error) throw error;
      
      setCurrentSession(prev => prev ? { ...prev, status: 'completed' } : null);
      setSessions(prev => 
        prev.map(s => s.id === currentSession.id ? { ...s, status: 'completed' } : s)
      );
      
      toast({
        title: 'Session Complete!',
        description: 'Your training session has been completed.',
      });
    } catch (err) {
      console.error('Failed to complete session:', err);
    }
  }, [currentSession, toast]);

  // Save a draft
  const saveDraft = useCallback(async (
    content: string,
    source: 'typed' | 'uploaded' | 'ai_generated' = 'typed',
    fileName?: string
  ): Promise<StudyPlanDraft | null> => {
    if (!currentSession || !user?.id) return null;
    
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const nextVersion = drafts.length > 0 ? Math.max(...drafts.map(d => d.version)) + 1 : 1;
    
    try {
      const { data, error } = await supabase
        .from('study_plan_drafts')
        .insert({
          session_id: currentSession.id,
          student_id: user.id,
          version: nextVersion,
          content,
          word_count: wordCount,
          source,
          file_name: fileName || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      const draft = data as StudyPlanDraft;
      setDrafts(prev => [draft, ...prev]);
      return draft;
    } catch (err) {
      console.error('Failed to save draft:', err);
      toast({
        title: 'Error',
        description: 'Failed to save draft',
        variant: 'destructive',
      });
      return null;
    }
  }, [currentSession, user?.id, drafts, toast]);

  // Save analysis
  const saveAnalysis = useCallback(async (
    draftId: string,
    analysisData: {
      overall_score?: number;
      grammar_errors?: Array<{ error: string; correction: string; type: string }>;
      content_feedback?: string;
      strengths?: string[];
      improvements?: string[];
      ai_response?: string;
    }
  ): Promise<StudyPlanAnalysis | null> => {
    if (!currentSession) return null;
    
    try {
      const { data, error } = await supabase
        .from('study_plan_analyses')
        .insert({
          session_id: currentSession.id,
          draft_id: draftId,
          overall_score: analysisData.overall_score || null,
          grammar_errors: analysisData.grammar_errors || [],
          content_feedback: analysisData.content_feedback || null,
          strengths: analysisData.strengths || [],
          improvements: analysisData.improvements || [],
          ai_response: analysisData.ai_response || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      const analysis = data as StudyPlanAnalysis;
      setAnalyses(prev => [analysis, ...prev]);
      return analysis;
    } catch (err) {
      console.error('Failed to save analysis:', err);
      return null;
    }
  }, [currentSession]);

  // Add chat message
  const addChatMessage = useCallback(async (
    role: 'user' | 'assistant',
    content: string
  ): Promise<ChatMessage | null> => {
    if (!currentSession) return null;
    
    try {
      const { data, error } = await supabase
        .from('study_plan_chat_history')
        .insert({
          session_id: currentSession.id,
          role,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      
      const message = data as ChatMessage;
      setChatHistory(prev => [...prev, message]);
      return message;
    } catch (err) {
      console.error('Failed to save chat message:', err);
      return null;
    }
  }, [currentSession]);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('study_plan_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setDrafts([]);
        setAnalyses([]);
        setChatHistory([]);
      }
      
      toast({
        title: 'Session Deleted',
        description: 'Training session has been removed.',
      });
    } catch (err) {
      console.error('Failed to delete session:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete session',
        variant: 'destructive',
      });
    }
  }, [currentSession?.id, toast]);

  // Clear current session (go back to list)
  const clearCurrentSession = useCallback(() => {
    setCurrentSession(null);
    setDrafts([]);
    setAnalyses([]);
    setChatHistory([]);
  }, []);

  // Get latest draft
  const latestDraft = drafts[0] || null;

  // Get latest analysis
  const latestAnalysis = analyses[0] || null;

  return {
    sessions,
    currentSession,
    drafts,
    analyses,
    chatHistory,
    latestDraft,
    latestAnalysis,
    isLoading,
    isSessionsLoading,
    createSession,
    loadSession,
    updateSessionStep,
    completeSession,
    saveDraft,
    saveAnalysis,
    addChatMessage,
    deleteSession,
    clearCurrentSession,
    refreshSessions: fetchSessions,
  };
}
