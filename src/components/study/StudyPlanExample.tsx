import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Sparkles, Copy, ArrowRight, CheckCircle, AlertTriangle, ShieldAlert, Ban } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StudyPlanExampleProps {
  documentType: 'study_plan' | 'personal_statement';
  universityName?: string | null;
  onGenerateExample: () => Promise<string | null>;
  onUseAsStartingPoint: (content: string) => void;
  onComplete: () => void;
  isLoading: boolean;
  savedExample?: string | null;
}

export function StudyPlanExample({
  documentType,
  universityName,
  onGenerateExample,
  onUseAsStartingPoint,
  onComplete,
  isLoading,
  savedExample,
}: StudyPlanExampleProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [example, setExample] = useState<string | null>(savedExample || null);
  const [copied, setCopied] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);

  const documentLabel = documentType === 'study_plan' 
    ? t('study.plan', 'Study Plan') 
    : t('study.personalStatement', 'Personal Statement');

  const handleGenerateExample = async () => {
    const result = await onGenerateExample();
    if (result) {
      setExample(result);
    }
  };

  const handleCopy = async () => {
    if (!example) return;
    await navigator.clipboard.writeText(example);
    setCopied(true);
    toast({
      title: t('common.copied', 'Copied!'),
      description: t('study.exampleCopied', 'Example copied to clipboard'),
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinueToWriting = () => {
    // Do NOT copy the example - just navigate to writing step
    onComplete();
  };

  const handleUseAsStartingPointClick = () => {
    // Show strong warning first
    setShowWarningModal(true);
  };

  const handleConfirmUseAsStartingPoint = () => {
    if (example) {
      onUseAsStartingPoint(example);
    }
    setShowWarningModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Critical Warning Banner - Always visible */}
      <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle className="text-base font-bold">
          {t('study.aiWarningTitle', '⚠️ Important: Do NOT Submit AI Content to Universities')}
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p className="font-medium">
            {t('study.aiWarningMain', 'Universities use advanced AI detection software (GPTZero, Turnitin AI, etc.) to identify AI-written content.')}
          </p>
          <ul className="list-disc list-inside text-sm space-y-1 opacity-90">
            <li>{t('study.aiWarning1', 'Submitting AI-generated text can result in immediate application rejection')}</li>
            <li>{t('study.aiWarning2', 'Some universities permanently ban applicants caught using AI')}</li>
            <li>{t('study.aiWarning3', 'Use this example ONLY as a reference for structure and ideas')}</li>
          </ul>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('study.step', 'Step')} 2: {t('study.seePersonalizedExample', 'See a Personalized Example')}
          </CardTitle>
          <CardDescription>
            {t('study.exampleDescriptionNew', 'View a sample {{documentType}} for reference only - you must write your own', { documentType: documentLabel.toLowerCase() })}
            {universityName ? ` ${t('study.andUniversity', 'and {{university}}', { university: universityName })}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!example && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-medium mb-2">{t('study.generateReferenceExample', 'Generate a Reference Example')}</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                {t('study.generateExampleDescNew', 'The AI will create a sample {{documentType}} to show you the structure and style. Remember: this is for learning only!', { documentType: documentLabel.toLowerCase() })}
              </p>
              <Button 
                onClick={handleGenerateExample} 
                disabled={isLoading}
                size="lg"
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('study.generatingExample', 'Generating Example...')}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t('study.generateExampleForMe', 'Generate Example for Me')}
                  </>
                )}
              </Button>

              {/* Skip option */}
              <div className="mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  {t('study.skipExamplePrompt', 'Already know what to write? Skip the example.')}
                </p>
                <Button variant="ghost" onClick={handleContinueToWriting} className="gap-2">
                  {t('study.skipToWriting', 'Skip to Writing')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {example && (
            <div className="space-y-4">
              {/* Example with "Reference Only" label */}
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20 relative">
                <div className="absolute -top-3 left-4">
                  <span className="bg-warning text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Ban className="h-3 w-3" />
                    {t('study.referenceOnly', 'REFERENCE ONLY - DO NOT COPY')}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-3 mt-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="font-medium">{t('study.sampleDocument', 'Sample {{documentType}}', { documentType: documentLabel })}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCopy}
                    className="gap-1"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-success" />
                        {t('common.copied', 'Copied!')}
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        {t('common.copy', 'Copy')}
                      </>
                    )}
                  </Button>
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap pr-4 opacity-90">
                    {example}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <Button 
                  variant="outline" 
                  onClick={handleGenerateExample}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {t('study.generateNewExample', 'Generate New Example')}
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleUseAsStartingPointClick}
                  className="gap-2 border-warning text-warning hover:bg-warning/10 dark:text-warning dark:hover:bg-warning/20"
                >
                  <AlertTriangle className="h-4 w-4" />
                  {t('study.useAsReference', 'Use as Starting Point (Risky)')}
                </Button>
              </div>

              {/* Main action - Continue to Writing */}
              <div className="text-center pt-6 border-t">
                <div className="bg-success/10 dark:bg-success/20 rounded-lg p-4 mb-4 border border-success/30 dark:border-success">
                  <p className="text-sm text-success dark:text-success font-medium mb-1">
                    {t('study.recommendedAction', '✅ Recommended: Write Your Own')}
                  </p>
                  <p className="text-xs text-success dark:text-success">
                    {t('study.recommendedActionDesc', 'Use the example above as inspiration, then write your own unique content in the next step.')}
                  </p>
                </div>
                <Button size="lg" onClick={handleContinueToWriting} className="gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {t('study.continueToWriteOwn', 'Continue to Write My Own')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-info to-primary dark:from-info/20 dark:to-primary/20 border-info/30 dark:border-info">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-info shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-info dark:text-info mb-1">{t('study.howToUseExample', 'How to Use This Example')}</p>
              <ul className="text-sm text-info dark:text-info space-y-1">
                <li>✓ {t('study.exampleUse1', 'Study the structure and organization')}</li>
                <li>✓ {t('study.exampleUse2', 'Note the tone and writing style')}</li>
                <li>✓ {t('study.exampleUse3', 'Understand what topics to cover')}</li>
                <li>✗ {t('study.exampleDont1', 'Do NOT copy sentences or paragraphs')}</li>
                <li>✗ {t('study.exampleDont2', 'Do NOT submit this text to any university')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-2 border-destructive">
            <CardHeader className="bg-destructive/10">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-6 w-6" />
                {t('study.finalWarningTitle', 'Final Warning')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="font-medium">
                {t('study.finalWarningText', 'You are about to copy AI-generated content to your editor.')}
              </p>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('study.finalWarningDetail', 'If you submit this content without completely rewriting it in your own words, your application will likely be rejected. Universities CAN and WILL detect AI-written text.')}
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                {t('study.finalWarningAsk', 'Are you sure you want to continue?')}
              </p>
              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowWarningModal(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleConfirmUseAsStartingPoint}
                  className="gap-2"
                >
                  <AlertTriangle className="h-4 w-4" />
                  {t('study.iUnderstand', 'I Understand the Risk')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
