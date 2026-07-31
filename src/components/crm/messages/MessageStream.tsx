import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { InternalNoteCard } from './InternalNoteCard';
import { MessageBubble } from './MessageBubble';
import { StreamDivider } from './StreamDivider';
import type { MessageVM } from './types';

interface MessageStreamProps {
  messages: MessageVM[];
  /** True while the stream still holds another thread's rows. */
  loading?: boolean;
  isExpanded: (id: string, hasTranslation: boolean) => boolean;
  translatingId: string | null;
  onToggleTranslation: (message: MessageVM, expanded: boolean) => void;
}

/**
 * The scrolling message stream.
 *
 * Marked `aria-live="polite"` so an operator using a screen reader hears new
 * inbound messages without having to re-read the pane, and auto-scrolls to the
 * newest message whenever the thread grows.
 */
export function MessageStream({ messages, loading, isExpanded, translatingId, onToggleTranslation }: MessageStreamProps) {
  const { t } = useTranslation();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

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
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-5"
      role="log"
      aria-live="polite"
      aria-label={t('messages.thread.streamLabel')}
    >
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
          />
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
