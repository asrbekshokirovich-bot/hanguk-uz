import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CalendarClock,
  AlertTriangle,
  Check,
  X,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { formatAmount } from '@/hooks/useStudentPlan';
import { PlannedTransaction, usePlannedTransactions } from '@/hooks/usePlannedTransactions';
import { AddPlannedTransactionDialog } from './AddPlannedTransactionDialog';

interface Props {
  data: ReturnType<typeof usePlannedTransactions>;
}

function TransactionRow({
  item,
  onComplete,
  onCancel,
  onRemove,
}: {
  item: PlannedTransaction;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const isOverdue = item.status === 'planned' && new Date(item.expected_date) < new Date(new Date().toDateString());
  const isIncome = item.type === 'income';

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${isOverdue ? 'border-destructive/30 bg-destructive/5' : 'bg-muted/30'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isIncome ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          {isIncome ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.description}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{item.expected_date}</span>
            {item.recurrence && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">{item.recurrence}</Badge>
            )}
            {isOverdue && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                Muddati o'tgan
              </Badge>
            )}
            {item.status === 'completed' && (
              <Badge variant="default" className="text-[10px] px-1 py-0 bg-success">Bajarildi</Badge>
            )}
            {item.status === 'cancelled' && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">Bekor</Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-sm font-semibold ${isIncome ? 'text-success' : 'text-destructive'}`}>
          {isIncome ? '+' : '-'}{formatAmount(item.amount, item.currency)}
        </span>
        {item.status === 'planned' && (
          <>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onComplete(item.id)} title="Bajarildi">
              <Check className="h-3.5 w-3.5 text-success" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onCancel(item.id)} title="Bekor qilish">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </>
        )}
        {item.status !== 'planned' && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemove(item.id)} title="O'chirish">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function UpcomingTransactionsPanel({ data }: Props) {
  const { planned, upcoming, overdue, stats, create, markCompleted, cancel, remove, items } = data;
  const completed = items.filter(i => i.status === 'completed');
  const cancelled = items.filter(i => i.status === 'cancelled');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="h-5 w-5" />
          Rejalashtirilgan tranzaksiyalar
        </CardTitle>
        <AddPlannedTransactionDialog onCreate={create} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-success/10">
            <p className="text-xs text-muted-foreground">Kutilayotgan daromad</p>
            <p className="text-sm font-bold text-success">
              {stats.upcomingIncomeUZS > 0 && formatAmount(stats.upcomingIncomeUZS, 'UZS')}
              {stats.upcomingIncomeUZS > 0 && stats.upcomingIncomeUSD > 0 && ' / '}
              {stats.upcomingIncomeUSD > 0 && formatAmount(stats.upcomingIncomeUSD, 'USD')}
              {stats.upcomingIncomeUZS === 0 && stats.upcomingIncomeUSD === 0 && '—'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10">
            <p className="text-xs text-muted-foreground">Kutilayotgan xarajat</p>
            <p className="text-sm font-bold text-destructive">
              {stats.upcomingExpenseUZS > 0 && formatAmount(stats.upcomingExpenseUZS, 'UZS')}
              {stats.upcomingExpenseUZS > 0 && stats.upcomingExpenseUSD > 0 && ' / '}
              {stats.upcomingExpenseUSD > 0 && formatAmount(stats.upcomingExpenseUSD, 'USD')}
              {stats.upcomingExpenseUZS === 0 && stats.upcomingExpenseUSD === 0 && '—'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-warning/10">
            <p className="text-xs text-muted-foreground">Muddati o'tgan</p>
            <p className="text-sm font-bold text-warning">{stats.overdueCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-info/10">
            <p className="text-xs text-muted-foreground">Jami rejada</p>
            <p className="text-sm font-bold text-info">{planned.length}</p>
          </div>
        </div>

        {/* Overdue */}
        {overdue.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Muddati o'tganlar ({overdue.length})
            </h4>
            {overdue.map((item) => (
              <TransactionRow key={item.id} item={item} onComplete={markCompleted} onCancel={cancel} onRemove={remove} />
            ))}
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Kelayotgan ({upcoming.length})</h4>
            {upcoming.map((item) => (
              <TransactionRow key={item.id} item={item} onComplete={markCompleted} onCancel={cancel} onRemove={remove} />
            ))}
          </div>
        )}

        {/* Completed / Cancelled (collapsed) */}
        {(completed.length > 0 || cancelled.length > 0) && (
          <details className="group">
            <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
              Tugatilgan ({completed.length}) / Bekor qilingan ({cancelled.length})
            </summary>
            <div className="mt-2 space-y-2">
              {[...completed, ...cancelled].map((item) => (
                <TransactionRow key={item.id} item={item} onComplete={markCompleted} onCancel={cancel} onRemove={remove} />
              ))}
            </div>
          </details>
        )}

        {planned.length === 0 && completed.length === 0 && cancelled.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            Hali rejalashtirilgan tranzaksiyalar yo'q
          </p>
        )}
      </CardContent>
    </Card>
  );
}
