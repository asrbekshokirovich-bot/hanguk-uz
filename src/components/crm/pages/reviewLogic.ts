import { z } from 'zod';

/**
 * Framework-free logic for the university-data review queue: per-field-group
 * validation schemas, a structural diff, confidence aggregation, and the
 * status-enum → label resolution. Kept separate from the React components so it
 * can be unit-tested directly against real `parsed_output` payloads.
 */

export const NOT_SPECIFIED = 'Not specified';

export const FIELD_GROUPS = [
  'calendar',
  'requirements',
  'tuition',
  'scholarships',
  'documents_required',
] as const;
export type FieldGroup = (typeof FIELD_GROUPS)[number];

export function isFieldGroup(v: string | null | undefined): v is FieldGroup {
  return !!v && (FIELD_GROUPS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Validation — mirrors the backend FIELD_GROUP_SCHEMAS shape closely enough to
// block malformed edits (wrong container, non-object rows, bad enums/types)
// while staying permissive about extra keys the extractor may add (passthrough).
// ---------------------------------------------------------------------------

export type RequirementStatus = 'required' | 'not_required' | 'not_stated';
const statusEnum = z.enum(['required', 'not_required', 'not_stated']);

const strN = z.union([z.string(), z.null()]).optional();
const numN = z.union([z.number(), z.null()]).optional();
const boolN = z.union([z.boolean(), z.null()]).optional();
const conf = z.number().optional();

const requirementsRow = z
  .object({
    applicant_category: strN,
    topik_status: statusEnum.optional(),
    english_status: statusEnum.optional(),
    gpa_status: statusEnum.optional(),
    topik_min_level: numN,
    topik_deferred: boolN,
    gpa_floor_pct: numN,
    interview_required: boolN,
    practical_exam_required: boolN,
    prose_ko: strN,
    prose_en: strN,
    extractor_confidence: conf,
  })
  .passthrough();

const documentsRow = z
  .object({
    document_type: strN,
    is_required: boolN,
    is_apostille_required: boolN,
    notes_ko: strN,
    deadline: strN,
    applies_to_round: strN,
    extractor_confidence: conf,
  })
  .passthrough();

const scholarshipsRow = z
  .object({
    name_ko: strN,
    name_en: strN,
    scope: strN,
    award_type: strN,
    award_value: numN,
    prose_ko: strN,
    extractor_confidence: conf,
  })
  .passthrough();

const tuitionRow = z
  .object({
    faculty_group: strN,
    academic_year: z.union([z.number(), z.string(), z.null()]).optional(),
    semester_number: z.union([z.number(), z.string(), z.null()]).optional(),
    amount_krw: numN,
    admission_fee_krw: numN,
    is_first_semester: boolN,
    extractor_confidence: conf,
  })
  .passthrough();

const calendarEvent = z
  .object({
    event_type: strN,
    starts_at: strN,
    is_tentative: boolN,
    notes_ko: strN,
    extractor_confidence: conf,
  })
  .passthrough();

export const FIELD_GROUP_SCHEMAS: Record<FieldGroup, z.ZodTypeAny> = {
  requirements: z.object({ rows: z.array(requirementsRow) }).passthrough(),
  documents_required: z.object({ rows: z.array(documentsRow) }).passthrough(),
  scholarships: z.object({ rows: z.array(scholarshipsRow) }).passthrough(),
  tuition: z.object({ rows: z.array(tuitionRow) }).passthrough(),
  calendar: z.object({ events: z.array(calendarEvent) }).passthrough(),
};

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

export function validateParsedOutput(
  fieldGroup: string | null,
  value: unknown,
): ValidationResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: [{ path: '(root)', message: 'Expected a JSON object' }] };
  }
  if (!isFieldGroup(fieldGroup)) {
    // Unknown field group: we can only assert it is a non-empty object.
    if (Object.keys(value as object).length === 0) {
      return { ok: false, errors: [{ path: '(root)', message: 'Object must not be empty' }] };
    }
    return { ok: true, errors: [] };
  }
  const res = FIELD_GROUP_SCHEMAS[fieldGroup].safeParse(value);
  if (res.success) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: res.error.issues.map((i) => ({
      path: i.path.length ? i.path.join('.') : '(root)',
      message: i.message,
    })),
  };
}

