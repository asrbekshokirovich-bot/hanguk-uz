import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { StudyPlanSession } from '@/hooks/useStudyPlanSessions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  BookOpen, 
  FileText, 
  Play, 
  CheckCircle2, 
  Clock,
  Trash2,
  GraduationCap
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SessionHistoryListProps {
  sessions: StudyPlanSession[];
  isLoading: boolean;
  onNewSession: () => void;
  onResumeSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionHistoryList({
  sessions,
  isLoading,
  onNewSession,
  onResumeSession,
  onDeleteSession,
}: SessionHistoryListProps) {
  const { t } = useTranslation();

  const getStepLabel = (step: number) => {
    switch (step) {
      case 1: return t('study.stepLearn', 'Learn');
      case 2: return t('study.stepExample', 'Example');
      case 3: return t('study.stepWrite', 'Write');
      case 4: return t('study.stepAnalyze', 'Analyze');
      default: return `${t('study.step', 'Step')} ${step}`;
    }
  };

  const getUniversityName = (session: StudyPlanSession) => {
    if (!session.university) return null;
    return session.university.name_en || session.university.name_ko || session.university.name_uz;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('study.trainingSessions', 'Training Sessions')}</h2>
          <p className="text-sm text-muted-foreground">
            {sessions.length} {sessions.length !== 1 ? t('study.sessionsPlural', 'sessions') : t('study.sessionSingular', 'session')}
          </p>
        </div>
        <Button onClick={onNewSession} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('study.newSession', 'New Session')}
        </Button>
      </div>

      {/* Empty State */}
      {sessions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">{t('study.noTrainingSessions', 'No Training Sessions Yet')}</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              {t('study.startFirstSessionDesc', 'Start your first training session to learn how to write an effective Study Plan or Personal Statement.')}
            </p>
            <Button onClick={onNewSession} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('study.startFirstSession', 'Start Your First Session')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Session List */}
      {sessions.length > 0 && (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3 pr-4">
            {sessions.map(session => (
              <Card 
                key={session.id} 
                className="hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => onResumeSession(session.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Icon and Info */}
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        session.document_type === 'study_plan' 
                          ? 'bg-info/10 dark:bg-info/30' 
                          : 'bg-primary/10 dark:bg-primary/30'
                      }`}>
                        {session.document_type === 'study_plan' ? (
                          <BookOpen className="h-5 w-5 text-info dark:text-info" />
                        ) : (
                          <FileText className="h-5 w-5 text-primary dark:text-primary" />
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {session.document_type === 'study_plan' 
                              ? t('study.plan', 'Study Plan') 
                              : t('study.personalStatement', 'Personal Statement')}
                          </span>
                          {session.status === 'completed' ? (
                            <Badge variant="secondary" className="gap-1 text-success bg-success/10 dark:bg-success/30">
                              <CheckCircle2 className="h-3 w-3" />
                              {t('common.completed', 'Completed')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              {t('study.step', 'Step')} {session.current_step}/4
                            </Badge>
                          )}
                        </div>
                        
                        {getUniversityName(session) && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <GraduationCap className="h-3.5 w-3.5" />
                            {getUniversityName(session)}
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground">
                          {t('study.lastUpdated', 'Last updated')} {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {session.status !== 'completed' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onResumeSession(session.id)}
                          className="gap-1"
                        >
                          <Play className="h-3 w-3" />
                          {t('study.resume', 'Resume')}
                        </Button>
                      )}
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('study.deleteSessionConfirm', 'Delete Session?')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('study.deleteSessionDesc', 'This will permanently delete this training session and all its drafts, analyses, and chat history. This action cannot be undone.')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => onDeleteSession(session.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t('common.delete', 'Delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {session.status !== 'completed' && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{t('study.progress', 'Progress')}:</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all" 
                            style={{ width: `${(session.current_step / 4) * 100}%` }}
                          />
                        </div>
                        <span>{getStepLabel(session.current_step)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
