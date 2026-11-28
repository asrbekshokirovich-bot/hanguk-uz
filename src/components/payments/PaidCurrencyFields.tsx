import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatAmount } from '@/hooks/useStudentPlan';
import { PAYMENT_CURRENCIES, rateError, toAccountCurrency } from '@/lib/paymentCurrency';

interface PaidCurrencyFieldsProps {
  /** Currency the payment account (the debt) is kept in. */
  accountCurrency: string;
  /** Currency the money actually came in. */
  paidCurrency: string;
  onPaidCurrencyChange: (currency: string) => void;
  /** So'm per 1 USD, as typed. */
  rate: string;
  onRateChange: (rate: string) => void;
  /** The paid sum as typed, in paidCurrency. */
  paid: number;
}

/**
 * "Which currency did the money come in" + the exchange rate when it differs
 * from the account. Shows how much will be counted against the debt.
 */
export function PaidCurrencyFields({
  accountCurrency,
  paidCurrency,
  onPaidCurrencyChange,
  rate,
  onRateChange,
  paid,
}: PaidCurrencyFieldsProps) {
  const { t } = useTranslation();
  const differs = paidCurrency !== accountCurrency;
  const err = differs ? rateError(Number(rate)) : null;
  const converted = differs ? toAccountCurrency(paid, paidCurrency, accountCurrency, Number(rate)) : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t('payments.fx.paidIn')}</Label>
          <Select value={paidCurrency} onValueChange={onPaidCurrencyChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {differs && (
          <div className="space-y-2">
            <Label htmlFor="fx-rate">{t('payments.fx.rate')}</Label>
            <Input
              id="fx-rate"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={rate}
              onChange={(e) => onRateChange(e.target.value)}
              placeholder="12 500"
            />
          </div>
        )}
      </div>
      {differs && err === 'rateMissing' && (
        <p className="text-xs font-medium text-destructive">{t('payments.fx.rateMissing')}</p>
      )}
      {differs && err === 'rateOdd' && (
        <p className="text-xs font-medium text-destructive">{t('payments.fx.rateOdd')}</p>
      )}
      {differs && !err && converted !== null && paid > 0 && (
        <p className="text-xs font-medium text-primary">
          {t('payments.fx.counted', {
            paid: formatAmount(paid, paidCurrency),
            counted: formatAmount(converted, accountCurrency),
          })}
        </p>
      )}
    </div>
  );
}
