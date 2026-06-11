import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  X, Sparkles, Loader2, Star, Send, 
  GraduationCap, DollarSign, Trophy, Users, Building
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ComparisonQuestionnaire, StudentPreferences } from './ComparisonQuestionnaire';

interface StudentContext {
  profile: {
    full_name?: string;
    topik_level?: number;
    ielts_score?: number;
    korean_region_preference?: string;
    study_work_priority?: string;
    notes?: string;
  };
  staffNotes: string[];
  staffComments: string[];
  applications: { university_name: string; status: string }[];
}

interface UniversityComparisonChatProps {
  universities: Tables<'universities'>[];
  onClose: () => void;
}

interface ComparisonData {
  rankings: { name: string; value: number; max: number }[];
  tuition: { name: string; min: number; max: number }[];
  acceptance: { name: string; value: number }[];
}

export function UniversityComparisonChat({ universities, onClose }: UniversityComparisonChatProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const currentLang = i18n.language as 'uz' | 'ko' | 'ru' | 'en';
  const [phase, setPhase] = useState<'questionnaire' | 'comparison'>('questionnaire');
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState('');
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [askingFollowUp, setAskingFollowUp] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [studentContext, setStudentContext] = useState<StudentContext | null>(null);
  const [preferences, setPreferences] = useState<StudentPreferences | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const getUniversityName = (university: Tables<'universities'>) => {
    const langMap: Record<string, keyof Tables<'universities'>> = {
      uz: 'name_uz', ko: 'name_ko', en: 'name_en', ru: 'name_ru',
    };
    const key = langMap[currentLang];
    return (key && university[key] as string) || (university.name_en as string) || (university.name_ko as string) || (university.name_uz as string) || '';
  };

  // Build comparison data for charts
  const comparisonData: ComparisonData = {
    rankings: universities
      .filter(u => u.ranking)
      .map(u => ({ 
        name: getUniversityName(u), 
        value: u.ranking!, 
        max: Math.max(...universities.map(uni => uni.ranking || 0)) 
      })),
    tuition: universities
      .filter(u => u.tuition_min && u.tuition_max)
      .map(u => ({ 
        name: getUniversityName(u), 
        min: u.tuition_min!, 
        max: u.tuition_max! 
      })),
    acceptance: universities
      .filter(u => u.acceptance_rate)
      .map(u => ({ 
        name: getUniversityName(u), 
        value: u.acceptance_rate! 
      })),
  };

  const maxTuition = Math.max(...comparisonData.tuition.map(t => t.max), 1);

  // Fetch student context on mount — inlined to avoid dependency lint issues
  useEffect(() => {
    if (!user) return;

    const fetchContext = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, topik_level, ielts_score, korean_region_preference, study_work_priority, notes')
          .eq('user_id', user.id)
          .single();

        const { data: applications } = await supabase
          .from('applications')
          .select('status, university:institutions(name_en, name_ko)')
          .eq('student_id', user.id);

        setStudentContext({
          profile: profile || {},
          staffNotes: [],
          staffComments: [],
          applications: applications?.map(a => ({
            university_name: (a.university as any)?.name_uz || 'Unknown',
            status: a.status
          })) || []
        });
      } catch (error) {
        console.error('Error fetching student context:', error);
      }
    };

    fetchContext();
  }, [user]);

  // Problem 7: Wrap auto-scroll in rAF to coalesce rapid streaming updates
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [comparison, messages]);

  const handleQuestionnaireComplete = (prefs: StudentPreferences) => {
    setPreferences(prefs);
    setPhase('comparison');
    startComparison(prefs);
  };

  const handleSkipQuestionnaire = () => {
    setPhase('comparison');
    startComparison(null);
  };

  // Problem 1: Fix SSE streaming — use raw fetch with user JWT instead of supabase.functions.invoke
  const streamAIResponse = async (universityIds: string[], additionalContext?: string, prefs?: StudentPreferences | null, skipDbFetch?: boolean) => {
    try {
      // Abort any previous stream
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/compare-universities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          universityIds,
          language: currentLang,
          followUpQuestion: additionalContext,
          studentContext: studentContext,
          studentPreferences: prefs || preferences,
          skipDbFetch: !!skipDbFetch,
          conversationHistory: additionalContext ? messages.slice(-6) : undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
        if (response.status === 402) throw new Error('AI credits exhausted. Please contact support.');
        throw new Error(`Comparison failed (${response.status})`);
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';
      let lineBuffer = ''; // Problem 1: Buffer incomplete lines across chunks
      let rawChunks = ''; // Problem 2: Capture raw chunks as fallback

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        rawChunks += chunk;
        lineBuffer += chunk;

        // Process only complete lines (terminated by \n)
        const lines = lineBuffer.split('\n');
        // Keep the last element as it may be incomplete
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
            if (content) {
              fullContent += content;
              if (additionalContext) {
                setMessages(prev => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    return [...prev.slice(0, -1), { role: 'assistant', content: fullContent }];
                  }
                  return [...prev, { role: 'assistant', content: fullContent }];
                });
              } else {
                setComparison(fullContent);
              }
            }
          } catch {
            // Non-JSON SSE line, skip
          }
        }
      }

      // Problem 2: Use captured raw chunks as fallback (stream already consumed)
      if (!fullContent && rawChunks.trim()) {
        fullContent = rawChunks;
        if (additionalContext) {
          setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
        } else {
          setComparison(fullContent);
        }
      }
      
      return fullContent;
    } catch (error) {
      console.error('Comparison error:', error);
      throw error;
    }
  };

  const startComparison = async (prefs: StudentPreferences | null) => {
    setLoading(true);
    try {
      const result = await streamAIResponse(universities.map(u => u.id), undefined, prefs);
      // Add initial comparison to messages so follow-ups have full context
      if (result) {
        setMessages(prev => [...prev, { role: 'assistant', content: result }]);
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async () => {
    if (!followUpQuestion.trim() || askingFollowUp) return;

    const question = followUpQuestion.trim();
    setFollowUpQuestion('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setAskingFollowUp(true);

    try {
      await streamAIResponse(universities.map(u => u.id), question, undefined, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to get response');
    } finally {
      setAskingFollowUp(false);
    }
  };

  // Problem 17 + 18: Questionnaire phase uses Dialog for proper accessibility
  if (phase === 'questionnaire') {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-md p-0 border-0 bg-transparent shadow-none">
          <ComparisonQuestionnaire 
            onComplete={handleQuestionnaireComplete}
            onSkip={handleSkipQuestionnaire}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Problem 17: Comparison chat uses Dialog for Escape key + backdrop click + focus trap
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('universities.aiComparison')}
            </DialogTitle>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {universities.map(uni => (
              <Badge key={uni.id} variant="secondary" className="text-xs flex items-center gap-1">
                {uni.is_partner && <Star className="h-3 w-3 text-warning" />}
                {getUniversityName(uni)}
              </Badge>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {/* Visual Comparison Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Rankings Chart */}
              {comparisonData.rankings.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-warning" />
                      {t('universities.ranking')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-4 space-y-2">
                    {comparisonData.rankings.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="truncate max-w-[150px]">{item.name}</span>
                          <span className="font-medium">#{item.value}</span>
                        </div>
                        <Progress 
                          value={((item.max - item.value + 1) / item.max) * 100} 
                          className="h-2" 
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Tuition Chart */}
              {comparisonData.tuition.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-success" />
                      {t('universities.tuition')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-4 space-y-2">
                    {comparisonData.tuition.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="truncate max-w-[120px]">{item.name}</span>
                          <span className="font-medium">₩{item.min.toLocaleString()} - ₩{item.max.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-success to-success rounded-full"
                            style={{ width: `${(item.max / maxTuition) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Acceptance Rate Chart */}
              {comparisonData.acceptance.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-info" />
                      {t('universities.acceptanceRate')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-4 space-y-2">
                    {comparisonData.acceptance.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="truncate max-w-[150px]">{item.name}</span>
                          <span className="font-medium">{item.value}%</span>
                        </div>
                        <Progress value={item.value} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Partner Status */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building className="h-4 w-4 text-primary" />
                    {t('universities.partnerUniversity')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-4 space-y-2">
                  {universities.map((uni, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[150px]">{getUniversityName(uni)}</span>
                      {uni.is_partner ? (
                        <Badge className="bg-warning/10 text-warning dark:bg-warning dark:text-warning">
                          <Star className="h-3 w-3 mr-1" />
                          {t('universities.partner', 'Partner')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t('universities.standard', 'Standard')}</Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* AI Analysis */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  {loading && !comparison ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('ai.thinking')}
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{comparison}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>

              {/* Follow-up Messages — skip index 0 which is the initial comparison already shown above */}
              {messages.slice(1).map((msg, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' ? 'bg-muted' : 'bg-primary/10'
                  }`}>
                    {msg.role === 'user' ? (
                      <GraduationCap className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}

              {askingFollowUp && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('ai.thinking')}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Follow-up Input */}
          {comparison && (
            <div className="border-t p-3">
              <form onSubmit={(e) => { e.preventDefault(); handleFollowUp(); }} className="flex gap-2">
                <Input
                  value={followUpQuestion}
                  onChange={(e) => setFollowUpQuestion(e.target.value)}
                  placeholder={t('universities.askFollowUp', 'Ask a follow-up question...')}
                  disabled={askingFollowUp}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!followUpQuestion.trim() || askingFollowUp}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
