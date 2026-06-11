import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FileText,
  CheckCircle,
  Circle,
  Lightbulb,
  BarChart3,
  Type,
  ChevronDown,
  AlertTriangle,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { WritingAssistantState, WritingSuggestion, SectionProgress } from '@/hooks/useWritingAssistant';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface WritingAssistantPanelProps {
  state: WritingAssistantState & {
    completedSections: number;
    sectionCompletionPercentage: number;
  };
  minWordCount?: number;
  maxWordCount?: number;
  className?: string;
}

export function WritingAssistantPanel({
  state,
  minWordCount = 500,
  maxWordCount = 1000,
  className,
}: WritingAssistantPanelProps) {
  const { t } = useTranslation();
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [sectionsOpen, setSectionsOpen] = useState(true);

  const wordCountStatus = state.wordCount < minWordCount 
    ? 'low' 
    : state.wordCount > maxWordCount 
      ? 'high' 
      : 'good';

  const wordCountPercentage = Math.min(100, (state.wordCount / maxWordCount) * 100);

  const getFormalityLabel = (score: number) => {
    if (score <= 3) return t('study.informal', 'Informal');
    if (score <= 5) return t('study.casual', 'Casual');
    if (score <= 7) return t('study.formal', 'Formal');
    return t('study.veryFormal', 'Very Formal');
  };

  const getFormalityColor = (score: number) => {
    if (score <= 3) return 'text-destructive';
    if (score <= 5) return 'text-warning';
    if (score <= 7) return 'text-success';
    return 'text-success';
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Header Stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {t('study.wordCount', 'Word Count')}
              </span>
              <Badge 
                variant={wordCountStatus === 'good' ? 'default' : 'outline'}
                className={cn(
                  wordCountStatus === 'low' && 'border-warning text-warning',
                  wordCountStatus === 'high' && 'border-destructive text-destructive'
                )}
              >
                {state.wordCount}
              </Badge>
            </div>
            <Progress 
              value={wordCountPercentage} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              {t('study.recommendedRange', 'Recommended: {{min}}-{{max}} words', { min: minWordCount, max: maxWordCount })}
            </p>
          </div>

          <Separator />

          {/* Formality Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                {t('study.formalityScore', 'Formality')}
              </span>
              <span className={cn('text-sm font-semibold', getFormalityColor(state.formalityScore))}>
                {state.formalityScore}/10
              </span>
            </div>
            <Progress value={state.formalityScore * 10} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {getFormalityLabel(state.formalityScore)}
            </p>
          </div>

          <Separator />

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{t('study.sentences', 'Sentences')}</p>
              <p className="text-lg font-semibold">{state.sentenceCount}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{t('study.paragraphs', 'Paragraphs')}</p>
              <p className="text-lg font-semibold">{state.paragraphCount}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{t('study.avgSentence', 'Avg. Sentence')}</p>
              <p className="text-lg font-semibold">{state.avgSentenceLength} {t('study.words', 'words')}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{t('study.readability', 'Readability')}</p>
              <p className="text-sm font-semibold capitalize">{state.readabilityLevel}</p>
            </div>
          </div>

          <Separator />

          {/* Section Progress */}
          <Collapsible open={sectionsOpen} onOpenChange={setSectionsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                {t('study.sectionProgress', 'Sections')}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {state.sectionCompletion.filter(s => s.detected).length}/{state.sectionCompletion.length}
                </Badge>
                <ChevronDown className={cn('h-4 w-4 transition-transform', sectionsOpen && 'rotate-180')} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {state.sectionCompletion.map((section) => (
                <div 
                  key={section.id}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md text-sm',
                    section.detected ? 'bg-success/10 dark:bg-success/30' : 'bg-muted/30'
                  )}
                >
                  {section.detected ? (
                    <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={cn(
                    section.detected ? 'text-success dark:text-success' : 'text-muted-foreground'
                  )}>
                    {section.name}
                  </span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Suggestions */}
          <Collapsible open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-warning" />
                {t('study.suggestions', 'Suggestions')}
              </span>
              <div className="flex items-center gap-2">
                {state.suggestions.length > 0 && (
                  <Badge variant="outline" className="text-xs border-warning text-warning">
                    {state.suggestions.length}
                  </Badge>
                )}
                <ChevronDown className={cn('h-4 w-4 transition-transform', suggestionsOpen && 'rotate-180')} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {state.suggestions.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-success" />
                  {t('study.noSuggestions', 'Looking good! No suggestions.')}
                </div>
              ) : (
                state.suggestions.map((suggestion, index) => (
                  <SuggestionCard key={index} suggestion={suggestion} />
                ))
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: WritingSuggestion }) {
  const { t } = useTranslation();
  
  const typeIcons = {
    vocabulary: Type,
    grammar: AlertTriangle,
    style: Lightbulb,
    structure: BookOpen,
  };
  
  const Icon = typeIcons[suggestion.type];
  
  return (
    <Card className="border-warning/30 dark:border-warning bg-warning/10/50 dark:bg-warning/20">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <Icon className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1 min-w-0">
            <div className="text-xs">
              <span className="line-through text-muted-foreground">{suggestion.original}</span>
              <span className="mx-1">→</span>
              <span className="text-success dark:text-success font-medium">{suggestion.suggestion}</span>
            </div>
            <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
