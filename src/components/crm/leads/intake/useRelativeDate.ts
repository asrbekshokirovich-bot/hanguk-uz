import { useTranslation } from 'react-i18next';
import type { DateParts } from './intakeForm';

/**
 * Date wording for the leads list and the intake screen.
 *
 * Phrased through i18n rather than a date library's locale bundles, for the
 * same reason `useDueLabel` does: the app ships four languages and the wording
 * here is short enough that a translated key is clearer — and testable — than a
 * per-language formatter. The month name is looked up from a translated array,
 * which is why `describeDate` hands back a month *index*.
 */
export const useRelativeDate = (now: Date) => {
  const { t } = useTranslation();

  /** "14-avgust · ertaga" — the date itself, plus how far off it is. */
  const label = (parts: DateParts): string => {
    const months = t('leads.intake.months', { returnObjects: true }) as string[];
    const month = Array.isArray(months) ? (months[parts.month] ?? '') : '';
    const date = t('leads.intake.dayOfMonth', { day: parts.day, month });

    const { offsetDays } = parts;
    const relative =
      offsetDays === 0
        ? t('leads.intake.relative.today')
        : offsetDays === 1
          ? t('leads.intake.relative.tomorrow')
          : offsetDays > 1
            ? t('leads.intake.relative.inDays', { count: offsetDays })
            : t('leads.intake.relative.overdueDays', { count: Math.abs(offsetDays) });

    return `${date} · ${relative}`;
  };

  /**
   * "3 kun oldin" for the created-at line under a name.
   *
   * The unit escalates because a queue that has not been worked in a year is
   * common, and "412 days ago" is a number nobody reads as a duration.
   */
  const addedLabel = (isoDate: string): string => {
    const created = new Date(isoDate);
    if (Number.isNaN(created.getTime())) return '';
    const days = Math.floor((now.getTime() - created.getTime()) / 86_400_000);
    if (days <= 0) return t('leads.intake.added.today');
    if (days < 7) return t('leads.intake.added.days', { count: days });
    if (days < 30) return t('leads.intake.added.weeks', { count: Math.floor(days / 7) });
    if (days < 365) return t('leads.intake.added.months', { count: Math.floor(days / 30) });
    return t('leads.intake.added.years', { count: Math.floor(days / 365) });
  };

  return { label, addedLabel };
};
