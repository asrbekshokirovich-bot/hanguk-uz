import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  FileEdit,
  Save,
  Loader2,
  Download,
  History,
  ArrowRight,
  CheckCircle,
  PanelRightClose,
  PanelRightOpen,
  Wand2
} from 'lucide-react';
import { StudyPlanDraft } from '@/hooks/useStudyPlanSessions';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { formatDistanceToNow } from 'date-fns';
import { WritingAssistantPanel } from './WritingAssistantPanel';
import { TemplateWizard } from './TemplateWizard';
import { RevisionDiffViewer } from './RevisionDiffViewer';
import { UniversityRequirementsChecker } from './UniversityRequirementsChecker';
import { PeerReviewPanel } from './PeerReviewPanel';
import { useWritingAssistant } from '@/hooks/useWritingAssistant';
import { useUniversityRequirements } from '@/hooks/useUniversityRequirements';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

interface StudyPlanEditorProps {
  documentType: 'study_plan' | 'personal_statement';
  initialContent?: string;
  drafts: StudyPlanDraft[];
  onSaveDraft: (content: string, source?: 'typed' | 'uploaded', fileName?: string) => Promise<StudyPlanDraft | null>;
  onSubmitForAnalysis: (content: string) => void;
  onDownload: (content: string) => void;
  isSaving: boolean;
  isSubmitting: boolean;
  universityId?: string;
  sessionId?: string;
  latestDraftId?: string;
}

