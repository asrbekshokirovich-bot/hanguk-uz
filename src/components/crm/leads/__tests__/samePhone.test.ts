import { describe, expect, it } from 'vitest';
import type { CreateLeadData, Lead } from '@/contexts/LeadsContext';
import { leadsWithSamePhone, phoneMatchKey, typedIntoExisting } from '../samePhone';

const lead = (over: Partial<Lead>): Lead =>
  ({ id: 'l1', full_name: 'A', phone: null, notes: null, created_at: '2026-11-11T12:00:00Z', ...over }) as Lead;

describe('phoneMatchKey', () => {
  it('is the same for every spelling of a number', () => {
    const key = phoneMatchKey('+998941966989');
    expect(key).toBe('941966989');
    for (const spelling of ['+998 94 196 69 89', '998941966989', '94 196-69-89', '(94) 196 69 89', '8 94 196 69 89']) {
      expect(phoneMatchKey(spelling), spelling).toBe(key);
    }
  });

  it('is nothing for a number too short to tell people apart', () => {
    expect(phoneMatchKey('+998')).toBeNull();
    expect(phoneMatchKey('12345678')).toBeNull();
    expect(phoneMatchKey('')).toBeNull();
    expect(phoneMatchKey(null)).toBeNull();
    expect(phoneMatchKey(undefined)).toBeNull();
  });
});

describe('leadsWithSamePhone', () => {
  const leads = [
    lead({ id: 'old', phone: '+998 94 196 69 89', created_at: '2026-10-01T10:00:00Z' }),
    lead({ id: 'new', phone: '998941966989', created_at: '2026-11-11T19:33:00Z' }),
    lead({ id: 'other', phone: '+998901234567' }),
    lead({ id: 'none', phone: null }),
  ];

  it('finds the leads with the number, newest first', () => {
    expect(leadsWithSamePhone(leads, '+998941966989').map((l) => l.id)).toEqual(['new', 'old']);
    expect(leadsWithSamePhone(leads, '90 123 45 67').map((l) => l.id)).toEqual(['other']);
  });

  it('finds nothing for a new number, a short one or none', () => {
    expect(leadsWithSamePhone(leads, '+998911112233')).toEqual([]);
    expect(leadsWithSamePhone(leads, '+998')).toEqual([]);
    expect(leadsWithSamePhone(leads, undefined)).toEqual([]);
  });

  it('shows at most three', () => {
    const many = Array.from({ length: 5 }, (_, i) => lead({ id: `l${i}`, phone: '+998941966989', created_at: `2026-11-0${i + 1}T00:00:00Z` }));
    expect(leadsWithSamePhone(many, '941966989').map((l) => l.id)).toEqual(['l4', 'l3', 'l2']);
  });
});

describe('typedIntoExisting', () => {
  const typed: CreateLeadData = {
    full_name: 'Muhammad Eshmurodov',
    phone: '+998941966989',
    age: 18,
    city: undefined,
    cert_level: null,
    education_level: 'Bakalavr',
    target_intake: null,
    contact_channel: 'Instagram',
    how_heard: undefined,
    source_note: null,
    notes: 'Kuzgi semestrga qiziqadi',
  };

  it('writes only what was filled in', () => {
    const update = typedIntoExisting(lead({ full_name: 'muhammad_0989' }), typed);
    expect(update).toEqual({
      full_name: 'Muhammad Eshmurodov',
      phone: '+998941966989',
      age: 18,
      education_level: 'Bakalavr',
      contact_channel: 'Instagram',
      notes: 'Kuzgi semestrga qiziqadi',
    });
    // Nothing the record already holds is wiped by a field left empty.
    expect(Object.keys(update)).not.toContain('city');
    expect(Object.keys(update)).not.toContain('cert_level');
  });

  it('adds the note under the one already there, once', () => {
    const existing = lead({ notes: 'Instagramdan yozdi' });
    expect(typedIntoExisting(existing, typed).notes).toBe('Instagramdan yozdi\nKuzgi semestrga qiziqadi');
    const again = lead({ notes: 'Instagramdan yozdi\nKuzgi semestrga qiziqadi' });
    expect(Object.keys(typedIntoExisting(again, typed))).not.toContain('notes');
  });

  it('leaves the note alone when none was typed', () => {
    const update = typedIntoExisting(lead({ notes: 'Instagramdan yozdi' }), { ...typed, notes: undefined });
    expect(Object.keys(update)).not.toContain('notes');
  });
});
