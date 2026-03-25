import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  BookOpen, 
  CheckCircle, 
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  AlertTriangle,
  Target,
  Briefcase,
  FileText,
  GraduationCap,
  Check,
  Video
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseInstructions, formatBulletPoint, type InstructionSection } from '@/lib/parseInstructions';
import { TutorialVideoSection } from './TutorialVideoSection';

interface StudyPlanInstructionsProps {
  documentType: 'study_plan' | 'personal_statement';
  universityName?: string | null;
  onLoadInstructions: () => Promise<string | null>;
  onComplete: () => void;
  isLoading: boolean;
}

// Map section types to icons
const sectionIcons: Record<string, React.ElementType> = {
  intro: BookOpen,
  sections: LayoutList,
  tips: Lightbulb,
  mistakes: AlertTriangle,
  example: FileText,
  why_korea: Target,
  career: Briefcase,
  conclusion: GraduationCap,
};

function SectionCard({ 
  section, 
  isActive,
  onNext,
  onPrev,
  isFirst,
  isLast,
  onComplete
}: { 
  section: InstructionSection; 
  isActive: boolean;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const Icon = sectionIcons[section.type] || BookOpen;

  if (!isActive) return null;

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader className={cn(
        "bg-gradient-to-r rounded-t-lg",
        section.colorTheme
      )}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-background/90 flex items-center justify-center shadow-sm">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{section.title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px]">
          <div className="p-6 space-y-3">
            {section.content.map((line, idx) => {
              const formatted = formatBulletPoint(line);
              
              if (formatted.type === 'bullet') {
                return (
                  <div 
                    key={idx} 
                    className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border/50"
                  >
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">{formatted.content}</span>
                  </div>
                );
              }
              
              if (formatted.type === 'number') {
                return (
                  <div key={idx} className="flex items-start gap-3 p-3">
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center shrink-0">
                      {formatted.number}
                    </span>
                    <span className="text-sm leading-relaxed pt-1">{formatted.content}</span>
                  </div>
                );
              }
              
              return (
                <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
                  {formatted.content}
                </p>
              );
            })}
          </div>
        </ScrollArea>

        {/* Navigation */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/20">
          <Button 
            variant="ghost" 
            onClick={onPrev}
            disabled={isFirst}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('common.previous', 'Previous')}
          </Button>

          {isLast ? (
            <Button onClick={onComplete} className="gap-2">
              <CheckCircle className="h-4 w-4" />
              {t('study.finishReading', 'Finish & Continue')}
            </Button>
          ) : (
            <Button onClick={onNext} className="gap-2">
              {t('common.next', 'Next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StudyPlanInstructions({
  documentType,
  universityName,
  onLoadInstructions,
  onComplete,
  isLoading,
}: StudyPlanInstructionsProps) {
  const { t } = useTranslation();
  const [instructions, setInstructions] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const documentLabel = documentType === 'study_plan' 
    ? t('study.plan', 'Study Plan') 
    : t('study.personalStatement', 'Personal Statement');

  // Create intro section that explains the basics
  const introSection: InstructionSection = useMemo(() => ({
    id: 'intro-overview',
    title: t('study.introTitle', 'What is a {{documentType}} and Why is it Important?', { documentType: documentLabel }),
    icon: BookOpen,
    content: [
      t('study.introPoint1', 'A {{documentType}} is a formal document that outlines your academic goals, motivations, and plans during your studies in Korea.', { documentType: documentLabel.toLowerCase() }),
      t('study.introPoint2', 'Universities use this document to evaluate your seriousness, clarity of purpose, and compatibility with their programs.'),
      t('study.introPoint3', 'A well-written {{documentType}} can significantly improve your chances of admission and scholarship opportunities.', { documentType: documentLabel.toLowerCase() }),
      t('study.introPoint4', 'It should demonstrate your understanding of the program, your academic background, and how studying in Korea aligns with your career goals.'),
    ],
    type: 'intro' as const,
    colorTheme: 'from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800',
  }), [t, documentLabel]);

  const sections = useMemo(() => {
    if (!instructions) return [];
    const parsed = parseInstructions(instructions);
    // Filter out sections with empty content
    const filtered = parsed.filter(section => section.content.length > 0);
    // Add intro section at the beginning
    return [introSection, ...filtered];
  }, [instructions, introSection]);

  const progressPercentage = sections.length > 0 
    ? ((currentIndex + 1) / sections.length) * 100 
    : 0;

  const handleLoadInstructions = async () => {
    const result = await onLoadInstructions();
    if (result) {
      setInstructions(result);
      setHasLoaded(true);
    }
  };

  const handleNext = () => {
    if (currentIndex < sections.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {t('study.step', 'Step')} 1: {t('study.learnHowToWrite', 'Learn How to Write a')} {documentLabel}
          </CardTitle>
          <CardDescription>
            {universityName 
              ? t('study.getPersonalizedGuidance', 'Get personalized guidance for {{university}}', { university: universityName })
              : t('study.getComprehensiveInstructions', 'Get comprehensive instructions on writing an effective document')
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasLoaded && (
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Lightbulb className="h-10 w-10 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{t('study.readyToLearn', 'Ready to Learn?')}</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                {t('study.clickToGetInstructions', 'Click below to get detailed instructions on how to write a compelling {{documentType}} for your Korean university application.', { documentType: documentLabel.toLowerCase() })}
              </p>
              <Button 
                onClick={handleLoadInstructions} 
                disabled={isLoading}
                size="lg"
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('study.loadingInstructions', 'Loading Instructions...')}
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4" />
                    {t('study.loadWritingGuide', 'Load Writing Guide')}
                  </>
                )}
              </Button>
            </div>
          )}

          {hasLoaded && sections.length > 0 && (
            <div className="space-y-4">
              {/* Progress indicator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('study.sectionProgress', 'Section {{current}} of {{total}}', { 
                      current: currentIndex + 1, 
                      total: sections.length 
                    })}
                  </span>
                  <span className="font-medium">{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {/* Section dots */}
              <div className="flex items-center justify-center gap-2 py-2">
                {sections.map((section, idx) => (
                  <button
                    key={section.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "w-3 h-3 rounded-full transition-all",
                      idx === currentIndex 
                        ? "bg-primary scale-125" 
                        : idx < currentIndex 
                          ? "bg-green-500" 
                          : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    )}
                    title={section.title}
                  />
                ))}
              </div>

              {/* Current section card */}
              {sections.map((section, idx) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  isActive={idx === currentIndex}
                  onNext={handleNext}
                  onPrev={handlePrev}
                  isFirst={idx === 0}
                  isLast={idx === sections.length - 1}
                  onComplete={onComplete}
                />
              ))}
            </div>
          )}

          {/* Fallback for unparseable content */}
          {hasLoaded && sections.length === 0 && instructions && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{t('study.writingGuideLoaded', 'Writing Guide Loaded')}</span>
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap pr-4">
                    {instructions}
                  </div>
                </ScrollArea>
              </div>
              <div className="flex justify-end">
                <Button onClick={onComplete} className="gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {t('study.markCompleteAndContinue', 'Mark as Complete & Continue')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Tutorials */}
      <TutorialVideoSection documentType={documentType} />

      {/* Tips Card */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">{t('study.whatYouWillLearn', "What You'll Learn")}</p>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• {t('study.learnTip1', 'Key sections every {{documentType}} should include', { documentType: documentLabel.toLowerCase() })}</li>
                <li>• {t('study.learnTip2', 'Common mistakes to avoid')}</li>
                <li>• {t('study.learnTip3', 'Tips for making your document stand out')}</li>
                <li>• {universityName 
                    ? t('study.learnTip4Specific', 'Specific guidance for {{university}}', { university: universityName }) 
                    : t('study.learnTip4General', 'General best practices')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
