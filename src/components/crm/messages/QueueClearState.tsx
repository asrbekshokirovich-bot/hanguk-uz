import { useTranslation } from 'react-i18next';
import { MessageSquare, MousePointerClick } from 'lucide-react';

interface QueueClearStateProps {
  /**
   * `empty` — no conversation matches the current filters (the good outcome).
   * `pick`  — there are rows, none is open yet. Nothing opens by itself: the
   *           old auto-open marked the top row read for every operator.
   */
  variant: 'empty' | 'pick';
  onGoToWaiting: () => void;
}

/** Shown in the thread pane when no conversation is open. */
export function QueueClearState({ variant, onGoToWaiting }: QueueClearStateProps) {
  const { t } = useTranslation();
  const empty = variant === 'empty';

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-10">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {empty ? (
          <MessageSquare className="h-7 w-7" strokeWidth={1.6} aria-hidden="true" />
        ) : (
          <MousePointerClick className="h-7 w-7" strokeWidth={1.6} aria-hidden="true" />
        )}
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-foreground">
          {empty ? t('messages.empty.title') : t('messages.empty.pickTitle')}
        </p>
        <p className="mx-auto mt-1.5 max-w-[330px] text-[13.5px] text-foreground/75">
          {empty ? t('messages.empty.body') : t('messages.empty.pickBody')}
        </p>
      </div>
      {empty && (
        <button
          type="button"
          onClick={onGoToWaiting}
          className="h-11 rounded-md bg-accent px-4 text-[13px] font-bold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t('messages.empty.cta')}
        </button>
      )}
    </div>
  );
}
