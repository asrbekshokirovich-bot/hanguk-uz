import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStaffMentions } from '@/hooks/useStaffMentions';
import type { Message } from '@/contexts/MessagesContext';
import { looksNonEnglish } from './queueLogic';
import { readCachedTranslation } from './translateMessage';
import type { MessageVM } from './types';

/**
 * Turns the raw `messages` rows for the selected thread into the stream view
 * model: bubbles, internal notes and the day dividers between them.
 *
 * Internal notes are ordinary `messages` rows carrying
 * `message_type = 'note'` and `metadata.internal = true`. They are stored on
 * the thread so the whole team sees them in context, but they are never
 * relayed to Telegram/Instagram — see `Composer` for the write path.
 */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toDateString();
}

export function useThreadMessages(messages: Message[]) {
  const { i18n } = useTranslation();
  const { staffList } = useStaffMentions();

  const staffNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staffList) map.set(s.user_id, s.full_name);
    return map;
  }, [staffList]);

  return useMemo<MessageVM[]>(() => {
    const out: MessageVM[] = [];
    let lastDay = '';

    for (const m of messages) {
      const day = dayKey(m.created_at);
      if (day && day !== lastDay) {
        lastDay = day;
        out.push({
          id: `day-${day}`,
          kind: 'event',
          text: formatDayLabel(m.created_at, i18n.language),
          createdAt: m.created_at,
          senderLabel: null,
          deliveryStatus: null,
          translation: null,
          translatable: false,
        });
      }

      const isNote = (m.message_type as string) === 'note' || !!m.metadata?.internal;
      const kind: MessageVM['kind'] = isNote ? 'note' : m.direction === 'incoming' ? 'in' : 'out';
      const staffId = m.replied_by ?? m.assigned_to;

      out.push({
        id: m.id,
        kind,
        text: m.content,
        createdAt: m.created_at,
        senderLabel: kind === 'in' ? null : (staffId ? staffNames.get(staffId) ?? null : null),
        deliveryStatus: kind === 'out' ? m.status : null,
        translation: readCachedTranslation(m.metadata),
        translatable: looksNonEnglish(m.content),
      });
    }

    return out;
  }, [messages, staffNames, i18n.language]);
}

/** "Today" / "Yesterday" / "12 June" for the stream's day dividers. */
function formatDayLabel(iso: string, locale: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}
