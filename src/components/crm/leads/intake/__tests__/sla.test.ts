import { describe, expect, it } from 'vitest';
import type { Lead } from '@/contexts/LeadsContext';
import { formatCountdown, isNewLead, newLeadCountdown } from '../sla';

const arrived = new Date('2026-09-23T10:00:00Z');
const at = (minutes: number, seconds = 0) =>
  new Date(arrived.getTime() + (minutes * 60 + seconds) * 1000);

const lead = (overrides: Partial<Lead> = {}): Lead =>
  ({
    id: 'lead-1',
    full_name: 'Aziz Karimov',
    phone: '+998901234567',
    source: 'instagram',
    status: 'new',
    call_result: null,
    last_contacted_at: null,
    converted_to_student_id: null,
    created_at: '2026-09-20T09:00:00Z',
    new_lead_at: arrived.toISOString(),
    ...overrides,
  }) as Lead;

describe('isNewLead', () => {
  it('takes a lead whose phone and name arrived and nobody has called', () => {
    expect(isNewLead(lead())).toBe(true);
  });

  it('never takes an older lead — it has no new_lead_at', () => {
    expect(isNewLead(lead({ new_lead_at: null }))).toBe(false);
    expect(isNewLead(lead({ new_lead_at: undefined }))).toBe(false);
  });

  it('lets the lead go once a call result is set', () => {
    expect(isNewLead(lead({ call_result: 'Gaplashildi' }))).toBe(false);
  });

  it('lets the lead go once it is converted or rejected', () => {
    expect(isNewLead(lead({ status: 'converted' }))).toBe(false);
    expect(isNewLead(lead({ status: 'lost' }))).toBe(false);
  });
});

describe('newLeadCountdown', () => {
  it('counts down from 10:00 from the moment the lead arrived', () => {
    expect(newLeadCountdown(lead(), at(0, 1))?.secondsLeft).toBe(599);
    expect(formatCountdown(599)).toBe('9:59');
  });

  it('is not red while more than 5 minutes remain', () => {
    expect(newLeadCountdown(lead(), at(4, 59))?.urgent).toBe(false);
  });

  it('turns red with 5 minutes left and stays red past the line', () => {
    expect(newLeadCountdown(lead(), at(5))?.urgent).toBe(true);
    const late = newLeadCountdown(lead(), at(12, 30));
    expect(late?.urgent).toBe(true);
    expect(late?.secondsLeft).toBe(-150);
    expect(formatCountdown(late!.secondsLeft)).toBe('2:30');
  });

  it('shows nothing for a lead that is not a new lead', () => {
    expect(newLeadCountdown(lead({ new_lead_at: null }), at(1))).toBeNull();
  });
});
