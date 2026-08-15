import { describe, expect, it } from 'vitest';
import type { Lead } from '@/contexts/LeadsContext';
import {
  canConvertLead,
  leadOutcome,
  noteWithRejection,
  noteWithoutRejection,
} from '../outcome';

const lead = (overrides: Partial<Lead> = {}): Lead =>
  ({
    id: 'lead-1',
    full_name: 'Muhammad Eshmurodov',
    phone: '+998 94 196 69 89',
    age: 18,
    city: 'Toshkent',
    cert_level: 'TOPIK 4',
    education_level: 'Bakalavr',
    target_intake: 'Bahorgi 2027',
    contact_channel: 'Instagram',
    how_heard: 'Instagram sahifasi',
    status: 'new',
    notes: null,
    created_at: new Date(2026, 7, 11).toISOString(),
    ...overrides,
  }) as Lead;

describe('leadOutcome', () => {
  it('reads a working lead as active', () => {
    expect(leadOutcome(lead())).toBe('active');
    expect(leadOutcome(lead({ status: 'contacted' }))).toBe('active');
  });

  it('reads a converted lead from either the status or the student link', () => {
    expect(leadOutcome(lead({ status: 'converted' }))).toBe('converted');
    expect(leadOutcome(lead({ status: 'new', converted_to_student_id: 'user-1' }))).toBe(
      'converted',
    );
  });

  it('reads a lost lead as rejected', () => {
    expect(leadOutcome(lead({ status: 'lost' }))).toBe('rejected');
  });
});

describe('canConvertLead', () => {
  it('allows a complete, still-active lead', () => {
    expect(canConvertLead(lead())).toBe(true);
  });

  it('refuses a half-filled record, so a half-filled student cannot be created', () => {
    expect(canConvertLead(lead({ city: null }))).toBe(false);
  });

  it('refuses a lead that has already left the list', () => {
    expect(canConvertLead(lead({ status: 'converted' }))).toBe(false);
    expect(canConvertLead(lead({ status: 'lost' }))).toBe(false);
  });
});

describe('rejection notes', () => {
  it('keeps what the operator wrote and adds the reason', () => {
    expect(noteWithRejection('Birinchi suhbat', 'Qiziqmaydi', '')).toBe(
      'Birinchi suhbat\nRad etildi: Qiziqmaydi',
    );
  });

  it('appends the free-text detail after the reason', () => {
    expect(noteWithRejection(null, 'Boshqa sabab', 'Chet elga ketdi')).toBe(
      'Rad etildi: Boshqa sabab — Chet elga ketdi',
    );
  });

  it('replaces a previous rejection rather than stacking one on top', () => {
    const first = noteWithRejection('Izoh', 'Qiziqmaydi', '');
    expect(noteWithRejection(first, 'Dublikat yozuv', '')).toBe('Izoh\nRad etildi: Dublikat yozuv');
  });

  it('strips the rejection line when the lead is restored', () => {
    const rejected = noteWithRejection('Izoh', 'Qiziqmaydi', 'qayta qo‘ng‘iroq qilmaslikni so‘radi');
    expect(noteWithoutRejection(rejected)).toBe('Izoh');
    expect(noteWithoutRejection(null)).toBe('');
  });
});
