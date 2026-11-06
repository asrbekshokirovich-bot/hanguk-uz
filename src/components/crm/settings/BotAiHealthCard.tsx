import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  errorPct,
  fmtAt,
  fmtTokens,
  fmtUsd,
  healthLevel,
  normalizeHealth,
  purposeKey,
  type AiHealth,
} from '@/lib/botAiHealth';

// RPC hali generatsiya qilingan Database turlarida yo'q (migratsiya 20261106060000_staff_bot_ai_layer.sql).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => any };

const HOURS = 24;

const LEVEL_TONE = { ok: 'text-green-600', warn: 'text-amber-600', bad: 'text-red-600', idle: '' } as const;

function Stat({ n, label, tone }: { n: string | number; label: string; tone?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className={`text-xl font-semibold tabular-nums ${tone ?? ''}`}>{n}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** Xodim boti AI holati (faqat owner): 24 soatlik chaqiruvlar, xatolar, vaqt, token, narx va navbat. */
export function BotAiHealthCard() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<AiHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: d, error } = await sb.rpc('bot_ai_health', { p_hours: HOURS });
    if (error) {
      console.error('bot_ai_health:', error.message);
      setFailed(true);
    } else {
      setFailed(false);
      setData(normalizeHealth(d));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const level = healthLevel(data);
  const pct = data ? errorPct(data.calls, data.errors) : null;
  const usd = (v: number | null) => (v === null ? '—' : fmtUsd(v, i18n.language));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> {t('crm.botAiHealth.title')}</CardTitle>
            <CardDescription>{t('crm.botAiHealth.subtitle', { hours: HOURS })}</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} aria-label={t('crm.botAiHealth.refresh')}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {failed && <p className="text-sm text-destructive">{t('crm.botAiHealth.loadFailed')}</p>}
        {!data && loading && <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={level === 'bad' ? 'destructive' : level === 'ok' ? 'default' : 'secondary'}>
                {t(`crm.botAiHealth.level_${level}`)}
              </Badge>
              <Badge variant={data.jobs.pending ? 'secondary' : 'outline'}>{t('crm.botAiHealth.pending', { n: data.jobs.pending })}</Badge>
              <Badge variant={data.jobs.failed ? 'destructive' : 'outline'}>{t('crm.botAiHealth.failedJobs', { n: data.jobs.failed })}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat n={data.calls} label={t('crm.botAiHealth.calls')} />
              <Stat n={data.errors} label={t('crm.botAiHealth.errors')} tone={data.errors ? LEVEL_TONE[level] : ''} />
              <Stat n={pct === null ? '—' : `${pct}%`} label={t('crm.botAiHealth.errorRate')} tone={LEVEL_TONE[level]} />
              <Stat n={data.avg_ms === null ? '—' : t('crm.botAiHealth.ms', { n: data.avg_ms })} label={t('crm.botAiHealth.avgMs')} />
              <Stat n={usd(data.cost_usd)} label={t('crm.botAiHealth.cost')} />
            </div>

            {data.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('crm.botAiHealth.empty')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('crm.botAiHealth.colPurpose')}</TableHead>
                    <TableHead>{t('crm.botAiHealth.colProvider')}</TableHead>
                    <TableHead className="text-right">{t('crm.botAiHealth.calls')}</TableHead>
                    <TableHead className="text-right">{t('crm.botAiHealth.errors')}</TableHead>
                    <TableHead className="text-right">{t('crm.botAiHealth.avgMs')}</TableHead>
                    <TableHead className="text-right">{t('crm.botAiHealth.colTokens')}</TableHead>
                    <TableHead className="text-right">{t('crm.botAiHealth.cost')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => {
                    const key = purposeKey(r.purpose);
                    return (
                      <TableRow key={`${r.purpose}:${r.provider}`}>
                        <TableCell>{key ? t(key) : r.purpose}</TableCell>
                        <TableCell className="capitalize">{r.provider}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.calls}</TableCell>
                        <TableCell className={`text-right tabular-nums ${r.errors ? 'text-red-600' : ''}`}>{r.errors}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.avg_ms === null ? '—' : t('crm.botAiHealth.ms', { n: r.avg_ms })}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtTokens(r.input_tokens)} / {fmtTokens(r.output_tokens)}</TableCell>
                        <TableCell className="text-right tabular-nums">{usd(r.cost_usd)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {data.last_error && (
              <p className="break-words text-xs text-muted-foreground">
                {t('crm.botAiHealth.lastError', { time: fmtAt(data.last_error.at) })}: {data.last_error.provider} {data.last_error.status ?? '—'} — {data.last_error.error ?? '—'}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{t('crm.botAiHealth.note')}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
