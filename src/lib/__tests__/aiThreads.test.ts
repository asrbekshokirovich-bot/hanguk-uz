import { describe, expect, it } from 'vitest';
import { firstName, sortThreads, threadDayLabel, threadInitials, threadTitleFrom, type AiThread } from '../aiThreads';

const words = { today: 'Bugun', yesterday: 'Kecha' };
const now = new Date('2026-10-27T12:00:00Z'); // 17:00 in Tashkent

describe('aiThreads', () => {
  it('builds a one-line title from the first question', () => {
    expect(threadTitleFrom('  Shoxrux\n rustamjonov ')).toBe('Shoxrux rustamjonov');
    expect(threadTitleFrom('a'.repeat(100))).toHaveLength(80);
  });

  it('makes two-letter initials', () => {
    expect(threadInitials('Shoxrux rustamjonov')).toBe('SR');
    expect(threadInitials('Kutilayotgan hujjatlar')).toBe('KH');
    expect(threadInitials('TOPIK')).toBe('TO');
    expect(threadInitials('???')).toBe('AI');
  });

  it('labels days in Tashkent time', () => {
    expect(threadDayLabel('2026-10-27T03:00:00Z', now, 'uz', words)).toBe('Bugun');
    // 26.10 22:00 UTC is already 27.10 in Tashkent
    expect(threadDayLabel('2026-10-26T22:00:00Z', now, 'uz', words)).toBe('Bugun');
    expect(threadDayLabel('2026-10-26T10:00:00Z', now, 'uz', words)).toBe('Kecha');
    expect(threadDayLabel('2026-10-24T10:00:00Z', now, 'uz', words)).toBe('24-okt');
  });

  it('puts pinned conversations first, then the latest', () => {
    const t = (id: string, pinned: boolean, updated_at: string): AiThread =>
      ({ id, title: id, pinned, message_count: 0, last_preview: null, created_at: updated_at, updated_at });
    const out = sortThreads([t('a', false, '2026-10-27'), t('b', true, '2026-10-20'), t('c', false, '2026-10-26')]);
    expect(out.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('takes the first name for the greeting', () => {
    expect(firstName("Xo'jamurod Arslanov")).toBe("Xo'jamurod");
    expect(firstName(null)).toBe('');
  });
});
