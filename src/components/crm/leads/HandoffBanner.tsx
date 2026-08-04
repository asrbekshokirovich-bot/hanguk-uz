import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';

interface HandoffBannerProps {
  message: string;
  onDismiss: () => void;
}

/**
 * The lime strip that confirms a lead has left the worklist — converted,
 * merged, or removed as a wrong number.
 *
 * A row vanishing from the queue is otherwise indistinguishable from a bug, so
 * every removal says what happened and, for a conversion, what now waits for
 * the preparers: the contract exists and the document pack is open.
 */
export function HandoffBanner({ message, onDismiss }: HandoffBannerProps) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="mb-3.5 flex items-center gap-3 rounded-lg border border-accent bg-accent/10 px-3.5 py-2.5"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0 text-spring" aria-hidden />
      <p className="flex-1 text-[12.5px] font-semibold text-spring">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="h-11 shrink-0 rounded-md border border-accent px-3 text-[11.5px] font-semibold text-spring hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        {t('leads.handoff.dismiss')}
      </button>
    </div>
  );
}
