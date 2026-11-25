import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { IshCard, IshFreeDay, IshMonthlyHire, IshPaymentDetails, IshTopup } from '@/lib/ish/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ishErrorText, ishKeys, useIshApi } from './context';
import { won } from './IshMonthly';

const METHODS = ['bank', 'kakaopay', 'toss', 'note'] as const;

/**
 * «Puyl va bo'sh kunlar»: the nightly work of one person.
 * 1. Free days: who posted which days and where → find jobs → send offers.
 * 2. Top-ups: money came → approve (the puyl go to the worker).
 * 3. Where workers send the money.
 * 4. Long-term hires: the ₩50,000 fee after two weeks.
 * 5. Yellow and red cards (no-shows, cancelled bookings).
 * 6. Puyl sold and spent by day.
 */
export function IshPyol() {
  return (
    <div className="space-y-4">
      <FreeDays />
      <Topups />
      <PaymentSettings />
      <Hires />
      <Cards />
      <Report />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function FreeDays() {
  const { t } = useTranslation();
  const api = useIshApi();
  const days = useQuery({ queryKey: ishKeys.freeDays, queryFn: () => api.freeDays(7) });
  const [picked, setPicked] = useState<IshFreeDay | null>(null);
  const workers = useQuery({
    queryKey: ishKeys.freeWorkers(picked?.day ?? '', picked?.district ?? ''),
    queryFn: () => api.freeWorkers(picked!.day, picked!.district),
    enabled: picked !== null,
  });
  const part = (p: string) => t(`ish.pyol.part.${p}`);
  return (
    <Section title={t('ish.pyol.freeDays')}>
      <p className="text-sm text-muted-foreground">{t('ish.pyol.freeDaysHint')}</p>
      {days.isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : days.isError ? (
        <p className="text-sm text-destructive">{ishErrorText(t, days.error)}</p>
      ) : (days.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('ish.pyol.freeDaysEmpty')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(days.data ?? []).map((d) => (
            <Button
              key={`${d.day}-${d.district}-${d.part}`}
              variant={picked?.day === d.day && picked.district === d.district ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPicked(d)}
              data-testid={`ish-free-${d.day}-${d.district}`}
            >
              {d.day} · {d.district} · {part(d.part)} · {t('ish.pyol.workers', { count: d.workers })}
            </Button>
          ))}
        </div>
      )}
      {picked && (
        <div className="space-y-1 border-t pt-3">
          {workers.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            (workers.data ?? []).map((w) => (
              <div key={w.worker_id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">
                  {w.first_name} {w.last_name}
                </span>
                <span className="text-muted-foreground">{w.phone ?? '—'}</span>
                <span>{w.district}</span>
                <span>{part(w.part)}</span>
                <span>{t('ish.pyol.balance', { n: w.coins })}</span>
                {w.card && w.card !== 'none' && (
                  <Badge variant={w.card === 'yellow' ? 'secondary' : 'destructive'}>
                    {t(`ish.pyol.card.level.${w.card}`)}
                  </Badge>
                )}
                {w.busy && <Badge variant="secondary">{t('ish.pyol.busy')}</Badge>}
                {w.note && <span className="text-muted-foreground">«{w.note}»</span>}
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground">{t('ish.pyol.sendHint')}</p>
        </div>
      )}
    </Section>
  );
}

function Topups() {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ishKeys.topups, queryFn: () => api.topups('pending') });
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ishKeys.topups });
    void queryClient.invalidateQueries({ queryKey: ishKeys.pyolReport });
  };
  const approve = useMutation({
    mutationFn: (id: string) => api.approveTopup(id),
    onSuccess: () => {
      toast.success(t('ish.pyol.approved'));
      done();
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectTopup(id, ''),
    onSuccess: done,
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  const busy = approve.isPending || reject.isPending;
  return (
    <Section title={t('ish.pyol.topups')}>
      <p className="text-sm text-muted-foreground">{t('ish.pyol.topupsHint')}</p>
      {list.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (list.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('ish.pyol.topupsEmpty')}</p>
      ) : (
        (list.data ?? []).map((r: IshTopup) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm" data-testid={`ish-topup-${r.id}`}>
            <span className="font-medium">
              {r.first_name} {r.last_name}
            </span>
            <span className="text-muted-foreground">{r.phone ?? '—'}</span>
            <span>
              {r.pyols} P · {won(r.amount_won)} · {t(`ish.pyol.method.${r.method}`)}
            </span>
            {r.payer_name && <span>«{r.payer_name}»</span>}
            <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            <Button size="sm" disabled={busy} onClick={() => approve.mutate(r.id)}>
              {t('ish.pyol.approve')}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => reject.mutate(r.id)}>
              {t('ish.pyol.reject')}
            </Button>
          </div>
        ))
      )}
    </Section>
  );
}

