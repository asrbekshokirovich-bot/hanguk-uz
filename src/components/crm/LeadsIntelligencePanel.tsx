import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  ChevronRight,
  Clock,
  Phone,
  UserX,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { isPast, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeadsStats {
  total: number;
  callToday: number;
  highPriority: number;
}

type Health = 'critical' | 'poor' | 'fair' | 'good' | 'unknown';

interface IntelligenceData {
  analysis: { summary: string; overall_health: Health };
  raw_stats: {
    answerRateThisWeek: number | null;
    answerRateLastWeek: number | null;
  };
  generated_at: string;
}

interface LeadsIntelligencePanelProps {
  leads: Lead[];
  stats: LeadsStats;
  onSelectLead?: (lead: Lead) => void;
}

const CACHE_KEY = 'leads_intelligence_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const HEALTH_TONE: Record<Health, string> = {
  critical: 'bg-destructive/10 text-destructive',
  poor: 'bg-warning/10 text-warning',
  fair: 'bg-warning/10 text-warning',
  good: 'bg-success/10 text-success',
  unknown: 'bg-muted text-muted-foreground',
};

const HEALTH_BORDER: Record<Health, string> = {
  critical: 'border-destructive/40',
  poor: 'border-warning/40',
  fair: 'border-warning/40',
  good: 'border-success/40',
  unknown: 'border-border',
};

type StatTone = 'red' | 'amber' | 'green' | 'muted';
const STAT_TONE: Record<StatTone, string> = {
  red: 'text-destructive bg-destructive/10 border-destructive/20',
  amber: 'text-warning bg-warning/10 border-warning/20',
  green: 'text-success bg-success/10 border-success/20',
  muted: 'text-muted-foreground bg-muted border-border',
};

export const LeadsIntelligencePanel: React.FC<LeadsIntelligencePanelProps> = ({ leads, onSelectLead }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  // ── client-computed signals (instant, no AI call needed) ────────────────
  const { overdueCount, hotStuckCount, actionLeads } = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const active = (l: Lead) => l.status !== 'converted' && l.status !== 'lost';

    const overdue = leads
      .filter((l) => active(l) && l.next_follow_up && isPast(new Date(l.next_follow_up)))
      .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
    const hotStuck = leads
      .filter((l) => active(l) && (l.priority_score ?? 0) >= 70 && l.status === 'contacted' && new Date(l.updated_at) < sevenDaysAgo)
      .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
    const never = leads.filter((l) => active(l) && !l.last_contacted_at);

    // Consolidated, de-duplicated, prioritised action list (hot-stuck → overdue → never).
    const seen = new Set<string>();
    const out: { lead: Lead; reason: string; sub: string; icon: React.ElementType; tone: string }[] = [];
    const push = (lead: Lead, reason: string, sub: string, icon: React.ElementType, tone: string) => {
      if (seen.has(lead.id)) return;
      seen.add(lead.id);
      out.push({ lead, reason, sub, icon, tone });
    };
    hotStuck.forEach((l) =>
      push(l, t('leads.intel.reasonHotStuck'), `${l.priority_score} · ${formatDistanceToNow(new Date(l.updated_at), { addSuffix: true })}`, Flame, 'text-warning'),
    );
    overdue.forEach((l) =>
      push(l, t('leads.intel.reasonOverdue'), l.next_follow_up ? formatDistanceToNow(new Date(l.next_follow_up), { addSuffix: true }) : '', Clock, 'text-destructive'),
    );
    never.forEach((l) =>
      push(l, t('leads.intel.reasonNever'), formatDistanceToNow(new Date(l.created_at), { addSuffix: true }), UserX, 'text-info'),
    );

    return { overdueCount: overdue.length, hotStuckCount: hotStuck.length, actionLeads: out.slice(0, 6) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  const fetchAnalysis = useCallback(async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          const age = Date.now() - new Date(parsed.generated_at).getTime();
          if (age < CACHE_TTL_MS) {
            setData(parsed);
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
        if (String(result.error).includes('Rate limit')) {
          setError(null);
          return;
        }
        throw new Error(result.error);
      }
      setData(result);
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const health: Health = data?.analysis?.overall_health ?? 'unknown';
  const answer = data?.raw_stats?.answerRateThisWeek;
  const answerLast = data?.raw_stats?.answerRateLastWeek;
  const answerTone: StatTone =
    answer == null ? 'muted' : answerLast != null && answer < answerLast - 10 ? 'red' : answer < 40 ? 'amber' : 'green';

  const stats: { label: string; value: string; sub?: string; tone: StatTone; icon: React.ElementType }[] = [
    {
      label: t('leads.intel.statOverdue'),
      value: String(overdueCount),
      tone: overdueCount > 20 ? 'red' : overdueCount > 5 ? 'amber' : 'green',
      icon: Clock,
    },
    {
      label: t('leads.intel.statAnswerRate'),
      value: answer != null ? `${answer}%` : '—',
      sub: answerLast != null ? t('leads.intel.vsLastWeek', { n: answerLast }) : undefined,
      tone: answerTone,
      icon: Phone,
    },
    {
      label: t('leads.intel.statHotStuck'),
      value: String(hotStuckCount),
      tone: hotStuckCount > 5 ? 'red' : hotStuckCount > 0 ? 'amber' : 'green',
      icon: Flame,
    },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn('border', HEALTH_BORDER[health])}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{t('leads.intel.title')}</h3>
                  {data && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', HEALTH_TONE[health])}>
                      {t(`leads.intel.health.${health}`)}
                    </span>
                  )}
                </div>
                {data?.analysis?.summary && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{data.analysis.summary}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => fetchAnalysis(true)} disabled={loading} className="h-8 gap-1.5 px-2 text-xs">
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                <span className="hidden sm:inline">{loading ? t('leads.intel.analysing') : t('leads.intel.refresh')}</span>
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* 3 key health metrics */}
            <div className="grid grid-cols-3 gap-2">
              {stats.map((s) => (
                <div key={s.label} className={cn('rounded-lg border px-3 py-2', STAT_TONE[s.tone])}>
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <s.icon className="h-3.5 w-3.5" />
                    <span className="truncate text-[11px] font-medium">{s.label}</span>
                  </div>
                  <div className="text-lg font-bold leading-tight">{s.value}</div>
                  {s.sub && <div className="mt-0.5 truncate text-[10px] opacity-70">{s.sub}</div>}
                </div>
              ))}
            </div>

            {/* Act-now list */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('leads.intel.actNow')}
              </h4>
              {loading && actionLeads.length === 0 ? (
                <div className="space-y-1.5">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                </div>
              ) : actionLeads.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {t('leads.intel.healthy')}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {actionLeads.map(({ lead, reason, sub, icon: Icon, tone }) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => onSelectLead?.(lead)}
                      className="group flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/50"
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', tone)} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{lead.full_name}</span>
                      <Badge variant="neutral" className="hidden shrink-0 sm:inline-flex">{reason}</Badge>
                      {sub && <span className="hidden shrink-0 text-[11px] text-muted-foreground md:inline">{sub}</span>}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-muted-foreground">{error}</p>}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
