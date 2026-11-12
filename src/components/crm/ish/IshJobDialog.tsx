import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardPaste, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { IshJobInput, IshJobPage } from '@/lib/ish/types';
import { parseJobPost, type ParsedJobPost } from '@/lib/ish/parseJobPost';
import { addDays, jobTimes, seoulParts, seoulToday } from '@/lib/ish/time';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ishErrorText, ishKeys, useIshApi } from './context';
import { businessName } from './IshBoard';
import { Field } from './IshEmployers';

interface Draft {
  businessId: string;
  title: string;
  date: string;
  start: string;
  end: string;
  wage: string;
  slots: string;
  duties: string;
  dress: string;
  address: string;
  autoConfirm: boolean;
  inviteOnly: boolean;
  source: string;
  notes: string;
}

function draftOf(job: IshJobPage | null): Draft {
  if (!job) {
    return {
      businessId: '',
      title: '',
      date: addDays(seoulToday(), 1),
      start: '09:00',
      end: '18:00',
      wage: '',
      slots: '1',
      duties: '',
      dress: '',
      address: '',
      autoConfirm: false,
      inviteOnly: true,
      source: '',
      notes: '',
    };
  }
  const from = seoulParts(job.starts_at);
  return {
    businessId: job.business_id,
    title: job.title,
    date: from.date,
    start: from.time,
    end: seoulParts(job.ends_at).time,
    wage: String(job.hourly_wage),
    slots: String(job.slots),
    duties: job.duties,
    dress: job.dress,
    address: job.address,
    autoConfirm: job.auto_confirm,
    inviteOnly: job.invite_only,
    source: job.notes?.source ?? '',
    notes: job.notes?.notes ?? '',
  };
}

/** The post's findings over the form; the whole post joins the notes. */
export function applyPost(draft: Draft, post: string, found: ParsedJobPost): Draft {
  const notes = [draft.notes.trim(), post.trim()].filter(Boolean).join('\n\n').slice(0, 2000);
  return {
    ...draft,
    date: found.date ?? draft.date,
    start: found.start ?? draft.start,
    end: found.end ?? draft.end,
    wage: found.wage ? String(found.wage) : draft.wage,
    slots: found.slots ? String(found.slots) : draft.slots,
    address: found.address ?? draft.address,
    source: found.link ?? draft.source,
    notes,
  };
}

