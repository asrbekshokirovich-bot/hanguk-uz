import type { CreateLeadData, Lead } from '@/contexts/LeadsContext';
import { MAX_AGE, MIN_AGE, MIN_PHONE_DIGITS, needsSourceNote } from './options';

/**
 * The intake form's shape and rules.
 *
 * Kept free of React and of i18n so the rules can be tested directly: what
 * counts as a filled-in lead is a business question the table's status chip,
 * the save button and the reporting all have to agree on, and that agreement is
 * much easier to keep when it lives in one pure module.
 */
export interface IntakeForm {
  firstName: string;
  lastName: string;
  phone: string;
  age: string;
  city: string;
  cert: string;
  level: string;
  semester: string;
  channel: string;
  source: string;
  sourceNote: string;
  note: string;
  followUp: string;
  /** "HH:MM" Tashkent time, or '' for a date-only follow-up. */
  followUpTime: string;
}

export const EMPTY_FORM: IntakeForm = {
  firstName: '',
  lastName: '',
  phone: '',
  age: '',
  city: '',
  cert: '',
  level: '',
  semester: '',
  channel: '',
  source: '',
  sourceNote: '',
  note: '',
  followUp: '',
  followUpTime: '',
};

/**
 * Splits a stored `full_name` into the two fields the form asks for.
 *
 * The first token is the given name and everything after it the family name,
 * which is how the names in this database are written. A single-token name
 * leaves the family field empty rather than guessing at one.
 */
