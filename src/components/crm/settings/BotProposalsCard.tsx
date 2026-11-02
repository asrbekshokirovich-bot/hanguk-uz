import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtTime } from '@/lib/dailyReports';
import {
  confidencePct,
  readyForOn,
  TARGET_PRECISION,
  verdictOf,
  type ProposalRow,
  type QualityStats,
} from '@/lib/botQuality';

// RPC'lar hali generatsiya qilingan Database turlarida yo'q (migratsiya 20261103030000_staff_bot_quality.sql).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => any };

function Stat({ n, label, tone }: { n: string | number; label: string; tone?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className={`text-xl font-semibold ${tone ?? ''}`}>{n}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** AI takliflari: ro'yxat, owner bahosi, 7 kunlik aniqlik (faqat owner). */
export function BotProposalsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [stats, setStats] = useState<QualityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, st] = await Promise.all([
      sb.rpc('bot_proposals_list', { p_limit: 50 }),
      sb.rpc('bot_quality_stats', { p_days: 7 }),
    ]);
    if (list.error || st.error) {
      console.error('bot quality:', list.error?.message ?? st.error?.message);
      toast({ title: t('crm.botQuality.loadFailed'), variant: 'destructive' });
    } else {
      setRows((list.data ?? []) as ProposalRow[]);
      setStats(st.data as QualityStats);
    }
    setLoading(false);
  }, [t, toast]);

  useEffect(() => { void load(); }, [load]);

  const review = async (id: string, verdict: 'correct' | 'wrong' | null) => {
    setBusy(id);
    const { error } = await sb.rpc('bot_proposal_review', { p_id: id, p_verdict: verdict });
    setBusy(null);
    if (error) {
      toast({ title: t('crm.botQuality.saveFailed'), description: error.message, variant: 'destructive' });
      return;
    }
    void load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> {t('crm.botQuality.title')}</CardTitle>
        <CardDescription>{t('crm.botQuality.subtitle', { target: TARGET_PRECISION })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            {stats && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Stat n={stats.messages} label={t('crm.botQuality.messages')} />
                <Stat n={stats.proposals} label={t('crm.botQuality.proposals')} />
                <Stat n={stats.judged} label={t('crm.botQuality.judged')} />
                <Stat n={stats.unjudged} label={t('crm.botQuality.unjudged')} />
                <Stat
                  n={stats.precision === null ? '—' : `${stats.precision}%`}
                  label={t('crm.botQuality.precision')}
                  tone={stats.precision === null ? '' : stats.precision >= TARGET_PRECISION ? 'text-green-600' : 'text-amber-600'}
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {readyForOn(stats) ? t('crm.botQuality.ready') : t('crm.botQuality.notReady')}
            </p>

            {rows.length === 0 && <p className="text-sm text-muted-foreground">{t('crm.botQuality.empty')}</p>}
            <div className="space-y-2">
              {rows.map((p) => {
                const v = verdictOf(p);
                return (
                  <div key={p.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{p.kind === 'close' ? t('crm.botQuality.kindClose') : t('crm.botQuality.kindCreate')}</Badge>
                        <Badge variant="secondary">{t(`crm.botQuality.status_${p.status}`)}</Badge>
                        {p.confidence !== null && <span className="text-xs text-muted-foreground">{confidencePct(p.confidence)}</span>}
                        <span className="text-xs text-muted-foreground">{fmtTime(p.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant={p.review === 'correct' ? 'default' : 'outline'} disabled={busy === p.id}
                          onClick={() => review(p.id, p.review === 'correct' ? null : 'correct')} aria-label={t('crm.botQuality.correct')}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant={p.review === 'wrong' ? 'destructive' : 'outline'} disabled={busy === p.id}
                          onClick={() => review(p.id, p.review === 'wrong' ? null : 'wrong')} aria-label={t('crm.botQuality.wrong')}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-1.5">
                      <span className="font-medium">{p.assignee_name}:</span> {p.title}
                      {v && !p.review && <span className="ml-2 text-xs text-muted-foreground">({t(`crm.botQuality.auto_${v}`)})</span>}
                    </div>
                    {p.source_text && (
                      <div className="mt-1 whitespace-pre-wrap break-words rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {p.author_name}: {p.source_text}
                      </div>
                    )}
                    {p.reason && <div className="mt-1 text-xs italic text-muted-foreground">{p.reason}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
