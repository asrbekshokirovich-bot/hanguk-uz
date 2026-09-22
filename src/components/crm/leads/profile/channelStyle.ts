import { Instagram, Phone, Send, type LucideIcon } from 'lucide-react';
import type { Channel } from './useLeadProfile';

/**
 * One colour and icon per channel, defined once.
 *
 * The channel marker appears in three places — the stat strip, every row of the
 * feed, and every proposal's evidence line — and the page only reads as one
 * conversation if the same channel looks identical in all three. Defining it
 * per component is how that drifts.
 */
export const CHANNEL_STYLE: Record<Channel, { icon: LucideIcon; dot: string; text: string }> = {
  instagram: { icon: Instagram, dot: 'bg-[#C13584]', text: 'text-[#C13584]' },
  telegram: { icon: Send, dot: 'bg-[#229ED9]', text: 'text-[#229ED9]' },
  phone: { icon: Phone, dot: 'bg-emerald-600', text: 'text-emerald-600' },
};
