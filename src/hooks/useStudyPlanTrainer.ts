import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TrainerResponse {
  response: string;
  action: string;
  documentType: string;
}

export function useStudyPlanTrainer() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const callTrainer = useCallback(async (
    action: 'teach' | 'analyze' | 'chat' | 'generate_example',
    documentType: 'study_plan' | 'personal_statement',
    content?: string,
    targetUniversityId?: string,
    language: string = 'en'
  ): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-plan-trainer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action,
            documentType,
            content,
            targetUniversityId,
            language,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      setLastResponse(data.response);
      return data.response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process request';
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
  }, [toast]);

  const teachStudyPlan = useCallback((language: string = 'en', universityId?: string) => {
    return callTrainer('teach', 'study_plan', undefined, universityId, language);
  }, [callTrainer]);

  const teachPersonalStatement = useCallback((language: string = 'en', universityId?: string) => {
    return callTrainer('teach', 'personal_statement', undefined, universityId, language);
  }, [callTrainer]);

  const generateStudyPlanExample = useCallback((language: string = 'en', universityId?: string) => {
    return callTrainer('generate_example', 'study_plan', undefined, universityId, language);
  }, [callTrainer]);

  const generatePersonalStatementExample = useCallback((language: string = 'en', universityId?: string) => {
    return callTrainer('generate_example', 'personal_statement', undefined, universityId, language);
  }, [callTrainer]);

  const analyzeStudyPlan = useCallback((content: string, language: string = 'en', universityId?: string) => {
    return callTrainer('analyze', 'study_plan', content, universityId, language);
  }, [callTrainer]);

  const analyzePersonalStatement = useCallback((content: string, language: string = 'en', universityId?: string) => {
    return callTrainer('analyze', 'personal_statement', content, universityId, language);
  }, [callTrainer]);

  const chatAboutStudyPlan = useCallback((message: string, language: string = 'en', universityId?: string) => {
    return callTrainer('chat', 'study_plan', message, universityId, language);
  }, [callTrainer]);

  const chatAboutPersonalStatement = useCallback((message: string, language: string = 'en', universityId?: string) => {
    return callTrainer('chat', 'personal_statement', message, universityId, language);
  }, [callTrainer]);

  const clearResponse = useCallback(() => {
    setLastResponse(null);
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    lastResponse,
    teachStudyPlan,
    teachPersonalStatement,
    generateStudyPlanExample,
    generatePersonalStatementExample,
    analyzeStudyPlan,
    analyzePersonalStatement,
    chatAboutStudyPlan,
    chatAboutPersonalStatement,
    clearResponse,
  };
}
