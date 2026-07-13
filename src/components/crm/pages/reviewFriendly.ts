/**
 * Framework-free helpers that make the uni-db review surfaces readable for
 * non-technical, Uzbek/English-speaking staff: locale date/money/TOPIK
 * formatters, confidence → traffic-light banding, extraction of the
 * extractor-emitted plain-language summaries (summary_uz / summary_en,
 * label_uz / label_en — all OPTIONAL, old payloads render without them), and
 * parsing of the reliability gauntlet's reviewer_notes into a pass/fail list.
 *
 * Kept separate from the React components so it can be unit-tested directly.
 */

/** The two review-surface languages. Anything that isn't Uzbek renders English. */
export type ReviewLang = 'uz' | 'en';

export function reviewLang(i18nLanguage: string | undefined | null): ReviewLang {
  return (i18nLanguage ?? '').toLowerCase().startsWith('uz') ? 'uz' : 'en';
}

// ---------------------------------------------------------------------------
// Dates — rendered in KST (the timezone the guidelines are written in),
// human-formatted: uz "20-mart 2026", en "20 March 2026", plus ", 17:00" when
// the source value carries a time of day.
// ---------------------------------------------------------------------------

const MONTHS_UZ = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function kstParts(d: Date): { y: number; m: number; day: number; hh: string; mm: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    day: Number(get('day')),
    hh: get('hour'),
    mm: get('minute'),
  };
}

/**
 * Format an ISO date / date-time as a human date ("20-mart 2026" /
 * "20 March 2026"), appending ", HH:MM" when the value carries a time.
 * Returns null when the value is absent or unparseable (caller falls back).
 */
export function formatReviewDate(value: unknown, lang: ReviewLang): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const s = value.trim();

  // A bare date must not go through Date() + KST conversion (UTC midnight
  // would shift the day); format it verbatim.
  if (DATE_ONLY_RE.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    if (m < 1 || m > 12) return null;
    return lang === 'uz'
      ? `${d}-${MONTHS_UZ[m - 1]} ${y}`
      : `${d} ${MONTHS_EN[m - 1]} ${y}`;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const p = kstParts(d);
  const date =
    lang === 'uz'
      ? `${p.day}-${MONTHS_UZ[p.m - 1]} ${p.y}`
      : `${p.day} ${MONTHS_EN[p.m - 1]} ${p.y}`;
  const hasTime = /T\d{2}:\d{2}/.test(s);
  return hasTime ? `${date}, ${p.hh}:${p.mm}` : date;
}

// ---------------------------------------------------------------------------
// Money — "4 200 000 KRW" (spaces as thousands separators, currency spelled
// out; reviewers found "₩4,200,000" and "4200000" hard to scan).
// ---------------------------------------------------------------------------

export function formatMoney(value: unknown, currency = 'KRW'): string | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return null;
  const grouped = new Intl.NumberFormat('en-US')
    .format(Math.round(n))
    .replace(/,/g, ' ');
  return `${grouped} ${currency}`;
}

// ---------------------------------------------------------------------------
// TOPIK — "TOPIK 3+" (a minimum level, hence the plus).
// ---------------------------------------------------------------------------

export function formatTopik(minLevel: unknown): string | null {
  const n = typeof minLevel === 'number' ? minLevel : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 6) return null;
  return `TOPIK ${n}+`;
}

// ---------------------------------------------------------------------------
// Confidence → traffic light. Scores are 0..1; bands follow the reviewer
// guidance: ≥80% looks reliable, 50–79% double-check, <50% caution.
// ---------------------------------------------------------------------------

export type ConfidenceBand = 'green' | 'yellow' | 'red';

export function confidenceBand(score: number | null | undefined): ConfidenceBand | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  const pct = score * 100;
  if (pct >= 80) return 'green';
  if (pct >= 50) return 'yellow';
  return 'red';
}

// ---------------------------------------------------------------------------
// Extractor-emitted plain-language summaries (OPTIONAL fields).
// ---------------------------------------------------------------------------

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * The reviewer summary for a payload in the given language, falling back to
 * the other language, or null for old payloads without summaries.
 */
export function getSummary(parsedOutput: unknown, lang: ReviewLang): string | null {
  if (!parsedOutput || typeof parsedOutput !== 'object' || Array.isArray(parsedOutput)) {
    return null;
  }
  const o = parsedOutput as Record<string, unknown>;
  const uz = str(o.summary_uz);
  const en = str(o.summary_en);
  return lang === 'uz' ? (uz ?? en) : (en ?? uz);
}

