import type { SavedReply } from './types';

/**
 * Default saved replies for the shared queue.
 *
 * Bodies are written in the language operators actually send (Uzbek), while
 * the titles are localised through i18n so the panel reads correctly in the
 * operator's UI language.
 *
 * These are module constants for now. The handoff calls for per-team editing
 * from Settings, which is explicitly out of scope for this change; when that
 * lands, swap this array for a `saved_replies` fetch behind the same shape.
 */
export const SAVED_REPLIES: SavedReply[] = [
  {
    key: '/docs',
    titleKey: 'messages.savedReplies.docs',
    body:
      'Assalomu alaykum! Kerakli hujjatlar: 1) Pasport nusxasi 2) Attestat + apostil ' +
      '3) TOPIK sertifikati (agar bo‘lsa).',
  },
  {
    key: '/apos',
    titleKey: 'messages.savedReplies.apostille',
    body: 'Apostil odatda 5–7 ish kuni oladi. Viloyat bo‘limlari ham qabul qiladi.',
  },
  {
    key: '/pay',
    titleKey: 'messages.savedReplies.payment',
    body: 'To‘lov: Standard reja 5M UZS. Kvitansiyani shu yerga rasm qilib yuboring.',
  },
  {
    key: '/call',
    titleKey: 'messages.savedReplies.call',
    body: 'Sizga qulay vaqtni ayting — konsultant bilan qo‘ng‘iroqni belgilaymiz.',
  },
  {
    key: '/topik',
    titleKey: 'messages.savedReplies.topik',
    body: 'Bu universitet uchun TOPIK majburiy emas, lekin ball qo‘shadi.',
  },
];
