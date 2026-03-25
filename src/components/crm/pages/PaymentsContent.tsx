import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePayments, Payment } from '@/hooks/usePayments';
import { useCRMData } from '@/hooks/useCRMData';
import { PaymentList } from '@/components/payments/PaymentList';
import { CreatePaymentDialog } from '@/components/payments/CreatePaymentDialog';
import { InvoiceView } from '@/components/payments/InvoiceView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

export default function PaymentsContent() {
  const { t } = useTranslation();
  const { payments, loading, stats, createPayment, recordTransaction } = usePayments();
  const { students } = useCRMData();
  const [selectedInvoice, setSelectedInvoice] = useState<Payment | null>(null);

  const handleRecordPayment = async (paymentId: string, amount: number, method: string) => {
    await recordTransaction(paymentId, { amount, payment_method: method });
  };

  if (selectedInvoice) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>
        <InvoiceView payment={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${stats.totalCollected.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{t('payments.paidAmount')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${stats.totalPending.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{t('payments.pending')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completedCount}</p>
              <p className="text-xs text-muted-foreground">{t('payments.completed')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.overdueCount}</p>
              <p className="text-xs text-muted-foreground">{t('payments.overdue')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <CreatePaymentDialog 
          students={students} 
          onCreatePayment={createPayment} 
        />
      </div>

      {/* Payment List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t('payments.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentList 
            payments={payments} 
            loading={loading} 
            onRecordPayment={handleRecordPayment}
          />
        </CardContent>
      </Card>
    </div>
  );
}
