import { useTranslation } from 'react-i18next';
import { SAVED_REPLIES } from './savedReplies';
import type { SavedReply } from './types';

interface SavedRepliesPanelProps {
  onPick: (reply: SavedReply) => void;
}

/**
 * Saved replies, opened from the composer button or by typing "/".
 *
 * Each row is a mono key chip + title + truncated body, so an operator who
 * knows the shortcut can scan by key and one who doesn't can read the title.
 */
export function SavedRepliesPanel({ onPick }: SavedRepliesPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-2.5 rounded-lg border border-border bg-popover p-2 shadow-pop">
      <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {t('messages.composer.savedReplies')}
      </p>
      <div className="flex flex-col gap-0.5">
        {SAVED_REPLIES.map((reply) => (
          <button
            key={reply.key}
            type="button"
            onClick={() => onPick(reply)}
            className="flex items-start gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
              {reply.key}
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-foreground">{t(reply.titleKey)}</span>
              <span className="block truncate text-xs text-muted-foreground">{reply.body}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
