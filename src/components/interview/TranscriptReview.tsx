import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AudioPlayback } from './AudioPlayback';
import { cn } from '@/lib/utils';
import { 
  ChevronDown, 
  ChevronUp, 
  Star, 
  AlertCircle, 
  Lightbulb,
  ArrowLeft,
  Clock,
  MessageSquare
} from 'lucide-react';

interface MessageScore {
  message_id: string;
  score: number;
  strengths: string[];
  suggestions: string[];
  ideal_hint?: string;
}

interface TranscriptMessage {
  id: string;
  role: 'interviewer' | 'student';
  content: string;
  created_at: string;
  audio_url?: string | null;
}

interface TranscriptReviewProps {
  messages: TranscriptMessage[];
  messageScores?: MessageScore[];
  onBack: () => void;
}

export function TranscriptReview({ messages, messageScores = [], onBack }: TranscriptReviewProps) {
  const { t } = useTranslation();
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showIdealHints, setShowIdealHints] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMessages(newExpanded);
  };

  const toggleIdealHint = (id: string) => {
    const newHints = new Set(showIdealHints);
    if (newHints.has(id)) {
      newHints.delete(id);
    } else {
      newHints.add(id);
    }
    setShowIdealHints(newHints);
  };

  const getScoreForMessage = (messageId: string): MessageScore | undefined => {
    return messageScores.find(s => s.message_id === messageId);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-success bg-success/10 dark:bg-success/30';
    if (score >= 6) return 'text-warning bg-warning/10 dark:bg-warning/30';
    return 'text-destructive bg-destructive/10 dark:bg-destructive/30';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 8) return 'bg-success';
    if (score >= 6) return 'bg-warning';
    return 'bg-destructive';
  };

  // Group messages into Q&A pairs
  const qaGroups: { question: TranscriptMessage; answer?: TranscriptMessage }[] = [];
  let currentQuestion: TranscriptMessage | null = null;
  
  messages.forEach(msg => {
    if (msg.role === 'interviewer') {
      if (currentQuestion) {
        qaGroups.push({ question: currentQuestion });
      }
      currentQuestion = msg;
    } else if (currentQuestion) {
      qaGroups.push({ question: currentQuestion, answer: msg });
      currentQuestion = null;
    }
  });
  
  if (currentQuestion) {
    qaGroups.push({ question: currentQuestion });
  }

  return (
    <div className="space-y-6 p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('interview.transcriptReview', 'Transcript Review')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('interview.reviewAnswers', 'Review your answers with detailed feedback')}
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back', 'Back')}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span>{qaGroups.length} {t('interview.exchanges', 'exchanges')}</span>
        </div>
        {messageScores.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4" />
            <span>
              {t('interview.avgAnswerScore', 'Avg')}: {' '}
              {(messageScores.reduce((sum, s) => sum + s.score, 0) / messageScores.length).toFixed(1)}/10
            </span>
          </div>
        )}
      </div>

      {/* Q&A Cards */}
      <div className="space-y-4">
        {qaGroups.map((group, index) => {
          const answerScore = group.answer ? getScoreForMessage(group.answer.id) : undefined;
          const isExpanded = group.answer ? expandedMessages.has(group.answer.id) : false;
          const showHint = group.answer ? showIdealHints.has(group.answer.id) : false;

          return (
            <Card key={index} className="overflow-hidden">
              {/* Question */}
              <CardHeader className="pb-2 bg-muted/30">
                <div className="flex items-start gap-2">
                  <Badge variant="secondary" className="shrink-0">Q{index + 1}</Badge>
                  <p className="text-sm font-medium">{group.question.content}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  {new Date(group.question.created_at).toLocaleTimeString()}
                </div>
              </CardHeader>

              {/* Answer */}
              {group.answer && (
                <CardContent className="pt-3">
                  <div className="space-y-3">
                    {/* Answer text with score badge */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge>A</Badge>
                          {answerScore && (
                            <Badge className={cn("text-white", getScoreBadgeColor(answerScore.score))}>
                              {answerScore.score}/10
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm bg-primary/5 rounded-lg p-3">{group.answer.content}</p>
                      </div>
                    </div>

                    {/* Audio playback if available */}
                    {group.answer.audio_url && (
                      <AudioPlayback audioUrl={group.answer.audio_url} className="mt-2" />
                    )}

                    {/* Expandable feedback section */}
                    {answerScore && (
                      <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(group.answer!.id)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-between">
                            <span>{t('interview.viewFeedback', 'View Feedback')}</span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-3">
                          {/* Strengths */}
                          {answerScore.strengths.length > 0 && (
                            <div className="bg-success/10 dark:bg-success/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-success dark:text-success font-medium text-sm mb-2">
                                <Star className="h-4 w-4" />
                                {t('interview.strengths', 'Strengths')}
                              </div>
                              <ul className="space-y-1">
                                {answerScore.strengths.map((s, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <span className="text-success">✓</span>
                                    <span>{s}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Suggestions */}
                          {answerScore.suggestions.length > 0 && (
                            <div className="bg-warning/10 dark:bg-warning/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-warning dark:text-warning font-medium text-sm mb-2">
                                <AlertCircle className="h-4 w-4" />
                                {t('interview.suggestions', 'Suggestions')}
                              </div>
                              <ul className="space-y-1">
                                {answerScore.suggestions.map((s, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <span className="text-warning">→</span>
                                    <span>{s}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Ideal Answer Hint */}
                          {answerScore.ideal_hint && (
                            <div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleIdealHint(group.answer!.id)}
                                className="mb-2"
                              >
                                <Lightbulb className="h-4 w-4 mr-2" />
                                {showHint 
                                  ? t('interview.hideIdeal', 'Hide Ideal Answer')
                                  : t('interview.showIdeal', 'Show Ideal Answer')}
                              </Button>
                              {showHint && (
                                <div className="bg-info/10 dark:bg-info/30 rounded-lg p-3">
                                  <p className="text-sm italic text-info dark:text-info">
                                    "{answerScore.ideal_hint}"
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Back button at bottom */}
      <div className="pt-4">
        <Button onClick={onBack} className="w-full">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('interview.backToFeedback', 'Back to Feedback')}
        </Button>
      </div>
    </div>
  );
}
