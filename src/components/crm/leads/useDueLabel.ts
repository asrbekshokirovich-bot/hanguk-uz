import { useTranslation } from 'react-i18next';

/**
 * Human due line for the next call: "3h overdue", "in 40m", "in 2 days".
 *
 * Kept as a hook so every surface (row, pane, AI card) phrases time the same
 * way and stays translatable. `null` means nothing is scheduled.
 */
export function useDueLabel(minutes: number | null): string {
  const { t } = useTranslation();
  return formatDue(minutes, t);
}

type Translate = ReturnType<typeof useTranslation>['t'];

/** The pure formatter, so callers outside a component can reuse the wording. */
export function formatDue(minutes: number | null, t: Translate): string {
  if (minutes === null) return t('leads.worklist.unscheduled');
  if (minutes < 0) {
    const overdue = Math.abs(minutes);
    return overdue >= 60
      ? t('leads.worklist.overdueHours', { n: Math.round(overdue / 60) })
      : t('leads.worklist.overdueMinutes', { n: overdue });
  }
  if (minutes < 60) return t('leads.worklist.inMinutes', { n: minutes });
  if (minutes < 1440) return t('leads.worklist.inHours', { n: Math.round(minutes / 60) });
  return t('leads.worklist.inDays', { n: Math.round(minutes / 1440) });
}