/** The array key (`rows` or `events`) a field group stores its items under. */
export function itemsKey(fieldGroup: string | null): 'rows' | 'events' {
  return fieldGroup === 'calendar' ? 'events' : 'rows';
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

export function rowConfidences(parsedOutput: unknown): number[] {
  const out: number[] = [];
  const scan = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const r of arr) {
      if (r && typeof r === 'object') {
        const c = (r as Record<string, unknown>).extractor_confidence;
        if (typeof c === 'number' && Number.isFinite(c)) out.push(c);
      }
    }
  };
  if (parsedOutput && typeof parsedOutput === 'object') {
    const o = parsedOutput as Record<string, unknown>;
    scan(o.rows);
    scan(o.events);
  }
  return out;
}

/** Lowest per-row extractor confidence found in a payload, or null. */
export function minRowConfidence(parsedOutput: unknown): number | null {
  const cs = rowConfidences(parsedOutput);
  return cs.length ? Math.min(...cs) : null;
}

/**
 * The confidence to surface for one queue item: prefer the view's
 * `min_row_confidence`, then a client-computed min over the rows (meaningful
 * before the backend migration lands), then the job-level `accuracy_self_score`.
 */
export function itemConfidence(item: {
  min_row_confidence?: number | null;
  parsed_output?: unknown;
  accuracy_self_score?: number | null;
}): number | null {
  if (typeof item.min_row_confidence === 'number') return item.min_row_confidence;
  const computed = minRowConfidence(item.parsed_output);
  if (computed !== null) return computed;
  return typeof item.accuracy_self_score === 'number' ? item.accuracy_self_score : null;
}

export function confidencePct(score: number | null | undefined): string | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  return `${Math.round(score * 100)}%`;
}

// ---------------------------------------------------------------------------
// Requirement status enums → display label
// ---------------------------------------------------------------------------

/**
 * Resolve a requirements status enum + the concrete value into a display
 * string. `not_required` renders "Not required" (a definite answer, not
 * muted); `not_stated` renders "Not specified" (muted). When the enum is
 * absent we fall back to the concrete value or "Not specified".
 */
export function resolveStatusField(
  status: unknown,
  concrete: string | null,
): { text: string; muted: boolean } {
  if (status === 'not_required') return { text: 'Not required', muted: false };
  if (status === 'not_stated') return { text: NOT_SPECIFIED, muted: true };
  if (status === 'required') return { text: concrete ?? 'Required', muted: false };
  return concrete ? { text: concrete, muted: false } : { text: NOT_SPECIFIED, muted: true };
}

// ---------------------------------------------------------------------------
// Structural diff (before/after of changed fields)
// ---------------------------------------------------------------------------

export type DiffKind = 'added' | 'removed' | 'changed';
export interface DiffEntry {
  path: string;
  before: unknown;
  after: unknown;
  kind: DiffKind;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function joinPath(base: string, key: string | number): string {
  if (typeof key === 'number') return `${base}[${key}]`;
  return base ? `${base}.${key}` : key;
}

/** Recursively diff two JSON values, listing leaf-level changes. */
export function diffParsedOutput(before: unknown, after: unknown): DiffEntry[] {
  const entries: DiffEntry[] = [];

  const walk = (path: string, a: unknown, b: unknown) => {
    if (a === b) return;

    if (isPlainObject(a) && isPlainObject(b)) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) walk(joinPath(path, k), a[k], b[k]);
      return;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++) walk(joinPath(path, i), a[i], b[i]);
      return;
    }

    if (JSON.stringify(a) === JSON.stringify(b)) return;

    const kind: DiffKind =
      a === undefined ? 'added' : b === undefined ? 'removed' : 'changed';
    entries.push({ path: path || '(root)', before: a, after: b, kind });
  };

  walk('', before, after);
  return entries;
}

