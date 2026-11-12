import { describe, expect, it } from 'vitest';
import { addDays, hoursMinutes, jobTimes, seoulParts, seoulToday, timeRange, weekStart, won } from '../time';

describe('Seoul time', () => {
  it('a job on a Seoul date and hours; an overnight one ends the next day', () => {
    expect(jobTimes('2026-11-12', '10:00', '14:00')).toEqual({
      startsAt: '2026-11-12T10:00:00+09:00',
      endsAt: '2026-11-12T14:00:00+09:00',
    });
    expect(jobTimes('2026-11-12', '22:00', '06:00')).toEqual({
      startsAt: '2026-11-12T22:00:00+09:00',
      endsAt: '2026-11-13T06:00:00+09:00',
    });
    expect(jobTimes('2026-12-31', '23:00', '02:00').endsAt).toBe('2027-01-01T02:00:00+09:00');
  });

  it('reads an instant on Seoul\'s clock, whatever the browser\'s', () => {
    expect(seoulParts('2026-11-12T01:00:00Z')).toEqual({ date: '2026-11-12', time: '10:00' });
    expect(seoulParts('2026-11-11T20:30:00+05:00')).toEqual({ date: '2026-11-12', time: '00:30' });
    expect(seoulToday(new Date('2026-11-11T15:30:00Z'))).toBe('2026-11-12');
    expect(timeRange('2026-11-12T01:00:00Z', '2026-11-12T05:00:00Z')).toBe('10:00–14:00');
  });

  it('days and weeks', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(weekStart('2026-11-11')).toBe('2026-11-09');
    expect(weekStart('2026-11-15')).toBe('2026-11-09');
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
  });

  it('money and durations', () => {
    expect(won(13000)).toBe('13 000 ₩');
    expect(won(45500)).toBe('45 500 ₩');
    expect(won(1250000)).toBe('1 250 000 ₩');
    expect(hoursMinutes(270, 'soat', 'daq')).toBe('4 soat 30 daq');
    expect(hoursMinutes(240, 'soat', 'daq')).toBe('4 soat');
    expect(hoursMinutes(45, 'soat', 'daq')).toBe('45 daq');
  });
});
