import { describe, expect, it } from 'vitest';
import type { Lead } from '@/contexts/LeadsContext';
import {
  EMPTY_FORM,
  describeDate,
  formFromLead,
  hasErrors,
  initialsOf,
  isLeadComplete,
  matchesLeadQuery,
  isoDaysFromNow,
  joinName,
  leadDataFromForm,
  splitName,
  validateIntake,
} from '../intakeForm';
import { needsSourceNote, semesterOptions } from '../options';

/** A lead with every intake answer filled in; tests blank out what they probe. */
const completeLead = (overrides: Partial<Lead> = {}): Lead =>
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
    source_note: null,
    notes: null,
    next_follow_up: null,
    ...overrides,
  }) as Lead;

describe('splitName / joinName', () => {
  it('treats the first token as the given name and the rest as the family name', () => {
    expect(splitName('Muhammad Eshmurodov')).toEqual({
      firstName: 'Muhammad',
      lastName: 'Eshmurodov',
    });
  });

  it('keeps multi-word family names whole', () => {
    expect(splitName('Sardor Abdulla Yo‘ldoshev')).toEqual({
      firstName: 'Sardor',
      lastName: 'Abdulla Yo‘ldoshev',
    });
  });

  it('leaves the family name empty rather than guessing at one', () => {
    expect(splitName('Aziza')).toEqual({ firstName: 'Aziza', lastName: '' });
  });

  it('survives blank and whitespace-only names', () => {
    expect(splitName('')).toEqual({ firstName: '', lastName: '' });
    expect(splitName('   ')).toEqual({ firstName: '', lastName: '' });
  });

  it('round-trips through joinName', () => {
    const { firstName, lastName } = splitName('Dilnoza Qodirova');
    expect(joinName(firstName, lastName)).toBe('Dilnoza Qodirova');
  });
});

describe('initialsOf', () => {
  it('reads family initial then given initial', () => {
    expect(initialsOf('Muhammad Eshmurodov')).toBe('EM');
  });

  it('falls back to a placeholder when there is no name at all', () => {
    expect(initialsOf('')).toBe('??');
  });

  it('copes with a single-token name', () => {
    expect(initialsOf('Aziza')).toBe('A');
  });
});

describe('validateIntake', () => {
  it('accepts a fully answered form', () => {
    const form = formFromLead(completeLead());
    expect(validateIntake(form)).toEqual({});
    expect(hasErrors(validateIntake(form))).toBe(false);
  });

  it('flags every required field on an empty form but not the optional ones', () => {
    const errors = validateIntake(EMPTY_FORM);
    expect(Object.keys(errors).sort()).toEqual(
      ['age', 'cert', 'channel', 'city', 'firstName', 'lastName', 'level', 'phone', 'semester', 'source'].sort(),
    );
  });

  it('rejects a phone with fewer than nine digits and accepts one with nine', () => {
    const form = { ...formFromLead(completeLead()), phone: '+998 94 196' };
    expect(validateIntake(form).phone).toBe(true);
    expect(validateIntake({ ...form, phone: '941966989' }).phone).toBeUndefined();
  });

  it('ignores spaces, dashes and brackets when counting phone digits', () => {
    const form = { ...formFromLead(completeLead()), phone: '(94) 196-69-89' };
    expect(validateIntake(form).phone).toBeUndefined();
  });

  it('holds the age to the 15–45 band, inclusive', () => {
    const form = formFromLead(completeLead());
    expect(validateIntake({ ...form, age: '15' }).age).toBeUndefined();
    expect(validateIntake({ ...form, age: '45' }).age).toBeUndefined();
    expect(validateIntake({ ...form, age: '14' }).age).toBe(true);
    expect(validateIntake({ ...form, age: '46' }).age).toBe(true);
    expect(validateIntake({ ...form, age: 'o‘n sakkiz' }).age).toBe(true);
  });

  it('does not require the note or the follow-up date', () => {
    const form = { ...formFromLead(completeLead()), note: '', followUp: '' };
    expect(validateIntake(form)).toEqual({});
  });

  it('treats a whitespace-only name as missing', () => {
    const form = { ...formFromLead(completeLead()), firstName: '   ' };
    expect(validateIntake(form).firstName).toBe(true);
  });
});

