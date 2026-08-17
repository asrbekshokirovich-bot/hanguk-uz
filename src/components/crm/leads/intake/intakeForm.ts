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
  return {
    firstName,
    lastName,
    phone: lead.phone ?? '',
    age: lead.age == null ? '' : String(lead.age),
    city: lead.city ?? '',
    cert: lead.cert_level ?? '',
    level: lead.education_level ?? '',
    semester: lead.target_intake ?? '',
    channel: lead.contact_channel ?? '',
    source: lead.how_heard ?? '',
    sourceNote: lead.source_note ?? '',
    note: lead.notes ?? '',
    followUp: lead.next_follow_up ? lead.next_follow_up.slice(0, 10) : '',
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
    phone: trimmed(form.phone) ?? undefined,
    age: Number.isFinite(age) ? age : null,
    city: trimmed(form.city) ?? undefined,
    cert_level: trimmed(form.cert),
    education_level: trimmed(form.level) ?? undefined,
    target_intake: trimmed(form.semester),
    contact_channel: trimmed(form.channel),
    how_heard: trimmed(form.source) ?? undefined,
    source_note: needsSourceNote(form.source) ? trimmed(form.sourceNote) : null,
    notes: trimmed(form.note) ?? undefined,
    next_follow_up: trimmed(form.followUp) ?? undefined,
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
  if (phoneDigits(form.phone).length < MIN_PHONE_DIGITS) errors.phone = true;

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
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
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
