import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SessionWithFeedback {
  id: string;
  session_type: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
  focus_topic: string | null;
  feedback: {
    communication_score: number | null;
    confidence_score: number | null;
    content_score: number | null;
    language_score: number | null;
    overall_score: number | null;
  } | null;
}

interface AnalyticsData {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  averageDuration: number;
  scoreHistory: {
    date: string;
    overall: number;
    communication: number;
    confidence: number;
    content: number;
    language: number;
  }[];
  categoryAverages: {
    communication: number;
    confidence: number;
    content: number;
    language: number;
  };
  weakestCategory: string | null;
  strongestCategory: string | null;
  improvementRate: number;
  practiceStreak: number;
  sessionsThisWeek: number;
  sessionsThisMonth: number;
}

export function useInterviewAnalytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [sessions, setSessions] = useState<SessionWithFeedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function fetchAnalytics() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch all sessions with feedback
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('interview_sessions')
          .select(`
            id,
            session_type,
            started_at,
            ended_at,
            duration_seconds,
            status,
            focus_topic,
            interview_feedback (
              communication_score,
              confidence_score,
              content_score,
              language_score,
              overall_score
            )
          `)
          .eq('student_id', user.id)
          .order('started_at', { ascending: false });

        if (sessionsError) throw sessionsError;

        const formattedSessions: SessionWithFeedback[] = (sessionsData || []).map(s => ({
          id: s.id,
          session_type: s.session_type,
          started_at: s.started_at,
          ended_at: s.ended_at,
          duration_seconds: s.duration_seconds,
          status: s.status,
          focus_topic: s.focus_topic,
          feedback: s.interview_feedback?.[0] || null,
        }));

        setSessions(formattedSessions);

        // Calculate analytics
        const completedSessions = formattedSessions.filter(s => s.status === 'completed' && s.feedback);
        const totalSessions = formattedSessions.length;

        if (completedSessions.length === 0) {
          setAnalytics({
            totalSessions,
            completedSessions: 0,
            averageScore: 0,
            averageDuration: 0,
            scoreHistory: [],
            categoryAverages: { communication: 0, confidence: 0, content: 0, language: 0 },
            weakestCategory: null,
            strongestCategory: null,
            improvementRate: 0,
            practiceStreak: 0,
            sessionsThisWeek: 0,
            sessionsThisMonth: 0,
          });
          return;
        }

        // Calculate averages
        const sum = { communication: 0, confidence: 0, content: 0, language: 0, overall: 0, duration: 0 };
        
        completedSessions.forEach(s => {
          if (s.feedback) {
            sum.communication += s.feedback.communication_score || 0;
            sum.confidence += s.feedback.confidence_score || 0;
            sum.content += s.feedback.content_score || 0;
            sum.language += s.feedback.language_score || 0;
            sum.overall += s.feedback.overall_score || 0;
          }
          sum.duration += s.duration_seconds || 0;
        });

        const count = completedSessions.length;
        const categoryAverages = {
          communication: sum.communication / count,
          confidence: sum.confidence / count,
          content: sum.content / count,
          language: sum.language / count,
        };

        // Find weakest and strongest
        const categories = Object.entries(categoryAverages);
        categories.sort((a, b) => a[1] - b[1]);
        const weakestCategory = categories[0][0];
        const strongestCategory = categories[categories.length - 1][0];

        // Score history (chronological)
        const scoreHistory = completedSessions
          .filter(s => s.feedback)
          .reverse()
          .map(s => ({
            date: new Date(s.started_at).toLocaleDateString(),
            overall: s.feedback?.overall_score || 0,
            communication: s.feedback?.communication_score || 0,
            confidence: s.feedback?.confidence_score || 0,
            content: s.feedback?.content_score || 0,
            language: s.feedback?.language_score || 0,
          }));

        // Calculate improvement rate (first 3 vs last 3 sessions)
        let improvementRate = 0;
        if (scoreHistory.length >= 6) {
          const first3 = scoreHistory.slice(0, 3).reduce((sum, s) => sum + s.overall, 0) / 3;
          const last3 = scoreHistory.slice(-3).reduce((sum, s) => sum + s.overall, 0) / 3;
          improvementRate = ((last3 - first3) / first3) * 100;
        }

        // Calculate practice streak
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let streak = 0;
        const sessionDates = new Set(
          formattedSessions.map(s => {
            const d = new Date(s.started_at);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
          })
        );

        for (let i = 0; i < 365; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() - i);
          if (sessionDates.has(checkDate.getTime())) {
            streak++;
          } else if (i > 0) {
            break;
          }
        }

        // Sessions this week/month
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const sessionsThisWeek = formattedSessions.filter(
          s => new Date(s.started_at) >= oneWeekAgo
        ).length;

        const sessionsThisMonth = formattedSessions.filter(
          s => new Date(s.started_at) >= oneMonthAgo
        ).length;

        setAnalytics({
          totalSessions,
          completedSessions: count,
          averageScore: sum.overall / count,
          averageDuration: sum.duration / count,
          scoreHistory,
          categoryAverages,
          weakestCategory,
          strongestCategory,
          improvementRate,
          practiceStreak: streak,
          sessionsThisWeek,
          sessionsThisMonth,
        });
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [user]);

  return { analytics, sessions, isLoading, error };
}
