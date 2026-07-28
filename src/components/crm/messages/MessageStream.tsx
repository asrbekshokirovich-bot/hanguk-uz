import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { InternalNoteCard } from './InternalNoteCard';
import { MessageBubble } from './MessageBubble';
import { StreamDivider } from './StreamDivider';
import type { MessageVM } from './types';

interface MessageStreamProps {
  messages: MessageVM[];
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
export function MessageStream({ messages, isExpanded, translatingId, onToggleTranslation }: MessageStreamProps) {
  const { t } = useTranslation();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

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
