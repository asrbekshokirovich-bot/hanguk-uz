import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { IshMonthlyInterest, IshMonthlyJob, IshMonthlyJobInput } from '@/lib/ish/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ishErrorText, ishKeys, useIshApi } from './context';
import { Field, parsePoint } from './IshEmployers';

const CATEGORIES = ['cafe', 'restaurant', 'retail', 'logistics', 'event', 'office', 'other'] as const;
const TRANSLATION_LANGS = ['uz', 'ru', 'en'] as const;
const NONE = '__none__';

function toInput(job: IshMonthlyJob | null): IshMonthlyJobInput {
  return {
    id: job?.id ?? null,
    title: job?.title ?? '',
    company: job?.company ?? '',
    area: job?.area ?? '',
    address: job?.address ?? '',
    lat: job?.lat ?? null,
    lng: job?.lng ?? null,
    monthlyWage: job?.monthly_wage ?? 0,
    daysPerWeek: job?.days_per_week ?? 5,
    hoursPerDay: job?.hours_per_day ?? 8,
    description: job?.description ?? '',
    category: job?.category ?? null,
    workTime: job?.work_time ?? null,
    contactPhone: job?.contact_phone ?? '',
    translations: job?.translations ?? {},
  };
}

/** «2 300 000 ₩». */
export function won(amount: number): string {
  return `${amount.toLocaleString('en-US').replace(/,/g, ' ')} ₩`;
}

/**
 * «Oylik ishlar»: jobs paid by the month. The staff post them here (a café
 * hire, a warehouse job found outside the app); workers see the open ones in
 * the app's «Oylik ishlar» and say «Qiziqaman» — the staff then call both
 * sides, using the list of who is interested.
 */
