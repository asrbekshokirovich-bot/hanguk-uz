import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Bot,
  Sparkles,
  DollarSign,
  FileText,
  ClipboardList,
  Users,
  MessageSquare,
  GraduationCap,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAIInsights } from '@/hooks/useAIInsights';

const typeConfig = {
  urgent: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bg: 'bg-destructive/10 dark:bg-destructive/30',
    border: 'border-destructive/30 dark:border-destructive',
    badge: 'bg-destructive/10 text-destructive dark:bg-destructive dark:text-destructive',
  },
  warning: {
    icon: AlertCircle,
    color: 'text-warning',
    bg: 'bg-warning/10 dark:bg-warning/30',
    border: 'border-warning/30 dark:border-warning',
    badge: 'bg-warning/10 text-warning dark:bg-warning dark:text-warning',
  },
  info: {
    icon: Info,
    color: 'text-info',
    bg: 'bg-info/10 dark:bg-info/30',
    border: 'border-info/30 dark:border-info',
    badge: 'bg-info/10 text-info dark:bg-info dark:text-info',
  },
  success: {
    icon: CheckCircle2,
    color: 'text-success',
    bg: 'bg-success/10 dark:bg-success/30',
    border: 'border-success/30 dark:border-success',
    badge: 'bg-success/10 text-success dark:bg-success dark:text-success',
  },
};

const categoryIcons = {
  payment: DollarSign,
  document: FileText,
  task: ClipboardList,
  student: Users,
  message: MessageSquare,
  application: GraduationCap,
};

export function AIInsightsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { insights, loading, refresh, urgentCount, warningCount } = useAIInsights();
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedInsights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="flex items-center gap-2">
              {t('ai.insightsTitle', 'AI Insights')}
              <Sparkles className="h-4 w-4 text-primary" />
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {(urgentCount > 0 || warningCount > 0) && (
              <div className="flex items-center gap-1">
                {urgentCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {urgentCount} urgent
                  </Badge>
                )}
                {warningCount > 0 && (
                  <Badge variant="outline" className="text-xs text-warning border-warning/30">
                    {warningCount} warning
                  </Badge>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
            <p className="font-medium text-success dark:text-success">
              {t('ai.allClear', 'All Clear!')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('ai.noIssues', 'No urgent issues or recommendations at this time.')}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {insights.map(insight => {
                const config = typeConfig[insight.type];
                const TypeIcon = config.icon;
                const CategoryIcon = categoryIcons[insight.category];
                const isExpanded = expandedInsights.has(insight.id);
                const hasItems = insight.items && insight.items.length > 0;

                return (
                  <div
                    key={insight.id}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      config.bg,
                      config.border
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-0.5", config.color)}>
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm">{insight.title}</h4>
                          <Badge variant="outline" className="text-xs gap-1">
                            <CategoryIcon className="h-3 w-3" />
                            {insight.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {insight.description}
                        </p>

                        {/* Expandable items */}
                        {hasItems && (
                          <div className="mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => toggleExpand(insight.id)}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  Hide details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  Show {insight.items!.length} item{insight.items!.length > 1 ? 's' : ''}
                                </>
                              )}
                            </Button>
                            
                            {isExpanded && (
                              <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-muted">
                                {insight.items!.map(item => (
                                  <div key={item.id} className="text-xs">
                                    <span className="font-medium">{item.name}</span>
                                    <span className="text-muted-foreground"> — {item.detail}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action button */}
                        {insight.action && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 mt-2 text-xs gap-1"
                            onClick={() => navigate(insight.action!.path)}
                          >
                            {insight.action.label}
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Quick link to AI Assistant */}
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => navigate('/crm/ai')}
          >
            <Zap className="h-4 w-4 text-primary" />
            {t('ai.askAI', 'Ask Hanguk AI for help')}
            <ChevronRight className="h-4 w-4 ml-auto" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
