import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { InternalNoteCard } from './InternalNoteCard';
import { MessageBubble } from './MessageBubble';
import { StreamDivider } from './StreamDivider';
import type { MessageVM } from './types';

interface MessageStreamProps {
  messages: MessageVM[];
  /** True while the stream still holds another thread's rows. */
  loading?: boolean;
  /** True when older pages exist beyond the loaded window. */
  hasMore?: boolean;
  /** Fetch the next (older) page; resolves when the rows are in state. */
  onLoadOlder?: () => Promise<void>;
  /** Re-deliver a failed outbound message by id. */
  onRetry?: (messageId: string) => void;
  isExpanded: (id: string, hasTranslation: boolean) => boolean;
  translatingId: string | null;
  onToggleTranslation: (message: MessageVM, expanded: boolean) => void;
}

/** Distance from the bottom (px) within which auto-scroll stays engaged. */
const NEAR_BOTTOM_PX = 120;

/**
 * The scrolling message stream.
 *
 * Auto-scroll is SMART: it follows new messages only while the operator is
 * already at (or near) the bottom. Scrolled up reading history? The view
 * stays put and a "jump to latest" pill appears instead — exactly how
 * Telegram behaves. Loading older pages preserves the scroll position.
 */
export function MessageStream({
  messages,
  loading,
  hasMore,
  onLoadOlder,
  onRetry,
  isExpanded,
  translatingId,
  onToggleTranslation,
}: MessageStreamProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const lastIdRef = useRef<string | null>(null);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    nearBottomRef.current = nearBottom;
    setShowJump(!nearBottom);
  };

  useEffect(() => {
    const last = messages[messages.length - 1];
    const lastId = last?.id ?? null;
    if (lastId === lastIdRef.current) return;
    const grewAtEnd = lastIdRef.current === null || messages.some((m) => m.id === lastIdRef.current);
    lastIdRef.current = lastId;
    // Follow the conversation only when already at the bottom, or when the
    // newest message is the operator's own send.
    if (grewAtEnd && (nearBottomRef.current || (last && (last.kind === 'out' || last.kind === 'note') && last.pending))) {
      endRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages]);

  const loadOlder = async () => {
    const el = containerRef.current;
    if (!el || !onLoadOlder || loadingOlder) return;
    setLoadingOlder(true);
    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;
    await onLoadOlder();
    // Keep the first previously-visible message exactly where it was.
    requestAnimationFrame(() => {
      const nowEl = containerRef.current;
      if (nowEl) nowEl.scrollTop = prevTop + (nowEl.scrollHeight - prevHeight);
      setLoadingOlder(false);
    });
  };

  if (loading) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-5"
        aria-busy="true"
        aria-label={t('messages.thread.streamLabel')}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className={i % 2 === 1 ? 'flex justify-end' : 'flex justify-start'}>
            <Skeleton className={i % 2 === 1 ? 'h-14 w-[42%] rounded-[14px_14px_4px_14px]' : 'h-16 w-[55%] rounded-[14px_14px_14px_4px]'} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-5"
        role="log"
        aria-live="polite"
        aria-label={t('messages.thread.streamLabel')}
      >
        {hasMore && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="flex min-h-0 items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1 text-[11.5px] font-semibold text-foreground/70 transition-colors hover:bg-muted disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {loadingOlder && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              {t('messages.thread.loadEarlier', 'Load earlier messages')}
            </button>
          </div>
        )}

        {messages.map((m) => {
          if (m.kind === 'event') return <StreamDivider key={m.id} label={m.text} />;
          if (m.kind === 'note') return <InternalNoteCard key={m.id} message={m} />;
          const expanded = isExpanded(m.id, !!m.translation);
          return (
            <MessageBubble
              key={m.id}
              message={m}
              expanded={expanded}
              translating={translatingId === m.id}
              onToggleTranslation={() => onToggleTranslation(m, expanded)}
              onRetry={
                m.kind === 'out' && m.deliveryStatus === 'failed' && onRetry
                  ? () => onRetry(m.id)
                  : undefined
              }
            />
          );
        })}
        <div ref={endRef} />
      </div>

      {showJump && (
        <button
          type="button"
          onClick={() => {
            endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }}
          aria-label={t('messages.thread.jumpToLatest', 'Jump to latest')}
          className="absolute bottom-4 right-5 flex h-9 w-9 min-h-0 min-w-0 items-center justify-center rounded-full border border-border bg-card shadow-card transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowDown className="h-4 w-4 text-foreground/70" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
