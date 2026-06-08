import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Trophy,
  Flame,
  Star,
  Pencil,
  BookOpen,
  RefreshCw,
  GraduationCap,
  Check,
  Sun,
  Moon,
  Zap,
  Lock,
} from 'lucide-react';
import { Achievement, WritingStreak } from '@/hooks/useGamification';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface AchievementsPanelProps {
  achievements: Achievement[];
  streak: WritingStreak;
  xp: number;
  level: number;
  unlockedCount: number;
  totalAchievements: number;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Pencil,
  BookOpen,
  Trophy,
  Flame,
  RefreshCw,
  GraduationCap,
  Check,
  Sun,
  Moon,
  Zap,
  Star,
};

export function AchievementsPanel({
  achievements,
  streak,
  xp,
  level,
  unlockedCount,
  totalAchievements,
}: AchievementsPanelProps) {
  const { t } = useTranslation();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Trophy className="h-4 w-4 text-warning" />
          <span className="hidden sm:inline">{t('study.achievements', 'Achievements')}</span>
          <Badge variant="secondary" className="ml-1">
            {unlockedCount}/{totalAchievements}
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            {t('study.achievementsTitle', 'Your Achievements')}
          </SheetTitle>
          <SheetDescription>
            {t('study.achievementsDesc', 'Track your progress and unlock badges')}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100dvh-10rem)] mt-6">
          <div className="space-y-6 pr-4">
            {/* Level & XP */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground font-bold">{level}</span>
                  </div>
                  <div>
                    <p className="font-semibold">{t('study.level', 'Level')} {level}</p>
                    <p className="text-xs text-muted-foreground">{xp.toLocaleString()} XP</p>
                  </div>
                </div>
                <Star className="h-6 w-6 text-warning" />
              </div>
              <Progress value={(xp % 1000) / 10} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {1000 - (xp % 1000)} XP {t('study.toNextLevel', 'to next level')}
              </p>
            </div>

            {/* Streak */}
            <div className="bg-warning/10 dark:bg-warning/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-warning/10 dark:bg-warning rounded-full flex items-center justify-center">
                    <Flame className={cn(
                      'h-6 w-6',
                      streak.currentStreak > 0 ? 'text-warning' : 'text-muted-foreground'
                    )} />
                  </div>
                  <div>
                    <p className="font-semibold text-2xl">{streak.currentStreak}</p>
                    <p className="text-sm text-muted-foreground">{t('study.dayStreak', 'Day Streak')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{t('study.best', 'Best')}</p>
                  <p className="font-semibold">{streak.longestStreak} {t('study.days', 'days')}</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{streak.totalWordsWritten.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t('study.wordsWritten', 'Words Written')}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{streak.totalSessionsCompleted}</p>
                <p className="text-xs text-muted-foreground">{t('study.sessionsCompleted', 'Sessions')}</p>
              </div>
            </div>

            {/* Achievements Grid */}
            <div>
              <h3 className="font-semibold mb-3">{t('study.badges', 'Badges')}</h3>
              <div className="space-y-2">
                {achievements.map((achievement) => {
                  const Icon = iconMap[achievement.icon] || Trophy;
                  const isEarned = !!achievement.earnedAt;

                  return (
                    <div
                      key={achievement.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                        isEarned
                          ? 'bg-warning/10 dark:bg-warning/30 border-warning/30 dark:border-warning'
                          : 'bg-muted/30 border-transparent opacity-60'
                      )}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                        isEarned ? 'bg-warning/10 dark:bg-warning' : 'bg-muted'
                      )}>
                        {isEarned ? (
                          <Icon className="h-5 w-5 text-warning dark:text-warning" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'font-medium text-sm',
                          !isEarned && 'text-muted-foreground'
                        )}>
                          {achievement.name}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {achievement.description}
                        </p>
                        {isEarned && achievement.earnedAt && (
                          <p className="text-xs text-warning dark:text-warning mt-0.5">
                            {t('study.earned', 'Earned')} {formatDistanceToNow(new Date(achievement.earnedAt), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Compact streak indicator for header
export function StreakIndicator({ streak }: { streak: WritingStreak }) {
  const { t } = useTranslation();

  if (streak.currentStreak === 0) return null;

  return (
    <Badge variant="outline" className="gap-1 border-warning/30 text-warning dark:border-warning dark:text-warning">
      <Flame className="h-3 w-3" />
      {streak.currentStreak}
    </Badge>
  );
}
