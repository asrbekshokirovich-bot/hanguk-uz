import { describe, expect, it } from 'vitest';
import { explainError, missingFieldsFrom } from '../copy';
import { findForbidden } from '../forbidden';
import {
  clock,
  dayKey,
  formatCountdown,
  fromLocalInput,
  quickCallbackTimes,
  secondsUntil,
  toLocalInput,
  urgency,
  whenLabel,
} from '../time';

describe('time (Tashkent, UTC+5)', () => {
  it('shows the Tashkent clock and day whatever the browser zone is', () => {
    expect(clock('2026-10-06T10:00:00Z')).toBe('15:00');
    expect(dayKey('2026-10-06T20:30:00Z')).toBe('2026-10-07'); // 01:30 next day in Tashkent
    expect(clock(null)).toBe('—');
  });

  it('formats a countdown, negative when overdue', () => {
    expect(formatCountdown(252)).toBe('04:12');
    expect(formatCountdown(-160)).toBe('−02:40');
    expect(formatCountdown(3730)).toBe('1:02:10');
    expect(formatCountdown(null)).toBe('—');
  });

  it('computes the seconds left and the colour of a HOZIR row', () => {
    const now = new Date('2026-10-06T10:00:00Z');
    expect(secondsUntil('2026-10-06T10:04:12Z', now)).toBe(252);
    expect(urgency('2026-10-06T10:08:00Z', now)).toBe('ok');
    expect(urgency('2026-10-06T10:04:59Z', now)).toBe('warn'); // inside the last 5 minutes
    expect(urgency('2026-10-06T09:57:00Z', now)).toBe('late');
    expect(urgency(null, now)).toBe('idle');
  });

  it('labels a moment relative to today', () => {
    const now = new Date('2026-10-06T10:00:00Z'); // Tue 15:00
    expect(whenLabel('2026-10-06T13:00:00Z', now)).toBe('Bugun 18:00');
    expect(whenLabel('2026-10-07T05:00:00Z', now)).toBe('Ertaga 10:00');
    expect(whenLabel('2026-10-12T05:00:00Z', now)).toBe('12.10 10:00');
  });

  it('round-trips a datetime-local value as Tashkent wall-clock time', () => {
    expect(fromLocalInput('2026-10-07T10:00')).toBe('2026-10-07T05:00:00.000Z');
    expect(toLocalInput('2026-10-07T05:00:00.000Z')).toBe('2026-10-07T10:00');
    expect(fromLocalInput('nonsense')).toBeNull();
  });

  it('offers quick call-back times, dropping "bugun 18:00" once it is nearly 18:00', () => {
    const afternoon = quickCallbackTimes(new Date('2026-10-06T08:00:00Z')); // 13:00
    expect(afternoon.map((p) => p.label)).toEqual(['+1 soat', 'Bugun 18:00', 'Ertaga 10:00']);
    const evening = quickCallbackTimes(new Date('2026-10-06T12:58:00Z')); // 17:58
    expect(evening.map((p) => p.label)).toEqual(['+1 soat', 'Ertaga 10:00']);
  });
});

describe('error text', () => {
  it('names the empty mandatory fields', () => {
    expect(explainError('missing_fields:goal,decider')).toBe('To‘ldirilmagan: Maqsad, Kim qaror qiladi / to‘laydi');
    expect(missingFieldsFrom('missing_fields:goal,objection')).toEqual(['goal', 'objection']);
    expect(missingFieldsFrom('boom')).toEqual([]);
  });

  it('explains the machine codes in Uzbek', () => {
    expect(explainError('next_action_required')).toMatch(/Keyingi harakat/);
    expect(explainError('new row violates row-level security policy')).toMatch(/ruxsat yo'q/);
    expect(explainError('owned_by_other')).toMatch(/boshqa operatorda/);
    expect(explainError(undefined)).toBe("Noma'lum xatolik");
  });
});

describe('forbidden words (spec §6)', () => {
  const words = ['kafolat', '100%', 'bepul noutbuk', 'bitta narx', 'sertifikatsiz Koreya'];
  it('finds a forbidden word regardless of case', () => {
    expect(findForbidden('Biz VIZA KAFOLAT beramiz', words)).toBe('kafolat');
    expect(findForbidden('Bu bitta narx, hammasi ichida', words)).toBe('bitta narx');
  });
  it('treats "10% chegirma" as a promise that needs approval', () => {
    expect(findForbidden('Sizga 10% chegirma qilamiz', words)).toBe('% chegirma');
    expect(findForbidden('chegirma 20 foiz', words)).toBe('% chegirma');
  });
  it('lets a normal message through', () => {
    expect(findForbidden("Qulay bo'lsa, raqamingizni qoldiring", words)).toBeNull();
  });
});
