import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, GripVertical, Eye, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface Survey {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  question_count: number;
  response_count: number;
}

interface Question {
  id?: string;
  question_text: string;
  question_type: 'single_choice' | 'multiple_choice' | 'text' | 'rating';
  options: string[] | null;
  sort_order: number;
  is_required: boolean;
}

interface ResponseSummary {
  question_text: string;
  question_type: string;
  answers: { answer: unknown; count: number }[];
  total: number;
}

export default function SurveysContent() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showResponses, setShowResponses] = useState<string | null>(null);
  const [responseSummary, setResponseSummary] = useState<ResponseSummary[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    { question_text: '', question_type: 'single_choice', options: [''], sort_order: 0, is_required: true },
  ]);
  const [saving, setSaving] = useState(false);

  const fetchSurveys = async () => {
    setLoading(true);
    const { data: surveyRows } = await supabase
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false });

    if (!surveyRows) {
      setLoading(false);
      return;
    }

    const ids = surveyRows.map((s: Record<string, unknown>) => s.id as string);

    const { data: qCounts } = ids.length > 0
      ? await supabase
          .from('survey_questions')
          .select('survey_id')
          .in('survey_id', ids)
      : { data: [] };

    const { data: rCounts } = ids.length > 0
      ? await supabase
          .from('survey_responses')
          .select('survey_id, user_id')
          .in('survey_id', ids)
      : { data: [] };

    const qMap: Record<string, number> = {};
    for (const q of qCounts ?? []) {
      const sid = (q as Record<string, unknown>).survey_id as string;
      qMap[sid] = (qMap[sid] ?? 0) + 1;
    }

    const rMap: Record<string, Set<string>> = {};
    for (const r of rCounts ?? []) {
      const row = r as Record<string, unknown>;
      const sid = row.survey_id as string;
      if (!rMap[sid]) rMap[sid] = new Set();
      rMap[sid].add(row.user_id as string);
    }

    setSurveys(
      surveyRows.map((s: Record<string, unknown>) => ({
        id: s.id as string,
        title: s.title as string,
        description: s.description as string | null,
        is_active: s.is_active as boolean,
        starts_at: s.starts_at as string,
        ends_at: s.ends_at as string | null,
        created_at: s.created_at as string,
        question_count: qMap[s.id as string] ?? 0,
        response_count: rMap[s.id as string]?.size ?? 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchSurveys();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Sarlavhani kiriting");
      return;
    }
    const validQuestions = questions.filter(q => q.question_text.trim());
    if (validQuestions.length === 0) {
      toast.error("Kamida bitta savol qo'shing");
      return;
    }

    setSaving(true);
    try {
      const { data: survey, error: surveyErr } = await supabase
        .from('surveys')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          is_active: true,
          starts_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (surveyErr) throw surveyErr;

      const questionRows = validQuestions.map((q, i) => ({
        survey_id: (survey as Record<string, unknown>).id as string,
        question_text: q.question_text.trim(),
        question_type: q.question_type,
        options: q.question_type === 'text' || q.question_type === 'rating'
          ? null
          : (q.options ?? []).filter(o => o.trim()),
        sort_order: i,
        is_required: q.is_required,
      }));

      const { error: qErr } = await supabase
        .from('survey_questions')
        .insert(questionRows);

      if (qErr) throw qErr;

      toast.success("So'rovnoma yaratildi");
      setShowCreate(false);
      resetForm();
      fetchSurveys();
    } catch (err) {
      toast.error(`Xatolik: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from('surveys')
      .update({ is_active: !active })
      .eq('id', id);

    if (error) {
      toast.error(`Xatolik: ${error.message}`);
      return;
    }
    fetchSurveys();
  };

  const deleteSurvey = async (id: string) => {
    if (!confirm("Bu so'rovnomani o'chirmoqchimisiz?")) return;
    const { error } = await supabase.from('surveys').delete().eq('id', id);
    if (error) {
      toast.error(`Xatolik: ${error.message}`);
      return;
    }
    toast.success("O'chirildi");
    fetchSurveys();
  };

  const viewResponses = async (surveyId: string) => {
    setShowResponses(surveyId);
    setResponsesLoading(true);

    const { data: qs } = await supabase
      .from('survey_questions')
      .select('id, question_text, question_type')
      .eq('survey_id', surveyId)
      .order('sort_order', { ascending: true });

    if (!qs || qs.length === 0) {
      setResponseSummary([]);
      setResponsesLoading(false);
      return;
    }

    const qIds = qs.map((q: Record<string, unknown>) => q.id as string);
    const { data: responses } = await supabase
      .from('survey_responses')
      .select('question_id, answer')
      .in('question_id', qIds);

    const summary: ResponseSummary[] = qs.map((q: Record<string, unknown>) => {
      const qId = q.id as string;
      const qResponses = (responses ?? []).filter(
        (r: Record<string, unknown>) => r.question_id === qId
      );

      const answerCounts: Record<string, number> = {};
      for (const r of qResponses) {
        const ans = r as Record<string, unknown>;
        const val = JSON.stringify(ans.answer);
        answerCounts[val] = (answerCounts[val] ?? 0) + 1;
      }

      return {
        question_text: q.question_text as string,
        question_type: q.question_type as string,
        answers: Object.entries(answerCounts).map(([answer, count]) => ({
          answer: JSON.parse(answer),
          count,
        })),
        total: qResponses.length,
      };
    });

    setResponseSummary(summary);
    setResponsesLoading(false);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setQuestions([
      { question_text: '', question_type: 'single_choice', options: [''], sort_order: 0, is_required: true },
    ]);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: '',
        question_type: 'single_choice',
        options: [''],
        sort_order: questions.length,
        is_required: true,
      },
    ]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: keyof Question, value: unknown) => {
    const updated = [...questions];
    (updated[idx] as Record<string, unknown>)[field] = value;
    setQuestions(updated);
  };

  const addOption = (qIdx: number) => {
    const updated = [...questions];
    updated[qIdx].options = [...(updated[qIdx].options ?? []), ''];
    setQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const updated = [...questions];
    const opts = [...(updated[qIdx].options ?? [])];
    opts[oIdx] = value;
    updated[qIdx].options = opts;
    setQuestions(updated);
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const updated = [...questions];
    updated[qIdx].options = (updated[qIdx].options ?? []).filter((_, i) => i !== oIdx);
    setQuestions(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">So'rovnomalar</h2>
          <p className="text-muted-foreground">
            So'rovnomalarni yarating va natijalarni ko'ring
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yangi so'rovnoma
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : surveys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Hali so'rovnomalar yo'q
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sarlavha</TableHead>
                  <TableHead>Savollar</TableHead>
                  <TableHead>Javoblar</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead>Yaratilgan</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surveys.map((survey) => (
                  <TableRow key={survey.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{survey.title}</div>
                        {survey.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {survey.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{survey.question_count}</TableCell>
                    <TableCell>{survey.response_count}</TableCell>
                    <TableCell>
                      <Badge variant={survey.is_active ? 'default' : 'neutral'}>
                        {survey.is_active ? 'Faol' : 'Nofaol'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(survey.created_at).toLocaleDateString('uz')}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewResponses(survey.id)}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(survey.id, survey.is_active)}
                      >
                        {survey.is_active ? 'O\'chirish' : 'Yoqish'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSurvey(survey.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create survey dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yangi so'rovnoma</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Sarlavha</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="So'rovnoma sarlavhasi"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tavsif (ixtiyoriy)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Qisqacha tavsif"
                rows={2}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Savollar</label>
                <Button variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="h-3 w-3 mr-1" />
                  Savol qo'shish
                </Button>
              </div>

              {questions.map((q, qIdx) => (
                <Card key={qIdx}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0" />
                      <div className="flex-1 space-y-3">
                        <Input
                          value={q.question_text}
                          onChange={(e) => updateQuestion(qIdx, 'question_text', e.target.value)}
                          placeholder={`${qIdx + 1}-savol`}
                        />
                        <div className="flex gap-3">
                          <Select
                            value={q.question_type}
                            onValueChange={(v) => updateQuestion(qIdx, 'question_type', v)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single_choice">Bitta tanlov</SelectItem>
                              <SelectItem value="multiple_choice">Ko'p tanlov</SelectItem>
                              <SelectItem value="text">Matn</SelectItem>
                              <SelectItem value="rating">Baho (1-5)</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={q.is_required}
                              onCheckedChange={(v) => updateQuestion(qIdx, 'is_required', v)}
                            />
                            <span className="text-sm text-muted-foreground">Majburiy</span>
                          </div>
                        </div>

                        {(q.question_type === 'single_choice' || q.question_type === 'multiple_choice') && (
                          <div className="space-y-2 pl-4">
                            {(q.options ?? []).map((opt, oIdx) => (
                              <div key={oIdx} className="flex gap-2">
                                <Input
                                  value={opt}
                                  onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                                  placeholder={`Variant ${oIdx + 1}`}
                                  className="flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOption(qIdx, oIdx)}
                                  disabled={(q.options?.length ?? 0) <= 1}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addOption(qIdx)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Variant qo'shish
                            </Button>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(qIdx)}
                        disabled={questions.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Bekor qilish
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Saqlanmoqda...' : 'Yaratish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Responses dialog */}
      <Dialog open={!!showResponses} onOpenChange={() => setShowResponses(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Natijalar</DialogTitle>
          </DialogHeader>

          {responsesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : responseSummary.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Hali javoblar yo'q
            </div>
          ) : (
            <div className="space-y-6">
              {responseSummary.map((item, idx) => (
                <Card key={idx}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{item.question_text}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {item.total} ta javob
                    </p>
                  </CardHeader>
                  <CardContent>
                    {item.answers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Javoblar yo'q</p>
                    ) : item.question_type === 'text' ? (
                      <div className="space-y-2">
                        {item.answers.map((a, i) => (
                          <div key={i} className="text-sm bg-muted rounded-md p-2">
                            {String(a.answer)}
                            {a.count > 1 && (
                              <Badge variant="neutral" className="ml-2">
                                ×{a.count}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {item.answers
                          .sort((a, b) => b.count - a.count)
                          .map((a, i) => {
                            const pct = item.total > 0
                              ? Math.round((a.count / item.total) * 100)
                              : 0;
                            return (
                              <div key={i} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span>{String(a.answer)}</span>
                                  <span className="text-muted-foreground">
                                    {a.count} ({pct}%)
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
