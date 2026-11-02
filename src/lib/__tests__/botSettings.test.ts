import { describe, expect, it } from 'vitest';
import { isValidTime, parseList, toggleDay, toggleId, validate } from '../botSettings';

describe('botSettings', () => {
  it('vaqt 05:00–23:59', () => {
    expect(isValidTime('17:00')).toBe(true);
    expect(isValidTime('05:00')).toBe(true);
    expect(isValidTime('04:59')).toBe(false);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:00')).toBe(false);
  });

  it('ro\'yxat, ish kunlari, oluvchilar', () => {
    expect(parseList(' 17:30, ,18:00 ')).toEqual(['17:30', '18:00']);
    expect(toggleDay('1,2,3,4,5,6', 6)).toBe('1,2,3,4,5');
    expect(toggleDay('2,1', 7)).toBe('1,2,7');
    expect(toggleId('', 'a')).toBe('a');
    expect(toggleId('a,b', 'a')).toBe('b');
  });

  it('validate', () => {
    const ok = { report_time: '17:00', digest_time: '18:15', morning_time: '09:00', reminder_times: '17:30,18:00', workdays: '1,2' };
    expect(validate(ok)).toEqual([]);
    expect(validate({ ...ok, reminder_times: '' })).toEqual([]);
    expect(validate({ ...ok, report_time: '3:00', workdays: '' })).toEqual(['report_time', 'workdays']);
    expect(validate({ ...ok, reminder_times: '17:10,17:20,17:30,17:40' })).toEqual(['reminder_times']);
  });
});