function PaymentSettings() {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const details = useQuery({ queryKey: ishKeys.payment, queryFn: api.paymentDetails });
  const [form, setForm] = useState<IshPaymentDetails['methods']>({});
  useEffect(() => {
    if (details.data) setForm(details.data.methods ?? {});
  }, [details.data]);
  const save = useMutation({
    mutationFn: async () => {
      for (const key of METHODS) {
        if ((form[key] ?? '') !== (details.data?.methods?.[key] ?? '')) await api.setPaymentSetting(key, form[key] ?? '');
      }
    },
    onSuccess: () => {
      toast.success(t('ish.saved'));
      void queryClient.invalidateQueries({ queryKey: ishKeys.payment });
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  return (
    <Section title={t('ish.pyol.payment')}>
      <p className="text-sm text-muted-foreground">
        {(details.data?.packs ?? []).map((p) => `${p.pyols} P = ${won(p.won)}`).join(' · ')}
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {METHODS.map((key) => (
          <label key={key} className="space-y-1 text-sm">
            <span>{t(`ish.pyol.method.${key}`)}</span>
            <Input
              value={form[key] ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              maxLength={500}
              aria-label={t(`ish.pyol.method.${key}`)}
            />
          </label>
        ))}
      </div>
      <Button size="sm" disabled={save.isPending || !details.data} onClick={() => save.mutate()}>
        {t('ish.pyol.save')}
      </Button>
    </Section>
  );
}

function Hires() {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const hires = useQuery({ queryKey: ishKeys.hires, queryFn: api.monthlyHires });
  const interest = useQuery({ queryKey: ishKeys.monthlyInterest, queryFn: () => api.monthlyInterest() });
  const jobs = useQuery({ queryKey: ishKeys.monthly, queryFn: api.monthlyJobs });
  const done = () => void queryClient.invalidateQueries({ queryKey: ishKeys.hires });
  const onError = (e: unknown) => toast.error(ishErrorText(t, e));
  const hire = useMutation({
    mutationFn: ({ job, worker }: { job: string; worker: string }) => api.markHired(job, worker),
    onSuccess: done,
    onError,
  });
  const check = useMutation({
    mutationFn: ({ id, still }: { id: string; still: boolean }) => api.confirmTwoWeeks(id, still),
    onSuccess: done,
    onError,
  });
  const paid = useMutation({ mutationFn: (id: string) => api.markFeePaid(id), onSuccess: done, onError });
  const hiredPairs = new Set((hires.data ?? []).map((h) => `${h.job_id}:${h.worker_id}`));
  const jobTitle = (id: string) => (jobs.data ?? []).find((j) => j.id === id)?.title ?? id;
  return (
    <Section title={t('ish.pyol.hires')}>
      <p className="text-sm text-muted-foreground">{t('ish.pyol.hiresHint')}</p>
      {(hires.data ?? []).map((h: IshMonthlyHire) => (
        <div key={h.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">
            {h.first_name} {h.last_name}
          </span>
          <span>
            {h.title} · {h.company}
          </span>
          <span className="text-muted-foreground">
            {h.hired_at} → {h.check_due}
          </span>
          <Badge variant={h.state === 'fee_unpaid' || h.state === 'check_due' ? 'destructive' : 'secondary'}>
            {t(`ish.pyol.state.${h.state}`)}
          </Badge>
          {h.state === 'check_due' && (
            <>
              <Button size="sm" onClick={() => check.mutate({ id: h.id, still: true })}>
                {t('ish.pyol.stillWorking')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => check.mutate({ id: h.id, still: false })}>
                {t('ish.pyol.left')}
              </Button>
            </>
          )}
          {h.state === 'fee_unpaid' && (
            <Button size="sm" onClick={() => paid.mutate(h.id)}>
              {t('ish.pyol.feePaid', { fee: won(h.fee_won) })}
            </Button>
          )}
        </div>
      ))}
      <div className="space-y-1 border-t pt-3">
        <p className="text-sm font-medium">{t('ish.pyol.interested')}</p>
        {(interest.data ?? [])
          .filter((i) => !hiredPairs.has(`${i.job_id}:${i.worker_id}`))
          .map((i) => (
            <div key={`${i.job_id}:${i.worker_id}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {i.first_name} {i.last_name}
              </span>
              <span className="text-muted-foreground">{i.phone ?? '—'}</span>
              <span>{jobTitle(i.job_id)}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={hire.isPending}
                onClick={() => hire.mutate({ job: i.job_id, worker: i.worker_id })}
              >
                {t('ish.pyol.markHired')}
              </Button>
            </div>
          ))}
      </div>
    </Section>
  );
}

function Cards() {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const cards = useQuery({ queryKey: ishKeys.cards, queryFn: api.cards });
  const businesses = useQuery({ queryKey: ishKeys.businesses, queryFn: api.businesses });
  const [business, setBusiness] = useState('');
  const [note, setNote] = useState('');
  const done = () => void queryClient.invalidateQueries({ queryKey: ishKeys.cards });
  const onError = (e: unknown) => toast.error(ishErrorText(t, e));
  const clear = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => api.clearCard(id, why),
    onSuccess: done,
    onError,
  });
  const give = useMutation({
    mutationFn: () => api.giveBusinessCard(business, note),
    onSuccess: () => {
      setNote('');
      done();
    },
    onError,
  });
  const onClear = (c: IshCard) => {
    const why = window.prompt(t('ish.pyol.card.clearAsk'));
    if (why && why.trim() !== '') clear.mutate({ id: c.subject_id, why });
  };
  return (
    <Section title={t('ish.pyol.card.cards')}>
      <p className="text-sm text-muted-foreground">{t('ish.pyol.card.cardsHint')}</p>
      {cards.isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : (cards.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('ish.pyol.card.cardsEmpty')}</p>
      ) : (
        (cards.data ?? []).map((c) => (
          <div key={c.subject_id} className="flex flex-wrap items-center gap-2 text-sm" data-testid={`ish-card-${c.subject_id}`}>
            <Badge variant={c.level === 'yellow' ? 'secondary' : 'destructive'}>{t(`ish.pyol.card.level.${c.level}`)}</Badge>
            <span className="font-medium">{c.name || '—'}</span>
            <span className="text-muted-foreground">{t(`ish.pyol.card.${c.subject}`)}</span>
            {c.phone && <span className="text-muted-foreground">{c.phone}</span>}
            {c.last_why && <span>{t(`ish.pyol.card.why.${c.last_why}`)}</span>}
            {c.red_until && <span>{t('ish.pyol.card.until', { date: new Date(c.red_until).toLocaleDateString() })}</span>}
            {c.subject === 'worker' && c.level !== 'blocked' && (
              <span className="text-muted-foreground">{t('ish.pyol.card.goodJobs', { n: c.good_jobs })}</span>
            )}
            <Button size="sm" variant="outline" disabled={clear.isPending} onClick={() => onClear(c)}>
              {t('ish.pyol.card.clear')}
            </Button>
          </div>
        ))
      )}
      <div className="space-y-2 border-t pt-3">
        <p className="text-sm font-medium">{t('ish.pyol.card.giveTitle')}</p>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            aria-label={t('ish.pyol.card.pickBusiness')}
          >
            <option value="">{t('ish.pyol.card.pickBusiness')}</option>
            {(businesses.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Input
            className="max-w-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('ish.pyol.card.giveNote')}
            aria-label={t('ish.pyol.card.giveNote')}
            maxLength={300}
          />
          <Button
            size="sm"
            disabled={give.isPending || business === '' || note.trim() === ''}
            onClick={() => give.mutate()}
          >
            {t('ish.pyol.card.give')}
          </Button>
        </div>
      </div>
    </Section>
  );
}

function Report() {
  const { t } = useTranslation();
  const api = useIshApi();
  const report = useQuery({ queryKey: ishKeys.pyolReport, queryFn: () => api.pyolReport(30) });
  const rows = report.data ?? [];
  const sum = (k: 'sold' | 'sold_won' | 'spent' | 'free' | 'refunded') => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  return (
    <Section title={t('ish.pyol.report')}>
      <p className="text-sm" data-testid="ish-pyol-total">
        {t('ish.pyol.reportTotal', {
          sold: sum('sold'),
          won: won(sum('sold_won')),
          spent: sum('spent'),
          free: sum('free'),
          refunded: sum('refunded'),
        })}
      </p>
      <div className="max-h-60 overflow-y-auto text-xs">
        {rows.map((r) => (
          <div key={r.day} className="flex gap-3">
            <span className="w-24">{r.day}</span>
            <span>+{r.sold ?? 0}</span>
            <span>{won(r.sold_won ?? 0)}</span>
            <span>−{r.spent ?? 0}</span>
            <span>🎁 {r.free ?? 0}</span>
            <span>↩ {r.refunded ?? 0}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
