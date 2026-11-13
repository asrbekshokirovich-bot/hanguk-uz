import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { IshStaffCandidate, IshStaffMember, IshStaffRole } from '@/lib/ish/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ishErrorText, ishKeys, useIshApi } from './context';

const ROLES: readonly IshStaffRole[] = ['operator', 'admin'];

/**
 * «Xodimlar» (P58): who works in this section, kept by a Hanguk Ish admin —
 * until now an SQL step. Only hanguk.uz's CRM people can be added (the
 * database allows nobody else); each is an operator or an admin; nobody
 * changes or removes themselves.
 */
export function IshStaff() {
  const { t, i18n } = useTranslation();
  const api = useIshApi();
  const people = useQuery({ queryKey: ishKeys.people, queryFn: api.staffPeople });
  const [removing, setRemoving] = useState<IshStaffMember | null>(null);

  if (people.isLoading) return <Skeleton className="h-40 w-full" />;
  if (people.isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">{ishErrorText(t, people.error)}</CardContent>
      </Card>
    );
  }
  const staff = people.data?.staff ?? [];
  const candidates = people.data?.candidates ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('ish.staff.intro')}</p>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('ish.staff.name')}</TableHead>
              <TableHead>{t('ish.staff.email')}</TableHead>
              <TableHead>{t('ish.staff.role')}</TableHead>
              <TableHead>{t('ish.staff.added')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((m) => (
              <TableRow key={m.id} data-testid={`ish-staff-${m.id}`}>
                <TableCell className="text-sm font-medium">
                  {m.name || t('ish.staff.noName')}
                  {m.me && (
                    <Badge variant="secondary" className="ml-2">
                      {t('ish.staff.you')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">{m.email}</TableCell>
                <TableCell>
                  <RoleSelect member={m} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {new Date(m.added_at).toLocaleDateString(i18n.language, { dateStyle: 'medium', timeZone: 'Asia/Seoul' })}
                </TableCell>
                <TableCell className="text-right">
                  {!m.me && (
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                      <UserMinus className="mr-1.5 h-4 w-4" />
                      {t('ish.staff.remove')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <AddStaff candidates={candidates} />
      {removing && <RemoveDialog member={removing} onClose={() => setRemoving(null)} />}
    </div>
  );
}

function RoleSelect({ member }: { member: IshStaffMember }) {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: (role: IshStaffRole) => api.setStaffRole(member.id, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ishKeys.people });
      toast.success(t('ish.staff.roleChanged'));
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  return (
    <Select
      value={member.role}
      onValueChange={(v) => change.mutate(v as IshStaffRole)}
      disabled={member.me || change.isPending}
    >
      <SelectTrigger className="w-40" aria-label={t('ish.staff.role')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {t(`ish.staff.roles.${r}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddStaff({ candidates }: { candidates: IshStaffCandidate[] }) {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<IshStaffRole>('operator');
  const add = useMutation({
    mutationFn: () => api.addStaff(userId, role),
    onSuccess: () => {
      setUserId('');
      setRole('operator');
      void queryClient.invalidateQueries({ queryKey: ishKeys.people });
      toast.success(t('ish.staff.addedToast'));
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('ish.staff.noCandidates')}</p>;
  }
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-64 flex-1">
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger aria-label={t('ish.staff.addLabel')}>
              <SelectValue placeholder={t('ish.staff.addPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {[c.name || t('ish.staff.noName'), c.email].filter(Boolean).join(' — ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={role} onValueChange={(v) => setRole(v as IshStaffRole)}>
          <SelectTrigger className="w-40" aria-label={t('ish.staff.newRole')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`ish.staff.roles.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => add.mutate()} disabled={!userId || add.isPending}>
          {add.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          {t('ish.staff.add')}
        </Button>
      </CardContent>
    </Card>
  );
}

function RemoveDialog({ member, onClose }: { member: IshStaffMember; onClose: () => void }) {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.removeStaff(member.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ishKeys.people });
      toast.success(t('ish.staff.removed'));
      onClose();
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('ish.staff.removeTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium">{member.name || member.email || t('ish.staff.noName')}</span>
            {' — '}
            {t('ish.staff.removeText')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('ish.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              remove.mutate();
            }}
            disabled={remove.isPending}
          >
            {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('ish.staff.remove')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
