import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/brand/Logo';
import { Download, Printer } from 'lucide-react';
import { Payment } from '@/hooks/usePayments';

interface InvoiceViewProps {
  payment: Payment;
  onClose: () => void;
}

export function InvoiceView({ payment, onClose }: InvoiceViewProps) {
  const { t } = useTranslation();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>

      <Card ref={invoiceRef} className="max-w-2xl mx-auto">
        <CardHeader className="text-center border-b">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Logo variant="glyph" className="h-12 w-12" />
            <div>
              <CardTitle className="text-2xl">Hanguk Consulting</CardTitle>
              <p className="text-sm text-muted-foreground">Education Consulting Services</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-primary">{t('payments.invoice').toUpperCase()}</div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('payments.invoice')} #</p>
              <p className="font-medium">{payment.invoice_number}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{t('common.date')}</p>
              <p className="font-medium">{new Date(payment.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <Separator />

          {/* Bill To */}
          <div>
            <p className="text-sm text-muted-foreground mb-1">Bill To:</p>
            <p className="font-medium">{payment.student?.full_name || 'Student'}</p>
            {payment.student?.phone && (
              <p className="text-sm text-muted-foreground">{payment.student.phone}</p>
            )}
          </div>

          <Separator />

          {/* Line Items */}
          <div className="space-y-3">
            <div className="grid grid-cols-12 text-sm font-medium text-muted-foreground">
              <div className="col-span-6">{t('common.description')}</div>
              <div className="col-span-3 text-right">{t('common.status')}</div>
              <div className="col-span-3 text-right">{t('payments.totalAmount')}</div>
            </div>
            <div className="grid grid-cols-12 items-center py-3 border-b">
              <div className="col-span-6">
                <p className="font-medium">
                  {payment.payment_type === 'initial_deposit' 
                    ? t('payments.initialPayment')
                    : payment.payment_type === 'remaining_payment'
                    ? t('payments.remainingPayment')
                    : 'Payment'}
                </p>
                {payment.notes && (
                  <p className="text-sm text-muted-foreground">{payment.notes}</p>
                )}
              </div>
              <div className="col-span-3 text-right">
                <span className={`px-2 py-1 rounded text-xs ${
                  payment.status === 'completed' 
                    ? 'bg-success/10 text-success' 
                    : payment.status === 'partial'
                    ? 'bg-info/10 text-info'
                    : 'bg-warning/10 text-warning'
                }`}>
                  {payment.status}
                </span>
              </div>
              <div className="col-span-3 text-right font-medium">
                {formatCurrency(Number(payment.amount), payment.currency)}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 pt-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('payments.totalAmount')}</span>
              <span className="font-medium">{formatCurrency(Number(payment.amount), payment.currency)}</span>
            </div>
            <div className="flex justify-between text-success">
              <span>{t('payments.paidAmount')}</span>
              <span className="font-medium">{formatCurrency(Number(payment.paid_amount), payment.currency)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>{t('payments.remainingPayment')}</span>
              <span className="text-primary">
                {formatCurrency(Number(payment.amount) - Number(payment.paid_amount), payment.currency)}
              </span>
            </div>
          </div>

          {/* Due Date */}
          {payment.due_date && (
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">{t('payments.dueDate')}</p>
              <p className="font-medium">{new Date(payment.due_date).toLocaleDateString()}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground pt-6 border-t">
            <p>Thank you for choosing Hanguk Consulting!</p>
            <p>For questions, contact us at info@hanguk.uz</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