/** The optional plain-language row label (label_uz / label_en), or null. */
export function getRowLabel(row: unknown, lang: ReviewLang): string | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const o = row as Record<string, unknown>;
  const uz = str(o.label_uz);
  const en = str(o.label_en);
  return lang === 'uz' ? (uz ?? en) : (en ?? uz);
}

// ---------------------------------------------------------------------------
// Original Korean text — collected per payload/row so the UI can collapse it
// behind one "Show original text" disclosure instead of inlining Korean.
// ---------------------------------------------------------------------------

const KO_TEXT_KEYS = ['source_text_ko', 'prose_ko', 'notes_ko', 'correction_text_ko'] as const;

export function collectOriginalTexts(container: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: unknown) => {
    const s = str(v);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  };
  const scanRow = (row: unknown) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return;
    for (const k of KO_TEXT_KEYS) push((row as Record<string, unknown>)[k]);
  };
  if (Array.isArray(container)) {
    for (const r of container) scanRow(r);
  } else if (container && typeof container === 'object') {
    const o = container as Record<string, unknown>;
    if (Array.isArray(o.rows) || Array.isArray(o.events)) {
      for (const r of [...(Array.isArray(o.rows) ? o.rows : []), ...(Array.isArray(o.events) ? o.events : [])]) {
        scanRow(r);
      }
    } else {
      scanRow(container);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reliability gauntlet notes → plain pass/fail checklist.
//
// reviewer_notes format (verify/engine.py to_review_note):
//   "[RED] reliability · tuition
//      identity: REJECTED — …
//      consensus DISAGREEMENT on field: […]
//      grounding[not_found] row 1 field: …
//      sanity[warn] field: …
//      critic[sev] row 1: …
//      all checks passed"
// ---------------------------------------------------------------------------

export type ReliabilityCheckKind =
  | 'identity'
  | 'consensus'
  | 'grounding'
  | 'sanity'
  | 'critic'
  | 'other';

export interface ReliabilityCheckItem {
  kind: ReliabilityCheckKind;
  detail: string;
}

export interface ReliabilityChecks {
  allPassed: boolean;
  failures: ReliabilityCheckItem[];
}

export function parseReliabilityChecks(detail: string | null | undefined): ReliabilityChecks | null {
  const text = (detail ?? '').trim();
  if (!text) return null;
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    // Drop the "[COLOR] reliability · group" header line(s).
    .filter((l) => !/^\[(RED|AMBER|GREEN)\]/i.test(l));

  if (lines.length === 0) return { allPassed: true, failures: [] };
  if (lines.length === 1 && /all checks passed/i.test(lines[0])) {
    return { allPassed: true, failures: [] };
  }

  const failures: ReliabilityCheckItem[] = lines
    .filter((l) => !/all checks passed/i.test(l))
    .map((l) => {
      let kind: ReliabilityCheckKind = 'other';
      if (/^identity\b/i.test(l)) kind = 'identity';
      else if (/^consensus\b/i.test(l)) kind = 'consensus';
      else if (/^grounding\b/i.test(l)) kind = 'grounding';
      else if (/^sanity\b/i.test(l)) kind = 'sanity';
      else if (/^(adversarial|critic|[a-z_]+critic)\b/i.test(l) || /^[a-z_]+\[\w+\]/i.test(l)) kind = 'critic';
      return { kind, detail: l };
    });

  return { allPassed: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Per-university completeness — which of the five reviewer-facing info groups
// a guideline has sections for.
// ---------------------------------------------------------------------------

export const REVIEW_SECTIONS = [
  'calendar',
  'requirements',
  'tuition',
  'scholarships',
  'documents_required',
] as const;
export type ReviewSection = (typeof REVIEW_SECTIONS)[number];

/** Aliases the pipeline uses for the same reviewer-facing section. */
const SECTION_ALIASES: Record<string, ReviewSection> = {
  calendar: 'calendar',
  admission_cycles: 'calendar',
  admission_periods: 'calendar',
  requirements: 'requirements',
  basic_requirements: 'requirements',
  tuition: 'tuition',
  scholarships: 'scholarships',
  documents_required: 'documents_required',
  document_checklist: 'documents_required',
};

export function canonicalSection(fieldGroup: string | null | undefined): ReviewSection | null {
  return fieldGroup ? (SECTION_ALIASES[fieldGroup] ?? null) : null;
}

export function presentSections(
  fieldGroups: Array<string | null | undefined>,
): Set<ReviewSection> {
  const out = new Set<ReviewSection>();
  for (const fg of fieldGroups) {
    const s = canonicalSection(fg);
    if (s) out.add(s);
  }
  return out;
}