/** A job of an employer the staff keep: new, or [job] to change. */
export function IshJobDialog({
  job = null,
  open,
  onOpenChange,
  onSaved,
}: {
  job?: IshJobPage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const businesses = useQuery({ queryKey: ishKeys.businesses, queryFn: api.businesses });
  const [draft, setDraft] = useState<Draft>(() => draftOf(job));
  const [post, setPost] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const wage = Number(draft.wage);
  const slots = Number(draft.slots);
  const valid =
    draft.businessId !== '' &&
    draft.title.trim() !== '' &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.date) &&
    /^\d{2}:\d{2}$/.test(draft.start) &&
    /^\d{2}:\d{2}$/.test(draft.end) &&
    draft.start !== draft.end &&
    Number.isInteger(wage) &&
    wage > 0 &&
    Number.isInteger(slots) &&
    slots >= 1 &&
    slots <= 50;

  const save = useMutation({
    mutationFn: () => {
      const { startsAt, endsAt } = jobTimes(draft.date, draft.start, draft.end);
      const input: IshJobInput = {
        id: job?.id ?? null,
        businessId: draft.businessId,
        title: draft.title,
        startsAt,
        endsAt,
        hourlyWage: wage,
        slots,
        duties: draft.duties,
        dress: draft.dress,
        address: draft.address,
        autoConfirm: draft.autoConfirm,
        inviteOnly: draft.inviteOnly,
        source: draft.source,
        notes: draft.notes,
      };
      return api.saveJob(input);
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ishKeys.all });
      toast.success(t('ish.saved'));
      onSaved(id);
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });

  const fill = () => {
    const found = parseJobPost(post);
    setDraft((d) => applyPost(d, post, found));
    const n = Object.keys(found).length;
    toast.success(t('ish.job.pasteFound', { count: n }));
    setPost('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{job ? t('ish.job.edit') : t('ish.board.newJob')}</DialogTitle>
        </DialogHeader>

        {!job && (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <Field id="ish-j-post" label={t('ish.job.paste')} hint={t('ish.job.pasteHint')}>
              <Textarea id="ish-j-post" value={post} onChange={(e) => setPost(e.target.value)} rows={4} />
            </Field>
            <Button size="sm" variant="secondary" onClick={fill} disabled={post.trim() === ''}>
              <ClipboardPaste className="mr-1 h-4 w-4" />
              {t('ish.job.pasteApply')}
            </Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ish-j-business" label={t('ish.job.employer')} wide>
            <Select value={draft.businessId} onValueChange={(v) => set('businessId', v)} disabled={!!job}>
              <SelectTrigger id="ish-j-business">
                <SelectValue placeholder={t('ish.job.chooseEmployer')} />
              </SelectTrigger>
              <SelectContent>
                {(businesses.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {businessName(b, i18n.language)} · {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {businesses.isSuccess && (businesses.data ?? []).length === 0 && (
              <p className="text-xs text-amber-600">{t('ish.job.noEmployers')}</p>
            )}
          </Field>
          <Field id="ish-j-title" label={t('ish.job.title')} hint={t('ish.job.titleHint')} wide>
            <Input id="ish-j-title" value={draft.title} onChange={(e) => set('title', e.target.value)} maxLength={80} />
          </Field>
          <Field id="ish-j-date" label={t('ish.job.date')} hint={t('ish.seoulTime')}>
            <Input id="ish-j-date" type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field id="ish-j-start" label={t('ish.job.start')}>
              <Input id="ish-j-start" type="time" value={draft.start} onChange={(e) => set('start', e.target.value)} />
            </Field>
            <Field id="ish-j-end" label={t('ish.job.end')}>
              <Input id="ish-j-end" type="time" value={draft.end} onChange={(e) => set('end', e.target.value)} />
            </Field>
          </div>
          <Field id="ish-j-wage" label={t('ish.job.wage')}>
            <Input id="ish-j-wage" inputMode="numeric" value={draft.wage} onChange={(e) => set('wage', e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field id="ish-j-slots" label={t('ish.job.slots')}>
            <Input id="ish-j-slots" inputMode="numeric" value={draft.slots} onChange={(e) => set('slots', e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field id="ish-j-duties" label={t('ish.job.duties')} hint={t('ish.job.dutiesHint')} wide>
            <Textarea id="ish-j-duties" value={draft.duties} onChange={(e) => set('duties', e.target.value)} rows={3} maxLength={600} />
          </Field>
          <Field id="ish-j-dress" label={t('ish.job.dress')}>
            <Input id="ish-j-dress" value={draft.dress} onChange={(e) => set('dress', e.target.value)} maxLength={300} />
          </Field>
          <Field id="ish-j-address" label={t('ish.job.address')} hint={t('ish.job.addressHint')}>
            <Input id="ish-j-address" value={draft.address} onChange={(e) => set('address', e.target.value)} maxLength={200} />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm sm:col-span-2">
            <span>
              <span className="font-medium">{t('ish.job.inviteOnly')}</span>
              <span className="block text-xs text-muted-foreground">{t('ish.job.inviteOnlyHint')}</span>
            </span>
            <Switch checked={draft.inviteOnly} onCheckedChange={(v) => set('inviteOnly', v)} aria-label={t('ish.job.inviteOnly')} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm sm:col-span-2">
            <span>
              <span className="font-medium">{t('ish.job.autoConfirm')}</span>
              <span className="block text-xs text-muted-foreground">{t('ish.job.autoConfirmHint')}</span>
            </span>
            <Switch checked={draft.autoConfirm} onCheckedChange={(v) => set('autoConfirm', v)} aria-label={t('ish.job.autoConfirm')} />
          </label>
          <Field id="ish-j-source" label={t('ish.employers.source')} wide>
            <Input id="ish-j-source" value={draft.source} onChange={(e) => set('source', e.target.value)} maxLength={300} />
          </Field>
          <Field id="ish-j-notes" label={t('ish.job.notes')} hint={t('ish.job.notesHint')} wide>
            <Textarea id="ish-j-notes" value={draft.notes} onChange={(e) => set('notes', e.target.value)} rows={4} maxLength={2000} />
          </Field>
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
