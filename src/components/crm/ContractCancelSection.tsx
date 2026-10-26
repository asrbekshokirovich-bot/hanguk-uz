import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Ban, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { paidByCurrency, parseRefundInput, validateRefunds, type RefundEntry } from '@/lib/contractCancel';

/**
 * "Shartnomani bekor qilish" at the bottom of a student's profile.
 *
 * Migration 20261026150000_contract_cancellation.sql holds the rules: an izoh
 * is required, the refund is asked per currency, the debt is closed, and only
 * owner / admin / contract_cancel_access (Omina) may cancel or restore. This
 * component only collects the input and asks "Rostdan ham...?" before calling
 * cancel_student_contract().
 */

// The tables and functions are newer than the generated types.
type Loose = {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};
const db = supabase as unknown as Loose;

interface Props {
  studentId: string;
  intakeId: string | null;
  onChanged: () => void;
}

interface CancellationRow {
  note: string;
  refunds: RefundEntry[];
  cancelled_at: string;
  cancelled_by: string | null;
}

export function ContractCancelSection({ studentId, intakeId, onChanged }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [cancellation, setCancellation] = useState<CancellationRow | null>(null);
  const [cancelledByName, setCancelledByName] = useState<string | null>(null);
  const [payments, setPayments] = useState<{ currency: string; paid_amount: number | null; status: string }[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [note, setNote] = useState('');
  const [refundInputs, setRefundInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!intakeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [membership, permission, latest, pays] = await Promise.all([
      db
        .from('student_intakes')
        .select('contract_cancelled_at')
        .eq('student_id', studentId)
        .eq('intake_id', intakeId)
        .maybeSingle(),
      db.rpc('can_cancel_contracts'),
      db
        .from('contract_cancellations')
        .select('note, refunds, cancelled_at, cancelled_by')
        .eq('student_id', studentId)
        .eq('intake_id', intakeId)
        .is('restored_at', null)
        .order('cancelled_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('payments')
        .select('currency, paid_amount, status')
        .eq('student_id', studentId)
        .eq('intake_id', intakeId),
    ]);

    // Before the migration is applied the column does not exist: show nothing.
    if (membership.error || !membership.data) {
      setAvailable(false);
      setLoading(false);
      return;
    }
    setAvailable(true);
    setCanManage(permission.data === true);
    setPayments(pays.data ?? []);

    const row: CancellationRow | null =
      membership.data.contract_cancelled_at && latest.data ? latest.data : null;
    setCancellation(row);
    if (row?.cancelled_by) {
      const { data: who } = await db
        .from('profiles')
        .select('full_name')
        .eq('user_id', row.cancelled_by)
        .maybeSingle();
      setCancelledByName(who?.full_name ?? null);
    } else {
      setCancelledByName(null);
    }
    setLoading(false);
  }, [studentId, intakeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const paid = useMemo(() => paidByCurrency(payments), [payments]);

  const refunds = useMemo(() => parseRefundInput(refundInputs), [refundInputs]);
  const refundError = useMemo(() => validateRefunds(refunds, paid), [refunds, paid]);
  const formValid = note.trim().length > 0 && !refundError;

  const openForm = () => {
    setNote('');
    setRefundInputs({});
    setFormOpen(true);
  };

  const doCancel = async () => {
    if (!intakeId) return;
    setBusy(true);
    const { error } = await db.rpc('cancel_student_contract', {
      p_student_id: studentId,
      p_intake_id: intakeId,
      p_note: note.trim(),
      p_refunds: refunds,
    });
    setBusy(false);
    setConfirmOpen(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFormOpen(false);
    toast.success(t('crm.contractCancel.done'));
    await load();
    onChanged();
  };

  const doRestore = async () => {
    if (!intakeId) return;
    setBusy(true);
    const { error } = await db.rpc('restore_student_contract', {
      p_student_id: studentId,
      p_intake_id: intakeId,
    });
    setBusy(false);
    setRestoreOpen(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('crm.contractCancel.restored'));
    await load();
    onChanged();
  };

  if (loading || !available) return null;
  // Nothing to show to someone who can neither act nor read a cancellation.
  if (!cancellation && !canManage) return null;

  const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/,/g, ' ');

  return (
    <section className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      {cancellation ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <Ban className="h-4 w-4" />
              {t('crm.contractCancel.cancelledTitle')}
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(cancellation.cancelled_at), 'dd.MM.yyyy HH:mm')}
              {cancelledByName ? ` · ${cancelledByName}` : ''}
            </p>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              <span className="font-medium">{t('crm.contractCancel.note')}:</span> {cancellation.note}
            </p>
            <p className="text-sm text-foreground">
              <span className="font-medium">{t('crm.contractCancel.refunded')}:</span>{' '}
              {cancellation.refunds.length > 0
                ? cancellation.refunds.map((r) => `${fmt(Number(r.amount))} ${r.currency}`).join(', ')
                : t('crm.contractCancel.noRefund')}
            </p>
          </div>
          {canManage && (
            <Button variant="outline" className="gap-2 shrink-0" onClick={() => setRestoreOpen(true)}>
              <RotateCcw className="h-4 w-4" />
              {t('crm.contractCancel.restore')}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t('crm.contractCancel.hint')}</p>
          <Button variant="destructive" className="gap-2 shrink-0" onClick={openForm}>
            <Ban className="h-4 w-4" />
            {t('crm.contractCancel.button')}
          </Button>
        </div>
      )}

      {/* Step 1: izoh + refund */}
      <Dialog open={formOpen} onOpenChange={(o) => !busy && setFormOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('crm.contractCancel.button')}</DialogTitle>
            <DialogDescription>{t('crm.contractCancel.formHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cc-note">
                {t('crm.contractCancel.note')} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="cc-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={t('crm.contractCancel.notePlaceholder')}
              />
            </div>
            {paid.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('crm.contractCancel.nothingPaid')}</p>
            ) : (
              paid.map((p) => (
                <div key={p.currency} className="space-y-1.5">
                  <Label htmlFor={`cc-ref-${p.currency}`}>
                    {t('crm.contractCancel.refundAmount', { currency: p.currency })}
                  </Label>
                  <Input
                    id={`cc-ref-${p.currency}`}
                    inputMode="decimal"
                    value={refundInputs[p.currency] ?? ''}
                    onChange={(e) =>
                      setRefundInputs((prev) => ({ ...prev, [p.currency]: e.target.value }))
                    }
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('crm.contractCancel.paidSoFar', { amount: `${fmt(p.amount)} ${p.currency}` })}
                  </p>
                </div>
              ))
            )}
            {refundError && <p className="text-sm text-destructive">{t(refundError.key, refundError.params)}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" disabled={!formValid || busy} onClick={() => setConfirmOpen(true)}>
              {t('crm.contractCancel.button')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: "Rostdan ham bekor qilmoqchimisiz?" */}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('crm.contractCancel.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {refunds.length > 0
                ? t('crm.contractCancel.confirmWithRefund', {
                    refund: refunds.map((r) => `${fmt(r.amount)} ${r.currency}`).join(', '),
                  })
                : t('crm.contractCancel.confirmNoRefund')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('crm.contractCancel.no')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void doCancel();
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('crm.contractCancel.yes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore */}
      <AlertDialog open={restoreOpen} onOpenChange={(o) => !busy && setRestoreOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('crm.contractCancel.restoreTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('crm.contractCancel.restoreHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('crm.contractCancel.no')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void doRestore();
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('crm.contractCancel.restore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
