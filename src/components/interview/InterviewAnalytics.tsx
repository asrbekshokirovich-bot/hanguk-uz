import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useInterviewAnalytics } from '@/hooks/useInterviewAnalytics';
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  type ChartConfig 
} from '@/components/ui/chart';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Calendar, 
  Clock, 
  Award,
  Flame,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InterviewAnalyticsProps {
  onBack: () => void;
}

const chartConfig: ChartConfig = {
  overall: { label: 'Overall', color: 'hsl(var(--primary))' },
  communication: { label: 'Communication', color: 'hsl(217, 91%, 60%)' },
  confidence: { label: 'Confidence', color: 'hsl(142, 76%, 36%)' },
  content: { label: 'Content', color: 'hsl(262, 83%, 58%)' },
  language: { label: 'Language', color: 'hsl(38, 92%, 50%)' },
};

export function InterviewAnalytics({ onBack }: InterviewAnalyticsProps) {
  const { t } = useTranslation();
  const { analytics, isLoading, error } = useInterviewAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <p className="text-destructive">{error}</p>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back', 'Back')}
        </Button>
      </div>
    );
  }

  if (!analytics || analytics.completedSessions === 0) {
    return (
      <div className="p-6 text-center max-w-md mx-auto">
        <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t('interview.noSessionsYet', 'No Practice Sessions Yet')}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t('interview.startPracticing', 'Complete your first interview practice to see your progress analytics.')}
        </p>
        <Button onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('interview.startPractice', 'Start Practice')}
        </Button>
      </div>
    );
  }

  const radarData = [
    { category: 'Communication', value: analytics.categoryAverages.communication },
    { category: 'Confidence', value: analytics.categoryAverages.confidence },
    { category: 'Content', value: analytics.categoryAverages.content },
    { category: 'Language', value: analytics.categoryAverages.language },
  ];

  const formatCategoryName = (category: string) => {
    return t(`interview.${category}`, category.charAt(0).toUpperCase() + category.slice(1));
  };

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('interview.yourProgress', 'Your Progress')}</h1>
          <p className="text-muted-foreground">
            {t('interview.trackImprovement', 'Track your interview skills improvement over time')}
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back', 'Back')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs">{t('interview.avgScore', 'Avg Score')}</span>
            </div>
            <div className="text-2xl font-bold">{analytics.averageScore.toFixed(1)}/10</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">{t('interview.sessions', 'Sessions')}</span>
            </div>
            <div className="text-2xl font-bold">{analytics.completedSessions}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-xs">{t('interview.streak', 'Streak')}</span>
            </div>
            <div className="text-2xl font-bold">{analytics.practiceStreak} {t('common.days', 'days')}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">{t('interview.avgDuration', 'Avg Duration')}</span>
            </div>
            <div className="text-2xl font-bold">{Math.round(analytics.averageDuration / 60)}m</div>
          </CardContent>
        </Card>
      </div>

      {/* Improvement & Focus Areas */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {analytics.improvementRate >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              {t('interview.improvement', 'Improvement')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-3xl font-bold",
              analytics.improvementRate >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {analytics.improvementRate >= 0 ? '+' : ''}{analytics.improvementRate.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t('interview.comparedToFirst', 'Compared to your first sessions')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4" />
              {t('interview.focusAreas', 'Focus Areas')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-green-600">{t('interview.strongest', 'Strongest')}</span>
                <span className="font-medium">{formatCategoryName(analytics.strongestCategory || '')}</span>
              </div>
              <Progress 
                value={analytics.categoryAverages[analytics.strongestCategory as keyof typeof analytics.categoryAverages] * 10} 
                className="h-2"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-yellow-600">{t('interview.needsWork', 'Needs Work')}</span>
                <span className="font-medium">{formatCategoryName(analytics.weakestCategory || '')}</span>
              </div>
              <Progress 
                value={analytics.categoryAverages[analytics.weakestCategory as keyof typeof analytics.categoryAverages] * 10} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Trend Chart */}
      {analytics.scoreHistory.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('interview.scoreTrend', 'Score Trend')}</CardTitle>
            <CardDescription>
              {t('interview.overallScoreProgress', 'Your overall score progression')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <LineChart data={analytics.scoreHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="overall" 
                  stroke="var(--color-overall)" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Category Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('interview.categoryBreakdown', 'Category Breakdown')}</CardTitle>
          <CardDescription>
            {t('interview.averageByCategory', 'Your average scores by category')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
              <Radar
                name="Score"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Weekly Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('interview.activity', 'Activity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-center">
            <div className="flex-1 p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{analytics.sessionsThisWeek}</div>
              <div className="text-sm text-muted-foreground">{t('interview.thisWeek', 'This Week')}</div>
            </div>
            <div className="flex-1 p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{analytics.sessionsThisMonth}</div>
              <div className="text-sm text-muted-foreground">{t('interview.thisMonth', 'This Month')}</div>
            </div>
            <div className="flex-1 p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{analytics.totalSessions}</div>
              <div className="text-sm text-muted-foreground">{t('interview.allTime', 'All Time')}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
