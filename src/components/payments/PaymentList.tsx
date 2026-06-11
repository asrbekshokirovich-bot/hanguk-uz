import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  DollarSign, 
  Plus, 
  Search, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  FileText,
  CreditCard,
  User
} from 'lucide-react';
import { Payment } from '@/hooks/usePayments';
import { PAYMENT_METHODS_WITH_FEES, calculateGatewayFee, getGatewayFeeRate } from '@/lib/paymentUtils';

interface PaymentListProps {
  payments: Payment[];
  loading: boolean;
  onRecordPayment: (paymentId: string, amount: number, method: string) => Promise<void>;
}

const getStatusBadge = (status: Payment['status']) => {
  switch (status) {
    case 'completed':
      return <Badge className="bg-success"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
    case 'partial':
      return <Badge className="bg-info"><Clock className="h-3 w-3 mr-1" /> Partial</Badge>;
    case 'overdue':
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Overdue</Badge>;
    case 'refunded':
      return <Badge variant="secondary">Refunded</Badge>;
    default:
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
  }
};

const getTypeLabel = (type: Payment['payment_type'], t: any) => {
  switch (type) {
    case 'initial_deposit':
      return t('payments.initialPayment');
    case 'remaining_payment':
      return t('payments.remainingPayment');
    default:
      return t('payments.title');
  }
};

export function PaymentList({ payments, loading, onRecordPayment }: PaymentListProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = !searchQuery || 
      payment.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || payment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleRecordPayment = async () => {
    if (selectedPayment && paymentAmount) {
      await onRecordPayment(selectedPayment.id, parseFloat(paymentAmount), paymentMethod);
      setIsDialogOpen(false);
      setPaymentAmount('');
      setSelectedPayment(null);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${t('common.search')}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? null : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('common.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="pending">{t('payments.pending')}</SelectItem>
            <SelectItem value="partial">{t('payments.partial')}</SelectItem>
            <SelectItem value="completed">{t('payments.completed')}</SelectItem>
            <SelectItem value="overdue">{t('payments.overdue')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payment Cards */}
      {filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('common.none')} {t('payments.title').toLowerCase()}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((payment) => {
            const progress = (Number(payment.paid_amount) / Number(payment.amount)) * 100;
            const remaining = Number(payment.amount) - Number(payment.paid_amount);

            return (
              <Card key={payment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{payment.student?.full_name || 'Unknown'}</span>
                        {getStatusBadge(payment.status)}
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {payment.invoice_number}
                        </span>
                        <Badge variant="outline">{getTypeLabel(payment.payment_type, t)}</Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{formatCurrency(Number(payment.paid_amount), payment.currency)} / {formatCurrency(Number(payment.amount), payment.currency)}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      {payment.due_date && (
                        <p className="text-xs text-muted-foreground">
                          {t('payments.dueDate')}: {new Date(payment.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {payment.status !== 'completed' && payment.status !== 'refunded' && (
                        <Dialog open={isDialogOpen && selectedPayment?.id === payment.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if (open) setSelectedPayment(payment);
                        }}>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <CreditCard className="h-4 w-4 mr-2" />
                              {t('payments.title')}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t('payments.title')}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm text-muted-foreground mb-1">{t('payments.remainingPayment')}</p>
                                <p className="text-2xl font-bold">{formatCurrency(remaining, payment.currency)}</p>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">{t('payments.paidAmount')}</label>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={paymentAmount}
                                  onChange={(e) => setPaymentAmount(e.target.value)}
                                  max={remaining}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Payment Method</label>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PAYMENT_METHODS_WITH_FEES.map((method) => (
                                      <SelectItem key={method.value} value={method.value}>
                                        {method.label} {method.feeRate > 0 && `(${(method.feeRate * 100).toFixed(1)}%)`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {paymentAmount && parseFloat(paymentAmount) > 0 && (
                                <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Gateway Fee ({getGatewayFeeRate(paymentMethod)})</span>
                                    <span className="font-medium text-destructive">
                                      -{formatCurrency(calculateGatewayFee(parseFloat(paymentAmount), paymentMethod), payment.currency)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between border-t pt-1">
                                    <span className="text-muted-foreground">Net Amount</span>
                                    <span className="font-medium">
                                      {formatCurrency(parseFloat(paymentAmount) - calculateGatewayFee(parseFloat(paymentAmount), paymentMethod), payment.currency)}
                                    </span>
                                  </div>
                                </div>
                              )}
                              <Button className="w-full" onClick={handleRecordPayment}>
                                {t('common.confirm')} {t('payments.title')}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        {t('payments.invoice')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
