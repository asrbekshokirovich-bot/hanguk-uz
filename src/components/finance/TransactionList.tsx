import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  ArrowUpRight, 
  ArrowDownRight,
  DollarSign,
  CreditCard,
  Pencil
} from 'lucide-react';
import { Payment } from '@/hooks/usePayments';
import { formatAmount } from '@/hooks/useStudentPlan';
import { supabase } from '@/integrations/supabase/client';
import { AddExpenseDialog } from './AddExpenseDialog';
import { EditTransactionDialog } from './EditTransactionDialog';

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  payment_method: string | null;
  recipient: string | null;
  expense_date: string;
  notes: string | null;
  created_at: string;
  linked_transaction_id: string | null;
}

interface TransactionListProps {
  payments: Payment[];
  loading: boolean;
}

interface TransactionItem {
  id: string;
  type: 'income' | 'expense';
  name: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  isGatewayFee?: boolean;
}

export function TransactionList({ payments, loading }: TransactionListProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(false);

  // Fetch expenses
  const fetchExpenses = async () => {
    setExpensesLoading(true);
    const { data, error } = await supabase
      .from('expenses' as any)
      .select('*')
      .order('expense_date', { ascending: false });
    
    if (!error && data) {
      setExpenses(data as unknown as Expense[]);
    }
    setExpensesLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Combine income and expense transactions
  const allTransactions = useMemo(() => {
    const transactions: TransactionItem[] = [];

    // Add income from payments
    payments.forEach(payment => {
      if (Number(payment.paid_amount) > 0) {
        transactions.push({
          id: payment.id,
          type: 'income',
          name: payment.student?.full_name || 'Unknown',
          description: payment.payment_type === 'initial_deposit' ? '1st Payment' : 
                       payment.payment_type === 'remaining_payment' ? '2nd Payment' : 'Other',
          amount: Number(payment.paid_amount),
          currency: payment.currency,
          category: payment.payment_type,
          date: payment.paid_at || payment.created_at,
        });
      }
    });

    // Add expenses
    expenses.forEach(expense => {
      transactions.push({
        id: expense.id,
        type: 'expense',
        name: expense.recipient || expense.category,
        description: expense.description,
        amount: Number(expense.amount),
        currency: expense.currency,
        category: expense.category,
        date: expense.expense_date,
        isGatewayFee: expense.category === 'gateway_fee',
      });
    });

    // Sort by date descending
    return transactions.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [payments, expenses]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = tx.name.toLowerCase().includes(query);
        const descMatch = tx.description.toLowerCase().includes(query);
        if (!nameMatch && !descMatch) return false;
      }

      // Type filter (income/expense)
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }

      // Date range filter
      if (dateRange !== 'all') {
        const txDate = new Date(tx.date);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (dateRange) {
          case 'today':
            if (txDate < startOfToday) return false;
            break;
          case 'week':
            const weekAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (txDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (txDate < monthAgo) return false;
            break;
        }
      }

      return true;
    });
  }, [allTransactions, searchQuery, typeFilter, dateRange]);

  // Calculate totals
  const totals = useMemo(() => {
    const incomeUZS = filteredTransactions
      .filter(tx => tx.type === 'income' && tx.currency === 'UZS')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const expenseUZS = filteredTransactions
      .filter(tx => tx.type === 'expense' && tx.currency === 'UZS')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const incomeUSD = filteredTransactions
      .filter(tx => tx.type === 'income' && tx.currency === 'USD')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const expenseUSD = filteredTransactions
      .filter(tx => tx.type === 'expense' && tx.currency === 'USD')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    return { incomeUZS, expenseUZS, incomeUSD, expenseUSD, netUZS: incomeUZS - expenseUZS, netUSD: incomeUSD - expenseUSD };
  }, [filteredTransactions]);

  const getTypeBadge = (tx: TransactionItem) => {
    if (tx.type === 'income') {
      switch (tx.category) {
        case 'initial_deposit':
          return <Badge variant="default">1st Payment</Badge>;
        case 'remaining_payment':
          return <Badge variant="secondary">2nd Payment</Badge>;
        default:
          return <Badge variant="outline">Other</Badge>;
      }
    } else {
      if (tx.isGatewayFee) {
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">Komissiya</Badge>;
      }
      return <Badge variant="destructive" className="capitalize">{tx.category}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kirim (UZS)</p>
              <p className="text-xl font-bold text-green-600">{formatAmount(totals.incomeUZS, 'UZS')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <ArrowDownRight className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Chiqim (UZS)</p>
              <p className="text-xl font-bold text-red-600">{formatAmount(totals.expenseUZS, 'UZS')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sof (UZS)</p>
              <p className={`text-xl font-bold ${totals.netUZS >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatAmount(totals.netUZS, 'UZS')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tranzaksiyalar</p>
              <p className="text-xl font-bold">{filteredTransactions.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Turi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  <SelectItem value="income">Kirim</SelectItem>
                  <SelectItem value="expense">Chiqim</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Sana" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hammasi</SelectItem>
                  <SelectItem value="today">Bugun</SelectItem>
                  <SelectItem value="week">7 kun</SelectItem>
                  <SelectItem value="month">30 kun</SelectItem>
                </SelectContent>
              </Select>
              <AddExpenseDialog onSuccess={fetchExpenses} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sana</TableHead>
                  <TableHead>Nomi</TableHead>
                  <TableHead>Turi</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Tranzaksiya topilmadi
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} className="group">
                      <TableCell>
                        <div>
                          <p className="font-medium">{format(new Date(tx.date), 'dd.MM.yyyy')}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tx.name}</p>
                          <p className="text-xs text-muted-foreground">{tx.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(tx)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {tx.type === 'income' ? (
                            <>
                              <ArrowUpRight className="h-3 w-3 text-green-500" />
                              <span className="font-medium text-green-600">+{formatAmount(tx.amount, tx.currency)}</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="h-3 w-3 text-red-500" />
                              <span className="font-medium text-red-600">-{formatAmount(tx.amount, tx.currency)}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {tx.type === 'expense' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setEditingTransaction(tx)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Transaction Dialog */}
      {editingTransaction && (
        <EditTransactionDialog
          transaction={editingTransaction}
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          onSuccess={fetchExpenses}
        />
      )}
    </div>
  );
}
