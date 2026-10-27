import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { channelLabel, groupBySession, sourceChips, whenLabel, type Person } from '../person';

const t = (k: string, o?: Record<string, unknown>) => {
  const uz: Record<string, string> = {
    'appPerson.today': `Bugun ${o?.time}`,
    'appPerson.yesterday': `Kecha ${o?.time}`,
    'appPerson.ties.operatorLink': 'operator havolasi',
    'appPerson.ties.telegramCode': 'Telegram kodi',
    'appPerson.sources.telegram': 'Telegram',
  };
  return uz[k] ?? k;
};

describe('the plan\'s wording of a person', () => {
  it('writes a time as the plan does: Bugun, Kecha, then the date', () => {
    const now = new Date(2026, 9, 26, 15, 0);
    expect(whenLabel(new Date(2026, 9, 26, 14, 20).toISOString(), t, now)).toBe('Bugun 14:20');
    expect(whenLabel(new Date(2026, 9, 25, 21, 40).toISOString(), t, now)).toBe('Kecha 21:40');
    expect(whenLabel(new Date(2026, 9, 24, 18, 30).toISOString(), t, now)).toBe('24-okt 18:30');
    expect(whenLabel(null, t, now)).toBe('—');
  });

  it('«Manba»: the own answer first, then the ways in — the form is not one', () => {
    const p = {
      how_heard: null,
      contact_channel: null,
      lead_source: 'telegram',
      ties: [
        { via: 'form', at: '1' },
        { via: 'link', at: '2' },
        { via: 'referrer', at: '3' },
        { via: 'telegram_code', at: '4' },
      ],
    } as unknown as Person;
    expect(sourceChips(p, t)).toEqual(['Telegram', 'operator havolasi', 'Telegram kodi']);
    expect(sourceChips({ ...p, how_heard: 'Instagram', ties: [] }, t)).toEqual(['Instagram']);
    expect(channelLabel('Instagram', 'instagram', t)).toBe('Instagram');
    expect(channelLabel(null, 'unknown_source', t)).toBe('unknown_source');
  });

  it('puts the steps under their visits; newer ones on top on their own', () => {
    const sessions = [
      { started_at: '2026-10-26T10:00:00Z', ended_at: '2026-10-26T10:10:00Z' },
      { started_at: '2026-10-25T09:00:00Z', ended_at: '2026-10-25T09:05:00Z' },
    ] as never;
    const step = (at: string) => ({ at, event: 'tap', screen: null, element: null, duration_ms: null, props: null });
    const groups = groupBySession(sessions, [step('2026-10-26T11:00:00Z'), step('2026-10-26T10:05:00Z'), step('2026-10-25T09:01:00Z')]);
    expect(groups.map((g) => g.steps.length)).toEqual([1, 1, 1]);
    expect(groups[0].session).toBeNull();
  });
});
