import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, ListTodo, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fmtTime,
  isLate,
  isWorkday,
  reportStats,
  shiftDate,
  sortReports,
  tashkentDate,
  type DailyReportRow,
} from '@/lib/dailyReports';

// crm_daily_reports hali generatsiya qilingan Database turlarida yo'q
// (migratsiya 20261102170000_crm_daily_reports.sql).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => any };

function Section({ icon, label, text, tone }: { icon: React.ReactNode; label: string; text: string; tone?: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className={`mt-0.5 shrink-0 ${tone ?? 'text-muted-foreground'}`}>{icon}</span>
      <div className="min-w-0">
        <span className="font-medium">{label}: </span>
        <span className="whitespace-pre-wrap break-words">{text}</span>
      </div>
    </div>
  );
}

/** Kunlik hisobotlar: xodim boti orqali 17:00 da topshirilgan hisobotlar, kun bo'yicha. */
export default function DailyReportsContent() {
  const { t } = useTranslation();
  const today = tashkentDate();
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<DailyReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await sb.rpc('crm_daily_reports', { p_date: d });
    if (err) {
      console.error('crm_daily_reports:', err.message);
      setError(t('crm.dailyReports.loadFailed'));
      setRows([]);
    } else {
      setRows((data ?? []) as DailyReportRow[]);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { void load(date); }, [date, load]);

  const sorted = useMemo(() => sortReports(rows), [rows]);
  const stats = useMemo(() => reportStats(rows), [rows]);
  const blockers = useMemo(() => rows.filter((r) => r.blockers), [rows]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('crm.dailyReports.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('crm.dailyReports.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, -1))} aria-label={t('crm.dailyReports.prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-[160px]"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={date >= today}
            aria-label={t('crm.dailyReports.next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {date !== today && (
            <Button variant="ghost" onClick={() => setDate(today)}>{t('crm.dailyReports.today')}</Button>
          )}
        </div>
      </div>

      {!isWorkday(date) && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" /> {t('crm.dailyReports.dayOff')}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">{t('crm.dailyReports.submitted')}</div>
          <div className="text-2xl font-semibold">{loading ? '—' : `${stats.submitted} / ${stats.total}`}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">{t('crm.dailyReports.missing')}</div>
          <div className="text-2xl font-semibold">{loading ? '—' : stats.missing}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">{t('crm.dailyReports.blockers')}</div>
          <div className="text-2xl font-semibold">{loading ? '—' : stats.blockers}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">{t('crm.dailyReports.tasksDone')}</div>
          <div className="text-2xl font-semibold">{loading ? '—' : rows.reduce((s, r) => s + r.completed_count, 0)}</div>
        </CardContent></Card>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && blockers.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> {t('crm.dailyReports.blockersTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {blockers.map((r) => (
              <div key={r.user_id}><span className="font-medium">{r.full_name}:</span> {r.blockers}</div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        {!loading && sorted.map((r) => (
          <Card key={r.user_id} className={r.report_id ? '' : 'opacity-80'}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {r.report_id
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <XCircle className="h-4 w-4 text-muted-foreground" />}
                {r.full_name}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                {r.completed_count > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <ListTodo className="h-3 w-3" /> {t('crm.dailyReports.tasksCount', { count: r.completed_count })}
                  </Badge>
                )}
                {r.report_id && (
                  <Badge variant={isLate(r.submitted_at) ? 'destructive' : 'outline'} className="gap-1">
                    <Clock className="h-3 w-3" /> {fmtTime(r.submitted_at)}
                  </Badge>
                )}
                {!r.is_linked && <Badge variant="outline">{t('crm.dailyReports.notLinked')}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {!r.report_id && <p className="text-sm text-muted-foreground">{t('crm.dailyReports.noReport')}</p>}
              {r.report_id && (r.done || r.blockers || r.plan) ? (
                <>
                  {r.done && <Section icon={<CheckCircle2 className="h-4 w-4" />} tone="text-green-600" label={t('crm.dailyReports.done')} text={r.done} />}
                  {r.blockers && <Section icon={<AlertTriangle className="h-4 w-4" />} tone="text-amber-600" label={t('crm.dailyReports.blocker')} text={r.blockers} />}
                  {r.plan && <Section icon={<CalendarDays className="h-4 w-4" />} label={t('crm.dailyReports.plan')} text={r.plan} />}
                  <details className="pt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">{t('crm.dailyReports.original')}</summary>
                    <p className="mt-1 whitespace-pre-wrap break-words">{r.raw_text}</p>
                  </details>
                </>
              ) : r.report_id ? (
                <p className="whitespace-pre-wrap break-words text-sm">{r.raw_text}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
