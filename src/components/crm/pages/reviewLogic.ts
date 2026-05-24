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
