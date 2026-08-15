import type { Lead } from '@/contexts/LeadsContext';
import { describeDate, isLeadComplete } from './intakeForm';
import { leadOutcome } from './outcome';

/**
 * Finding a lead in the list.
 *
 * Two ways in, deliberately: a text box for "the Samarqand girl who called on
 * Tuesday", and a set of pickers for "everyone on the Bakalavr track whose
 * follow-up is overdue". The text box also takes `field:value` terms, so an
 * operator who knows what they are looking for can type it faster than they
 * could reach the pickers.
 *
 * Kept free of React and i18n so the rules can be tested directly — matching is
 * the part that quietly goes wrong, and it goes wrong on real data (an
 * apostrophe typed three different ways, a phone number pasted with brackets).
 */

/** The fields a `field:value` term can name. */
export const SEARCH_FIELDS = [
  'name',
  'phone',
  'city',
  'source',
  'channel',
  'level',
  'semester',
  'cert',
  'note',
  'age',
] as const;

export type SearchField = (typeof SEARCH_FIELDS)[number];

export type Completeness = 'any' | 'complete' | 'incomplete';
export type FollowUpWindow = 'any' | 'overdue' | 'today' | 'week' | 'none';

export interface LeadFilters {
  query: string;
  city: string;
  channel: string;
  source: string;
  level: string;
  semester: string;
  cert: string;
  completeness: Completeness;
  followUp: FollowUpWindow;
}

export const EMPTY_FILTERS: LeadFilters = {
  query: '',
  city: '',
  channel: '',
  source: '',
  level: '',
  semester: '',
  cert: '',
  completeness: 'any',
  followUp: 'any',
};

/**
 * Folds away the differences that are invisible to the person typing.
 *
 * The Uzbek names in this database carry three different apostrophes (`'`,
 * `’`, `ʻ`) depending on which keyboard typed them, and nobody searching for
 * "Farg'ona" knows or cares which one is stored. Case and accents go the same
 * way. Without this, the list looks empty for a lead that is plainly there.
 */
