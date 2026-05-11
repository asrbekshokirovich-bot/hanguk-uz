import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface InterviewMessage {
  id: string;
  role: 'interviewer' | 'student';
  content: string;
  created_at: string;
}

interface InterviewSession {
  id: string;
  status: string;
  session_type: string;
  started_at: string;
}

interface InterviewFeedback {
  communication_score: number;
  confidence_score: number;
  content_score: number;
  language_score: number;
  overall_score: number;
  strengths: string[];
  improvements: string[];
  detailed_feedback: string;
}

export function useInterviewSession() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionRef = useRef<InterviewSession | null>(null);
  const sendMessageRef = useRef<typeof sendMessage>(null!);

  // HeyGen token removed - now using Simli for avatar

  const sendMessage = useCallback(async (
    studentMessage: string,
    sessionType?: string,
    language: string = 'ko'
  ) => {
    const currentSession = sessionRef.current || session;
    if (!currentSession) {
      console.error('[Interview] No active session for sendMessage');
      setError('No active session');
      return null;
    }

    setIsProcessing(true);

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) {
        throw new Error('Not authenticated');
      }

      // Add student message to UI immediately
      const tempStudentMessage: InterviewMessage = {
        id: `temp-${Date.now()}`,
        role: 'student',
        content: studentMessage,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempStudentMessage]);

      console.log('[Interview] Sending message to interview-ai...', { sessionId: currentSession.id, sessionType });
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            sessionId: currentSession.id,
            studentMessage,
            sessionType: sessionType || currentSession.session_type,
            language,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('[Interview] interview-ai error:', response.status, data);
        throw new Error(data.error || 'Failed to get response');
      }

      console.log('[Interview] Got AI response, length:', data.response?.length);

      // Add interviewer response
      const interviewerMessage: InterviewMessage = {
        id: `interviewer-${Date.now()}`,
        role: 'interviewer',
        content: data.response,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, interviewerMessage]);

      return data.response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      console.error('[Interview] sendMessage error:', message);
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [session, toast]);

  // Keep ref always up-to-date
  sendMessageRef.current = sendMessage;

  const startSession = useCallback(async (
    sessionType: 'general' | 'university_specific' | 'visa' | 'document_based' = 'general',
    targetUniversityId?: string,
    language: string = 'ko',
    focusTopic?: string,
    timedMode?: boolean,
    timeLimitSeconds?: number
  ) => {
    if (!user) {
      setError('Not authenticated');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create session in database (including timed mode and focus topic)
      const { data: newSession, error: sessionError } = await supabase
        .from('interview_sessions')
        .insert({
          student_id: user.id,
          session_type: sessionType,
          target_institution_id: targetUniversityId || null,
          status: 'active',
          focus_topic: focusTopic || null,
          timed_mode: timedMode || false,
          time_limit_seconds: timeLimitSeconds || null,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      console.log('[Interview] Session created:', newSession.id);
      
      setSession(newSession);
      sessionRef.current = newSession;
      setMessages([]);
      setFeedback(null);

      // AI starts the conversation — use ref to get latest sendMessage
      await sendMessageRef.current('[Interview started - AI begins]', sessionType, language);

      return newSession;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start session';
      console.error('[Interview] startSession error:', message);
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);


  const endSession = useCallback(async (language: string = 'ko') => {
    const currentSession = sessionRef.current || session;
    if (!currentSession) return null;

    setIsLoading(true);

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) {
        throw new Error('Not authenticated');
      }

      // Get feedback from AI
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-feedback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({
            sessionId: currentSession.id,
            language,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get feedback');
      }

      setFeedback(data.feedback);
      setSession(prev => prev ? { ...prev, status: 'completed' } : null);

      return data.feedback;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end session';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session, toast]);

  const resetSession = useCallback(() => {
    setSession(null);
    sessionRef.current = null;
    setMessages([]);
    setFeedback(null);
    setError(null);
  }, []);

  return {
    session,
    messages,
    feedback,
    isLoading,
    isProcessing,
    error,
    startSession,
    sendMessage,
    endSession,
    resetSession,
  };
}
