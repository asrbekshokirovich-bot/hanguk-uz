import { describe, expect, it } from 'vitest';
import type { Lead } from '@/contexts/LeadsContext';
import { arrivedToday, isTodayLead, tashkentDay } from '../today';

// 2026-09-30 15:00 in Tashkent (UTC+5).
const now = new Date('2026-09-30T10:00:00Z');

const lead = (overrides: Partial<Lead> = {}): Lead =>
  ({
    id: 'lead-1',
    full_name: 'Aziz Karimov',
    phone: '+998901234567',
    source: 'instagram',
    status: 'contacted',
    call_result: null,
    last_contacted_at: '2026-09-30T09:05:00Z',
    converted_to_student_id: null,
    created_at: '2026-09-30T09:00:00Z',
    new_lead_at: '2026-09-30T09:00:00Z',
    ...overrides,
  }) as Lead;

describe('tashkentDay', () => {
  it('reads the calendar day in Tashkent, not in UTC', () => {
    expect(tashkentDay(new Date('2026-09-29T19:00:00Z'))).toBe('2026-09-30');
    expect(tashkentDay(new Date('2026-09-29T18:59:59Z'))).toBe('2026-09-29');
  });
});

describe('isTodayLead', () => {
  it('takes a lead that arrived today and has left "Yangi lid"', () => {
    expect(isTodayLead(lead(), now)).toBe(true);
  });

  it('leaves a lead still waiting in "Yangi lid" there', () => {
    const waiting = lead({ last_contacted_at: null, status: 'new' });
    expect(arrivedToday(waiting, now)).toBe(true);
    expect(isTodayLead(waiting, now)).toBe(false);
  });

  it('counts from the moment the phone arrived, not when the chat began', () => {
    expect(isTodayLead(lead({ created_at: '2026-09-29T12:00:00Z' }), now)).toBe(true);
  });

  it('takes a hand-entered lead created today', () => {
    expect(
      isTodayLead(lead({ source: 'manual', new_lead_at: null, last_contacted_at: null }), now),
    ).toBe(true);
  });

  it('keeps converted and rejected leads of today until midnight', () => {
    expect(isTodayLead(lead({ status: 'lost' }), now)).toBe(true);
    expect(isTodayLead(lead({ status: 'converted' }), now)).toBe(true);
  });

  it('lets a lead from yesterday go to "Lidlar" at 00:00 Tashkent', () => {
    const yesterday = lead({ created_at: '2026-09-29T18:30:00Z', new_lead_at: '2026-09-29T18:30:00Z' });
    expect(isTodayLead(yesterday, new Date('2026-09-29T18:59:00Z'))).toBe(true);
    expect(isTodayLead(yesterday, new Date('2026-09-29T19:00:00Z'))).toBe(false);
  });
});

describe('countdown started today', () => {
  // Monday 2026-10-05 12:00 in Tashkent.
  const monday = new Date('2026-10-05T07:00:00Z');
  // Arrived on Sunday 18:40; the countdown started Monday 10:00.
  const weekend = lead({
    created_at: '2026-10-04T13:40:00Z',
    new_lead_at: '2026-10-04T13:40:00Z',
    sla_start_at: '2026-10-05T05:00:00Z',
    call_result: 'Gaplashildi',
  });

  it('a weekend lead answered on Monday is in Monday\'s list', () => {
    expect(arrivedToday(weekend, monday)).toBe(true);
    expect(isTodayLead(weekend, monday)).toBe(true);
  });

  it('it moves to Lidlar on Tuesday', () => {
    expect(isTodayLead(weekend, new Date('2026-10-06T07:00:00Z'))).toBe(false);
  });

  it('a lead whose countdown started on its own day is unchanged', () => {
    const sameDay = lead({ sla_start_at: '2026-09-30T09:00:00Z' });
    expect(isTodayLead(sameDay, now)).toBe(true);
    expect(isTodayLead(sameDay, new Date('2026-10-01T10:00:00Z'))).toBe(false);
  });
});
