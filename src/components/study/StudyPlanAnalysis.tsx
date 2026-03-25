import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Lightbulb,
  ArrowLeft,
  Trophy,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { StudyPlanAnalysis as AnalysisType } from '@/hooks/useStudyPlanSessions';

interface StudyPlanAnalysisProps {
  documentType: 'study_plan' | 'personal_statement';
  analysis: AnalysisType | null;
  previousAnalyses: AnalysisType[];
  aiResponse: string | null;
  isLoading: boolean;
  onRevise: () => void;
  onComplete: () => void;
}

export function StudyPlanAnalysis({
  documentType,
  analysis,
  previousAnalyses,
  aiResponse,
  isLoading,
  onRevise,
  onComplete,
}: StudyPlanAnalysisProps) {
  const { t } = useTranslation();
  const documentLabel = documentType === 'study_plan' 
    ? t('study.plan', 'Study Plan') 
    : t('study.personalStatement', 'Personal Statement');

  // Calculate improvement if there are previous analyses
  const previousScore = previousAnalyses.length > 0 
    ? previousAnalyses[0]?.overall_score 
    : null;
  const improvement = analysis?.overall_score && previousScore 
    ? analysis.overall_score - previousScore 
    : null;

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400';
    if (score >= 6) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h3 className="font-medium text-lg mb-2">{t('study.analyzingDocument', 'Analyzing Your {{documentType}}...', { documentType: documentLabel })}</h3>
        <p className="text-muted-foreground text-center max-w-md">
          {t('study.aiReviewing', 'The AI is reviewing your document for grammar, content, and structure. This may take a moment.')}
        </p>
      </div>
    );
  }

  // If we have the raw AI response but no structured analysis, show the raw response
  if (aiResponse && !analysis) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t('study.step', 'Step')} 4: {t('study.aiAnalysisFeedback', 'AI Analysis & Feedback')}
            </CardTitle>
            <CardDescription>
              {t('study.detailedReview', 'Detailed review and suggestions for your {{documentType}}', { documentType: documentLabel.toLowerCase() })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <ScrollArea className="h-[500px]">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap pr-4">
                  {aiResponse}
                </div>
              </ScrollArea>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end mt-6 pt-4 border-t">
              <Button variant="outline" onClick={onRevise} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t('study.reviseAndResubmit', 'Revise & Re-submit')}
              </Button>
              <Button onClick={onComplete} className="gap-2">
                <CheckCircle className="h-4 w-4" />
                {t('study.completeSession', 'Complete Session')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analysis && !aiResponse) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-lg mb-2">{t('study.noAnalysisYet', 'No Analysis Yet')}</h3>
        <p className="text-muted-foreground">
          {t('study.submitToReceive', 'Submit your document in Step 3 to receive AI feedback.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score Overview */}
      {analysis?.overall_score && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{t('study.overallScore', 'Overall Score')}</h3>
                <p className="text-sm text-muted-foreground">{t('study.basedOnGrammar', 'Based on grammar, content, and structure')}</p>
              </div>
              <div className="text-right">
                <div className={`text-4xl font-bold ${getScoreColor(analysis.overall_score)}`}>
                  {analysis.overall_score}/10
                </div>
                {improvement !== null && improvement !== 0 && (
                  <Badge 
                    variant={improvement > 0 ? 'default' : 'destructive'}
                    className="gap-1 mt-1"
                  >
                    <TrendingUp className={`h-3 w-3 ${improvement < 0 ? 'rotate-180' : ''}`} />
                    {improvement > 0 ? '+' : ''}{improvement} {t('study.fromLast', 'from last')}
                  </Badge>
                )}
              </div>
            </div>
            <Progress 
              value={analysis.overall_score * 10} 
              className="h-3"
            />
            
            {/* Milestone celebration */}
            {analysis.overall_score >= 8 && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-3">
                <Trophy className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">{t('study.excellentWork', 'Excellent Work!')}</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {t('study.readyForSubmission', 'Your {{documentType}} is ready for submission.', { documentType: documentLabel.toLowerCase() })}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Strengths */}
      {analysis?.strengths && analysis.strengths.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              {t('interview.strengths', 'Strengths')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Grammar Errors */}
      {analysis?.grammar_errors && analysis.grammar_errors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              {t('study.grammarLanguageErrors', 'Grammar & Language Errors')} ({analysis.grammar_errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3">
                {analysis.grammar_errors.map((error, idx) => (
                  <div key={idx} className="p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-start gap-2 mb-1">
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {error.type || 'error'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="line-through text-red-600 dark:text-red-400">
                          {error.error}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        <span className="text-green-600 dark:text-green-400">
                          {error.correction}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Improvements */}
      {analysis?.improvements && analysis.improvements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              {t('study.suggestedImprovements', 'Suggested Improvements')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.improvements.map((improvement, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{improvement}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Content Feedback */}
      {analysis?.content_feedback && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t('study.contentAssessment', 'Content Assessment')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p>{analysis.content_feedback}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full AI Response */}
      {analysis?.ai_response && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('study.fullAnalysis', 'Full Analysis')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap pr-4">
                {analysis.ai_response}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t">
        <Button variant="outline" onClick={onRevise} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('study.reviseAndResubmit', 'Revise & Re-submit')}
        </Button>
        <Button onClick={onComplete} className="gap-2">
          <CheckCircle className="h-4 w-4" />
          {t('study.completeSession', 'Complete Session')}
        </Button>
      </div>
    </div>
  );
}
