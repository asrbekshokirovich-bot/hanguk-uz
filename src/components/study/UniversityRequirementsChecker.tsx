import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  Circle,
  AlertTriangle,
  Info,
  GraduationCap,
  FileText,
  Languages,
} from 'lucide-react';
import { UniversityRequirement } from '@/hooks/useUniversityRequirements';
import { cn } from '@/lib/utils';

interface UniversityRequirementsCheckerProps {
  requirements: UniversityRequirement | null;
  content: string;
  universityName?: string;
  className?: string;
}

// Section keywords for detection
const sectionKeywords: Record<string, string[]> = {
  'Introduction': ['my name', 'i am', 'introduce', '자기소개', '저는'],
  'Why Korea': ['why korea', 'korean culture', 'south korea', '한국을 선택', '왜 한국'],
  'Why This University': ['university', 'chose this', 'selected', '대학교', '이 대학'],
  'Study Goals': ['study goal', 'academic goal', 'learn', 'research', '학업 목표'],
  'Career Plans': ['career', 'future plan', 'after graduation', '진로', '졸업 후'],
  'Conclusion': ['in conclusion', 'finally', 'thank you', '결론', '감사'],
  'Background': ['grew up', 'childhood', 'family', 'background', '성장'],
  'Motivation': ['motivation', 'inspired', 'passion', 'interest', '동기'],
  'Experience': ['experience', 'worked', 'project', 'participated', '경험'],
  'Goals': ['goal', 'dream', 'aspire', 'future', '목표'],
};

function detectSections(content: string, requiredSections: string[]): Record<string, boolean> {
  const lowerContent = content.toLowerCase();
  const detected: Record<string, boolean> = {};

  requiredSections.forEach(section => {
    const keywords = sectionKeywords[section] || [section.toLowerCase()];
    detected[section] = keywords.some(keyword => lowerContent.includes(keyword.toLowerCase()));
  });

  return detected;
}

export function UniversityRequirementsChecker({
  requirements,
  content,
  universityName,
  className,
}: UniversityRequirementsCheckerProps) {
  const { t } = useTranslation();

  if (!requirements) {
    return null;
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const detectedSections = detectSections(content, requirements.required_sections);
  const completedSections = Object.values(detectedSections).filter(Boolean).length;
  const totalSections = requirements.required_sections.length;
  const sectionProgress = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;

  const wordCountStatus = wordCount < requirements.min_word_count 
    ? 'low' 
    : wordCount > requirements.max_word_count 
      ? 'high' 
      : 'good';

  const wordCountProgress = Math.min(100, (wordCount / requirements.max_word_count) * 100);

  return (
    <Card className={cn('border-info/30 dark:border-info bg-info/10/50 dark:bg-info/20', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-info" />
          {universityName || t('study.universityRequirements', 'University Requirements')}
        </CardTitle>
        <CardDescription>
          {t('study.checkAgainstRequirements', 'Checking your document against university guidelines')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Word Count */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {t('study.wordCount', 'Word Count')}
            </span>
            <span className={cn(
              'font-medium',
              wordCountStatus === 'good' && 'text-success',
              wordCountStatus === 'low' && 'text-warning',
              wordCountStatus === 'high' && 'text-destructive'
            )}>
              {wordCount} / {requirements.min_word_count}-{requirements.max_word_count}
            </span>
          </div>
          <Progress 
            value={wordCountProgress} 
            className={cn(
              'h-2',
              wordCountStatus === 'low' && '[&>div]:bg-warning',
              wordCountStatus === 'high' && '[&>div]:bg-destructive'
            )}
          />
          {wordCountStatus === 'low' && (
            <p className="text-xs text-warning flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t('study.needMoreWords', 'Need at least {{count}} more words', { count: requirements.min_word_count - wordCount })}
            </p>
          )}
          {wordCountStatus === 'high' && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t('study.tooManyWords', 'Reduce by {{count}} words', { count: wordCount - requirements.max_word_count })}
            </p>
          )}
        </div>

        <Separator />

        {/* Required Sections */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>{t('study.requiredSections', 'Required Sections')}</span>
            <Badge variant={completedSections === totalSections ? 'default' : 'secondary'}>
              {completedSections}/{totalSections}
            </Badge>
          </div>
          <Progress value={sectionProgress} className="h-2" />
          <div className="grid grid-cols-2 gap-2 mt-2">
            {requirements.required_sections.map(section => (
              <div
                key={section}
                className={cn(
                  'flex items-center gap-2 text-xs p-2 rounded',
                  detectedSections[section] 
                    ? 'bg-success/10 dark:bg-success/30 text-success dark:text-success'
                    : 'bg-muted/50 text-muted-foreground'
                )}
              >
                {detectedSections[section] ? (
                  <CheckCircle className="h-3 w-3 shrink-0" />
                ) : (
                  <Circle className="h-3 w-3 shrink-0" />
                )}
                {section}
              </div>
            ))}
          </div>
        </div>

        {/* Language Requirements */}
        {requirements.language_requirements && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Languages className="h-4 w-4 text-muted-foreground" />
                {t('study.languageRequirements', 'Language Requirements')}
              </div>
              <p className="text-xs text-muted-foreground">
                {requirements.language_requirements}
              </p>
            </div>
          </>
        )}

        {/* Tips */}
        {requirements.tips && (
          <>
            <Separator />
            <div className="bg-info/10 dark:bg-info/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-info dark:text-info">
                    {t('study.tip', 'Tip')}
                  </p>
                  <p className="text-xs text-info dark:text-info mt-1">
                    {requirements.tips}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