export function StudyPlanEditor({
  documentType,
  initialContent = '',
  drafts,
  onSaveDraft,
  onSubmitForAnalysis,
  onDownload,
  isSaving,
  isSubmitting,
  universityId,
  sessionId,
  latestDraftId,
}: StudyPlanEditorProps) {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState(initialContent);
  const [lastSavedContent, setLastSavedContent] = useState(initialContent);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [showAssistant, setShowAssistant] = useState(true);
  const [showTemplateWizard, setShowTemplateWizard] = useState(false);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks for features
  const assistantState = useWritingAssistant(content, documentType);
  const { requirements } = useUniversityRequirements(universityId, documentType);

  const documentLabel = documentType === 'study_plan'
    ? t('study.plan', 'Study Plan')
    : t('study.personalStatement', 'Personal Statement');
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const hasChanges = content !== lastSavedContent;
  const currentLang = i18n.language;

  // Auto-save effect
  useEffect(() => {
    if (hasChanges && content.trim().length > 50) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(async () => {
        setIsAutoSaving(true);
        const draft = await onSaveDraft(content);
        if (draft) {
          setLastSavedContent(content);
          setLastSaveTime(new Date());
        }
        setIsAutoSaving(false);
      }, 30000); // Auto-save every 30 seconds
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, hasChanges, onSaveDraft]);

  // Set initial content when it changes
  useEffect(() => {
    if (initialContent && !content) {
      setContent(initialContent);
      setLastSavedContent(initialContent);
    }
  }, [initialContent]);

  const handleManualSave = async () => {
    if (!content.trim()) return;
    const draft = await onSaveDraft(content);
    if (draft) {
      setLastSavedContent(content);
      setLastSaveTime(new Date());
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    setIsParsingFile(true);

    try {
      if (fileName.endsWith('.txt')) {
        const text = await file.text();
        setContent(text);
        await onSaveDraft(text, 'uploaded', file.name);
      } else if (fileName.endsWith('.docx')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          try {
            const JSZip = (await import('jszip')).default;
            const zip = await JSZip.loadAsync(arrayBuffer);
            const docXml = await zip.file('word/document.xml')?.async('string');
            if (docXml) {
              const textContent = docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              setContent(textContent);
              await onSaveDraft(textContent, 'uploaded', file.name);
            }
          } catch {
            setContent(t('study.unableToParseDocx', 'Unable to parse .docx file. Please paste the content directly.'));
          }
          setIsParsingFile(false);
        };
        reader.readAsArrayBuffer(file);
        return;
      } else {
        const text = await file.text();
        setContent(text);
        await onSaveDraft(text, 'uploaded', file.name);
      }
    } catch (err) {
      console.error('Failed to read file:', err);
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleLoadVersion = (draft: StudyPlanDraft) => {
    setContent(draft.content);
  };

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmitForAnalysis(content);
    }
  };

  const handleTemplateComplete = (generatedContent: string) => {
    setContent(prev => prev ? `${prev}\n\n${generatedContent}` : generatedContent);
    setShowTemplateWizard(false);
  };

  // Calculate section completion for assistant panel
  const completedSections = assistantState.sectionCompletion.filter(s => s.detected).length;
  const sectionCompletionPercentage = assistantState.sectionCompletion.length > 0
    ? (completedSections / assistantState.sectionCompletion.length) * 100
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileEdit className="h-5 w-5 text-primary" />
                {t('study.step', 'Step')} 3: {t('study.writeYour', 'Write Your')} {documentLabel}
              </CardTitle>
              <CardDescription>
                {t('study.writeOrUpload', 'Write your document or upload an existing file')}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {/* Peer Review */}
              {latestDraftId && (
                <PeerReviewPanel
                  currentDraftId={latestDraftId}
                  documentType={documentType}
                  language={currentLang}
                  universityId={universityId}
                />
              )}

              {/* Version History */}
              {drafts.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDiffViewer(true)}
                  className="gap-1"
                >
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('study.compare', 'Compare')}</span>
                </Button>
              )}

              {drafts.length > 0 && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <History className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('study.versionHistory', 'History')}</span> ({drafts.length})
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>{t('study.versionHistory', 'Version History')}</SheetTitle>
                      <SheetDescription>
                        {t('study.loadPreviousVersion', 'Load a previous version of your document')}
                      </SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100dvh-10rem)] mt-6">
                      <div className="space-y-3 pr-4">
                        {drafts.map(draft => (
                          <Card
                            key={draft.id}
                            className="cursor-pointer hover:border-primary/50 transition-colors"
                            onClick={() => handleLoadVersion(draft)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline">
                                  {t('study.version', 'Version')} {draft.version}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {draft.word_count} {t('study.words', 'words')}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {draft.content.substring(0, 150)}...
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(draft.created_at), { addSuffix: true })}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {draft.source}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* University Requirements Checker */}
          {requirements && (
            <UniversityRequirementsChecker
              requirements={requirements}
              content={content}
            />
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsingFile}
              className="gap-2"
            >
              {isParsingFile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t('study.uploadFile', 'Upload File')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplateWizard(true)}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              {t('study.useTemplate', 'Use Template')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSave}
              disabled={isSaving || !hasChanges}
              className="gap-2"
            >
              {isSaving || isAutoSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isAutoSaving ? t('study.autoSaving', 'Auto-saving...') : t('study.saveDraft', 'Save Draft')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload(content)}
              disabled={!content.trim()}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {t('study.downloadWord', 'Download')}
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAssistant(!showAssistant)}
              className="gap-2"
            >
              {showAssistant ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
              {t('study.assistant', 'Assistant')}
            </Button>
          </div>

          {/* Editor with Assistant Panel */}
          <ResizablePanelGroup direction="horizontal" className="min-h-[400px] rounded-lg border">
            <ResizablePanel defaultSize={showAssistant ? 70 : 100} minSize={50}>
              <Textarea
                placeholder={t('study.writePlaceholder', 'Write your {{documentType}} here...\n\nYou can also upload a .txt or .docx file.', { documentType: documentLabel.toLowerCase() })}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="h-full min-h-[380px] font-mono text-sm resize-none border-0 focus-visible:ring-0 rounded-none"
              />
            </ResizablePanel>

            {showAssistant && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                  <WritingAssistantPanel
                    state={{
                      ...assistantState,
                      completedSections,
                      sectionCompletionPercentage,
                    }}
                    minWordCount={requirements?.min_word_count || 500}
                    maxWordCount={requirements?.max_word_count || 1000}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>

          {/* Status Bar */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>{wordCount} {t('study.words', 'words')}</span>
              {lastSaveTime && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {t('study.saved', 'Saved')} {formatDistanceToNow(lastSaveTime, { addSuffix: true })}
                </span>
              )}
              {hasChanges && (
                <span className="text-amber-500">{t('study.unsavedChanges', 'Unsaved changes')}</span>
              )}
            </div>
            <span>
              {t('study.recommendedWords', 'Recommended: 500-1000 words')}
            </span>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || wordCount < 50}
              size="lg"
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('study.submitting', 'Submitting...')}
                </>
              ) : (
                <>
                  {t('study.submitForAnalysis', 'Submit for Analysis')}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Writing Tips */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileEdit className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200 mb-1">{t('study.writingTips', 'Writing Tips')}</p>
              <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                <li>• {t('study.writingTip1', 'Be specific and use concrete examples')}</li>
                <li>• {t('study.writingTip2', 'Mention your target university by name')}</li>
                <li>• {t('study.writingTip3', 'Connect your past experiences to future goals')}</li>
                <li>• {t('study.writingTip4', 'Use formal academic language')}</li>
                <li>• {t('study.writingTip5', 'Your draft auto-saves every 30 seconds')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Wizard Modal */}
      <TemplateWizard
        open={showTemplateWizard}
        onOpenChange={setShowTemplateWizard}
        documentType={documentType}
        onComplete={handleTemplateComplete}
      />

      {/* Revision Diff Viewer */}
      {drafts.length > 1 && (
        <RevisionDiffViewer
          open={showDiffViewer}
          onOpenChange={setShowDiffViewer}
          drafts={drafts}
        />
      )}
    </div>
  );
}
