import { useTranslation } from 'react-i18next';
import { qualificationFields } from './qualification';
import type { QualificationKey } from './qualification';
import type { LeadVM } from './types';

interface QualificationListProps {
  lead: LeadVM;
  /** Flags an unanswered field to ask about on the next call. */
  onAsk: (key: QualificationKey) => void;
  busy: boolean;
}

/**
 * The five fields a contract needs. Known values read as plain text; unknown
 * ones become a dashed "Ask on the call" button that writes the question into
 * the touch history, so the gap turns into a task instead of a blank.
 *
 * Stored values are enum keys (`high_school`, `20000_plus`); each has a
 * translation, and anything unrecognised falls back to the raw string rather
 * than rendering an empty cell.
 */
export function QualificationList({ lead, onAsk, busy }: QualificationListProps) {
  const { t } = useTranslation();
  const fields = qualificationFields(lead.lead);
  const missing = fields.filter((field) => field.value === null).length;

  return (
    <section className="border-b border-border px-4 py-4">
      <div className="mb-2.5 flex items-center gap-2">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          {t('leads.detail.qualificationTitle')}
        </h3>
        {missing > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {t('leads.detail.missingCount', { n: missing })}
          </span>
        )}
      </div>

      <dl className="flex flex-col gap-2">
        {fields.map((field) => (
          <div key={field.key} className="flex items-center gap-2.5">
            <dt className="w-24 shrink-0 text-[12.5px] font-medium text-muted-foreground">
              {t(`leads.qualification.${field.key}`)}
            </dt>
            <dd className="min-w-0 flex-1">
              {field.value ? (
                <span className="block truncate text-[12.5px] font-semibold text-foreground">
                  {t(`leads.qualification.values.${field.value}`, { defaultValue: field.value })}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAsk(field.key)}
                  className="min-h-11 w-full rounded-md border border-dashed border-border px-2.5 py-1.5 text-left text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  {t('leads.detail.askOnCall')}
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