describe('isLeadComplete', () => {
  it('is true for a lead carrying every answer', () => {
    expect(isLeadComplete(completeLead())).toBe(true);
  });

  it.each([
    ['city', { city: null }],
    ['certificate', { cert_level: null }],
    ['study track', { education_level: null }],
    ['semester', { target_intake: null }],
    ['channel', { contact_channel: null }],
    ['source', { how_heard: null }],
    ['age', { age: null }],
    ['phone', { phone: null }],
  ])('is false when the %s is missing', (_label, missing) => {
    expect(isLeadComplete(completeLead(missing as Partial<Lead>))).toBe(false);
  });

  it('counts "no certificate" as an answer, not a blank', () => {
    expect(isLeadComplete(completeLead({ cert_level: "Yo'q" }))).toBe(true);
  });

  it('does not depend on the optional note or follow-up date', () => {
    expect(isLeadComplete(completeLead({ notes: null, next_follow_up: null }))).toBe(true);
  });
});

describe('leadDataFromForm', () => {
  it('rejoins the name and parses the age as a number', () => {
    const payload = leadDataFromForm(formFromLead(completeLead()));
    expect(payload.full_name).toBe('Muhammad Eshmurodov');
    expect(payload.age).toBe(18);
  });

  it('writes null rather than an empty string for unanswered fields', () => {
    const payload = leadDataFromForm({ ...EMPTY_FORM, firstName: 'Aziza' });
    expect(payload.age).toBeNull();
    expect(payload.cert_level).toBeNull();
    expect(payload.contact_channel).toBeNull();
    expect(payload.source_note).toBeNull();
  });

  it('keeps the clarification when the source calls for one', () => {
    const payload = leadDataFromForm({
      ...formFromLead(completeLead()),
      source: 'Do‘sti / tanishi tavsiyasi',
      sourceNote: 'Do‘sti Dilnoza tavsiya qildi',
    });
    expect(payload.source_note).toBe('Do‘sti Dilnoza tavsiya qildi');
  });

  it('drops a stale clarification when the source no longer needs one', () => {
    const payload = leadDataFromForm({
      ...formFromLead(completeLead()),
      source: 'Google qidiruv',
      sourceNote: 'Do‘sti Dilnoza tavsiya qildi',
    });
    expect(payload.source_note).toBeNull();
  });

  it('trims the values it stores', () => {
    const payload = leadDataFromForm({
      ...formFromLead(completeLead()),
      firstName: '  Muhammad  ',
      lastName: '  Eshmurodov  ',
      note: '  qayta aloqa kerak  ',
    });
    expect(payload.full_name).toBe('Muhammad Eshmurodov');
    expect(payload.notes).toBe('qayta aloqa kerak');
  });

  it('survives a round trip through the form', () => {
    const lead = completeLead({ notes: 'izoh', next_follow_up: '2027-03-01' });
    const payload = leadDataFromForm(formFromLead(lead));
    expect(payload).toMatchObject({
      full_name: lead.full_name,
      city: lead.city,
      cert_level: lead.cert_level,
      education_level: lead.education_level,
      target_intake: lead.target_intake,
      contact_channel: lead.contact_channel,
      how_heard: lead.how_heard,
      notes: 'izoh',
      next_follow_up: '2027-03-01',
    });
  });

  it('reads a timestamped follow-up back as a plain date', () => {
    const form = formFromLead(completeLead({ next_follow_up: '2027-03-01T09:30:00Z' }));
    expect(form.followUp).toBe('2027-03-01');
  });
});

