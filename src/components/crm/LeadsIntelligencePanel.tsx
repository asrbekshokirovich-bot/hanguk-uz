import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Lead } from '@/hooks/useLeads';
import { supabase } from '@/integrations/supabase/client';
import { 
  Brain, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle, 
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Minus,
  Clock,
  Phone,
  UserX,
  Flame,
  Target,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import { isPast, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeadsStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
  lost: number;
  callToday: number;
  highPriority: number;
  aiDetected: number;
}

interface Problem {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  metric: string;
}

interface FocusItem {
  action: string;
  reason: string;
  count: string;
}

interface Recommendation {
  priority: 'immediate' | 'short_term' | 'strategic';
  title: string;
  action: string;
}

interface Analysis {
  summary: string;
  overall_health: 'critical' | 'poor' | 'fair' | 'good' | 'unknown';
  problems: Problem[];
  focus_today: FocusItem[];
  weekly_trend: { direction: 'improving' | 'declining' | 'stable'; summary: string };
  recommendations: Recommendation[];
}

interface RawStats {
  total: number;
  overdue: number;
  overdueOver3Days: number;
  overdueOver7Days: number;
  neverContacted: number;
  stuckContacted: number;
  hotStuck: number;
  highPriority: number;
  unscored: number;
  answerRateThisWeek: number | null;
  answerRateLastWeek: number | null;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
}

interface IntelligenceData {
  analysis: Analysis;
  raw_stats: RawStats;
  generated_at: string;
}

interface LeadsIntelligencePanelProps {
  leads: Lead[];
  stats: LeadsStats;
}

const CACHE_KEY = 'leads_intelligence_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const severityConfig = {
  critical: { color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30', icon: XCircle, label: 'CRITICAL' },
  high: { color: 'text-warning', bg: 'bg-warning/10 border-warning/30', icon: AlertTriangle, label: 'HIGH' },
  medium: { color: 'text-warning', bg: 'bg-warning/10 border-warning/30', icon: AlertCircle, label: 'MEDIUM' },
  low: { color: 'text-info', bg: 'bg-info/10 border-info/30', icon: Info, label: 'LOW' },
};

const healthConfig = {
  critical: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Critical' },
  poor: { color: 'text-warning', bg: 'bg-warning/10', label: 'Poor' },
  fair: { color: 'text-warning', bg: 'bg-warning/10', label: 'Fair' },
  good: { color: 'text-success', bg: 'bg-success/10', label: 'Good' },
  unknown: { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Unknown' },
};

export const LeadsIntelligencePanel: React.FC<LeadsIntelligencePanelProps> = ({ leads, stats }) => {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Client-side computed leads to act on
  const overdueLeads = leads
    .filter(l => l.next_follow_up && isPast(new Date(l.next_follow_up)) && !['converted', 'lost'].includes(l.status))
    .sort((a, b) => (a.priority_score || 0) > (b.priority_score || 0) ? -1 : 1)
    .slice(0, 5);

  const neverContactedLeads = leads
    .filter(l => !l.last_contacted_at && !['converted', 'lost'].includes(l.status))
    .slice(0, 5);

  const hotStuckLeads = leads
    .filter(l => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return l.priority_score !== null && l.priority_score >= 70 && 
             l.status === 'contacted' && 
             new Date(l.updated_at) < sevenDaysAgo;
    })
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
    .slice(0, 5);

  const fetchAnalysis = useCallback(async (force = false) => {
    // Check cache first
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          const age = Date.now() - new Date(parsed.generated_at).getTime();
          if (age < CACHE_TTL_MS) {
            setData(parsed);
            setLastUpdated(parsed.generated_at);
            return;
          }
        }
      } catch {
        // ignore cache errors
      }
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('leads-intelligence', {});

      if (fnError) throw new Error(fnError.message);
      if (result?.error) {
        if (result.error.includes('Rate limit')) {
          setError('Rate limit reached. Analysis cached — try again in a few minutes.');
          return;
        }
        throw new Error(result.error);
      }

      setData(result);
      setLastUpdated(result.generated_at);
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intelligence report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const rs = data?.raw_stats;
  const analysis = data?.analysis;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "border-2 transition-colors",
        analysis?.overall_health === 'critical' && "border-destructive/40",
        analysis?.overall_health === 'poor' && "border-warning/40",
        analysis?.overall_health === 'fair' && "border-warning/40",
        analysis?.overall_health === 'good' && "border-success/40",
        !analysis && "border-border"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  AI Leads Intelligence
                  {analysis?.overall_health && (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      healthConfig[analysis.overall_health].bg,
                      healthConfig[analysis.overall_health].color
                    )}>
                      {healthConfig[analysis.overall_health].label}
                    </span>
                  )}
                </CardTitle>
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Analysed {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchAnalysis(true)}
                disabled={loading}
                className="h-8 px-2"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} />
                {loading ? 'Analysing...' : 'Refresh'}
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Always-visible Live Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            <StatPill
              icon={Clock}
              label="Overdue"
              value={rs ? String(rs.overdue) : stats ? String(stats.callToday) : '—'}
              color={rs && rs.overdue > 20 ? 'red' : rs && rs.overdue > 5 ? 'amber' : 'green'}
              loading={loading && !rs}
            />
            <StatPill
              icon={Phone}
              label="Answer Rate"
              value={rs?.answerRateThisWeek != null ? `${rs.answerRateThisWeek}%` : '—'}
              subValue={rs?.answerRateLastWeek != null ? `vs ${rs.answerRateLastWeek}% last wk` : undefined}
              color={
                rs?.answerRateThisWeek != null && rs?.answerRateLastWeek != null
                  ? rs.answerRateThisWeek < rs.answerRateLastWeek - 10 ? 'red' : 'amber'
                  : 'muted'
              }
              loading={loading && !rs}
            />
            <StatPill
              icon={UserX}
              label="Stuck Contacted"
              value={rs ? `${rs.stuckContacted}` : '—'}
              subValue="> 7 days no update"
              color={rs && rs.stuckContacted > 10 ? 'red' : rs && rs.stuckContacted > 3 ? 'amber' : 'green'}
              loading={loading && !rs}
            />
            <StatPill
              icon={Flame}
              label="Hot Stuck"
              value={rs ? `${rs.hotStuck}` : '—'}
              subValue="score ≥70, stuck"
              color={rs && rs.hotStuck > 5 ? 'red' : rs && rs.hotStuck > 0 ? 'amber' : 'green'}
              loading={loading && !rs}
            />
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-5">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 border border-destructive/20">
                {error}
              </div>
            )}

            {/* AI Summary */}
            {loading && !data ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : analysis?.summary ? (
              <div className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                {analysis.summary}
              </div>
            ) : null}

            {/* Problems Section */}
            {loading && !data ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : analysis?.problems && analysis.problems.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Identified Problems
                </h4>
                {analysis.problems.map((problem, i) => {
                  const cfg = severityConfig[problem.severity] || severityConfig.low;
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={cn("rounded-lg border p-3", cfg.bg)}>
                      <div className="flex items-start gap-2">
                        <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", cfg.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("text-xs font-bold", cfg.color)}>{cfg.label}</span>
                            <span className="text-sm font-medium">{problem.title}</span>
                            {problem.metric && (
                              <Badge variant="outline" className={cn("text-xs", cfg.color, cfg.bg)}>
                                {problem.metric}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{problem.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Today's Focus */}
            {analysis?.focus_today && analysis.focus_today.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  Today's Focus
                </h4>
                <div className="space-y-2">
                  {analysis.focus_today.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.action}</span>
                          {item.count && (
                            <Badge variant="secondary" className="text-xs">{item.count}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly Trend */}
            {analysis?.weekly_trend && (
              <div className={cn(
                "flex items-start gap-2 p-3 rounded-lg border text-sm",
                analysis.weekly_trend.direction === 'declining' && "bg-destructive/5 border-destructive/20",
                analysis.weekly_trend.direction === 'improving' && "bg-success/5 border-success/20",
                analysis.weekly_trend.direction === 'stable' && "bg-muted border-border",
              )}>
                {analysis.weekly_trend.direction === 'declining' ? (
                  <TrendingDown className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                ) : analysis.weekly_trend.direction === 'improving' ? (
                  <TrendingUp className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                    Weekly Trend — {analysis.weekly_trend.direction}
                  </span>
                  <p className="text-xs mt-0.5">{analysis.weekly_trend.summary}</p>
                </div>
              </div>
            )}

            {/* Specific Leads to Act On */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Specific Leads to Act On Now
              </h4>
              
              {overdueLeads.length > 0 && (
                <ActionLeadGroup
                  icon={Clock}
                  title="Most Overdue"
                  color="text-destructive"
                  leads={overdueLeads}
                  getSubtext={(l) => l.next_follow_up ? `Overdue ${formatDistanceToNow(new Date(l.next_follow_up), { addSuffix: true })}` : ''}
                />
              )}

              {neverContactedLeads.length > 0 && (
                <ActionLeadGroup
                  icon={UserX}
                  title="Never Been Contacted"
                  color="text-warning"
                  leads={neverContactedLeads}
                  getSubtext={(l) => `Added ${formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}`}
                />
              )}

              {hotStuckLeads.length > 0 && (
                <ActionLeadGroup
                  icon={Flame}
                  title="Hot Leads Stuck in Contacted"
                  color="text-warning"
                  leads={hotStuckLeads}
                  getSubtext={(l) => `Score: ${l.priority_score} — stuck ${formatDistanceToNow(new Date(l.updated_at), { addSuffix: true })}`}
                />
              )}

              {overdueLeads.length === 0 && neverContactedLeads.length === 0 && hotStuckLeads.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg p-3">
                  <CheckCircle2 className="h-4 w-4" />
                  No urgent leads to action right now. Pipeline looks healthy!
                </div>
              )}
            </div>

            {/* Recommendations */}
            {analysis?.recommendations && analysis.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recommendations
                </h4>
                {analysis.recommendations.map((rec, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        rec.priority === 'immediate' && "border-destructive/50 text-destructive",
                        rec.priority === 'short_term' && "border-warning/50 text-warning",
                        rec.priority === 'strategic' && "border-info/50 text-info",
                      )}>
                        {rec.priority.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm font-medium">{rec.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.action}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface StatPillProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  color: 'red' | 'amber' | 'green' | 'muted';
  loading?: boolean;
}

const StatPill: React.FC<StatPillProps> = ({ icon: Icon, label, value, subValue, color, loading }) => {
  const colorMap = {
    red: 'text-destructive bg-destructive/10 border-destructive/20',
    amber: 'text-warning bg-warning/10 border-warning/20',
    green: 'text-success bg-success/10 border-success/20',
    muted: 'text-muted-foreground bg-muted border-border',
  };

  if (loading) {
    return <Skeleton className="h-14 rounded-lg" />;
  }

  return (
    <div className={cn("rounded-lg border px-3 py-2", colorMap[color])}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold leading-tight">{value}</div>
      {subValue && <div className="text-xs opacity-70 mt-0.5">{subValue}</div>}
    </div>
  );
};

interface ActionLeadGroupProps {
  icon: React.ElementType;
  title: string;
  color: string;
  leads: Lead[];
  getSubtext: (lead: Lead) => string;
}

const ActionLeadGroup: React.FC<ActionLeadGroupProps> = ({ icon: Icon, title, color, leads, getSubtext }) => (
  <div>
    <div className={cn("flex items-center gap-1.5 mb-1.5 text-xs font-medium", color)}>
      <Icon className="h-3.5 w-3.5" />
      {title} ({leads.length})
    </div>
    <div className="space-y-1">
      {leads.map(lead => (
        <div key={lead.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5">
          <span className="font-medium truncate">{lead.full_name}</span>
          <span className="text-muted-foreground ml-2 flex-shrink-0">{getSubtext(lead)}</span>
        </div>
      ))}
    </div>
  </div>
);
