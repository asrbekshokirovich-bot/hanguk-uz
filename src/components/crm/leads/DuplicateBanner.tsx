import { useTranslation } from 'react-i18next';
import type { LeadVM } from './types';

interface DuplicateBannerProps {
  lead: LeadVM;
  onMerge: (lead: LeadVM) => void;
  onKeepBoth: (lead: LeadVM) => void;
  busy: boolean;
}

/**
 * Shown when an inbound lead's phone number already belongs to an earlier
 * record. Names the earlier record rather than just claiming a match, so the
 * operator can judge it — two siblings sharing a family phone are a real case,
 * and "Keep both" has to be as easy as merging.
 *
 * Both choices write to the touch history, so the decision is auditable later.
 */
export function DuplicateBanner({ lead, onMerge, onKeepBoth, busy }: DuplicateBannerProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-4 mt-3.5 rounded-md border border-dashed border-warning bg-warning/10 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-warning">
        {t('leads.duplicate.title')}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('leads.duplicate.note', { name: lead.duplicateNote })}
      </p>
      <div className="mt-2.5 flex gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onMerge(lead)}
          className="h-11 rounded-md bg-warning px-3 text-xs font-semibold text-warning-foreground transition-[filter] hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {t('leads.duplicate.merge')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onKeepBoth(lead)}
          className="h-11 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {t('leads.duplicate.keepBoth')}
        </button>
      </div>
    </div>
  );
}
