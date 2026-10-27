import { useState, useCallback, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { threadTitleFrom } from '@/lib/aiThreads';

// ai_threads is newer than the generated types.
const db = supabase as unknown as SupabaseClient;

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type UserType = 'student' | 'staff';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hanguk-ai-chat`;

interface Options {
  /** Keep each conversation separately (ai_threads). Used by the CRM page. */
  threads?: boolean;
  /** Called after an answer is saved, e.g. to refresh the conversation list. */
  onSaved?: () => void;
}

export function useHangukAI(userType: UserType, language: string = 'en', options: Options = {}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const threadRef = useRef<string | null>(null);
  const { threads = false, onSaved } = options;

  const sendMessage = useCallback(async (input: string) => {
    if (!user || !input.trim()) return;

    setError(null);
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = '';
    
    const upsertAssistant = (nextChunk: string) => {
      assistantSoFar += nextChunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      // Forward the logged-in user's access token so the edge function can
      // identify them (the staff agent path needs a real JWT, not the anon key).
      // The publishable key still goes in `apikey` to satisfy the gateway.
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // A new conversation starts with the first question.
      if (threads && !threadRef.current) {
        const { data: created, error: threadErr } = await db
          .from('ai_threads')
          .insert({ user_id: user.id, user_type: userType, title: threadTitleFrom(input) })
          .select('id')
          .single();
        if (!threadErr && created?.id) {
          threadRef.current = created.id as string;
          setThreadId(threadRef.current);
        }
      }

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: input,
          user_id: user.id,
          user_type: userType,
          language,
          thread_id: threads ? threadRef.current : undefined,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (resp.status === 402) {
          throw new Error('AI service temporarily unavailable.');
        }
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!resp.body) {
        throw new Error('No response body');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }

    } catch (e) {
      console.error('Hanguk AI error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to get response';
      setError(errorMessage);
      // Remove the user message if we failed
      setMessages(prev => prev.filter((_, i) => i !== prev.length - 1));
    } finally {
      setIsLoading(false);
      onSaved?.();
    }
  }, [user, userType, language, threads, onSaved]);

  /** Start a new conversation (the next question opens a new thread). */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    threadRef.current = null;
    setThreadId(null);
  }, []);

  /** Continue an earlier conversation: load its messages and keep writing to it. */
  const openThread = useCallback(async (id: string) => {
    setError(null);
    const { data, error: loadErr } = await db
      .from('ai_conversations')
      .select('role, content')
      .eq('thread_id', id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (loadErr) {
      setError(loadErr.message);
      return;
    }
    threadRef.current = id;
    setThreadId(id);
    setMessages(
      (data ?? [])
        .filter((r: { role: string; content: string }) => (r.role === 'user' || r.role === 'assistant') && r.content)
        .map((r: { role: string; content: string }) => ({ role: r.role as Message['role'], content: r.content })),
    );
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    openThread,
    threadId,
  };
}
