import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Power, Clock, AlertTriangle, CheckCircle2, Loader2, RefreshCw, PauseCircle } from 'lucide-react';
import { useAiCrawlConfig, useUpdateAiCrawlConfig, useRecentCrawlRuns } from '@/hooks/useAiCrawlConfig';

function fmtDateTime(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AiCrawlMonitorContent() {
  const { data: config, isLoading } = useAiCrawlConfig();
  const { data: runs } = useRecentCrawlRuns(10);
  const updateConfig = useUpdateAiCrawlConfig();

  const [interval, setIntervalH] = useState('6');
  const [batch, setBatch] = useState('5');

  useEffect(() => {
    if (config) {
      setIntervalH(String(config.interval_hours));
      setBatch(String(config.batch_size));
    }
  }, [config]);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-60 w-full" /></div>;
  }

  const enabled = config?.enabled ?? false;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5" /> AI Crawling — Monitoring
        </h2>
        <p className="text-sm text-muted-foreground">
          Universitet saytlaridan avtomatik ma'lumot yig'ish tizimi. Hozircha sinov bosqichida.
        </p>
      </div>

      {/* Status banner */}
      <Card className={enabled ? 'border-success/40' : 'border-warning/40'}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {enabled ? (
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <Power className="h-5 w-5 text-success" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                <PauseCircle className="h-5 w-5 text-warning" />
              </div>
            )}
            <div>
              <p className="font-medium">{enabled ? 'YOQILGAN' : 'O\'CHIQ (xavfsiz holat)'}</p>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? `Har ${config?.interval_hours} soatda ${config?.batch_size} ta universitet tekshiriladi`
                  : 'Avtomatik so\'rov yuborilmaydi, xarajat yo\'q'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="crawl-enabled" className="text-sm">{enabled ? 'Yoniq' : 'O\'chiq'}</Label>
            <Switch
              id="crawl-enabled"
              checked={enabled}
              disabled={updateConfig.isPending}
              onCheckedChange={(v) => updateConfig.mutate({ enabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      {!enabled && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Tizim tayyor, lekin o'chiq.</p>
            <p className="text-muted-foreground mt-0.5">
              Yoqishdan oldin <code>ANTHROPIC_API_KEY</code> sozlanishi va scheduler (pg_cron) ulanishi kerak.
              Yoqilganda har bir tekshiruv staff tasdig'i uchun navbatga tushadi — to'g'ridan-to'g'ri saytga yozilmaydi.
            </p>
          </div>
        </div>
      )}

      {/* Config */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Sozlamalar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <Label className="text-xs">Interval (necha soatda)</Label>
              <Select value={interval} onValueChange={(v) => { setIntervalH(v); updateConfig.mutate({ interval_hours: Number(v) }); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Har 6 soatda</SelectItem>
                  <SelectItem value="12">Har 12 soatda</SelectItem>
                  <SelectItem value="24">Har 24 soatda</SelectItem>
                  <SelectItem value="72">Har 3 kunda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Bir martada (universitet)</Label>
              <Select value={batch} onValueChange={(v) => { setBatch(v); updateConfig.mutate({ batch_size: Number(v) }); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 ta</SelectItem>
                  <SelectItem value="5">5 ta</SelectItem>
                  <SelectItem value="10">10 ta</SelectItem>
                  <SelectItem value="20">20 ta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-md text-xs text-muted-foreground">
            <div>Model: <span className="font-mono">{config?.model}</span></div>
            <div>Auto-tasdiq chegarasi: {config ? Math.round(config.auto_approve_threshold * 100) : 90}%</div>
            <div>Oxirgi ishga tushish: {fmtDateTime(config?.last_run_at ?? null)}</div>
            <div>Holat: {config?.last_run_status ?? '—'}</div>
          </div>
        </CardContent>
      </Card>

      {/* Recent runs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Oxirgi tekshiruvlar</CardTitle>
        </CardHeader>
        <CardContent>
          {runs && runs.length > 0 ? (
            <div className="space-y-1.5">
              {runs.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-border/60 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    {r.status === 'succeeded' ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      : r.status === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    <span>{fmtDateTime(r.started_at)}</span>
                    <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {r.records_new != null ? `${r.records_new} yangi / ${r.records_seen ?? 0} ko'rildi` : (r.error_text ? 'xato' : '—')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">Hali tekshiruvlar yo'q.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
