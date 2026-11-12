import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Ban,
  Check,
  Download,
  Loader2,
  MessageSquare,
  Pencil,
  Phone,
  QrCode,
  Send,
  UserCheck,
  UserX,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { plannedMinutes } from '@/lib/ish/api';
import type { IshApplication, IshCandidate, IshJobPage, IshWorker } from '@/lib/ish/types';
import { dayLabel, hoursMinutes, seoulParts, timeRange, won } from '@/lib/ish/time';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ishErrorText, ishKeys, useIshApi } from './context';
import { businessName } from './IshBoard';
import { IshJobDialog } from './IshJobDialog';

const LIVE = new Set(['pending', 'confirmed', 'checked_in', 'completed']);

const fullName = (w: Pick<IshWorker, 'first_name' | 'last_name'>) =>
  [w.first_name, w.last_name].filter(Boolean).join(' ') || '—';

/** One job: the employer's contact, who fits, the offers, the applications. */
export function IshJobDetail({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  // Applications, answers to offers and attendance show without a reload
  // (only while the tab is in front).
  const job = useQuery({ queryKey: ishKeys.job(jobId), queryFn: () => api.job(jobId), refetchInterval: 15_000 });
  const [editing, setEditing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const cancel = useMutation({
    mutationFn: () => api.cancelJob(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ishKeys.all });
      toast.success(t('ish.detail.cancelled'));
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });

  if (job.isLoading) return <Skeleton className="h-64 w-full" />;
  if (job.isError || !job.data) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('ish.detail.back')}
        </Button>
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{ishErrorText(t, job.error)}</CardContent>
        </Card>
      </div>
    );
  }
  const j = job.data;
  const open = j.status === 'open';
  const started = Date.parse(j.starts_at) <= Date.now();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('ish.detail.back')}
        </Button>
        <div className="flex flex-wrap gap-2">
          {j.managed && open && !started && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              {t('ish.detail.edit')}
            </Button>
          )}
          {j.managed && open && (
            <Button variant="outline" onClick={() => setQrOpen(true)}>
              <QrCode className="mr-1 h-4 w-4" />
              {t('ish.detail.qr')}
            </Button>
          )}
          {j.managed && open && !started && (
            <Button variant="outline" className="text-destructive" onClick={() => setCancelOpen(true)}>
              <Ban className="mr-1 h-4 w-4" />
              {t('ish.detail.cancel')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">{j.title}</CardTitle>
            {!open && <Badge variant="destructive">{t('ish.status.cancelled')}</Badge>}
            {j.invite_only ? (
              <Badge variant="secondary">{t('ish.status.inviteOnly')}</Badge>
            ) : (
              <Badge variant="outline">{t('ish.status.public')}</Badge>
            )}
            {!j.managed && <Badge variant="outline">{t('ish.status.inApp')}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {businessName(j.business, i18n.language)} · {j.business.name}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-4">
          <Info label={t('ish.board.when')} value={`${dayLabel(j.starts_at, i18n.language)} · ${timeRange(j.starts_at, j.ends_at)}`} />
          <Info label={t('ish.board.wage')} value={`${won(j.hourly_wage)} · ${t('ish.detail.total', { amount: won(Math.floor((j.hourly_wage * plannedMinutes(j)) / 60)) })}`} />
          <Info label={t('ish.board.places')} value={`${j.slots - j.slots_left}/${j.slots}`} />
          <Info label={t('ish.job.address')} value={[j.business.address, j.business.address_detail].filter(Boolean).join(', ') || '—'} />
          {j.duties && <Info label={t('ish.job.duties')} value={j.duties} wide />}
          {j.dress && <Info label={t('ish.job.dress')} value={j.dress} />}
        </CardContent>
      </Card>

      {(j.contact || j.notes) && (
        <div className="grid gap-4 md:grid-cols-2">
          {j.contact && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('ish.detail.contact')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {j.contact.contact_name && <div>{j.contact.contact_name}</div>}
                {j.contact.phone && (
                  <a className="flex items-center gap-1 text-primary underline-offset-2 hover:underline" href={`tel:${j.contact.phone}`}>
                    <Phone className="h-3.5 w-3.5" />
                    {j.contact.phone}
                  </a>
                )}
                {j.contact.telegram && (
                  <a
                    className="block text-primary underline-offset-2 hover:underline"
                    href={`https://t.me/${j.contact.telegram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {j.contact.telegram}
                  </a>
                )}
                {j.contact.notes && <p className="whitespace-pre-wrap text-muted-foreground">{j.contact.notes}</p>}
              </CardContent>
            </Card>
          )}
          {j.notes && (j.notes.source || j.notes.notes) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('ish.job.notes')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {j.notes.source && <SourceLink source={j.notes.source} />}
                {j.notes.notes && <p className="whitespace-pre-wrap text-muted-foreground">{j.notes.notes}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <IshApplications job={j} />
      {open && !started && <IshCandidates job={j} />}
      <IshOffers job={j} />

      {editing && (
        <IshJobDialog
          job={j}
          open
          onOpenChange={(v) => !v && setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
      {qrOpen && <IshQrDialog job={j} onClose={() => setQrOpen(false)} />}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ish.detail.cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('ish.detail.cancelText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('ish.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancel.mutate()}>{t('ish.detail.cancel')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-4' : undefined}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap font-medium">{value}</div>
    </div>
  );
}

function SourceLink({ source }: { source: string }) {
  return /^https?:\/\//.test(source) ? (
    <a className="block break-all text-primary underline-offset-2 hover:underline" href={source} target="_blank" rel="noreferrer">
      {source}
    </a>
  ) : (
    <div className="break-all">{source}</div>
  );
}

function WorkerLine({ worker }: { worker: IshWorker }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="font-medium">{fullName(worker)}</div>
      <div className="text-xs text-muted-foreground">
        {[
          worker.phone,
          (worker.languages ?? []).join(', '),
          worker.topik ? `TOPIK ${worker.topik}` : null,
          t('ish.worker.stats', { done: worker.completed, reliability: worker.reliability ?? 100 }),
        ]
          .filter(Boolean)
          .join(' · ')}
      </div>
    </div>
  );
}

/** «Mos ishchilar»: who fits, best first; ticked ones get the offer. */
export function IshCandidates({ job }: { job: IshJobPage }) {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const [radius, setRadius] = useState('10');
  const km = radius === 'all' ? null : Number(radius);
  const list = useQuery({ queryKey: ishKeys.candidates(job.id, km), queryFn: () => api.candidates(job.id, km) });
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  useEffect(() => setChosen(new Set()), [radius]);

  const send = useMutation({
    mutationFn: () => api.sendOffers(job.id, [...chosen], note),
    onSuccess: (count) => {
      toast.success(t('ish.candidates.sent', { count }));
      setChosen(new Set());
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ishKeys.all });
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });

  const canOffer = (c: IshCandidate) => c.offer_status === null && !(c.application_status && LIVE.has(c.application_status));
  const toggle = (id: string, on: boolean) =>
    setChosen((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">{t('ish.candidates.title')}</CardTitle>
        <Select value={radius} onValueChange={setRadius}>
          <SelectTrigger className="w-44" aria-label={t('ish.candidates.radius')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['3', '5', '10', '20'].map((r) => (
              <SelectItem key={r} value={r}>
                {t('ish.candidates.within', { km: r })}
              </SelectItem>
            ))}
            <SelectItem value="all">{t('ish.candidates.anyDistance')}</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : list.isError ? (
          <p className="text-sm text-destructive">{ishErrorText(t, list.error)}</p>
        ) : (list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('ish.candidates.none')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t('ish.candidates.worker')}</TableHead>
                <TableHead>{t('ish.candidates.distance')}</TableHead>
                <TableHead>{t('ish.candidates.time')}</TableHead>
                <TableHead>{t('ish.candidates.state')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((c) => (
                <TableRow key={c.id} data-testid={`ish-candidate-${c.id}`}>
                  <TableCell>
                    <Checkbox
                      checked={chosen.has(c.id)}
                      disabled={!canOffer(c)}
                      onCheckedChange={(v) => toggle(c.id, v === true)}
                      aria-label={fullName(c)}
                    />
                  </TableCell>
                  <TableCell>
                    <WorkerLine worker={c} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {c.distance_km == null ? '—' : t('ish.candidates.km', { km: c.distance_km })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.busy ? (
                      <Badge variant="destructive">{t('ish.candidates.busy')}</Badge>
                    ) : c.available ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">{t('ish.candidates.free')}</Badge>
                    ) : (
                      <Badge variant="outline">{t('ish.candidates.notInSchedule')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.application_status
                      ? t(`ish.application.${c.application_status}`)
                      : c.offer_status
                        ? t(`ish.offer.${c.offer_status}`)
                        : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder={t('ish.candidates.note')}
            aria-label={t('ish.candidates.note')}
          />
          <Button className="shrink-0" onClick={() => send.mutate()} disabled={chosen.size === 0 || send.isPending}>
            {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {t('ish.candidates.send', { count: chosen.size })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** «Takliflar»: who was offered the job and how they answered. */
function IshOffers({ job }: { job: IshJobPage }) {
  const { t, i18n } = useTranslation();
  if (job.offers.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('ish.offers.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            {job.offers.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <WorkerLine worker={o.worker} />
                </TableCell>
                <TableCell className="text-sm">
                  <Badge variant={o.status === 'declined' ? 'outline' : o.status === 'applied' ? 'default' : 'secondary'}>
                    {t(`ish.offer.${o.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {dayLabel(o.created_at, i18n.language)} {seoulParts(o.created_at).time}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** «Arizalar»: 확정/거절 after the call with the employer, who came, paid. */
function IshApplications({ job }: { job: IshJobPage }) {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const [chat, setChat] = useState<IshApplication | null>(null);
  const [came, setCame] = useState<IshApplication | null>(null);
  const started = Date.parse(job.starts_at) <= Date.now();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ishKeys.all });
  const fail = (e: unknown) => toast.error(ishErrorText(t, e));

  const decide = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => api.decide(id, accept),
    onSuccess: refresh,
    onError: fail,
  });
  const notCame = useMutation({ mutationFn: (id: string) => api.markAttendance(id, false), onSuccess: refresh, onError: fail });
  const paid = useMutation({ mutationFn: (value: boolean) => api.setPaid(job.id, value), onSuccess: refresh, onError: fail });

  const completed = job.applications.filter((a) => a.status === 'completed');
  const allPaid = completed.length > 0 && completed.every((a) => a.paid_at);
  const shown = job.applications;
  // What the workers wrote and nobody has read yet: a number on the chat
  // button.
  const unread = useQuery({
    queryKey: [...ishKeys.unread(job.id), job.applications.map((a) => a.id).join(',')],
    queryFn: () => api.unread(job.applications.map((a) => ({ id: a.id, workerId: a.worker.id }))),
    enabled: job.managed && job.applications.length > 0,
    refetchInterval: 15_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">{t('ish.applications.title')}</CardTitle>
        {job.managed && completed.length > 0 && (
          <Button size="sm" variant={allPaid ? 'outline' : 'default'} onClick={() => paid.mutate(!allPaid)} disabled={paid.isPending}>
            <Wallet className="mr-1 h-4 w-4" />
            {allPaid ? t('ish.applications.unmarkPaid') : t('ish.applications.markPaid')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('ish.applications.none')}</p>
        ) : (
          <Table>
            <TableBody>
              {shown.map((a) => (
                <TableRow key={a.id} data-testid={`ish-application-${a.id}`}>
                  <TableCell>
                    <WorkerLine worker={a.worker} />
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge variant={a.status === 'no_show' || a.status === 'rejected' ? 'outline' : 'secondary'}>
                      {t(`ish.application.${a.status}`)}
                    </Badge>
                    {a.status === 'completed' && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {hoursMinutes(a.worked_minutes ?? 0, t('ish.hours'), t('ish.minutes'))} · {won(a.pay_amount ?? 0)}
                        {a.paid_at ? ` · ${t('ish.applications.paid')}` : ''}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {job.managed && a.status === 'pending' && !started && (
                        <>
                          <Button size="sm" onClick={() => decide.mutate({ id: a.id, accept: true })} disabled={decide.isPending}>
                            <Check className="mr-1 h-4 w-4" />
                            {t('ish.applications.accept')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: a.id, accept: false })} disabled={decide.isPending}>
                            <X className="mr-1 h-4 w-4" />
                            {t('ish.applications.reject')}
                          </Button>
                        </>
                      )}
                      {job.managed && started && (a.status === 'confirmed' || a.status === 'checked_in') && (
                        <>
                          <Button size="sm" onClick={() => setCame(a)}>
                            <UserCheck className="mr-1 h-4 w-4" />
                            {t('ish.applications.came')}
                          </Button>
                          {a.status === 'confirmed' && (
                            <Button size="sm" variant="outline" onClick={() => notCame.mutate(a.id)} disabled={notCame.isPending}>
                              <UserX className="mr-1 h-4 w-4" />
                              {t('ish.applications.notCame')}
                            </Button>
                          )}
                        </>
                      )}
                      {job.managed && a.status !== 'rejected' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="relative"
                          onClick={() => setChat(a)}
                          aria-label={
                            unread.data?.[a.id]
                              ? `${t('ish.chat.title')}: ${t('ish.chat.unread', { count: unread.data[a.id] })}`
                              : t('ish.chat.title')
                          }
                        >
                          <MessageSquare className="h-4 w-4" />
                          {!!unread.data?.[a.id] && (
                            <span
                              data-testid={`ish-unread-${a.id}`}
                              className="absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground"
                            >
                              {unread.data[a.id]}
                            </span>
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {chat && <IshChatDialog application={chat} onClose={() => setChat(null)} />}
      {came && <CameDialog job={job} application={came} onClose={() => setCame(null)} onDone={refresh} />}
    </Card>
  );
}

/** «Keldi»: how long they worked (the planned time by default). */
function CameDialog({
  job,
  application,
  onClose,
  onDone,
}: {
  job: IshJobPage;
  application: IshApplication;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const api = useIshApi();
  const planned = plannedMinutes(job);
  const [minutes, setMinutes] = useState(String(planned));
  const value = Number(minutes);
  const valid = Number.isInteger(value) && value >= 0 && value <= planned;
  const save = useMutation({
    mutationFn: () => api.markAttendance(application.id, true, value),
    onSuccess: () => {
      onDone();
      onClose();
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('ish.applications.cameTitle', { name: fullName(application.worker) })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="ish-minutes" className="text-sm font-medium">
            {t('ish.applications.workedMinutes')}
          </label>
          <Input id="ish-minutes" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} />
          <p className="text-xs text-muted-foreground">
            {t('ish.applications.payWillBe', { amount: won(valid ? Math.floor((job.hourly_wage * value) / 60) : 0) })}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
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

/** The worker's A10 chat with «the employer» — the staff, on their jobs. */
function IshChatDialog({ application, onClose }: { application: IshApplication; onClose: () => void }) {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const messages = useQuery({
    queryKey: ishKeys.messages(application.id),
    queryFn: () => api.messages(application.id),
    refetchInterval: 10_000,
  });
  // What the worker wrote is read once it is on the screen (and again when
  // a new message comes in while the chat is open).
  const workerMessages = (messages.data ?? []).filter((m) => m.sender_id === application.worker.id).length;
  useEffect(() => {
    if (!messages.isSuccess || workerMessages === 0) return;
    void api
      .markRead(application.id, application.worker.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['ish', 'unread'] }))
      .catch(() => {});
  }, [api, application.id, application.worker.id, messages.isSuccess, workerMessages, queryClient]);
  const [text, setText] = useState('');
  const send = useMutation({
    mutationFn: () => api.sendMessage(application.id, text),
    onSuccess: () => {
      setText('');
      void queryClient.invalidateQueries({ queryKey: ishKeys.messages(application.id) });
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  const workerId = application.worker.id;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('ish.chat.with', { name: fullName(application.worker) })}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3">
          {(messages.data ?? []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">{t('ish.chat.none')}</p>
          ) : (
            (messages.data ?? []).map((m) => {
              const fromWorker = m.sender_id === workerId;
              return (
                <div key={m.id} className={fromWorker ? 'flex justify-start' : 'flex justify-end'}>
                  <div className={fromWorker ? 'max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm' : 'max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'}>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                    {fromWorker && m.translations?.uz && m.translations.uz !== m.body && (
                      <div className="mt-1 text-xs opacity-70">{m.translations.uz}</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !send.isPending) send.mutate();
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={t('ish.chat.placeholder')} aria-label={t('ish.chat.placeholder')} />
          <Button type="submit" disabled={!text.trim() || send.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The job's QR, for the employer to put up: workers scan it coming and going. */
function IshQrDialog({ job, onClose }: { job: IshJobPage; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const api = useIshApi();
  const payload = useQuery({ queryKey: ['ish', 'qr', job.id], queryFn: () => api.qr(job.id) });
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (payload.data) {
      QRCode.toDataURL(payload.data, { width: 640, margin: 2, errorCorrectionLevel: 'M' })
        .then((url) => live && setImage(url))
        .catch(() => live && setImage(null));
    }
    return () => {
      live = false;
    };
  }, [payload.data]);

  const fileName = useMemo(() => `hanguk-ish-qr-${job.starts_at.slice(0, 10)}.png`, [job.starts_at]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('ish.qr.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">{t('ish.qr.hint')}</p>
          <div className="text-sm font-medium">
            {job.title} · {businessName(job.business, i18n.language)}
            <div className="text-xs text-muted-foreground">
              {dayLabel(job.starts_at, i18n.language)} · {timeRange(job.starts_at, job.ends_at)}
            </div>
          </div>
          {payload.isError ? (
            <p className="text-sm text-destructive">{ishErrorText(t, payload.error)}</p>
          ) : image ? (
            <img src={image} alt={t('ish.qr.title')} className="mx-auto w-64 rounded-md border" />
          ) : (
            <Skeleton className="mx-auto h-64 w-64" />
          )}
        </div>
        <DialogFooter>
          <Button asChild disabled={!image}>
            <a href={image ?? '#'} download={fileName}>
              <Download className="mr-2 h-4 w-4" />
              {t('ish.qr.download')}
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
