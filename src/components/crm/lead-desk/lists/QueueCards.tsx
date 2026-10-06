import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchQueueSummary, startQueue } from '../api';
import { shortDate } from '../time';
import { useLeadSettings } from '../useLeadSettings';
import ConfirmDialog from './ConfirmDialog';
import { daysToDrain, explainLeadError, queueKeys, queueLabel, QUEUE_RULES } from './labels';

/**
 * "Navbatlar" tab (spec §3.4): one card per reactivation queue with its count,
 * the rule and the offer, and the senior's "Navbatni boshlash".
 */
export default function QueueCards() {
  const qc = useQueryClient();
  const { isLeadSenior } = useUserRole();
  const { settings } = useLeadSettings();
  const summary = useQuery({ queryKey: ['lead-v2', 'queues'], queryFn: fetchQueueSummary });

  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limit = settings.queue_daily_limit;
  const byKey = useMemo(() => new Map((summary.data ?? []).map((s) => [s.queue_key, s])), [summary.data]);
  const keys = useMemo(() => queueKeys(summary.data ?? []), [summary.data]);

  const target = confirmKey ? byKey.get(confirmKey) : undefined;

  const start = async () => {
    if (!confirmKey) return;
    setBusy(true);
    setError(null);
    try {
      const n = await startQueue(confirmKey);
      toast.success(`${queueLabel(confirmKey)}: ${n ?? 0} ta lid navbatga qo'yildi`);
      setConfirmKey(null);
      await qc.invalidateQueries({ queryKey: ['lead-v2', 'queues'] });
    } catch (e) {
      setError(explainLeadError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="rounded-md border bg-muted/40 px-3 py-2 text-[13px]">
        Navbat boshlanganda lidlar BUGUN'ga kuniga <strong>{limit}</strong> tadan tushadi — har biri «qayta faollashtirish» belgisi va ruxsat
        etilgan taklif bilan. Limitni Sozlamalarda o'zgartirish mumkin.
      </p>

      {summary.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : summary.error ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          <p className="text-sm font-medium">Navbatlarni yuklab bo'lmadi</p>
          <p className="text-[13px] text-muted-foreground">{explainLeadError(summary.error)}</p>
          <Button size="sm" variant="outline" onClick={() => void summary.refetch()}>
            Qayta urinish
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {keys.map((key) => {
            const s = byKey.get(key);
            const waiting = s?.waiting ?? 0;
            const ready = s?.ready ?? 0;
            const due = s?.due ?? 0;
            const rule = QUEUE_RULES[key];
            return (
              <section
                key={key}
                aria-label={queueLabel(key)}
                data-testid={`queue-${key}`}
                className="flex flex-col gap-2 rounded-md border bg-background p-3"
              >
                <header className="flex items-start justify-between gap-2">
                  <h3 className="text-[13px] font-semibold leading-snug">{queueLabel(key)}</h3>
                  <div className="text-right">
                    <div className="text-2xl font-semibold leading-none tabular-nums" aria-label={`Navbatda ${waiting + ready} ta`}>
                      {waiting + ready}
                    </div>
                    <div className="text-[11px] text-muted-foreground">ta lid</div>
                  </div>
                </header>

                <dl className="grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <dt className="text-muted-foreground">Muddati kelgan</dt>
                    <dd className="font-medium tabular-nums">{due}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Kutmoqda</dt>
                    <dd className="font-medium tabular-nums">{waiting}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Boshlangan</dt>
                    <dd className="font-medium tabular-nums">{ready}</dd>
                  </div>
                </dl>

                {rule && (
                  <div className="space-y-0.5 text-[12px]">
                    <p>
                      <span className="text-muted-foreground">Qachon: </span>
                      {rule.when}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Taklif: </span>
                      {rule.offer}
                    </p>
                  </div>
                )}

                {key === 'hanbox' && (
                  <p className="text-[12px] text-muted-foreground">
                    Guruh sanasi: {settings.hanbox_group_date ? shortDate(`${settings.hanbox_group_date}T00:00:00+05:00`) : '—'} ·{' '}
                    {settings.hanbox_announced ? "e'lon qilingan" : "e'lon qilinmagan"}
                  </p>
                )}
                {key === 'no_risk' && !settings.no_risk_announced && (
                  <p className="flex items-start gap-1 text-[12px] text-warning">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    NO RISK sharti hali e'lon qilinmagan — server navbatni boshlashga ruxsat bermaydi (Sozlamalar).
                  </p>
                )}

                {isLeadSenior ? (
                  <Button
                    size="sm"
                    className="mt-auto self-start"
                    disabled={waiting === 0}
                    title={waiting === 0 ? "Boshlanadigan (kutayotgan) lid yo'q" : undefined}
                    onClick={() => {
                      setError(null);
                      setConfirmKey(key);
                    }}
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Navbatni boshlash
                  </Button>
                ) : (
                  <p className="mt-auto text-[11px] text-muted-foreground">Navbatni senior yoki rahbar boshlaydi.</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmKey != null}
        title={confirmKey ? `${queueLabel(confirmKey)} — navbatni boshlash` : 'Navbatni boshlash'}
        description={
          target ? (
            <>
              {target.waiting} ta kutayotgan lid navbatga qo'yiladi. Ular BUGUN'ga kuniga {limit} tadan tushadi
              {limit > 0 ? ` (taxminan ${daysToDrain(target.waiting, limit)} kun)` : ''}. Davom etasizmi?
            </>
          ) : (
            'Davom etasizmi?'
          )
        }
        confirmLabel="Boshlash"
        busy={busy}
        error={error}
        onConfirm={() => void start()}
        onCancel={() => setConfirmKey(null)}
      />
    </div>
  );
}