export const splitName = (fullName: string): { firstName: string; lastName: string } => {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

export const joinName = (firstName: string, lastName: string) =>
  [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

/** Family initial then given initial, matching the avatars in the design. */
export const initialsOf = (fullName: string): string => {
  const { firstName, lastName } = splitName(fullName);
  const initials = `${lastName[0] ?? ''}${firstName[0] ?? ''}`.toUpperCase();
  return initials || '??';
};

/** Loads an existing lead into the form. */
export const formFromLead = (lead: Lead): IntakeForm => {
  const { firstName, lastName } = splitName(lead.full_name);
  const followUp = followUpParts(lead.next_follow_up);
  return {
    firstName,
    lastName,
    phone: phoneForInput(lead.phone),
    age: lead.age == null ? '' : String(lead.age),
    city: lead.city ?? '',
    cert: lead.cert_level ?? '',
    level: lead.education_level ?? '',
    semester: lead.target_intake ?? '',
    channel: lead.contact_channel ?? '',
    source: lead.how_heard ?? '',
    sourceNote: lead.source_note ?? '',
    note: lead.notes ?? '',
    followUp: followUp.date,
    followUpTime: followUp.time,
  };
};

/**
 * Turns the form back into a lead payload.
 *
 * Blank strings are written as `null` rather than `''` so that "not answered"
 * has exactly one representation in the column — `isComplete` and every report
 * downstream test for absence, and an empty string would pass those tests while
 * meaning the opposite. The clarification note is dropped when the chosen
 * source no longer calls for one, so a stale explanation cannot outlive the
 * answer it explained.
 */
export const leadDataFromForm = (form: IntakeForm): CreateLeadData => {
  const trimmed = (value: string) => {
    const next = value.trim();
    return next === '' ? null : next;
  };
  const age = Number.parseInt(form.age, 10);
  return {
    full_name: joinName(form.firstName, form.lastName),
    phone: phoneForSave(form.phone),
    age: Number.isFinite(age) ? age : null,
    city: trimmed(form.city) ?? undefined,
    cert_level: trimmed(form.cert),
    education_level: trimmed(form.level) ?? undefined,
    target_intake: trimmed(form.semester),
    contact_channel: trimmed(form.channel),
    how_heard: trimmed(form.source) ?? undefined,
    source_note: needsSourceNote(form.source) ? trimmed(form.sourceNote) : null,
    notes: trimmed(form.note) ?? undefined,
    next_follow_up: followUpForSave(form.followUp, form.followUpTime),
  };
};

export type IntakeErrorKey =
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'age'
  | 'city'
  | 'cert'
  | 'level'
  | 'semester'
  | 'channel'
  | 'source';

export type IntakeErrors = Partial<Record<IntakeErrorKey, true>>;

/** Digits only — operators paste numbers with spaces, dashes and brackets. */
export const phoneDigits = (phone: string) => phone.replace(/\D/g, '');

/** The country code the intake field always carries. */
export const UZ_PREFIX = '+998';

/**
 * A Kyrgyz number (plan KG3, 2026-11-11): typed with its "+996", or stored
 * whole (996 + 9 digits). Such a number keeps +996; everything else is Uzbek.
 */
export const KG_PREFIX = '+996';

export const isKgPhone = (phone: string | null | undefined): boolean => {
  const value = (phone ?? '').trim();
  if (value.startsWith(KG_PREFIX)) return true;
  const digits = phoneDigits(value);
  return digits.length === 12 && digits.startsWith('996');
};

/**
 * A lead from Kyrgyzstan (QA audit 2026-11-11): the server tags it
 * `country = 'KG'` (the app form and the +996 trigger); a +996 number that has
 * not been saved since still counts.
 */
export const isKgLead = (lead: { country?: string | null; phone?: string | null }): boolean =>
  lead.country === 'KG' || isKgPhone(lead.phone);

/** The 9 digits after +996, at most 9. */
export const kgLocalDigits = (phone: string | null | undefined): string => {
  const digits = phoneDigits((phone ?? '').trim());
  return (digits.startsWith('996') ? digits.slice(3) : digits).slice(0, MIN_PHONE_DIGITS);
};

/** The local digits of the number in the field, Kyrgyz or Uzbek. */
export const localDigits = (phone: string | null | undefined): string =>
  isKgPhone(phone) ? kgLocalDigits(phone) : uzLocalDigits(phone);

/**
 * The local part (operator code + number) of an Uzbek number, at most 9 digits.
 * A leading 998 is the country code only when more than 9 digits were given —
 * "998 90 ..." pasted whole — so a 9-digit local number is never cut.
 */
export const uzLocalDigits = (phone: string | null | undefined): string => {
  const value = (phone ?? '').trim();
  // "+998 2" while typing: the written prefix is the country code however short the rest is.
  if (value.startsWith(UZ_PREFIX)) return phoneDigits(value.slice(UZ_PREFIX.length)).slice(0, MIN_PHONE_DIGITS);
  const digits = phoneDigits(value);
  const local = digits.length > MIN_PHONE_DIGITS && digits.startsWith('998') ? digits.slice(3) : digits;
  return local.slice(0, MIN_PHONE_DIGITS);
};

/**
 * What the phone field shows while the operator types: "+998 20 278 97 15".
 * Operators typed bare local numbers ("202789715") and those were saved
 * without the country code; the field now always shows and keeps +998.
 */
export const formatPhoneInput = (value: string): string => {
  // "+", "+9", "+99" while typing a country code by hand: kept, so "+996" can
  // be reached; "+996 …" is a Kyrgyz number, spaced 700 123 456.
  if (/^\+9{0,2}$/.test(value.trim())) return value.trim();
  if (isKgPhone(value)) {
    const kg = kgLocalDigits(value);
    const groups = [kg.slice(0, 3), kg.slice(3, 6), kg.slice(6, 9)].filter(Boolean);
    return groups.length ? `${KG_PREFIX} ${groups.join(' ')}` : KG_PREFIX;
  }
  const local = uzLocalDigits(value);
  if (!local) return '';
  const parts = [local.slice(0, 2), local.slice(2, 5), local.slice(5, 7), local.slice(7, 9)].filter(Boolean);
  return `${UZ_PREFIX} ${parts.join(' ')}`;
};

/** A stored number loaded into the field. Anything that is not one Uzbek number stays as stored. */
export const phoneForInput = (stored: string | null | undefined): string => {
  const raw = (stored ?? '').trim();
  if (!raw) return '';
  const numbers = phoneNumbersOf(raw);
  const digits = numbers[0] ?? '';
  const isUz = numbers.length === 1 && (digits.length === 9 || (digits.length === 12 && digits.startsWith('998')));
  const isKg = numbers.length === 1 && digits.length === 12 && digits.startsWith('996');
  return isUz || isKg ? formatPhoneInput(raw) : raw;
};

/** Saved as "+998XXXXXXXXX" — the canonical form the rest of the system matches on. */
export const phoneForSave = (value: string): string | undefined => {
  // A Kyrgyz number keeps +996 — it was cut to "+998 99 6…" before (plan KG3).
  if (isKgPhone(value)) {
    const kg = kgLocalDigits(value);
    if (kg.length === MIN_PHONE_DIGITS) return `${KG_PREFIX}${kg}`;
    const trimmed = value.trim();
    return trimmed === KG_PREFIX ? undefined : trimmed;
  }
  const local = uzLocalDigits(value);
  if (local.length === MIN_PHONE_DIGITS) return `${UZ_PREFIX}${local}`;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === UZ_PREFIX ? undefined : trimmed;
};

/**
 * Every field except the free-text note and the follow-up date is required.
 *
 * The note is optional because it is a courtesy, and the follow-up date because
 * not every lead earns one; everything else is what makes the record usable to
 * the person who picks it up next.
 */
export const validateIntake = (form: IntakeForm): IntakeErrors => {
  const errors: IntakeErrors = {};
  if (!form.firstName.trim()) errors.firstName = true;
  if (!form.lastName.trim()) errors.lastName = true;
  if (localDigits(form.phone).length !== MIN_PHONE_DIGITS) errors.phone = true;

  const age = Number.parseInt(form.age, 10);
  if (!(Number.isFinite(age) && age >= MIN_AGE && age <= MAX_AGE)) errors.age = true;

  if (!form.city) errors.city = true;
  if (!form.cert) errors.cert = true;
  if (!form.level) errors.level = true;
  if (!form.semester) errors.semester = true;
  if (!form.channel) errors.channel = true;
  if (!form.source) errors.source = true;
  return errors;
};

export const hasErrors = (errors: IntakeErrors) => Object.keys(errors).length > 0;

/**
 * The far smaller set that must hold before a lead can be SAVED.
 *
 * Saving and completing are different questions, and conflating them cost the
 * office real leads: a caller who gives a name and hangs up before the rest is
 * still a lead worth keeping, but the form refused the record and the operator
 * was left retyping it later from memory — or not at all.
 *
 * Only the name is required, for two reasons that are not style preferences:
 * `leads.full_name` is NOT NULL in the database, and a record nobody can
 * search by is one nobody will ever pick up again. Everything else is
 * genuinely nullable in the schema and `leadDataFromForm` already turns a
 * blank into null, so a partial row stores exactly as well as a whole one.
 *
 * `validateIntake` is deliberately left alone: it defines COMPLETE, which the
 * list badge, the incomplete-first sort and the convert gate all read. Loosen
 * that and every half-filled lead would start claiming it was finished.
 */
export const validateSavable = (form: IntakeForm): IntakeErrors => {
  const errors: IntakeErrors = {};
  // Either part will do. Operators often have only a first name on a cold
  // call, and demanding a surname is the same wall in a smaller doorway.
  if (!form.firstName.trim() && !form.lastName.trim()) {
    errors.firstName = true;
  }
  return errors;
};

/** How many of the completeness answers are still outstanding. */
export const missingCount = (form: IntakeForm): number =>
  Object.keys(validateIntake(form)).length;

/**
 * Whether a lead answers to what the operator typed in the search box.
 *
 * Matches a name fragment or a phone fragment, because those are the two
 * things a caller gives: "this is Aziz" or a number on the screen.
 *
 * Phone is compared DIGITS ONLY on both sides. The same person is stored as
 * `+998 90 123-45-67` and searched for as `901234567` or `90 123 45 67`, and a
 * literal comparison would miss every one of those. Name is folded to
 * lowercase; Uzbek and Russian both case-fold correctly under `toLowerCase`
 * for the letters these names actually use.
 *
 * An empty or whitespace-only query matches everything — the box is a filter,
 * not a mode, and clearing it must restore the full list.
 */
export const matchesLeadQuery = (lead: Lead, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  if ((lead.full_name ?? '').toLowerCase().includes(needle)) return true;

  // Only treat the query as a phone when it actually contains digits;
  // otherwise `phoneDigits('aziz')` is '' and would match every lead that has
  // a phone at all.
  const digits = phoneDigits(query);
  if (!digits) return false;

  // Exactly four digits is how the office looks a caller up — "the number
  // ending in 4567". Matched against the END of each stored number, because a
  // plain substring search also returns every number that merely has those
  // four digits somewhere in the middle.
  if (isLastDigitsQuery(query)) {
    return phoneNumbersOf(lead.phone).some((number) => number.endsWith(digits));
  }

  return phoneDigits(lead.phone ?? '').includes(digits);
};

/** How many trailing digits make a "number ending in …" lookup. */
export const LAST_DIGITS_LENGTH = 4;

/** `"4567"` or `"45 67"` — digits (spaces allowed), exactly four of them. */
export const isLastDigitsQuery = (query: string): boolean =>
  /^[\d\s]+$/.test(query.trim()) && phoneDigits(query).length === LAST_DIGITS_LENGTH;

/**
 * The separate numbers in a phone field, as digit strings.
 *
 * A few records hold two numbers in one field ("90 123 45 67 / 91 765 43 21");
 * each is matched on its own, so the first number's ending is not lost inside
 * the second.
 */
export const phoneNumbersOf = (phone: string | null | undefined): string[] =>
  (phone ?? '')
    .split(/[,;/|\n]/)
    .map(phoneDigits)
    .filter(Boolean);

/**
 * A phone number laid out for reading in the list.
 *
 * Only reshapes what is unambiguous — an Uzbek number stored as 9 digits, or as
 * 12 digits starting with 998. Anything else (foreign numbers, two numbers in
 * one field, text such as "Tel:") is shown exactly as stored, so nothing is
 * guessed. The stored value is never changed.
 */
export const formatPhoneForList = (phone: string | null | undefined): string => {
  const raw = (phone ?? '').trim();
  if (!raw) return '';
  const numbers = phoneNumbersOf(raw);
  if (numbers.length !== 1 || /[^\d\s()+-]/.test(raw)) return raw;
  const digits = numbers[0];
  const local =
    digits.length === 12 && digits.startsWith('998')
      ? digits.slice(3)
      : digits.length === 9
        ? digits
        : null;
  if (!local) return raw;
  const grouped = `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
  return digits.length === 12 ? `+998 ${grouped}` : grouped;
};

/**
 * Whether a saved lead carries every answer the intake form asks for.
 *
 * Read straight off the record rather than off a stored flag, so a lead
 * imported or edited elsewhere reports its true state in the list.
 */
export const isLeadComplete = (lead: Lead): boolean =>
  !hasErrors(validateIntake(formFromLead(lead)));

/**
 * Describes a follow-up date relative to today.
 *
 * Returns the parts rather than a sentence: the month name and the wording of
 * "in 3 days" are translated copy, and building them here would pin the module
 * to one language and make it untestable without an i18n runtime.
 * `offsetDays` is negative when the date has already passed.
 */
export interface DateParts {
  day: number;
  /** 0-based, so it indexes a month-name array directly. */
  month: number;
  offsetDays: number;
}

export const describeDate = (value: string, now: Date = new Date()): DateParts | null => {
  if (!value) return null;
  const date = new Date(`${followUpParts(value).date}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    day: date.getDate(),
    month: date.getMonth(),
    offsetDays: Math.round((date.getTime() - midnight.getTime()) / 86_400_000),
  };
};

/** An ISO date `n` days from `now`, for the "tomorrow" / "in a week" buttons. */
export const isoDaysFromNow = (days: number, now: Date = new Date()): string => {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const TASHKENT = 'Asia/Tashkent';

/**
 * A stored follow-up split into the form's date and time (Asrbek, 2026-11-12:
 * "bu yerda soat qo'shish kerak"). Both are read in Tashkent time, so a call
 * set for 03:00 does not slip to the previous day. A bare date, or a stamp at
 * exactly 00:00 UTC (how date-only saves were stored before), has no time.
 */
export const followUpParts = (value: string | null | undefined): { date: string; time: string } => {
  if (!value) return { date: '', time: '' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: value, time: '' };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: value.slice(0, 10), time: '' };
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TASHKENT,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const date = `${p.year}-${p.month}-${p.day}`;
  const dateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  return { date, time: dateOnly ? '' : `${p.hour}:${p.minute}` };
};

/** Date only → "2026-11-12" as before; with a time → "2026-11-12T15:30:00+05:00". */
export const followUpForSave = (date: string, time: string): string | undefined => {
  const d = date.trim();
  if (!d) return undefined;
  const t = time.trim();
  return /^\d{2}:\d{2}$/.test(t) ? `${d}T${t}:00+05:00` : d;
};
