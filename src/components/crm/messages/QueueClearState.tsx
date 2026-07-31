import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';

/**
 * Shown in the thread pane when no conversation matches the current filters —
 * the good outcome, not an error. The lime CTA drops the operator straight
 * back into the Unassigned queue.
 */
export function QueueClearState({ onGoToUnassigned }: { onGoToUnassigned: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-10">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <MessageSquare className="h-7 w-7" strokeWidth={1.6} aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-foreground">{t('messages.empty.title')}</p>
        <p className="mx-auto mt-1.5 max-w-[330px] text-[13.5px] text-foreground/75">
          {t('messages.empty.body')}
        </p>
      </div>
      <button
        type="button"
        onClick={onGoToUnassigned}
        className="h-11 rounded-md bg-accent px-4 text-[13px] font-bold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {t('messages.empty.cta')}
      </button>
    </div>
  );
}