export const normalize = (value: string): string =>
  (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bb\u02bc`\u00b4']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Digits only, so a pasted `+998 (94) 196-69-89` still matches `941966989`. */
export const phoneDigits = (value: string | null): string => (value ?? '').replace(/\D/g, '');

export interface SearchTerm {
  /** `undefined` searches every field. */
  field?: SearchField;
  value: string;
}

const isField = (value: string): value is SearchField =>
  (SEARCH_FIELDS as readonly string[]).includes(value);

/**
 * Splits what was typed into terms.
 *
 * Terms are ANDed: each one narrows the result. Quoting keeps a phrase in one
 * term instead of splitting it at the spaces. A `field:` prefix that names no
 * known field is kept as ordinary text — someone searching for a note that
 * happens to contain a colon should find it, not get an empty list.
 */
export const parseQuery = (query: string): SearchTerm[] => {
  const terms: SearchTerm[] = [];
  // A quoted phrase, or a run of non-space characters.
  const pattern = /(?:([a-z]+):)?(?:"([^"]*)"|(\S+))/gi;
  for (const match of (query ?? '').matchAll(pattern)) {
    const [, rawField, quoted, bare] = match;
    const value = quoted ?? bare ?? '';
    if (!value.trim() && quoted === undefined) continue;

    const field = rawField?.toLowerCase();
    if (field && isField(field)) {
      if (!value.trim()) continue;
      terms.push({ field, value });
    } else {
      // Not a field we know: put the prefix back so the text is searched whole.
      const text = rawField ? `${rawField}:${value}` : value;
      if (!text.trim()) continue;
      terms.push({ value: text });
    }
  }
  return terms;
};

/** What each field searches over, normalized once per lead. */
const haystack = (lead: Lead, field: SearchField): string => {
  switch (field) {
    case 'name':
      return normalize(lead.full_name);
    case 'phone':
      return phoneDigits(lead.phone);
    case 'city':
      return normalize(lead.city ?? '');
    case 'source':
      return normalize(`${lead.how_heard ?? ''} ${lead.source_note ?? ''}`);
    case 'channel':
      return normalize(lead.contact_channel ?? '');
    case 'level':
      return normalize(lead.education_level ?? '');
    case 'semester':
      return normalize(lead.target_intake ?? '');
    case 'cert':
      return normalize(lead.cert_level ?? '');
    case 'note':
      return normalize(lead.notes ?? '');
    case 'age':
      return lead.age == null ? '' : String(lead.age);
  }
};

const matchesTerm = (lead: Lead, term: SearchTerm): boolean => {
  const fields = term.field ? [term.field] : SEARCH_FIELDS;

  // Anything with digits is also tried against the phone, so typing part of a
  // number finds the lead without having to say `phone:`.
  const digits = phoneDigits(term.value);
  if (!term.field && digits.length >= 3 && phoneDigits(lead.phone).includes(digits)) return true;

  const needle = term.field === 'phone' ? digits : normalize(term.value);
  if (!needle) return false;

  return fields.some((field) => {
    const value = haystack(lead, field);
    if (!value) return false;
    if (field === 'age') return term.field === 'age' ? value === needle : false;
    return value.includes(needle);
  });
};

/** Whether a lead's follow-up date falls in the chosen window. */
export const matchesFollowUp = (lead: Lead, window: FollowUpWindow, now: Date): boolean => {
  if (window === 'any') return true;
  const parts = describeDate(lead.next_follow_up ?? '', now);
  if (!parts) return window === 'none';
  switch (window) {
    case 'none':
      return false;
    case 'overdue':
      return parts.offsetDays < 0;
    case 'today':
      return parts.offsetDays === 0;
    case 'week':
      // Today through a week out: what an operator plans their week around.
      return parts.offsetDays >= 0 && parts.offsetDays <= 7;
  }
};

const matchesPick = (value: string | null, chosen: string): boolean =>
  !chosen || normalize(value ?? '') === normalize(chosen);

/** Applies every filter. A lead has to satisfy all of them to survive. */
export const filterLeads = (leads: Lead[], filters: LeadFilters, now: Date): Lead[] => {
  const terms = parseQuery(filters.query);

  return leads.filter((lead) => {
    if (!matchesPick(lead.city, filters.city)) return false;
    if (!matchesPick(lead.contact_channel, filters.channel)) return false;
    if (!matchesPick(lead.how_heard, filters.source)) return false;
    if (!matchesPick(lead.education_level, filters.level)) return false;
    if (!matchesPick(lead.target_intake, filters.semester)) return false;
    if (!matchesPick(lead.cert_level, filters.cert)) return false;

    if (filters.completeness !== 'any') {
      const complete = isLeadComplete(lead);
      if (complete !== (filters.completeness === 'complete')) return false;
    }

    // A follow-up date on a lead that has already left the list is history, not
    // a plan, so the window only ever narrows the leads still being worked.
    if (filters.followUp !== 'any') {
      if (leadOutcome(lead) !== 'active') return false;
      if (!matchesFollowUp(lead, filters.followUp, now)) return false;
    }

    return terms.every((term) => matchesTerm(lead, term));
  });
};

/** How many filters are narrowing the list, for the badge on the toggle. */
export const activeFilterCount = (filters: LeadFilters): number =>
  [
    filters.city,
    filters.channel,
    filters.source,
    filters.level,
    filters.semester,
    filters.cert,
    filters.completeness === 'any' ? '' : filters.completeness,
    filters.followUp === 'any' ? '' : filters.followUp,
  ].filter(Boolean).length;

export const hasActiveSearch = (filters: LeadFilters): boolean =>
  filters.query.trim().length > 0 || activeFilterCount(filters) > 0;
