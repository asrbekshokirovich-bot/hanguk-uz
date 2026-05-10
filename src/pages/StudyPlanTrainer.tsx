import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStudyPlanTrainer } from '@/hooks/useStudyPlanTrainer';
import { useStudyPlanSessions } from '@/hooks/useStudyPlanSessions';
import { useStudentPlan } from '@/hooks/useStudentPlan';
import { useGamification } from '@/hooks/useGamification';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { VIPAccessGate } from '@/components/interview/VIPAccessGate';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StudyPlanStepIndicator } from '@/components/study/StudyPlanStepIndicator';
import { SessionHistoryList } from '@/components/study/SessionHistoryList';
import { NewSessionDialog } from '@/components/study/NewSessionDialog';
import { StudyPlanInstructions } from '@/components/study/StudyPlanInstructions';
import { StudyPlanExample } from '@/components/study/StudyPlanExample';
import { StudyPlanEditor } from '@/components/study/StudyPlanEditor';
import { StudyPlanAnalysis } from '@/components/study/StudyPlanAnalysis';
import { StudyPlanChat } from '@/components/study/StudyPlanChat';
import { AchievementsPanel } from '@/components/study/AchievementsPanel';
import { generateDocx } from '@/lib/docxExport';
import {
  ArrowLeft,
  Sparkles,
  List,
  Loader2,
  Flame,
  Trophy
} from 'lucide-react';

// Helper function to extract JSON from AI response if present
function extractJsonFromResponse(response: string): any | null {
  try {
    // Strip markdown code blocks
    let cleaned = response
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Find JSON boundaries
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      return null;
    }

    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

    // Attempt parse with error handling
    try {
      return JSON.parse(cleaned);
    } catch {
      // Try to fix common issues
      cleaned = cleaned
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/[\x00-\x1F\x7F]/g, '');
      return JSON.parse(cleaned);
    }
  } catch {
    return null;
  }
}

