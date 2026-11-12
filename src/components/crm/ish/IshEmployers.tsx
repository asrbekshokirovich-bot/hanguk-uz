import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { BUSINESS_CATEGORIES, type BusinessCategory, type IshBusiness, type IshBusinessInput } from '@/lib/ish/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ishErrorText, ishKeys, useIshApi } from './context';
import { businessName } from './IshBoard';

/** «Ish beruvchilar»: the employers outside the app the staff keep. */
export function IshEmployers() {
  const { t, i18n } = useTranslation();
  const api = useIshApi();
  const list = useQuery({ queryKey: ishKeys.businesses, queryFn: api.businesses });
  const [editing, setEditing] = useState<IshBusiness | 'new' | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>
          <Plus className="mr-1 h-4 w-4" />
          {t('ish.employers.new')}
        </Button>
      </div>
      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : list.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{ishErrorText(t, list.error)}</CardContent>
        </Card>
      ) : (list.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{t('ish.employers.empty')}</CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ish.employers.name')}</TableHead>
                <TableHead>{t('ish.employers.address')}</TableHead>
                <TableHead>{t('ish.employers.contact')}</TableHead>
                <TableHead className="text-center">{t('ish.employers.openJobs')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => setEditing(b)}>
                  <TableCell>
                    <div className="font-medium">{businessName(b, i18n.language)}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.name} · {t(`ish.category.${b.category}`)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {[b.address, b.address_detail].filter(Boolean).join(', ') || '—'}
                    {b.lat == null && <div className="text-xs text-amber-600">{t('ish.employers.noPoint')}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{b.contact.contact_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {[b.contact.phone, b.contact.telegram].filter(Boolean).join(' · ')}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{b.open_shifts}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {editing && (
        <IshBusinessDialog
          business={editing === 'new' ? null : editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </div>
  );
}

const EMPTY_CONTACT = { contact_name: '', phone: '', telegram: '', source: '', notes: '' };

function toInput(b: IshBusiness | null): IshBusinessInput {
  return {
    id: b?.id ?? null,
    name: b?.name ?? '',
    nameUz: b?.name_i18n?.uz ?? '',
    category: (BUSINESS_CATEGORIES as readonly string[]).includes(b?.category ?? '')
      ? (b?.category as BusinessCategory)
      : 'other',
    area: b?.area ?? '',
    address: b?.address ?? '',
    addressDetail: b?.address_detail ?? '',
    district: b?.district ?? null,
    lat: b?.lat ?? null,
    lng: b?.lng ?? null,
    contact: { ...EMPTY_CONTACT, ...(b?.contact ?? {}) },
  };
}

/** «37.5560, 126.9230» or a map link with «@37.5560,126.9230» / «?q=…» → the point. */
export function parsePoint(text: string): { lat: number; lng: number } | null {
  const m = text.match(/(-?\d{1,2}\.\d+)\s*[,/ ]\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** An employer found on Telegram: what the workers see, and how to reach them. */
export function IshBusinessDialog({
  business,
  open,
  onOpenChange,
  onSaved,
}: {
  business: IshBusiness | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string) => void;
}) {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<IshBusinessInput>(() => toInput(business));
  const [point, setPoint] = useState(() =>
    business?.lat != null && business?.lng != null ? `${business.lat}, ${business.lng}` : '',
  );
  const parsedPoint = parsePoint(point);
  const pointBad = point.trim() !== '' && parsedPoint === null;
  const set = <K extends keyof IshBusinessInput>(k: K, v: IshBusinessInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setContact = (k: keyof IshBusinessInput['contact'], v: string) =>
    setForm((f) => ({ ...f, contact: { ...f.contact, [k]: v } }));

  const save = useMutation({
    mutationFn: () => api.saveBusiness({ ...form, lat: parsedPoint?.lat ?? null, lng: parsedPoint?.lng ?? null }),
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ishKeys.all });
      toast.success(t('ish.saved'));
      onSaved(id);
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  const valid = form.name.trim() !== '' && !pointBad;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{business ? t('ish.employers.edit') : t('ish.employers.new')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ish-b-name" label={t('ish.employers.nameKo')}>
            <Input id="ish-b-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} />
          </Field>
          <Field id="ish-b-name-uz" label={t('ish.employers.nameUz')}>
            <Input id="ish-b-name-uz" value={form.nameUz} onChange={(e) => set('nameUz', e.target.value)} maxLength={80} />
          </Field>
          <Field id="ish-b-category" label={t('ish.employers.category')}>
            <Select value={form.category} onValueChange={(v) => set('category', v as BusinessCategory)}>
              <SelectTrigger id="ish-b-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`ish.category.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="ish-b-area" label={t('ish.employers.area')}>
            <Input id="ish-b-area" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="홍대" maxLength={40} />
          </Field>
          <Field id="ish-b-address" label={t('ish.employers.addressKo')} wide>
            <Input id="ish-b-address" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={200} />
          </Field>
          <Field id="ish-b-detail" label={t('ish.employers.addressDetail')}>
            <Input id="ish-b-detail" value={form.addressDetail} onChange={(e) => set('addressDetail', e.target.value)} maxLength={80} />
          </Field>
          <Field id="ish-b-point" label={t('ish.employers.point')} hint={t('ish.employers.pointHint')}>
            <Input
              id="ish-b-point"
              value={point}
              onChange={(e) => setPoint(e.target.value)}
              placeholder="37.5560, 126.9230"
              aria-invalid={pointBad}
            />
          </Field>
          <Field id="ish-c-name" label={t('ish.employers.contactName')}>
            <Input id="ish-c-name" value={form.contact.contact_name} onChange={(e) => setContact('contact_name', e.target.value)} maxLength={80} />
          </Field>
          <Field id="ish-c-phone" label={t('ish.employers.phone')}>
            <Input id="ish-c-phone" value={form.contact.phone} onChange={(e) => setContact('phone', e.target.value)} maxLength={32} />
          </Field>
          <Field id="ish-c-telegram" label="Telegram">
            <Input id="ish-c-telegram" value={form.contact.telegram} onChange={(e) => setContact('telegram', e.target.value)} maxLength={64} />
          </Field>
          <Field id="ish-c-source" label={t('ish.employers.source')}>
            <Input id="ish-c-source" value={form.contact.source} onChange={(e) => setContact('source', e.target.value)} maxLength={300} />
          </Field>
          <Field id="ish-c-notes" label={t('ish.employers.notes')} wide>
            <Textarea id="ish-c-notes" value={form.contact.notes} onChange={(e) => setContact('notes', e.target.value)} maxLength={2000} rows={3} />
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

export function Field({
  id,
  label,
  hint,
  wide,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
