import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface InterviewMessage {
  id: string;
  role: 'interviewer' | 'student';
  content: string;
  created_at: string;
  audio_url?: string | null;
}

/** Sentinel message used by the client to ask the AI to greet first.
 *  The interview-ai edge function detects this string and skips persisting it
 *  as a student turn so `conversationHistory.length === 0` correctly triggers
 *  the AI's greeting branch. */
export const START_INTERVIEW_SENTINEL = '[START_INTERVIEW]';

interface SendMessageResult {
  response: string;
  studentMessageId: string | null;
  interviewerMessageId: string | null;
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
  ): Promise<SendMessageResult | null> => {
    const currentSession = sessionRef.current || session;
    if (!currentSession) {
      console.error('[Interview] No active session for sendMessage');
      setError('No active session');
      return null;
    }

    const isStartSentinel = studentMessage === START_INTERVIEW_SENTINEL;

    setIsProcessing(true);

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) {
        throw new Error('Not authenticated');
      }

      // Add the student bubble to the UI immediately for snappy feel — but
      // skip the START sentinel: it's a backend trigger, not a real turn the
      // user typed/spoke.
      if (!isStartSentinel) {
        const tempStudentMessage: InterviewMessage = {
          id: `temp-${Date.now()}`,
          role: 'student',
          content: studentMessage,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, tempStudentMessage]);
      }

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

      const studentMessageId: string | null = data.studentMessageId ?? null;
      const interviewerMessageId: string | null = data.interviewerMessageId ?? null;

      // Replace the temp student bubble with the persisted ID so callers can
      // patch its `audio_url` later.
      if (!isStartSentinel && studentMessageId) {
        setMessages(prev => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === 'student' && next[i].id.startsWith('temp-')) {
              next[i] = { ...next[i], id: studentMessageId };
              break;
            }
          }
          return next;
        });
      }

      // Add interviewer response carrying the real DB id (or fallback).
      const interviewerMessage: InterviewMessage = {
        id: interviewerMessageId ?? `interviewer-${Date.now()}`,
        role: 'interviewer',
        content: data.response,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, interviewerMessage]);

      return {
        response: data.response,
        studentMessageId,
        interviewerMessageId,
      };
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
          target_university_id: targetUniversityId || null,
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

      // AI starts the conversation. The sentinel is recognized server-side
      // and is intentionally NOT persisted as a student turn so the AI's
      // greeting branch (`conversationHistory.length === 0`) actually fires.
      await sendMessageRef.current(START_INTERVIEW_SENTINEL, sessionType, language);

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
    // Idempotency guard: if a session has already been ended (manual click +
    // auto timeout firing in the same tick, for example), don't double-call
    // the feedback edge function or transition state twice.
    if (currentSession.status === 'completed') {
      console.log('[Interview] endSession skipped — session already completed');
      return null;
    }

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

  /**
   * Attach an `audio_url` to a previously persisted message so the transcript
   * review UI can render an `<AudioPlayback>` for it. Used after the audio
   * blob (student mic recording, or AI TTS output) has been uploaded to
   * Supabase Storage.
   */
  const setMessageAudioUrl = useCallback((messageId: string, audioUrl: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, audio_url: audioUrl } : m
    ));
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
    setMessageAudioUrl,
  };
}
