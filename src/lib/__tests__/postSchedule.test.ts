import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { arrivalDate, lastDispatchDate, parseDay, planPost, toIsoDay } from '../postSchedule';

const last = (iso: string) => toIsoDay(lastDispatchDate(parseDay(iso)));

describe('postSchedule', () => {
  it("matches the owner's example: deadline 31 Oct → leave by Wed 21 Oct", () => {
    expect(last('2026-10-31')).toBe('2026-10-21');
  });

  it('Monday post arrives Thursday, Wednesday post arrives Saturday', () => {
    expect(toIsoDay(arrivalDate(parseDay('2026-10-26')))).toBe('2026-10-29');
    expect(toIsoDay(arrivalDate(parseDay('2026-10-28')))).toBe('2026-10-31');
  });

  it('steps back two post days from the last post that arrives in time', () => {
    // Deadline Fri 30 Oct: last in time is Mon 26 (arrives Thu 29) → Wed 21 → Mon 19.
    expect(last('2026-10-30')).toBe('2026-10-19');
    // Deadline Thu 29 Oct: Mon 26 arrives that day → Wed 21 → Mon 19.
    expect(last('2026-10-29')).toBe('2026-10-19');
    // Deadline Wed 28 Oct: Mon 26 would arrive Thu → too late; Wed 21 (Sat 24) → Mon 19 → Wed 14.
    expect(last('2026-10-28')).toBe('2026-10-14');
  });

  it('plans the next post and the days left', () => {
    const plan = planPost('2026-10-31', new Date('2026-10-14T09:00:00Z'));
    expect(toIsoDay(plan.lastDispatch)).toBe('2026-10-21');
    expect(toIsoDay(plan.nextDispatch!)).toBe('2026-10-14'); // a Wednesday
    expect(plan.daysLeft).toBe(7);

    const late = planPost('2026-10-31', new Date('2026-10-22T09:00:00Z'));
    expect(late.nextDispatch).toBeNull();
    expect(late.daysLeft).toBe(-1);
  });
});

describe('pickDeadline', () => {
  it('takes the nearest deadline still ahead, else the latest past one', async () => {
    const { pickDeadline } = await import('@/hooks/useOfflineDeadlines');
    const rounds = [
      { date: '2026-09-30', bosqich: 1 },
      { date: '2026-11-20', bosqich: 3 },
      { date: '2026-10-31', bosqich: 2 },
    ];
    expect(pickDeadline(rounds, '2026-10-14')).toEqual({ date: '2026-10-31', bosqich: 2 });
    expect(pickDeadline(rounds, '2026-12-01')).toEqual({ date: '2026-11-20', bosqich: 3 });
    expect(pickDeadline([], '2026-10-14')).toBeNull();
  });
});
