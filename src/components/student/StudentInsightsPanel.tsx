import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  RefreshCw,
  Sparkles,
  Bot
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useStudentInsights } from '@/hooks/useStudentInsights';
import { useState } from 'react';

const typeStyles = {
  action: 'bg-info/10 dark:bg-info/30 border-info/30 dark:border-info',
  info: 'bg-muted dark:bg-muted/30 border-border dark:border-border',
  success: 'bg-success/10 dark:bg-success/30 border-success/30 dark:border-success',
  warning: 'bg-warning/10 dark:bg-warning/30 border-warning/30 dark:border-warning',
};

interface StudentInsightsPanelProps {
  onOpenChat?: () => void;
}

export function StudentInsightsPanel({ onOpenChat }: StudentInsightsPanelProps) {
  const { t } = useTranslation();
  const { insights, loading, refresh } = useStudentInsights();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t('ai.yourUpdates', 'Your Updates')}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-7 w-7"
          >
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.slice(0, 4).map(insight => (
          <div
            key={insight.id}
            className={cn(
              "rounded-lg border p-3 transition-all",
              typeStyles[insight.type]
            )}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg">{insight.icon}</span>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm">{insight.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {insight.description}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Ask AI button */}
        {onOpenChat && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 gap-2"
            onClick={onOpenChat}
          >
            <Bot className="h-4 w-4 text-primary" />
            {t('ai.askForHelp', 'Ask AI for help')}
            <ChevronRight className="h-3 w-3 ml-auto" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