export function IshMonthly() {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const jobs = useQuery({ queryKey: ishKeys.monthly, queryFn: api.monthlyJobs });
  const interest = useQuery({ queryKey: ishKeys.monthlyInterest, queryFn: () => api.monthlyInterest() });
  const [editing, setEditing] = useState<IshMonthlyJob | null | 'new'>(null);
  const [viewing, setViewing] = useState<IshMonthlyJob | null>(null);

  const counts = useMemo(() => {
    const byJob = new Map<string, number>();
    for (const i of interest.data ?? []) byJob.set(i.job_id, (byJob.get(i.job_id) ?? 0) + 1);
    return byJob;
  }, [interest.data]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ishKeys.monthly });
  const toggle = useMutation({
    mutationFn: (j: IshMonthlyJob) => api.setMonthlyJobStatus(j.id, j.status === 'open' ? 'closed' : 'open'),
    onSuccess: refresh,
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  const remove = useMutation({
    mutationFn: (j: IshMonthlyJob) => api.deleteMonthlyJob(j.id),
    onSuccess: () => {
      refresh();
      toast.success(t('ish.monthly.deleted'));
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });

  if (jobs.isLoading) return <Skeleton className="h-40 w-full" />;
  if (jobs.isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">{ishErrorText(t, jobs.error)}</CardContent>
      </Card>
    );
  }
  const list = jobs.data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">{t('ish.monthly.intro')}</p>
        <Button onClick={() => setEditing('new')} data-testid="ish-monthly-new">
          <Plus className="mr-2 h-4 w-4" />
          {t('ish.monthly.new')}
        </Button>
      </div>
      {list.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{t('ish.monthly.empty')}</CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ish.monthly.job')}</TableHead>
                <TableHead>{t('ish.monthly.pay')}</TableHead>
                <TableHead>{t('ish.monthly.schedule')}</TableHead>
                <TableHead>{t('ish.monthly.interested')}</TableHead>
                <TableHead>{t('ish.monthly.status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((j) => (
                <TableRow key={j.id} data-testid={`ish-monthly-${j.id}`} className={j.status === 'closed' ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="font-medium">{j.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {j.company}
                      {j.area ? ` · ${j.area}` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{won(j.monthly_wage)}</TableCell>
                  <TableCell className="text-sm">
                    {j.days_per_week ? t('ish.monthly.daysHours', { days: j.days_per_week, hours: j.hours_per_day ?? '–' }) : '–'}
                    {j.work_time ? ` · ${t(`ish.monthly.workTimes.${j.work_time}`)}` : ''}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setViewing(j)} disabled={!counts.get(j.id)}>
                      <Users className="mr-1.5 h-4 w-4" />
                      {counts.get(j.id) ?? 0}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={j.status === 'open' ? 'default' : 'secondary'}>{t(`ish.monthly.statuses.${j.status}`)}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="icon" aria-label={t('ish.monthly.edit')} onClick={() => setEditing(j)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggle.mutate(j)} disabled={toggle.isPending}>
                      {j.status === 'open' ? t('ish.monthly.close') : t('ish.monthly.reopen')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('ish.monthly.delete')}
                      onClick={() => {
                        if (window.confirm(t('ish.monthly.deleteAsk', { title: j.title }))) remove.mutate(j);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {editing !== null && (
        <IshMonthlyDialog
          key={editing === 'new' ? 'new' : editing.id}
          job={editing === 'new' ? null : editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {viewing && (
        <InterestDialog job={viewing} people={(interest.data ?? []).filter((i) => i.job_id === viewing.id)} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

/** A monthly job: what workers see (Korean, with optional translations), and its pay. */
export function IshMonthlyDialog({
  job,
  open,
  onOpenChange,
  onSaved,
}: {
  job: IshMonthlyJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const api = useIshApi();
  const [form, setForm] = useState<IshMonthlyJobInput>(() => toInput(job));
  const [wage, setWage] = useState(job ? String(job.monthly_wage) : '');
  const [point, setPoint] = useState(job?.lat != null && job?.lng != null ? `${job.lat}, ${job.lng}` : '');
  const parsedPoint = parsePoint(point);
  const pointBad = point.trim() !== '' && parsedPoint === null;
  const set = <K extends keyof IshMonthlyJobInput>(k: K, v: IshMonthlyJobInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setTranslation = (lang: string, key: 'title' | 'company' | 'description', value: string) =>
    setForm((f) => ({ ...f, translations: { ...f.translations, [lang]: { ...f.translations[lang], [key]: value } } }));
  const wageNumber = Number(wage.replace(/\D/g, ''));

  const save = useMutation({
    mutationFn: () => {
      // Empty translations are left out, so the app falls back to the Korean text.
      const translations: IshMonthlyJobInput['translations'] = {};
      for (const [lang, texts] of Object.entries(form.translations)) {
        const kept = Object.fromEntries(Object.entries(texts ?? {}).filter(([, v]) => (v ?? '').trim() !== ''));
        if (Object.keys(kept).length > 0) translations[lang] = kept;
      }
      return api.saveMonthlyJob({
        ...form,
        monthlyWage: wageNumber,
        lat: parsedPoint?.lat ?? null,
        lng: parsedPoint?.lng ?? null,
        translations,
      });
    },
    onSuccess: () => {
      toast.success(t('ish.saved'));
      onSaved();
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  const valid = form.title.trim() !== '' && form.company.trim() !== '' && wageNumber > 0 && !pointBad;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{job ? t('ish.monthly.edit') : t('ish.monthly.new')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ish-m-title" label={t('ish.monthly.titleKo')} wide>
            <Input id="ish-m-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={80} />
          </Field>
          <Field id="ish-m-company" label={t('ish.monthly.companyKo')}>
            <Input id="ish-m-company" value={form.company} onChange={(e) => set('company', e.target.value)} maxLength={80} />
          </Field>
          <Field id="ish-m-wage" label={t('ish.monthly.wage')} hint={t('ish.monthly.wageHint')}>
            <Input
              id="ish-m-wage"
              inputMode="numeric"
              value={wage}
              onChange={(e) => setWage(e.target.value.replace(/[^\d ]/g, ''))}
              placeholder="2300000"
            />
          </Field>
          <Field id="ish-m-days" label={t('ish.monthly.days')}>
            <Input
              id="ish-m-days"
              inputMode="numeric"
              value={form.daysPerWeek ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''));
                set('daysPerWeek', n >= 1 && n <= 7 ? n : null);
              }}
            />
          </Field>
          <Field id="ish-m-hours" label={t('ish.monthly.hours')}>
            <Input
              id="ish-m-hours"
              inputMode="numeric"
              value={form.hoursPerDay ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''));
                set('hoursPerDay', n >= 1 && n <= 16 ? n : null);
              }}
            />
          </Field>
          <Field id="ish-m-category" label={t('ish.monthly.category')}>
            <Select value={form.category ?? NONE} onValueChange={(v) => set('category', v === NONE ? null : v)}>
              <SelectTrigger id="ish-m-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('ish.monthly.notSaid')}</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`ish.category.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="ish-m-time" label={t('ish.monthly.workTime')}>
            <Select value={form.workTime ?? NONE} onValueChange={(v) => set('workTime', v === NONE ? null : (v as 'day' | 'night'))}>
              <SelectTrigger id="ish-m-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('ish.monthly.workTimes.any')}</SelectItem>
                <SelectItem value="day">{t('ish.monthly.workTimes.day')}</SelectItem>
                <SelectItem value="night">{t('ish.monthly.workTimes.night')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="ish-m-area" label={t('ish.monthly.area')}>
            <Input id="ish-m-area" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="서울 마포구" maxLength={80} />
          </Field>
          <Field id="ish-m-point" label={t('ish.monthly.point')} hint={t('ish.monthly.pointHint')}>
            <Input id="ish-m-point" value={point} onChange={(e) => setPoint(e.target.value)} placeholder="37.5560, 126.9230" aria-invalid={pointBad} />
          </Field>
          <Field id="ish-m-address" label={t('ish.monthly.address')} wide>
            <Input id="ish-m-address" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={200} />
          </Field>
          <Field id="ish-m-phone" label={t('ish.monthly.contactPhone')} wide>
            <Input id="ish-m-phone" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="010-0000-0000" maxLength={30} />
          </Field>
          <Field id="ish-m-description" label={t('ish.monthly.descriptionKo')} wide>
            <Textarea id="ish-m-description" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={1200} rows={4} />
          </Field>
        </div>
        <div className="space-y-3 border-t pt-3">
          <p className="text-sm font-medium">{t('ish.monthly.translations')}</p>
          <p className="text-xs text-muted-foreground">{t('ish.monthly.translationsHint')}</p>
          {TRANSLATION_LANGS.map((lang) => (
            <div key={lang} className="grid gap-2 sm:grid-cols-2">
              <Field id={`ish-m-${lang}-title`} label={`${lang.toUpperCase()} · ${t('ish.monthly.titleShort')}`}>
                <Input
                  id={`ish-m-${lang}-title`}
                  value={form.translations[lang]?.title ?? ''}
                  onChange={(e) => setTranslation(lang, 'title', e.target.value)}
                  maxLength={80}
                />
              </Field>
              <Field id={`ish-m-${lang}-company`} label={`${lang.toUpperCase()} · ${t('ish.monthly.companyShort')}`}>
                <Input
                  id={`ish-m-${lang}-company`}
                  value={form.translations[lang]?.company ?? ''}
                  onChange={(e) => setTranslation(lang, 'company', e.target.value)}
                  maxLength={80}
                />
              </Field>
              <Field id={`ish-m-${lang}-description`} label={`${lang.toUpperCase()} · ${t('ish.monthly.descriptionShort')}`} wide>
                <Textarea
                  id={`ish-m-${lang}-description`}
                  value={form.translations[lang]?.description ?? ''}
                  onChange={(e) => setTranslation(lang, 'description', e.target.value)}
                  maxLength={1200}
                  rows={2}
                />
              </Field>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('ish.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('ish.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Who said «Qiziqaman» for one job, with their phones (to call). */
function InterestDialog({ job, people, onClose }: { job: IshMonthlyJob; people: IshMonthlyInterest[]; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('ish.monthly.interestedIn', { title: job.title })}</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2" data-testid="ish-monthly-interest">
          {people.map((p) => (
            <li key={p.worker_id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
              <div>
                <div className="font-medium">{`${p.first_name} ${p.last_name}`.trim() || '–'}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Seoul' })}
                </div>
              </div>
              <div className="select-all font-mono text-sm">{p.phone ?? '–'}</div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
