/**
 * What a public comment reply may say (spec §3.2: "Ochiq javob narx aytmaydi;
 * narx va shartlar DM'da"). Pure, so the box can check on every keystroke.
 */
import { findForbidden } from '../forbidden';

// 2 000 so'm, 5 mln, $400, 100$, 2000 usd ...; the unit must end the word ("summa" is not "sum").
const UNIT = String.raw`(?:so['’‘ʻʼ]?m|sum|сум|mln|млн|million|миллион|usd|dollar|доллар)(?![\p{L}])`;
const NUMBER = String.raw`\d[\d\s.,]*`;
const PRICE_RE = new RegExp(String.raw`${NUMBER}(?:${UNIT}|\$)|\$\s*${NUMBER}`, 'iu');

/** The part of the text that states a price ("2 000 so'm", "$400"), or null. */
export function findPriceMention(text: string): string | null {
  const m = PRICE_RE.exec(text);
  return m ? m[0].replace(/[\s.,]+$/, '') : null;
}

export interface ReplyCheck {
  /** nothing but spaces */
  empty: boolean;
  /** a forbidden word / "% chegirma": sending is blocked */
  forbidden: string | null;
  /** a price: allowed only after the person confirms */
  price: string | null;
  tooLong: boolean;
}

/** Instagram refuses a comment longer than this. */
export const MAX_REPLY_LENGTH = 2200;

export function checkReply(text: string, forbiddenWords: string[]): ReplyCheck {
  const t = text.trim();
  return {
    empty: t === '',
    forbidden: t ? findForbidden(t, forbiddenWords) : null,
    price: t ? findPriceMention(t) : null,
    tooLong: t.length > MAX_REPLY_LENGTH,
  };
}

/** Sendable as it stands: not empty, not too long, no forbidden word. A price needs the confirmation on top. */
export const canSendReply = (check: ReplyCheck, priceConfirmed: boolean): boolean =>
  !check.empty && !check.tooLong && !check.forbidden && (!check.price || priceConfirmed);
