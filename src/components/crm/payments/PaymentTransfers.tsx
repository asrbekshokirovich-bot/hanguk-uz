import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ImagePlus, Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { MultiReceiptUpload } from '@/components/payments/MultiReceiptUpload';
import { formatAmount } from '@/hooks/useStudentPlan';
import { getPaymentMethodLabel } from '@/lib/paymentUtils';
import { addReceiptsToTransfer } from '@/lib/recordInstallment';
import { receiptsOf } from '@/lib/paymentBalance';

export interface TransferRow {
  id: string;
  amount: number;
  payment_method: string | null;
  created_at: string;
  paid_on?: string | null;
  receipt_url?: string | null;
  receipt_urls?: string[] | null;
}

/**
 * The transfers (bo'laklar) behind one payment account, oldest first, each
 * with its paid date, amount, method and receipt images — and the two things
 * staff need here: add another transfer, add a receipt to one already saved.
 */
export function PaymentTransfers({
  transfers,
  currency,
  studentId,
  canAdd,
  onAddInstallment,
  onChanged,
}: {
  transfers: TransferRow[] | undefined;
  currency: string;
  studentId: string;
  canAdd: boolean;
  onAddInstallment: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [receiptFor, setReceiptFor] = useState<TransferRow | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const rows = [...(transfers ?? [])].sort((a, b) =>
    (a.paid_on ?? a.created_at).localeCompare(b.paid_on ?? b.created_at),
  );

  const saveReceipts = async () => {
    if (!receiptFor || added.length === 0) {
      setReceiptFor(null);
      return;
    }
    setSaving(true);
    try {
      await addReceiptsToTransfer(receiptFor.id, receiptsOf(receiptFor), added);
      toast({ title: t('common.success'), description: t('payments.installment.receiptsSaved') });
      setReceiptFor(null);
      setAdded([]);
      onChanged();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t('payments.installment.listTitle', { count: rows.length })}</p>
        {canAdd && (
          <Button size="sm" variant="outline" className="gap-1" onClick={onAddInstallment}>
            <Plus className="h-4 w-4" />
            {t('payments.installment.add')}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('payments.installment.none')}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((tx) => {
            const receipts = receiptsOf(tx);
            const date = tx.paid_on ?? tx.created_at;
            return (
              <li key={tx.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2 text-sm">
                <span className="tabular-nums text-muted-foreground">{format(new Date(date), 'dd.MM.yyyy')}</span>
                <span className="font-semibold tabular-nums">{formatAmount(Number(tx.amount), currency)}</span>
                {tx.payment_method && (
                  <span className="text-muted-foreground">{getPaymentMethodLabel(tx.payment_method)}</span>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  {receipts.map((url, i) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      title={t('payments.installment.receiptN', { n: i + 1 })}
                      className="block h-9 w-9 overflow-hidden rounded border bg-muted"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                  {receipts.length === 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Receipt className="h-3.5 w-3.5" />
                      {t('payments.installment.noReceipt')}
                    </span>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title={t('payments.installment.addReceipt')}
                    aria-label={t('payments.installment.addReceipt')}
                    onClick={() => {
                      setAdded([]);
                      setReceiptFor(tx);
                    }}
                  >
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!receiptFor} onOpenChange={(o) => !o && setReceiptFor(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t('payments.installment.addReceipt')}</DialogTitle>
          </DialogHeader>
          <MultiReceiptUpload
            value={added}
            onChange={setAdded}
            studentId={studentId}
            maxFiles={Math.max(10 - (receiptFor ? receiptsOf(receiptFor).length : 0), 1)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReceiptFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveReceipts} disabled={saving || added.length === 0}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