// Helper function to parse AI analysis response into structured data
function parseAnalysisResponse(response: string) {
  const grammarErrors: Array<{ error: string; correction: string; type: string }> = [];
  const strengths: string[] = [];
  const improvements: string[] = [];
  let content_feedback: string | null = null;
  let overall_score: number | null = null;

  // First try JSON extraction
  const jsonData = extractJsonFromResponse(response);
  if (jsonData) {
    if (typeof jsonData.overall_score === 'number') {
      overall_score = jsonData.overall_score;
    }
    if (Array.isArray(jsonData.grammar_errors)) {
      for (const err of jsonData.grammar_errors) {
        if (err.error && err.correction) {
          grammarErrors.push({
            error: String(err.error).trim(),
            correction: String(err.correction).trim(),
            type: err.type || 'grammar'
          });
        }
      }
    }
    if (Array.isArray(jsonData.strengths)) {
      strengths.push(...jsonData.strengths.map((s: any) => String(s).trim()).filter(Boolean));
    }
    if (Array.isArray(jsonData.improvements)) {
      improvements.push(...jsonData.improvements.map((s: any) => String(s).trim()).filter(Boolean));
    }
    if (typeof jsonData.content_feedback === 'string') {
      content_feedback = jsonData.content_feedback.trim();
    }
    // If JSON provided all fields, return early
    if (overall_score !== null && grammarErrors.length > 0) {
      return { grammarErrors, strengths, improvements, content_feedback, overall_score };
    }
  }

  // Fallback: Extract overall score from text
  if (overall_score === null) {
    const scorePatterns = [
      /(?:Overall\s*Score|Score|📊\s*Overall\s*Score)[:\s]*(\d+)\s*(?:\/\s*10|out of 10)?/i,
      /(\d+)\s*\/\s*10/,
      /(?:rating|grade)[:\s]*(\d+)/i
    ];
    for (const pattern of scorePatterns) {
      const match = response.match(pattern);
      if (match) {
        const score = parseInt(match[1]);
        if (score >= 1 && score <= 10) {
          overall_score = score;
          break;
        }
      }
    }
  }

  // Parse grammar errors: ❌ ... → ✅ ... or various formats
  if (grammarErrors.length === 0) {
    const errorPatterns = [
      /❌\s*["""]?(.+?)["""]?\s*(?:→|->|➡️|=>)\s*✅\s*["""]?(.+?)["""]?(?=\n|❌|$)/g,
      /["""]([^"""]+)["""]\s*(?:→|->|➡️|=>|should be)\s*["""]([^"""]+)["""]/gi,
      /(?:Error|Mistake|Wrong)[:\s]*["""]?(.+?)["""]?\s*(?:→|->|➡️|=>|Correction)[:\s]*["""]?(.+?)["""]?(?=\n|$)/gi,
      /\*\*([^*]+)\*\*\s*(?:→|->|should be)\s*\*\*([^*]+)\*\*/g
    ];

    for (const pattern of errorPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        const error = match[1].trim().replace(/^["'"'"]|["'"'"]$/g, '');
        const correction = match[2].trim().replace(/^["'"'"]|["'"'"]$/g, '');
        if (error && correction && error !== correction) {
          const existing = grammarErrors.find(e => e.error === error);
          if (!existing) {
            grammarErrors.push({ error, correction, type: 'grammar' });
          }
        }
      }
    }
  }

  // Parse strengths section
  if (strengths.length === 0) {
    const strengthPatterns = [
      /(?:✅\s*Strengths|Strengths|What's Good|What works well|강점)[:\s]*\n((?:[-•*✓✔]\s*.+\n?)+)/gi,
      /(?:2\.\s*✅\s*Strengths)[:\s]*\n((?:[-•*✓✔\d.]\s*.+\n?)+)/gi,
      /Strengths[:\s]*\n((?:\d+\.\s*.+\n?)+)/gi
    ];

    for (const pattern of strengthPatterns) {
      const match = response.match(pattern);
      if (match) {
        const lines = match[1].split('\n').filter(s => s.trim());
        for (const line of lines) {
          const cleaned = line.replace(/^[-•*✓✔\d.)\]]\s*/, '').trim();
          if (cleaned && cleaned.length > 10 && !strengths.includes(cleaned)) {
            strengths.push(cleaned);
          }
        }
        if (strengths.length > 0) break;
      }
    }
  }

  // Parse improvements section
  if (improvements.length === 0) {
    const improvementPatterns = [
      /(?:💡\s*(?:Final\s*)?Tips|Suggested Improvements|Areas to Improve|Improvements|개선 영역|What to improve)[:\s]*\n((?:[-•*\d.)\]]\s*.+\n?)+)/gi,
      /(?:6\.\s*💡\s*Final Tips|7\.\s*💡\s*Final Tips)[:\s]*\n((?:[-•*\d.)\]]\s*.+\n?)+)/gi,
      /(?:Recommendations|Action Items)[:\s]*\n((?:[-•*\d.)\]]\s*.+\n?)+)/gi
    ];

    for (const pattern of improvementPatterns) {
      const match = response.match(pattern);
      if (match) {
        const lines = match[1].split('\n').filter(s => s.trim());
        for (const line of lines) {
          const cleaned = line.replace(/^[-•*\d.)\]]\s*/, '').trim();
          if (cleaned && cleaned.length > 10 && !improvements.includes(cleaned)) {
            improvements.push(cleaned);
          }
        }
        if (improvements.length > 0) break;
      }
    }
  }

  // Parse content feedback
  if (!content_feedback) {
    const contentPatterns = [
      /(?:📝\s*Content|Content Assessment|Content Issues|4\.\s*📝\s*Content)[:\s]*\n([^\n#]+(?:\n(?![-•*✓\d])[^\n#]+)*)/gi,
      /(?:Content Feedback|Content Analysis)[:\s]*\n([^\n]+(?:\n[^\n]+){0,3})/gi
    ];

    for (const pattern of contentPatterns) {
      const match = response.match(pattern);
      if (match) {
        content_feedback = match[1].trim().substring(0, 500);
        break;
      }
    }
  }

  return { grammarErrors, strengths, improvements, content_feedback, overall_score };
}

function StudyPlanTrainerContent() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentLang = i18n.language;

  // Session management
  const {
    sessions,
    currentSession,
    drafts,
    analyses,
    chatHistory,
    latestDraft,
    latestAnalysis,
    isLoading: isSessionLoading,
    isSessionsLoading,
    createSession,
    loadSession,
    updateSessionStep,
    completeSession,
    saveDraft,
    saveAnalysis,
    addChatMessage,
    deleteSession,
    clearCurrentSession,
    refreshSessions,
  } = useStudyPlanSessions();

  // AI trainer
  const {
    isLoading: isAILoading,
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
  } = useStudyPlanTrainer();

  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [analysisResponse, setAnalysisResponse] = useState<string | null>(null);
  const [isSubmittingForAnalysis, setIsSubmittingForAnalysis] = useState(false);

  // Track completed steps
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Initialize completed steps based on session data
  useEffect(() => {
    if (currentSession) {
      const completed: number[] = [];
      // If we have any drafts, step 1 and 2 are considered complete
      if (drafts.length > 0) {
        completed.push(1, 2);
      }
      // If we have analyses, step 3 is complete
      if (analyses.length > 0) {
        completed.push(3);
      }
      // Check current step to mark previous as complete
      for (let i = 1; i < currentSession.current_step; i++) {
        if (!completed.includes(i)) completed.push(i);
      }
      setCompletedSteps(completed);
    } else {
      setCompletedSteps([]);
    }
  }, [currentSession, drafts, analyses]);

  // Load saved draft content when session loads (but NOT AI-generated content)
  useEffect(() => {
    // Only load user-written drafts, never auto-populate with AI-generated example
    if (latestDraft && currentSession?.current_step === 3) {
      // Skip AI-generated drafts - user must explicitly choose to use them
      if (latestDraft.source !== 'ai_generated') {
        setEditorContent(latestDraft.content);
      }
    }
  }, [latestDraft, currentSession?.current_step]);

  // Get university name for display
  const universityName = currentSession?.university
    ? (currentSession.university.name_en || currentSession.university.name_ko || currentSession.university.name_uz)
    : null;

  // Handlers
  const handleCreateSession = async (
    documentType: 'study_plan' | 'personal_statement',
    universityId?: string
  ) => {
    setIsCreatingSession(true);
    try {
      await createSession(documentType, universityId);
      setShowNewSessionDialog(false);
      clearResponse();
      setEditorContent('');
      setAnalysisResponse(null);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleResumeSession = (sessionId: string) => {
    loadSession(sessionId);
    clearResponse();
    setAnalysisResponse(null);
  };

  const handleBackToSessions = () => {
    clearCurrentSession();
    clearResponse();
    setEditorContent('');
    setAnalysisResponse(null);
    refreshSessions();
  };

  const handleStepClick = (step: number) => {
    if (currentSession && step <= currentSession.current_step) {
      updateSessionStep(step);
    }
  };

  // Step 1: Load instructions
  const handleLoadInstructions = useCallback(async () => {
    if (!currentSession) return null;

    if (currentSession.document_type === 'study_plan') {
      return await teachStudyPlan(currentLang, currentSession.target_institution_id || undefined);
    } else {
      return await teachPersonalStatement(currentLang, currentSession.target_institution_id || undefined);
    }
  }, [currentSession, currentLang, teachStudyPlan, teachPersonalStatement]);

  const handleStep1Complete = () => {
    if (currentSession) {
      setCompletedSteps(prev => prev.includes(1) ? prev : [...prev, 1]);
      updateSessionStep(2);
    }
  };

  // Step 2: Generate example
  const handleGenerateExample = useCallback(async () => {
    if (!currentSession) return null;

    let response: string | null = null;
    if (currentSession.document_type === 'study_plan') {
      response = await generateStudyPlanExample(currentLang, currentSession.target_institution_id || undefined);
    } else {
      response = await generatePersonalStatementExample(currentLang, currentSession.target_institution_id || undefined);
    }

    // Save as AI-generated draft (version 0)
    if (response) {
      await saveDraft(response, 'ai_generated');
    }

    return response;
  }, [currentSession, currentLang, generateStudyPlanExample, generatePersonalStatementExample, saveDraft]);

  const handleUseAsStartingPoint = (content: string) => {
    setEditorContent(content);
    setCompletedSteps(prev => prev.includes(2) ? prev : [...prev, 2]);
    updateSessionStep(3);
  };

  const handleStep2Complete = () => {
    if (currentSession) {
      setCompletedSteps(prev => prev.includes(2) ? prev : [...prev, 2]);
      updateSessionStep(3);
    }
  };

  // Step 3: Save draft and submit for analysis
  const handleSaveDraft = useCallback(async (
    content: string,
    source: 'typed' | 'uploaded' = 'typed',
    fileName?: string
  ) => {
    return await saveDraft(content, source, fileName);
  }, [saveDraft]);

  const handleSubmitForAnalysis = async (content: string) => {
    if (!currentSession) return;

    setIsSubmittingForAnalysis(true);
    setAnalysisResponse(null);

    try {
      // Save the draft first
      const draft = await saveDraft(content);
      if (!draft) return;

      // Analyze
      let response: string | null = null;
      if (currentSession.document_type === 'study_plan') {
        response = await analyzeStudyPlan(content, currentLang, currentSession.target_institution_id || undefined);
      } else {
        response = await analyzePersonalStatement(content, currentLang, currentSession.target_institution_id || undefined);
      }

      if (response) {
        setAnalysisResponse(response);

        // Parse structured data from response
        const parsed = parseAnalysisResponse(response);

        // Save analysis with parsed data
        await saveAnalysis(draft.id, {
          overall_score: parsed.overall_score || undefined,
          grammar_errors: parsed.grammarErrors.length > 0 ? parsed.grammarErrors : undefined,
          strengths: parsed.strengths.length > 0 ? parsed.strengths : undefined,
          improvements: parsed.improvements.length > 0 ? parsed.improvements : undefined,
          content_feedback: parsed.content_feedback || undefined,
          ai_response: response,
        });

        // Move to step 4
        setCompletedSteps(prev => prev.includes(3) ? prev : [...prev, 3]);
        updateSessionStep(4);
      }
    } finally {
      setIsSubmittingForAnalysis(false);
    }
  };

  const handleDownload = (content: string) => {
    const docType = currentSession?.document_type === 'study_plan' ? 'Study_Plan' : 'Personal_Statement';
    generateDocx(content, docType);
  };

  // Step 4: Actions
  const handleRevise = () => {
    if (currentSession) {
      updateSessionStep(3);
    }
  };

  const handleCompleteSession = async () => {
    await completeSession();
    handleBackToSessions();
  };

  // Chat handlers
  const handleSendChatMessage = useCallback(async (message: string) => {
    if (!currentSession) return null;

    if (currentSession.document_type === 'study_plan') {
      return await chatAboutStudyPlan(message, currentLang, currentSession.target_institution_id || undefined);
    } else {
      return await chatAboutPersonalStatement(message, currentLang, currentSession.target_institution_id || undefined);
    }
  }, [currentSession, currentLang, chatAboutStudyPlan, chatAboutPersonalStatement]);

  const handleAddChatMessage = useCallback(async (role: 'user' | 'assistant', content: string) => {
    await addChatMessage(role, content);
  }, [addChatMessage]);

  // Render session list if no active session
  if (!currentSession) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/portal')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">{t('study.planTrainer', 'Study Plan Trainer')}</h1>
                <p className="text-xs text-muted-foreground">{t('study.writeAndImprove', 'Write & Improve Your Documents')}</p>
              </div>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              {t('ai.powered', 'AI Powered')}
            </Badge>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4 pb-20">
          <SessionHistoryList
            sessions={sessions}
            isLoading={isSessionsLoading}
            onNewSession={() => setShowNewSessionDialog(true)}
            onResumeSession={handleResumeSession}
            onDeleteSession={deleteSession}
          />
        </main>

        <NewSessionDialog
          open={showNewSessionDialog}
          onOpenChange={setShowNewSessionDialog}
          onCreateSession={handleCreateSession}
          isCreating={isCreatingSession}
        />
      </div>
    );
  }

  // Render active session
  const documentLabel = currentSession.document_type === 'study_plan'
    ? t('study.plan', 'Study Plan')
    : t('study.personalStatement', 'Personal Statement');

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBackToSessions}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{documentLabel} {t('study.trainer', 'Training')}</h1>
              <p className="text-xs text-muted-foreground">
                {universityName || t('study.generalTraining', 'General Training')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBackToSessions} className="gap-1">
              <List className="h-4 w-4" />
              {t('study.sessions', 'Sessions')}
            </Button>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              VIP
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-20 space-y-6">
        {/* Step Indicator */}
        <StudyPlanStepIndicator
          currentStep={currentSession.current_step}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
        />

        {/* Step Content */}
        {isSessionLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {currentSession.current_step === 1 && (
              <StudyPlanInstructions
                documentType={currentSession.document_type}
                universityName={universityName}
                onLoadInstructions={handleLoadInstructions}
                onComplete={handleStep1Complete}
                isLoading={isAILoading}
              />
            )}

            {currentSession.current_step === 2 && (
              <StudyPlanExample
                documentType={currentSession.document_type}
                universityName={universityName}
                onGenerateExample={handleGenerateExample}
                onUseAsStartingPoint={handleUseAsStartingPoint}
                onComplete={handleStep2Complete}
                isLoading={isAILoading}
                savedExample={drafts.find(d => d.source === 'ai_generated')?.content}
              />
            )}

            {currentSession.current_step === 3 && (
              <StudyPlanEditor
                documentType={currentSession.document_type}
                initialContent={editorContent}
                drafts={drafts.filter(d => d.source !== 'ai_generated')}
                onSaveDraft={handleSaveDraft}
                onSubmitForAnalysis={handleSubmitForAnalysis}
                onDownload={handleDownload}
                isSaving={isSessionLoading}
                isSubmitting={isSubmittingForAnalysis}
                universityId={currentSession.target_institution_id || undefined}
                sessionId={currentSession.id}
                latestDraftId={latestDraft?.id}
              />
            )}

            {currentSession.current_step === 4 && (
              <StudyPlanAnalysis
                documentType={currentSession.document_type}
                analysis={latestAnalysis}
                previousAnalyses={analyses.slice(1)}
                aiResponse={analysisResponse || latestAnalysis?.ai_response || null}
                isLoading={isSubmittingForAnalysis}
                onRevise={handleRevise}
                onComplete={handleCompleteSession}
              />
            )}
          </>
        )}
      </main>

      {/* Floating Chat */}
      {currentSession && (
        <StudyPlanChat
          documentType={currentSession.document_type}
          chatHistory={chatHistory}
          onSendMessage={handleSendChatMessage}
          onAddChatMessage={handleAddChatMessage}
          isLoading={isAILoading}
          draftContent={editorContent}
        />
      )}
    </div>
  );
}

// Default export wraps with ProtectedRoute and VIP Access Gate
export default function StudyPlanTrainer() {
  const { isVIP, loading } = useStudentPlan();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <img src="/logo.jpg" alt="Hanguk" className="h-16 w-16 rounded-xl object-cover" />
          <p className="text-muted-foreground">{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (!isVIP) {
    return (
      <ProtectedRoute>
        <VIPAccessGate />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <StudyPlanTrainerContent />
    </ProtectedRoute>
  );
}
