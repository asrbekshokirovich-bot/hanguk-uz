import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useStaffMentions } from '@/hooks/useStaffMentions';
import type { Message } from '@/contexts/MessagesContext';
import { looksNonEnglish } from './queueLogic';
import { extractMedia, isMediaPlaceholder } from './media';
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
  const { t, i18n } = useTranslation();
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
          text: formatDayLabel(m.created_at, i18n.language, t),
          createdAt: m.created_at,
          senderLabel: null,
          deliveryStatus: null,
          deliveryError: null,
          translation: null,
          translatable: false,
          media: null,
        });
      }

      const isNote = (m.message_type as string) === 'note' || !!m.metadata?.internal;
      const kind: MessageVM['kind'] = isNote ? 'note' : m.direction === 'incoming' ? 'in' : 'out';
      const staffId = m.replied_by ?? m.assigned_to;
      const media = extractMedia(m.message_type as string, m.metadata);
      // A media message with no caption carries a placeholder string like
      // "🎤 Voice message" or "[document]". Once the real player/thumbnail is
      // rendered, repeating that as body text is just noise.
      const text = media && isMediaPlaceholder(m.content) ? '' : m.content;

      out.push({
        id: m.id,
        kind,
        text,
        media,
        createdAt: m.created_at,
        senderLabel: kind === 'in' ? null : (staffId ? staffNames.get(staffId) ?? null : null),
        // Real delivery lifecycle (sending → sent / failed) written by the
        // send functions and the userbot triggers; legacy rows fall back to
        // 'sent' so old history doesn't render as unconfirmed.
        deliveryStatus: kind === 'out' ? m.delivery_status ?? 'sent' : null,
        deliveryError: kind === 'out' ? m.delivery_error ?? null : null,
        pending: kind === 'out' && m.delivery_status === 'sending',
        translation: readCachedTranslation(m.metadata),
        translatable: !media && looksNonEnglish(m.content),
      });
    }

    return out;
  }, [messages, staffNames, i18n.language]);
}

/**
 * "Bugun" / "Kecha" / "12 iyun" for the stream's day dividers.
 *
 * The two relative labels were English string literals while everything around
 * them was translated, so an operator working in Uzbek got "Today" over the
 * top of today's messages. The absolute dates were always localised — only the
 * two hardest-coded ones were not.
 */
function formatDayLabel(iso: string, locale: string, t: TFunction): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return t('messages.day.today');
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return t('messages.day.yesterday');
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}
