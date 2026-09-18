import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { Loader2, ChevronRight } from 'lucide-react';

interface SurveyRow {
  id: string;
  title: string;
  description: string | null;
  question_count: number;
  answered_count: number;
}

export default function SurveyList() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data: rows } = await supabase
        .from('surveys')
        .select('id, title, description')
        .order('created_at', { ascending: false });

      const list = (rows ?? []) as Record<string, unknown>[];
      const ids = list.map((s) => s.id as string);

      if (ids.length === 0) {
        setSurveys([]);
        setLoading(false);
        return;
      }

      const { data: qs } = await supabase
        .from('survey_questions')
        .select('survey_id')
        .in('survey_id', ids);

      const { data: mine } = await supabase
        .from('survey_responses')
        .select('survey_id')
        .eq('user_id', userId)
        .in('survey_id', ids);

      const qCount: Record<string, number> = {};
      for (const q of (qs ?? []) as Record<string, unknown>[]) {
        const sid = q.survey_id as string;
        qCount[sid] = (qCount[sid] ?? 0) + 1;
      }

      const aCount: Record<string, number> = {};
      for (const r of (mine ?? []) as Record<string, unknown>[]) {
        const sid = r.survey_id as string;
        aCount[sid] = (aCount[sid] ?? 0) + 1;
      }

      setSurveys(
        list.map((s) => ({
          id: s.id as string,
          title: s.title as string,
          description: s.description as string | null,
          question_count: qCount[s.id as string] ?? 0,
          answered_count: aCount[s.id as string] ?? 0,
        }))
      );
      setLoading(false);
    };

    load();
  }, [authLoading, userId]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex justify-center">
          <Link to="/">
            <Logo className="h-12 w-12" />
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold">So'rovnomalar</h1>
          <p className="text-muted-foreground">
            To'ldirilishi kerak bo'lgan so'rovnomalar
          </p>
        </div>

        {authLoading || loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !user ? (
          <Card>
            <CardContent className="space-y-4 py-8 text-center">
              <p className="text-muted-foreground">
                Ko'rish uchun tizimga kiring.
              </p>
              <Button onClick={() => navigate('/auth?next=/surveys')}>
                Kirish
              </Button>
            </CardContent>
          </Card>
        ) : surveys.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Hozircha so'rovnoma yo'q
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {surveys.map((s) => {
              const complete =
                s.question_count > 0 && s.answered_count >= s.question_count;
              return (
                <Card
                  key={s.id}
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() => navigate(`/surveys/${s.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base">{s.title}</CardTitle>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={complete ? 'default' : 'neutral'}>
                          {complete ? 'Bajarilgan' : `${s.question_count} savol`}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardHeader>
                  {s.description && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        {s.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
