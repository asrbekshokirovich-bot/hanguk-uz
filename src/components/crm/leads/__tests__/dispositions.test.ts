import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { BOOK_EFFECT, DISPOSITIONS, dispositionEffect, nextAttempts } from '../dispositions';
import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import type { Disposition } from '../types';

describe('the disposition table', () => {
  it('offers exactly the four call outcomes', () => {
    expect(DISPOSITIONS).toEqual(['reached', 'no_answer', 'callback', 'wrong_number']);
  });

  it('moves each disposition to the documented stage and status', () => {
    expect(dispositionEffect('reached')).toMatchObject({ stage: 'contacted', status: 'contacted' });
    expect(dispositionEffect('no_answer')).toMatchObject({ stage: 'attempting', status: 'contacted' });
    expect(dispositionEffect('callback')).toMatchObject({ stage: 'contacted', status: 'contacted' });
    expect(dispositionEffect('wrong_number')).toMatchObject({ stage: null, status: 'lost' });
  });

  it('counts every disposition as an attempt', () => {
    for (const disposition of DISPOSITIONS) {
      expect(dispositionEffect(disposition).countsAsAttempt).toBe(true);
      expect(nextAttempts(2, dispositionEffect(disposition))).toBe(3);
    }
  });

  it('keeps the touch type consistent with the attempt rule', () => {
    // The attempt counter is derived by counting `call` touches, so a touch
    // typed `call` *is* an attempt. If these two disagree, booking a
    // consultation silently bumps the lead's attempt count.
    for (const effect of [...DISPOSITIONS.map(dispositionEffect), BOOK_EFFECT]) {
      expect(effect.touchType === 'call').toBe(effect.countsAsAttempt);
    }
  });

  it('removes the lead only on a wrong number', () => {
    const removing = DISPOSITIONS.filter((d) => dispositionEffect(d).removes);
    expect(removing).toEqual(['wrong_number']);
  });

  it('keeps a wrong number as a lost record rather than deleting it', () => {
    // The bad number is still evidence of an enquiry, and deleting the row
    // would let the same number be re-imported tomorrow.
    expect(dispositionEffect('wrong_number').status).toBe('lost');
  });

  it('drives the planner from every disposition except a wrong number', () => {
    expect(dispositionEffect('reached').plan).toBe('reached');
    expect(dispositionEffect('no_answer').plan).toBe('no_answer');
    expect(dispositionEffect('callback').plan).toBe('callback');
    expect(dispositionEffect('wrong_number').plan).toBeNull();
  });

  it('writes an outcome the lead_notes schema already accepts', () => {
    const allowed = new Set([
      'answered',
      'interested',
      'callback_requested',
      'no_answer',
      'busy',
      'voicemail',
      'not_interested',
    ]);
    for (const disposition of DISPOSITIONS) {
      expect(allowed.has(dispositionEffect(disposition).outcome)).toBe(true);
    }
    expect(allowed.has(BOOK_EFFECT.outcome)).toBe(true);
  });
});

describe('booking a consultation', () => {
  it('moves the stage without spending an attempt, and keeps the lead in the list', () => {
    expect(BOOK_EFFECT.stage).toBe('booked');
    expect(BOOK_EFFECT.countsAsAttempt).toBe(false);
    expect(BOOK_EFFECT.removes).toBe(false);
    expect(nextAttempts(2, BOOK_EFFECT)).toBe(2);
  });
});

/**
 * Nothing else in this app uses i18next plurals, so the `_one`/`_other` forms
 * these components rely on are verified against the real locale files rather
 * than assumed to resolve.
 */
describe('plural locale keys resolve', () => {
  const i18n = i18next.createInstance();
  i18n.init({
    lng: 'en',
    resources: { en: { translation: en }, ru: { translation: ru } },
  });

  it('picks singular and plural attempt notes in English', () => {
    expect(i18n.t('leads.dispositions.attemptsNote', { count: 1, owner: 'Aziz' })).toBe(
      '1 attempt so far · owner Aziz',
    );
    expect(i18n.t('leads.dispositions.attemptsNote', { count: 3, owner: 'Aziz' })).toBe(
      '3 attempts so far · owner Aziz',
    );
  });

  it('picks the convert-block plural in English', () => {
    expect(i18n.t('leads.convertPanel.blocked', { count: 1, fields: 'TOPIK' })).toContain(
      '1 more qualification field ',
    );
    expect(i18n.t('leads.convertPanel.blocked', { count: 2, fields: 'TOPIK' })).toContain(
      '2 more qualification fields',
    );
  });

  it('uses the Russian few/many forms', () => {
    const one = i18n.t('leads.dispositions.attemptsNote', { lng: 'ru', count: 1, owner: 'Aziz' });
    const few = i18n.t('leads.dispositions.attemptsNote', { lng: 'ru', count: 3, owner: 'Aziz' });
    const many = i18n.t('leads.dispositions.attemptsNote', { lng: 'ru', count: 7, owner: 'Aziz' });
    expect(one).toContain('попытка');
    expect(few).toContain('попытки');
    expect(many).toContain('попыток');
  });

  it('resolves a note for every disposition', () => {
    for (const disposition of DISPOSITIONS as Disposition[]) {
      const key = `leads.dispositions.notes.${disposition}`;
      expect(i18n.t(key, { n: 2 })).not.toBe(key);
    }
  });
});