describe('describeDate', () => {
  const now = new Date(2026, 7, 14); // 14 August 2026

  it('returns nothing for a blank or unparseable value', () => {
    expect(describeDate('', now)).toBeNull();
    expect(describeDate('ertaga', now)).toBeNull();
  });

  it('reads today as a zero offset', () => {
    expect(describeDate('2026-08-14', now)).toEqual({ day: 14, month: 7, offsetDays: 0 });
  });

  it('counts forward and backward from today', () => {
    expect(describeDate('2026-08-15', now)?.offsetDays).toBe(1);
    expect(describeDate('2026-08-21', now)?.offsetDays).toBe(7);
    expect(describeDate('2026-08-11', now)?.offsetDays).toBe(-3);
  });

  it('is unaffected by the time of day on the clock', () => {
    const evening = new Date(2026, 7, 14, 23, 45);
    expect(describeDate('2026-08-15', evening)?.offsetDays).toBe(1);
  });
});

describe('isoDaysFromNow', () => {
  it('produces a plain ISO date', () => {
    expect(isoDaysFromNow(1, new Date(2026, 7, 14))).toBe('2026-08-15');
    expect(isoDaysFromNow(7, new Date(2026, 7, 14))).toBe('2026-08-21');
  });

  it('rolls over month and year boundaries', () => {
    expect(isoDaysFromNow(1, new Date(2026, 7, 31))).toBe('2026-09-01');
    expect(isoDaysFromNow(7, new Date(2026, 11, 28))).toBe('2027-01-04');
  });

  it('pads single-digit months and days', () => {
    expect(isoDaysFromNow(0, new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('options', () => {
  it('offers this year and next, spring before autumn', () => {
    expect(semesterOptions(new Date(2026, 7, 14))).toEqual([
      'Bahorgi 2026',
      'Kuzgi 2026',
      'Bahorgi 2027',
      'Kuzgi 2027',
    ]);
  });

  it('asks for a clarification only where the source is uninformative on its own', () => {
    expect(needsSourceNote('Do‘sti / tanishi tavsiyasi')).toBe(true);
    expect(needsSourceNote('Tadbir yoki ko‘rgazma')).toBe(true);
    expect(needsSourceNote('Boshqa')).toBe(true);
    expect(needsSourceNote('Instagram sahifasi')).toBe(false);
    expect(needsSourceNote('')).toBe(false);
  });
});

describe('matchesLeadQuery', () => {
  const person = (over: Partial<Lead> = {}): Lead =>
    ({
      id: 'l',
      full_name: 'Aziz Karimov',
      phone: '+998 90 123-45-67',
      status: 'new',
      created_at: '2026-01-01T00:00:00Z',
      ...over,
    }) as Lead;

  it('matches a first name and a surname, either case', () => {
    expect(matchesLeadQuery(person(), 'aziz')).toBe(true);
    expect(matchesLeadQuery(person(), 'KARIMOV')).toBe(true);
    expect(matchesLeadQuery(person(), 'rim')).toBe(true);
  });

  it('matches a phone however either side is punctuated', () => {
    // The same number is stored as '+998 90 123-45-67' and typed as any of
    // these; a literal comparison would miss every one.
    for (const typed of ['901234567', '90 123 45 67', '+998901234567', '1234567']) {
      expect(matchesLeadQuery(person(), typed)).toBe(true);
    }
  });

  it('an empty or blank query keeps everyone', () => {
    expect(matchesLeadQuery(person(), '')).toBe(true);
    expect(matchesLeadQuery(person(), '   ')).toBe(true);
  });

  it('a word with no digits is never treated as a phone', () => {
    // phoneDigits('aziz') is '', and ''.includes('') is true — so a naive
    // implementation matches every lead that has a phone at all.
    expect(matchesLeadQuery(person({ full_name: 'Bek Tursunov' }), 'aziz')).toBe(false);
  });

  it('does not match a lead with no phone on a numeric query', () => {
    expect(matchesLeadQuery(person({ phone: null }), '901')).toBe(false);
  });

  it('says no when nothing matches', () => {
    expect(matchesLeadQuery(person(), 'zzz')).toBe(false);
  });
});
