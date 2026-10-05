import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeadRecord } from './useLeadProfile';

interface LeadAppQuizProps {
  lead: LeadRecord;
}

const BAND_STYLE: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  mid: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-red-50 text-red-700 border-red-200',
};

function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

/**
 * What the customer answered in the app's eligibility quiz, and the result
 * the app showed them.
 *
 * The answers are stored as codes (`leads.quiz_answers`), so the labels here
 * are the CRM's own; an unknown code is shown as it is rather than hidden.
 */
export function LeadAppQuiz({ lead }: LeadAppQuizProps) {
  const { t } = useTranslation();
  if (!lead.quiz_submitted_at && !lead.quiz_answers) return null;

  const a = lead.quiz_answers ?? {};
  const label = (group: string, value: unknown) => {
    const code = str(value);
    return code ? t(`leads.profile.app.${group}.${code}`, { defaultValue: code }) : null;
  };

  const grad = str(a.grad_year);
  const ageGrad = [
    str(a.age) ? t('leads.profile.app.age', { age: str(a.age) }) : null,
    grad === 'studying' ? t('leads.profile.app.studying') : grad,
  ];

  const rows: { key: string; value: (string | null)[] }[] = [
    { key: 'route', value: [label('routes', a.route)] },
    { key: 'ageGrad', value: ageGrad },
    { key: 'korean', value: [label('korean', a.korean)] },
    { key: 'english', value: [label('english', a.english)] },
    { key: 'money', value: [label('budget', a.budget), label('payer', a.payer)] },
    {
      key: 'documents',
      value: [
        str(a.formal_income) ? `${t('leads.profile.app.income')}: ${label('yesNo', a.formal_income)}` : null,
        str(a.bank_statement) ? `${t('leads.profile.app.bank')}: ${label('yesNo', a.bank_statement)}` : null,
        str(a.kdb) ? `${t('leads.profile.app.kdb')}: ${label('kdbStatus', a.kdb)}` : null,
      ],
    },
    { key: 'whereWhen', value: [str(a.region), label('intake', a.intake)] },
  ];

  const band = lead.eligibility_band;
  const tariff = lead.tariff_interest;
  const sent = lead.quiz_submitted_at ? new Date(lead.quiz_submitted_at) : null;

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-bold text-foreground">{t('leads.profile.app.title')}</h2>
        {sent && (
          <p className="text-[11.5px] text-muted-foreground">
            {t('leads.profile.app.sent', { date: sent.toLocaleString() })}
          </p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {band && (
          <span
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[12px] font-semibold',
              BAND_STYLE[band] ?? 'border-border text-foreground',
            )}
          >
            {t(`leads.profile.app.band.${band}`, { defaultValue: band })}
          </span>
        )}
        {tariff && (
          <span className="rounded-full border border-border px-2.5 py-0.5 text-[12px] font-semibold text-foreground">
            {t('leads.profile.app.tariff', {
              tariff: t(`leads.profile.app.tariffs.${tariff}`, { defaultValue: tariff }),
            })}
          </span>
        )}
        {lead.needs_operator && (
          <span className="flex items-center gap-1 text-[12px] font-semibold text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {t('leads.profile.app.needsOperator')}
          </span>
        )}
      </div>

      <dl className="mt-1 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline">
            <dt className="w-[150px] shrink-0 text-[12.5px] font-semibold text-muted-foreground">
              {t(`leads.profile.app.rows.${row.key}`)}
            </dt>
            <dd className="min-w-0 flex-1 text-[13px] text-foreground">
              {row.value.filter(Boolean).join(' · ') || '—'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
