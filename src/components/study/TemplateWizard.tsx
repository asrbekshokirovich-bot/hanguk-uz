import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Wand2,
  Copy,
  Check,
} from 'lucide-react';
import { 
  DocumentTemplate, 
  TemplateSection,
  getTemplatesByType,
  generateDocumentFromTemplate,
} from '@/data/documentTemplates';
import { cn } from '@/lib/utils';

interface TemplateWizardProps {
  documentType: 'study_plan' | 'personal_statement';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (content: string) => void;
}

export function TemplateWizard({
  documentType,
  open,
  onOpenChange,
  onComplete,
}: TemplateWizardProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as 'en' | 'uz' | 'ru' | 'ko';
  
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const templates = useMemo(() => getTemplatesByType(documentType), [documentType]);

  const currentSection = selectedTemplate?.sections[currentSectionIndex];
  const totalSections = selectedTemplate?.sections.length || 0;
  const progress = totalSections > 0 ? ((currentSectionIndex + 1) / totalSections) * 100 : 0;

  const handleValueChange = (sectionId: string, promptId: string, value: string) => {
    setValues(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [promptId]: value,
      },
    }));
  };

  const handleNext = () => {
    if (currentSectionIndex < totalSections - 1) {
      setCurrentSectionIndex(prev => prev + 1);
    } else {
      setShowPreview(true);
    }
  };

  const handleBack = () => {
    if (showPreview) {
      setShowPreview(false);
    } else if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    } else {
      setSelectedTemplate(null);
    }
  };

  const generatedContent = useMemo(() => {
    if (!selectedTemplate) return '';
    const lang = selectedTemplate.language === 'ko' ? 'ko' : 'en';
    return generateDocumentFromTemplate(selectedTemplate, values, lang);
  }, [selectedTemplate, values]);

  const handleComplete = () => {
    onComplete(generatedContent);
    onOpenChange(false);
    // Reset state
    setSelectedTemplate(null);
    setCurrentSectionIndex(0);
    setValues({});
    setShowPreview(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLocalizedText = (textMap: Record<string, string>) => {
    return textMap[currentLang] || textMap.en || Object.values(textMap)[0];
  };

  const isSectionComplete = (section: TemplateSection) => {
    const sectionValues = values[section.id] || {};
    return section.prompts
      .filter(p => p.required)
      .every(p => sectionValues[p.id]?.trim());
  };

  const canProceed = currentSection ? isSectionComplete(currentSection) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            {t('study.templateWizard', 'Template Wizard')}
          </DialogTitle>
          <DialogDescription>
            {selectedTemplate 
              ? showPreview 
                ? t('study.reviewGenerated', 'Review your generated document')
                : `${t('study.step', 'Step')} ${currentSectionIndex + 1} ${t('study.of', 'of')} ${totalSections}: ${getLocalizedText(currentSection?.title || {})}`
              : t('study.selectTemplate', 'Choose a template to get started')
            }
          </DialogDescription>
        </DialogHeader>

        {selectedTemplate && (
          <Progress value={showPreview ? 100 : progress} className="h-2" />
        )}

        <ScrollArea className="flex-1 -mx-6 px-6">
          {!selectedTemplate ? (
            // Template Selection
            <div className="space-y-3 py-4">
              {templates.map(template => (
                <Button
                  key={template.id}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-8 w-8 text-primary shrink-0" />
                    <div className="text-left">
                      <p className="font-medium">{getLocalizedText(template.name)}</p>
                      <p className="text-sm text-muted-foreground">
                        {template.language === 'en' ? '🇺🇸 English' : '🇰🇷 Korean'} • {template.style}
                      </p>
                      <div className="flex gap-1 mt-2">
                        {template.sections.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {getLocalizedText(s.title)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          ) : showPreview ? (
            // Preview
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t('study.preview', 'Preview')}</h3>
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
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
              <div className="bg-muted rounded-lg p-4 whitespace-pre-wrap text-sm font-mono">
                {generatedContent || (
                  <span className="text-muted-foreground italic">
                    {t('study.noContentGenerated', 'No content generated yet. Fill in the template fields.')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {generatedContent.split(/\s+/).filter(Boolean).length} {t('study.words', 'words')}
              </p>
            </div>
          ) : (
            // Section Form
            <div className="py-4 space-y-6">
              {currentSection && (
                <>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">
                      {getLocalizedText(currentSection.title)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {getLocalizedText(currentSection.description)}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {currentSection.prompts.map(prompt => (
                      <div key={prompt.id} className="space-y-2">
                        <Label htmlFor={prompt.id} className="flex items-center gap-1">
                          {getLocalizedText(prompt.label)}
                          {prompt.required && <span className="text-destructive">*</span>}
                        </Label>
                        {prompt.type === 'textarea' ? (
                          <Textarea
                            id={prompt.id}
                            placeholder={getLocalizedText(prompt.placeholder)}
                            value={values[currentSection.id]?.[prompt.id] || ''}
                            onChange={(e) => handleValueChange(currentSection.id, prompt.id, e.target.value)}
                            className="min-h-[100px]"
                          />
                        ) : (
                          <Input
                            id={prompt.id}
                            placeholder={getLocalizedText(prompt.placeholder)}
                            value={values[currentSection.id]?.[prompt.id] || ''}
                            onChange={(e) => handleValueChange(currentSection.id, prompt.id, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={!selectedTemplate && !showPreview}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('common.back', 'Back')}
          </Button>

          {showPreview ? (
            <Button onClick={handleComplete} disabled={!generatedContent.trim()}>
              <FileText className="h-4 w-4 mr-2" />
              {t('study.useThisContent', 'Use This Content')}
            </Button>
          ) : selectedTemplate ? (
            <Button onClick={handleNext} disabled={!canProceed}>
              {currentSectionIndex < totalSections - 1 ? (
                <>
                  {t('common.next', 'Next')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  {t('study.generatePreview', 'Generate Preview')}
                  <Wand2 className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
