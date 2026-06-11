import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GitCompare,
  Plus,
  Minus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { StudyPlanDraft } from '@/hooks/useStudyPlanSessions';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface RevisionDiffViewerProps {
  drafts: StudyPlanDraft[];
  analyses?: Array<{ draft_id: string; overall_score?: number }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

function computeWordDiff(oldText: string, newText: string): DiffSegment[] {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);
  
  const segments: DiffSegment[] = [];
  
  // Simple word-by-word diff using LCS approach
  const dp: number[][] = [];
  for (let i = 0; i <= oldWords.length; i++) {
    dp[i] = [];
    for (let j = 0; j <= newWords.length; j++) {
      if (i === 0 || j === 0) {
        dp[i][j] = 0;
      } else if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the diff
  let i = oldWords.length;
  let j = newWords.length;
  const result: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ type: 'unchanged', text: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: newWords[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', text: oldWords[i - 1] });
      i--;
    }
  }

  // Merge consecutive segments of the same type
  for (const segment of result) {
    if (segments.length > 0 && segments[segments.length - 1].type === segment.type) {
      segments[segments.length - 1].text += ' ' + segment.text;
    } else {
      segments.push({ ...segment });
    }
  }

  return segments;
}

export function RevisionDiffViewer({
  drafts,
  analyses = [],
  open,
  onOpenChange,
}: RevisionDiffViewerProps) {
  const { t } = useTranslation();
  
  const sortedDrafts = useMemo(() => 
    [...drafts].sort((a, b) => b.version - a.version),
    [drafts]
  );

  const [oldVersionId, setOldVersionId] = useState<string>(sortedDrafts[1]?.id || '');
  const [newVersionId, setNewVersionId] = useState<string>(sortedDrafts[0]?.id || '');
  const [viewMode, setViewMode] = useState<'inline' | 'side-by-side'>('inline');

  const oldDraft = sortedDrafts.find(d => d.id === oldVersionId);
  const newDraft = sortedDrafts.find(d => d.id === newVersionId);

  const oldScore = analyses.find(a => a.draft_id === oldVersionId)?.overall_score;
  const newScore = analyses.find(a => a.draft_id === newVersionId)?.overall_score;

  const diff = useMemo(() => {
    if (!oldDraft || !newDraft) return [];
    return computeWordDiff(oldDraft.content, newDraft.content);
  }, [oldDraft, newDraft]);

  const stats = useMemo(() => {
    const added = diff.filter(d => d.type === 'added').reduce((sum, d) => sum + d.text.split(/\s+/).length, 0);
    const removed = diff.filter(d => d.type === 'removed').reduce((sum, d) => sum + d.text.split(/\s+/).length, 0);
    const unchanged = diff.filter(d => d.type === 'unchanged').reduce((sum, d) => sum + d.text.split(/\s+/).length, 0);
    return { added, removed, unchanged };
  }, [diff]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            {t('study.compareVersions', 'Compare Versions')}
          </DialogTitle>
          <DialogDescription>
            {t('study.visualizeDifferences', 'Visualize the differences between draft versions')}
          </DialogDescription>
        </DialogHeader>

        {/* Version Selectors */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('study.from', 'From')}:</span>
            <Select value={oldVersionId} onValueChange={setOldVersionId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('study.selectVersion', 'Select version')} />
              </SelectTrigger>
              <SelectContent>
                {sortedDrafts.map(draft => (
                  <SelectItem key={draft.id} value={draft.id} disabled={draft.id === newVersionId}>
                    {t('study.version', 'Version')} {draft.version} ({draft.word_count} {t('study.words', 'words')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowRight className="h-4 w-4 text-muted-foreground" />

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('study.to', 'To')}:</span>
            <Select value={newVersionId} onValueChange={setNewVersionId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('study.selectVersion', 'Select version')} />
              </SelectTrigger>
              <SelectContent>
                {sortedDrafts.map(draft => (
                  <SelectItem key={draft.id} value={draft.id} disabled={draft.id === oldVersionId}>
                    {t('study.version', 'Version')} {draft.version} ({draft.word_count} {t('study.words', 'words')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant="outline" className="gap-1 text-success border-success/30">
            <Plus className="h-3 w-3" />
            {stats.added} {t('study.added', 'added')}
          </Badge>
          <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
            <Minus className="h-3 w-3" />
            {stats.removed} {t('study.removed', 'removed')}
          </Badge>
          {oldScore !== undefined && newScore !== undefined && (
            <Badge 
              variant="outline" 
              className={cn(
                'gap-1',
                newScore > oldScore 
                  ? 'text-success border-success/30' 
                  : newScore < oldScore 
                    ? 'text-destructive border-destructive/30'
                    : 'text-muted-foreground'
              )}
            >
              {newScore > oldScore ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {t('study.score', 'Score')}: {oldScore} → {newScore}
            </Badge>
          )}
        </div>

        {/* View Mode Toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 max-w-xs">
            <TabsTrigger value="inline">{t('study.inlineView', 'Inline')}</TabsTrigger>
            <TabsTrigger value="side-by-side">{t('study.sideBySide', 'Side by Side')}</TabsTrigger>
          </TabsList>

          <TabsContent value="inline" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="text-sm leading-relaxed">
                {diff.map((segment, index) => (
                  <span
                    key={index}
                    className={cn(
                      segment.type === 'added' && 'bg-success/10 dark:bg-success/50 text-success dark:text-success',
                      segment.type === 'removed' && 'bg-destructive/10 dark:bg-destructive/50 text-destructive dark:text-destructive line-through'
                    )}
                  >
                    {segment.text}{' '}
                  </span>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="side-by-side" className="flex-1 min-h-0 mt-4">
            <div className="grid grid-cols-2 gap-4 h-[400px]">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-3 py-2 border-b text-sm font-medium">
                  {t('study.version', 'Version')} {oldDraft?.version} ({t('study.old', 'Old')})
                </div>
                <ScrollArea className="h-[360px] p-4">
                  <div className="text-sm whitespace-pre-wrap">
                    {oldDraft?.content}
                  </div>
                </ScrollArea>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-3 py-2 border-b text-sm font-medium">
                  {t('study.version', 'Version')} {newDraft?.version} ({t('study.new', 'New')})
                </div>
                <ScrollArea className="h-[360px] p-4">
                  <div className="text-sm whitespace-pre-wrap">
                    {newDraft?.content}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
