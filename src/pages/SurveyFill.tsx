import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { Loader2, Check, Star } from 'lucide-react';
import { toast } from 'sonner';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  is_required: boolean;
}

type Answer = string | string[] | number;

/* There is deliberately no format check here.
 *
 * A typed field exists to raise the right keyboard, not to police what the
 * student writes. The first real survey asked "write 2 phone numbers" in one
 * phone field; a one-number rule rejected the answer the question asked for
 * and there was no way past it. Staff read these answers themselves, so a
 * wrong-looking phone number costs a glance — a blocked submit costs the
 * whole response. Required-ness is still enforced in handleSubmit. */

function hasValue(answer: Answer | undefined): boolean {
  if (answer === undefined || answer === null) return false;
  if (typeof answer === 'string') return answer.trim().length > 0;
  if (Array.isArray(answer)) return answer.length > 0;
  return true;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex justify-center">
          <Link to="/">
            <Logo className="h-12 w-12" />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SurveyFill() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  // Seed the form from stored answers once. A token refresh hands back a new
  // user object, which would otherwise re-run the load and wipe out whatever
  // the student had typed so far — on a form this long, all of it.
  const seeded = useRef(false);

  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState<{ title: string; description: string | null } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);

  const load = useCallback(async () => {
    if (!id || !userId) return;
    setLoading(true);

    const { data: s } = await supabase
      .from('surveys')
      .select('title, description')
      .eq('id', id)
      .maybeSingle();

    if (!s) {
      setSurvey(null);
      setLoading(false);
      return;
    }
    setSurvey(s as { title: string; description: string | null });

    const { data: qs } = await supabase
      .from('survey_questions')
      .select('id, question_text, question_type, options, is_required')
      .eq('survey_id', id)
      .order('sort_order', { ascending: true });

    const list = ((qs ?? []) as Record<string, unknown>[]).map((q) => ({
      id: q.id as string,
      question_text: q.question_text as string,
      question_type: q.question_type as string,
      options: Array.isArray(q.options) ? (q.options as string[]) : null,
      is_required: q.is_required as boolean,
    }));
    setQuestions(list);

    // Pre-fill anything this student already sent, so a reopened link shows
    // their answers instead of an empty form.
    const { data: existing } = await supabase
      .from('survey_responses')
      .select('question_id, answer')
      .eq('user_id', userId)
      .eq('survey_id', id);

    const prior: Record<string, Answer> = {};
    for (const r of (existing ?? []) as Record<string, unknown>[]) {
      prior[r.question_id as string] = r.answer as Answer;
    }
    if (!seeded.current) {
      setAnswers(prior);
      seeded.current = true;
    }
    setAlreadyAnswered(list.length > 0 && Object.keys(prior).length >= list.length);
    setLoading(false);
  }, [id, userId]);

  useEffect(() => {
    if (authLoading) return;
    if (userId) load();
    else setLoading(false);
  }, [authLoading, userId, load]);

  const setAnswer = (qId: string, value: Answer) =>
    setAnswers((prev) => ({ ...prev, [qId]: value }));

  const handleSubmit = async () => {
    const missing = questions.find((q) => q.is_required && !hasValue(answers[q.id]));
    if (missing) {
      toast.error(`Majburiy savol: ${missing.question_text}`);
      return;
    }
    setSubmitting(true);
    try {
      const rows = questions
        .filter((q) => hasValue(answers[q.id]))
        .map((q) => ({
          survey_id: id,
          question_id: q.id,
          user_id: user!.id,
          answer: answers[q.id],
        }));

      const { error } = await supabase
        .from('survey_responses')
        .upsert(rows, { onConflict: 'question_id,user_id' });

      if (error) throw error;
      setDone(true);
    } catch (err) {
      toast.error(`Xatolik: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Shell>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>So'rovnomani to'ldirish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              To'ldirish uchun avval tizimga kiring. Ilovadagi kodingiz bilan
              kirasiz.
            </p>
            <Button
              className="w-full"
              onClick={() => navigate(`/auth?next=/surveys/${id}`)}
            >
              Kirish
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (!survey) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            So'rovnoma topilmadi yoki yopilgan.
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">Rahmat!</p>
              <p className="text-muted-foreground">Javoblaringiz qabul qilindi</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              Bosh sahifa
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>{survey.title}</CardTitle>
          {survey.description && (
            <p className="text-sm text-muted-foreground">{survey.description}</p>
          )}
          {alreadyAnswered && (
            <p className="text-sm text-muted-foreground">
              Siz bu so'rovnomani to'ldirgansiz. O'zgartirib qayta yuborishingiz
              mumkin.
            </p>
          )}
        </CardHeader>
      </Card>

      {questions.map((q, i) => (
        <Card key={q.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              {i + 1}. {q.question_text}
              {q.is_required && <span className="ml-1 text-destructive">*</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionInput
              question={q}
              value={answers[q.id]}
              onChange={(v) => setAnswer(q.id, v)}
            />
          </CardContent>
        </Card>
      ))}

      {questions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Bu so'rovnomada savol yo'q.
          </CardContent>
        </Card>
      ) : (
        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Yuborilmoqda...
            </>
          ) : (
            'Yuborish'
          )}
        </Button>
      )}
    </Shell>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
}) {
  const text = typeof value === 'string' ? value : '';

  switch (question.question_type) {
    case 'long_text':
      return (
        <Textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Batafsil yozing..."
          rows={5}
        />
      );

    case 'email':
      return (
        <Input
          type="email"
          inputMode="email"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="misol@mail.com"
        />
      );

    case 'phone':
      return (
        <Input
          type="tel"
          inputMode="tel"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="+998 90 123 45 67"
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Raqam kiriting"
        />
      );

    case 'date':
      return (
        <Input
          type="date"
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'single_choice':
      return (
        <RadioGroup value={text} onValueChange={onChange}>
          {(question.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center space-x-2">
              <RadioGroupItem value={opt} id={`${question.id}-${i}`} />
              <Label htmlFor={`${question.id}-${i}`} className="font-normal">
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );

    case 'multiple_choice': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {(question.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center space-x-2">
              <Checkbox
                id={`${question.id}-${i}`}
                checked={selected.includes(opt)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked
                      ? [...selected, opt]
                      : selected.filter((o) => o !== opt)
                  )
                }
              />
              <Label htmlFor={`${question.id}-${i}`} className="font-normal">
                {opt}
              </Label>
            </div>
          ))}
        </div>
      );
    }

    case 'rating': {
      const current = typeof value === 'number' ? value : 0;
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              aria-label={`${star} ball`}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={
                  star <= current
                    ? 'h-8 w-8 fill-primary text-primary'
                    : 'h-8 w-8 text-muted-foreground'
                }
              />
            </button>
          ))}
        </div>
      );
    }

    default:
      return (
        <Input
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Javobingizni yozing..."
        />
      );
  }
}
