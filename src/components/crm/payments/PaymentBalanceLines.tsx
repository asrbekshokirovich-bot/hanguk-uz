import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatBalanceParts, type CurrencyBalance } from '@/lib/paymentBalance';

/**
 * "5000$ dan 1000$ to'langan, 4000$ qoldi" — one line per currency.
 *
 * No "N days overdue" wording on purpose: the owner asked for the amounts
 * only; lateness is shown by the red chip alone.
 */
export function PaymentBalanceLines({
  balances,
  className,
}: {
  balances: CurrencyBalance[] | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!balances || balances.length === 0) return null;
  return (
    <div className={cn('space-y-0.5 text-xs text-muted-foreground', className)}>
      {balances.map((b) => (
        <p key={b.currency} className="whitespace-nowrap tabular-nums">
          {t('payments.balanceLine', formatBalanceParts(b))}
        </p>
      ))}
    </div>
  );
}
