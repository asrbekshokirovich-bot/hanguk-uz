import { useTranslation } from 'react-i18next';
import { Target } from 'lucide-react';

/**
 * Shown when the filters match nothing. Names the way out (clear the filter,
 * or add a lead) rather than just stating the absence.
 */
export function WorklistEmpty({ onAddLead }: { onAddLead: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto mb-3.5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Target className="h-7 w-7 text-primary" aria-hidden />
      </div>
      <p className="text-lg font-bold text-foreground">{t('leads.worklist.clearTitle')}</p>
      <p className="mx-auto mt-1.5 max-w-[340px] text-[13.5px] text-muted-foreground">
        {t('leads.worklist.clearBody')}
      </p>
      <button
        type="button"
        onClick={onAddLead}
        className="mt-4 h-11 rounded-md border border-border px-4 text-[13px] font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        {t('leads.addLead')}
      </button>
    </div>
  );
}
