import type { SendLanguage } from './types';

/**
 * Languages the operator can send in. The operator writes in English or
 * Uzbek; the outbound message is translated to the student's language on send.
 */
export const SEND_LANGUAGES: { code: SendLanguage; nameKey: string }[] = [
  { code: 'UZ', nameKey: 'messages.languages.uz' },
  { code: 'RU', nameKey: 'messages.languages.ru' },
  { code: 'KO', nameKey: 'messages.languages.ko' },
  { code: 'EN', nameKey: 'messages.languages.en' },
];
