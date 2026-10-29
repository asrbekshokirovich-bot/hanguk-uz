import { Instagram, Send, Smartphone, type LucideIcon } from 'lucide-react';
import type { ChannelId } from './types';

/**
 * Channel registry for the Messages queue.
 *
 * The two `badgeColor` values are third-party BRAND identity colours
 * (Telegram and Instagram), not theme colours: they are defined by those
 * products and are deliberately identical in light and OLED dark, so they
 * cannot be expressed as a theme token. They are confined to this file and
 * applied only to the 17px channel dot on the avatar. Every other colour in
 * the Messages section comes from the design tokens.
 *
 * The Hanguk App channel uses the brand token (`--primary`) instead, so it
 * tracks the theme like the rest of the UI.
 */
export interface ChannelMeta {
  id: ChannelId;
  /** i18n key under `messages.channels.*` */
  labelKey: string;
  icon: LucideIcon;
  /** Inline background for the avatar badge, or null to use `bg-primary`. */
  badgeColor: string | null;
}

export const CHANNELS: Record<ChannelId, ChannelMeta> = {
  telegram: {
    id: 'telegram',
    labelKey: 'messages.channels.telegram',
    icon: Send,
    badgeColor: '#229ED9', // Telegram brand blue
  },
  instagram: {
    id: 'instagram',
    labelKey: 'messages.channels.instagram',
    icon: Instagram,
    badgeColor: '#C7377F', // Instagram brand magenta
  },
  app: {
    id: 'app',
    labelKey: 'messages.channels.app',
    icon: Smartphone,
    badgeColor: null, // uses the royal-blue brand token
  },
};

/**
 * Channels offered as filter chips. The app channel is not listed: no
 * producer writes `source = 'app'` (audit 2026-10-29, finding 18), so the chip
 * was always empty. `toChannelId` still maps stray sources onto it so a row
 * can never vanish.
 */
export const CHANNEL_IDS: ChannelId[] = ['telegram', 'instagram'];

/**
 * Narrows the free-form `message_threads.source` string to a known channel.
 * Unknown sources (`whatsapp`, `manual`, …) fall back to the app channel so a
 * stray row never disappears from the shared queue.
 */
export function toChannelId(source: string | null | undefined): ChannelId {
  if (source === 'telegram' || source === 'instagram' || source === 'app') return source;
  return 'app';
}

/**
 * "@malika_ysp" for social channels; the product name for the app channel.
 *
 * Only a real username is shown. The old fallback was "@" + the numeric chat
 * id ("@1819638515"), which looked like a handle and was not one (audit
 * 2026-10-29, finding 15). With no username the result is empty and the
 * header simply omits it.
 */
export function channelHandle(
  channel: ChannelId,
  handle: string | null | undefined,
  senderName: string | null,
): string {
  if (channel === 'app') return 'Hanguk App';
  const known = (handle ?? '').trim().replace(/^@/, '');
  if (known) return `@${known}`;
  const raw = (senderName ?? '').trim();
  if (raw.startsWith('@') && raw.length > 1) return raw;
  return '';
}