// ---------------------------------------------------------------------------
// Item presence
// ---------------------------------------------------------------------------

export function itemCount(parsedOutput: unknown): number {
  if (!parsedOutput || typeof parsedOutput !== 'object') return 0;
  const o = parsedOutput as Record<string, unknown>;
  const rows = Array.isArray(o.rows) ? o.rows.length : 0;
  const events = Array.isArray(o.events) ? o.events.length : 0;
  return rows + events;
}

export function isEmptyExtraction(parsedOutput: unknown): boolean {
  return itemCount(parsedOutput) === 0;
}

// ---------------------------------------------------------------------------
// Admission-track relevance. This service serves FOREIGN applicants, so
// 외국인전형 is relevant; overseas-Korean / defector / "completed all schooling
// abroad" / naturalised tracks are noise that should be de-emphasised.
// ---------------------------------------------------------------------------

export type TrackRelevance = 'foreign' | 'korean_heritage' | 'unknown';

const FOREIGN_RE = /외국인|\bforeign\b/i;
const KOREAN_HERITAGE_RE = /재외국민|북한이탈|국외\s*전\s*교육|전\s*교육과정|전교육과정|귀화/;

export function classifyTrack(row: Record<string, unknown>): TrackRelevance {
  const hay = ['applicant_category', 'prose_ko', 'prose_en', 'source_text_ko']
    .map((k) => (typeof row[k] === 'string' ? (row[k] as string) : ''))
    .join(' ');
  const foreign = FOREIGN_RE.test(hay);
  const heritage = KOREAN_HERITAGE_RE.test(hay);
  if (foreign) return 'foreign'; // mixed 외국인+재외국민 cards stay visible
  if (heritage) return 'korean_heritage';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Calendar event_type → timeline slot. Keep the union of `types` in sync with
// the audit harness (uni_db_audit.sql §7). Any event_type not listed here is
// returned in `other` so it is never silently dropped.
// ---------------------------------------------------------------------------

export const CALENDAR_SLOTS: Array<{ label: string; types: string[] }> = [
  { label: 'Online application opens', types: ['apply_open'] },
  { label: 'Online application deadline', types: ['apply_close'] },
  { label: 'Document deadline', types: ['documents_deadline', 'document_submission_close'] },
  { label: 'First-stage results', types: ['first_stage_results'] },
  { label: 'Interview', types: ['interview'] },
  { label: 'Results announced', types: ['final_results'] },
  { label: 'Registration opens', types: ['registration_open'] },
  { label: 'Registration deadline', types: ['registration_close'] },
  { label: 'Orientation', types: ['orientation'] },
];

const MAPPED_EVENT_TYPES = new Set(CALENDAR_SLOTS.flatMap((s) => s.types));

export function mapCalendarEvents(events: Array<Record<string, unknown>>): {
  slots: Array<{ label: string; events: Array<Record<string, unknown>> }>;
  other: Array<Record<string, unknown>>;
} {
  const slots = CALENDAR_SLOTS.map((s) => ({
    label: s.label,
    events: events.filter((e) => s.types.includes(String(e.event_type))),
  }));
  const other = events.filter((e) => !MAPPED_EVENT_TYPES.has(String(e.event_type)));
  return { slots, other };
}

// ---------------------------------------------------------------------------
// Stale-cycle detection: collect dates from a payload; a cycle is stale when it
// has at least one parseable date and its LATEST date is already in the past.
// ---------------------------------------------------------------------------

export function collectDates(parsedOutput: unknown): Date[] {
  const out: Date[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) out.push(d);
    }
  };
  if (parsedOutput && typeof parsedOutput === 'object') {
    const o = parsedOutput as Record<string, unknown>;
    if (Array.isArray(o.events)) for (const e of o.events) push((e as Record<string, unknown>)?.starts_at);
    if (Array.isArray(o.rows)) for (const r of o.rows) push((r as Record<string, unknown>)?.deadline);
  }
  return out;
}

