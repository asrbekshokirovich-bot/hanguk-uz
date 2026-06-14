import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type UserType = 'student' | 'staff';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hanguk-ai-chat`;

export function useHangukAI(userType: UserType, language: string = 'en') {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      // Forward the user's session JWT so the edge function can authenticate the
      // caller (enables the staff agentic tool path, which gates on auth.uid()).
      // The publishable key rides along as `apikey` for PostgREST. If there's no
      // session token, fall back to the publishable key as Authorization (legacy).
      const accessToken = session?.access_token;
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': publishableKey,
          'Authorization': `Bearer ${accessToken || publishableKey}`,
        },
        body: JSON.stringify({
          message: input,
          user_id: user.id,
          user_type: userType,
          language,
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
    }
  }, [user, session, userType, language]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
