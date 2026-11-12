import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  BUSINESS_CATEGORIES,
  type BusinessCategory,
  type IshAppBusiness,
  type IshAppBusinessInput,
} from '@/lib/ish/types';
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
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ishErrorText, ishKeys, useIshApi } from './context';
import { businessName } from './IshBoard';
import { Field } from './IshEmployers';

/** The name a business has until someone sets the real one (P50). */
const PLACEHOLDER_NAME = /^사업장 [0-9A-F]{4}$/;

/**
 * «Ilovadagi bizneslar» (P52): the businesses the 사장님 app opens at once,
 * without a check (P50). The staff give them their real name and suspend a
 * suspicious one: its shifts leave the feed and nobody can apply.
 */
export function IshAppBusinesses() {
  const { t, i18n } = useTranslation();
  const api = useIshApi();
  const list = useQuery({ queryKey: ishKeys.appBusinesses, queryFn: api.appBusinesses });
  const [editing, setEditing] = useState<IshAppBusiness | null>(null);
  const [blocking, setBlocking] = useState<IshAppBusiness | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('ish.appBusinesses.intro')}</p>
      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : list.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{ishErrorText(t, list.error)}</CardContent>
        </Card>
      ) : (list.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t('ish.appBusinesses.empty')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ish.appBusinesses.business')}</TableHead>
                <TableHead>{t('ish.appBusinesses.status')}</TableHead>
                <TableHead>{t('ish.appBusinesses.opened')}</TableHead>
                <TableHead>{t('ish.appBusinesses.shifts')}</TableHead>
                <TableHead className="text-right">{t('ish.appBusinesses.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((b) => (
                <TableRow key={b.id} data-testid={`ish-app-business-${b.id}`}>
                  <TableCell>
                    <div className="font-medium">{businessName(b, i18n.language)}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.name} · {t(`ish.category.${b.category}`)}
                      {b.area ? ` · ${b.area}` : ''}
                    </div>
                    {PLACEHOLDER_NAME.test(b.name) && (
                      <div className="text-xs text-amber-600">{t('ish.appBusinesses.placeholder')}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                  </TableCell>
                  <TableCell className="text-sm">{new Date(b.created_at).toLocaleDateString(i18n.language)}</TableCell>
                  <TableCell className="text-sm">
                    <div>{t('ish.appBusinesses.shiftsLine', { open: b.open_shifts, total: b.shifts })}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('ish.appBusinesses.last24h', { count: b.shifts_24h })}
                    </div>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(b)}>
                      {t('ish.appBusinesses.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant={b.status === 'rejected' ? 'secondary' : 'destructive'}
                      onClick={() => setBlocking(b)}
                    >
                      {b.status === 'rejected' ? t('ish.appBusinesses.resume') : t('ish.appBusinesses.suspend')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {editing && (
        <AppBusinessDialog business={editing} onClose={() => setEditing(null)} />
      )}
      {blocking && <BlockDialog business={blocking} onClose={() => setBlocking(null)} />}
    </div>
  );
}

function StatusBadge({ status }: { status: IshAppBusiness['status'] }) {
  const { t } = useTranslation();
  if (status === 'rejected') return <Badge variant="destructive">{t('ish.appBusinesses.statusSuspended')}</Badge>;
  if (status === 'pending') return <Badge variant="secondary">{t('ish.appBusinesses.statusPending')}</Badge>;
  return <Badge variant="outline">{t('ish.appBusinesses.statusActive')}</Badge>;
}

/** Suspend or let back — what it means for the workers is said first. */
function BlockDialog({ business, onClose }: { business: IshAppBusiness; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const suspend = business.status !== 'rejected';
  const change = useMutation({
    mutationFn: () => api.setAppBusinessBlocked(business.id, suspend),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ishKeys.all });
      toast.success(suspend ? t('ish.appBusinesses.suspended') : t('ish.appBusinesses.resumed'));
      onClose();
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {suspend ? t('ish.appBusinesses.suspendTitle') : t('ish.appBusinesses.resumeTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium">{businessName(business, i18n.language)}</span>
            {' — '}
            {suspend ? t('ish.appBusinesses.suspendText') : t('ish.appBusinesses.resumeText')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('ish.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              change.mutate();
            }}
            disabled={change.isPending}
          >
            {change.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {suspend ? t('ish.appBusinesses.suspend') : t('ish.appBusinesses.resume')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function toInput(b: IshAppBusiness): IshAppBusinessInput {
  return {
    id: b.id,
    name: b.name,
    nameUz: b.name_i18n?.uz ?? '',
    category: (BUSINESS_CATEGORIES as readonly string[]).includes(b.category) ? (b.category as BusinessCategory) : 'other',
    area: b.area ?? '',
    address: b.address ?? '',
    addressDetail: b.address_detail ?? '',
  };
}

/** The real name and place of an app business (what the workers see). */
export function AppBusinessDialog({ business, onClose }: { business: IshAppBusiness; onClose: () => void }) {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<IshAppBusinessInput>(() => toInput(business));
  const set = <K extends keyof IshAppBusinessInput>(k: K, v: IshAppBusinessInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () => api.updateAppBusiness(form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ishKeys.all });
      toast.success(t('ish.saved'));
      onClose();
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('ish.appBusinesses.editTitle')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ish-ab-name" label={t('ish.employers.nameKo')}>
            <Input id="ish-ab-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} />
          </Field>
          <Field id="ish-ab-name-uz" label={t('ish.employers.nameUz')}>
            <Input id="ish-ab-name-uz" value={form.nameUz} onChange={(e) => set('nameUz', e.target.value)} maxLength={80} />
          </Field>
          <Field id="ish-ab-category" label={t('ish.employers.category')}>
            <Select value={form.category} onValueChange={(v) => set('category', v as BusinessCategory)}>
              <SelectTrigger id="ish-ab-category">
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
          <Field id="ish-ab-area" label={t('ish.employers.area')}>
            <Input id="ish-ab-area" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="홍대" maxLength={40} />
          </Field>
          <Field id="ish-ab-address" label={t('ish.employers.addressKo')} wide>
            <Input id="ish-ab-address" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={200} />
          </Field>
          <Field id="ish-ab-detail" label={t('ish.employers.addressDetail')}>
            <Input id="ish-ab-detail" value={form.addressDetail} onChange={(e) => set('addressDetail', e.target.value)} maxLength={80} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('ish.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} disabled={form.name.trim() === '' || save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('ish.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
