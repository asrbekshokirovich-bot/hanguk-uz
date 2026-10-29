import { useTranslation } from 'react-i18next';
import type { SavedReplyRow } from './useSavedReplies';

interface SavedRepliesPanelProps {
  replies: SavedReplyRow[];
  onPick: (reply: SavedReplyRow) => void;
  onClose?: () => void;
}

/**
 * Saved replies, opened from the composer button or by typing "/". Typing
 * further ("/do") narrows the list by key; Enter picks the only match.
 *
 * Each row is a mono key chip + title + truncated body, so an operator who
 * knows the shortcut can scan by key and one who doesn't can read the title.
 */
export function SavedRepliesPanel({ replies, onPick, onClose }: SavedRepliesPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border bg-popover p-2 shadow-pop">
      <div className="flex items-center px-2 pb-2 pt-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          {t('messages.composer.savedReplies')}
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-sm px-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Esc
          </button>
        )}
      </div>
      <div className="flex max-h-[260px] flex-col gap-0.5 overflow-y-auto">
        {replies.length === 0 && (
          <p className="px-2.5 py-3 text-xs text-muted-foreground">{t('messages.composer.noSavedReplies')}</p>
        )}
        {replies.map((reply) => (
          <button
            key={reply.id}
            type="button"
            onClick={() => onPick(reply)}
            className="flex items-start gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
              {reply.key}
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-foreground">
                {reply.id.startsWith('builtin-') ? t(reply.title) : reply.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{reply.body}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
