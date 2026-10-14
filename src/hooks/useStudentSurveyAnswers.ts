import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// The survey tables are not in the generated types yet — read untyped, the
// same way useUniversityCatalog does.
interface Result {
  data: unknown;
  error: { message: string } | null;
}
interface UntypedQuery extends PromiseLike<Result> {
  select: (columns?: string) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  in: (column: string, values: unknown[]) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
}
const db = supabase as unknown as { from: (table: string) => UntypedQuery };

interface ResponseRow { survey_id: string; question_id: string; answer: unknown; created_at: string }
interface SurveyRow { id: string; title: string }
interface QuestionRow { id: string; survey_id: string; question_text: string }

export interface SurveyAnswerBlock {
  surveyId: string;
  title: string;
  items: { questionId: string; question: string; answer: string | null }[];
}

/** A stored answer is JSON: usually a string, an array for multi-choice. */
export function formatAnswer(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) return value.map((v) => formatAnswer(v)).filter(Boolean).join(', ') || null;
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${formatAnswer(v) ?? '—'}`)
      .join(', ');
  }
  return String(value);
}

/**
 * Every survey the student answered, newest survey first, each with all of its
 * questions in order and the student's answer under each one.
 */
export function useStudentSurveyAnswers(studentId: string | null) {
  return useQuery<SurveyAnswerBlock[], Error>({
    queryKey: ['student-survey-answers', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data: rawResponses, error } = await db
        .from('survey_responses')
        .select('survey_id, question_id, answer, created_at')
        .eq('user_id', studentId!);
      if (error) throw new Error(error.message);
      const responses = (rawResponses ?? []) as ResponseRow[];
      const surveyIds = [...new Set(responses.map((r) => r.survey_id))];
      if (surveyIds.length === 0) return [];

      const [{ data: rawSurveys, error: sErr }, { data: rawQuestions, error: qErr }] = await Promise.all([
        db.from('surveys').select('id, title, created_at').in('id', surveyIds).order('created_at', { ascending: false }),
        db.from('survey_questions').select('id, survey_id, question_text, sort_order').in('survey_id', surveyIds).order('sort_order'),
      ]);
      if (sErr) throw new Error(sErr.message);
      if (qErr) throw new Error(qErr.message);
      const surveys = (rawSurveys ?? []) as SurveyRow[];
      const questions = (rawQuestions ?? []) as QuestionRow[];

      // Newest answer wins if a question was answered more than once.
      const answerByQuestion = new Map<string, { answer: unknown; at: string }>();
      for (const r of responses) {
        const prev = answerByQuestion.get(r.question_id);
        if (!prev || r.created_at > prev.at) answerByQuestion.set(r.question_id, { answer: r.answer, at: r.created_at });
      }

      return surveys.map((s) => ({
        surveyId: s.id,
        title: s.title,
        items: questions
          .filter((q) => q.survey_id === s.id)
          .map((q) => ({
            questionId: q.id,
            question: q.question_text,
            answer: formatAnswer(answerByQuestion.get(q.id)?.answer),
          })),
      }));
    },
  });
}