export function isStaleCycle(parsedOutput: unknown, now: Date = new Date()): boolean {
  const dates = collectDates(parsedOutput);
  if (dates.length === 0) return false;
  const latest = Math.max(...dates.map((d) => d.getTime()));
  return latest < now.getTime();
}

// ---------------------------------------------------------------------------
// Per-document country-specific rules (e.g. { UZ: { consular: true } }).
// ---------------------------------------------------------------------------

export interface CountryRule {
  country: string;
  rules: string[];
}

export function countryRules(row: Record<string, unknown>): CountryRule[] {
  const cs = row.country_specific;
  if (!cs || typeof cs !== 'object' || Array.isArray(cs)) return [];
  const out: CountryRule[] = [];
  for (const [country, val] of Object.entries(cs as Record<string, unknown>)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const rules = Object.entries(val as Record<string, unknown>)
        .filter(([, v]) => v === true || (typeof v === 'string' && v))
        .map(([k, v]) => (v === true ? k : `${k}: ${v}`));
      if (rules.length) out.push({ country, rules });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Review-queue list filtering. The dashboard view is open-only (no status
// column), so filtering is by institution / field group / priority / free-text
// search. Kept pure so the component's filter bar is trivially testable.
// ---------------------------------------------------------------------------

export interface ReviewRowLike {
  name_ko: string | null;
  name_en: string | null;
  field_group: string | null;
  reason: string;
  priority: number;
  parsed_output?: unknown;
}

export interface ReviewFilters {
  institution: string; // '' = all (compared against institutionLabel)
  fieldGroup: string; // '' = all
  priority: number | null; // null = all
  search: string; // '' = all
}

export const EMPTY_REVIEW_FILTERS: ReviewFilters = {
  institution: '',
  fieldGroup: '',
  priority: null,
  search: '',
};

export function hasActiveFilters(f: ReviewFilters): boolean {
  return !!f.institution || !!f.fieldGroup || f.priority !== null || f.search.trim() !== '';
}

/** Display identity for an institution row (English name, else Korean). */
export function institutionLabel(row: { name_ko: string | null; name_en: string | null }): string {
  return row.name_en?.trim() || row.name_ko?.trim() || 'Unknown institution';
}

export function distinctInstitutions(
  rows: Array<{ name_ko: string | null; name_en: string | null }>,
): string[] {
  return Array.from(new Set(rows.map(institutionLabel))).sort((a, b) => a.localeCompare(b));
}

export function distinctFieldGroups(rows: Array<{ field_group: string | null }>): string[] {
  return Array.from(new Set(rows.map((r) => r.field_group ?? 'other'))).sort();
}

export function distinctPriorities(rows: Array<{ priority: number }>): number[] {
  return Array.from(new Set(rows.map((r) => r.priority))).sort((a, b) => a - b);
}

export function reviewRowMatches(row: ReviewRowLike, f: ReviewFilters): boolean {
  if (f.institution && institutionLabel(row) !== f.institution) return false;
  if (f.fieldGroup && (row.field_group ?? 'other') !== f.fieldGroup) return false;
  if (f.priority !== null && row.priority !== f.priority) return false;
  const q = f.search.trim().toLowerCase();
  if (q) {
    let hay = `${row.name_ko ?? ''} ${row.name_en ?? ''} ${row.field_group ?? ''} ${row.reason ?? ''}`;
    if (row.parsed_output != null) {
      try {
        hay += ` ${JSON.stringify(row.parsed_output)}`;
      } catch {
        /* non-serialisable payloads are searched by metadata only */
      }
    }
    if (!hay.toLowerCase().includes(q)) return false;
  }
  return true;
}

export function filterReviewRows<T extends ReviewRowLike>(rows: T[], f: ReviewFilters): T[] {
  return rows.filter((r) => reviewRowMatches(r, f));
}
