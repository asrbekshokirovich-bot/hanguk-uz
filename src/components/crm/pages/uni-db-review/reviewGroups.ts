import type { LucideIcon } from 'lucide-react';
import { CalendarClock, GraduationCap, Banknote, FileText, Award } from 'lucide-react';
import type { ReviewQueueRow } from '@/hooks/useReviewQueue';
import { parseReliability, rollupColor, type ReliabilityColor } from '../reliability';

/**
 * Framework-free helpers for the redesigned review page: the guideline
 * grouping (moved verbatim from the old ReviewApprovalQueue — one group per
 * `guideline_document_id`, red → amber → green → unscored sort), the local
 * decided-row bookkeeping that keeps result strips visible until refetch, and
 * the mono date/money formats from the design handoff
 * (design_handoff/uni_db_review/README.md).
 */

/** One guideline document inside a university's group. */
export interface DocumentBlock {
  key: string;
  guidelineDocId: string | null;
  sourceUrl: string | null;
  storagePath: string | null;
  academicYear: number | null;
  semester: string | null;
  rows: ReviewQueueRow[];
}

export interface GuidelineGroup {
  key: string;
  nameKo: string | null;
  nameEn: string | null;
  /** First document's source/PDF — the header uses these when there is only one. */
  sourceUrl: string | null;
  storagePath: string | null;
  guidelineDocId: string | null;
  /** Every row in the group, flat, in document order. */
  rows: ReviewQueueRow[];
  /** The group's rows split by guideline document, in first-seen order. */
  documents: DocumentBlock[];
}

/**
 * One group per UNIVERSITY, not per guideline document.
 *
 * Grouping on `guideline_document_id` put a university with three stored
 * guidelines into three separate rail cards — three "KAIST / 한국과학기술원"
 * entries whose only visible difference was a section count, so a reviewer
 * could not tell which was which and the same university's work was scattered.
 *
 * The documents are kept as a nested level rather than flattened away: two
 * guidelines can describe different intakes (2027 spring vs 2027 fall), and
 * merging their sections into one undifferentiated list would let a reviewer
 * approve a spring figure believing it was autumn's. One card to find the
 * university; the document boundary stays visible inside it.
 *
 * Falls back to the old per-document key when `institution_id` is absent, so
 * the UI still groups sensibly before migration 20260918000000 is applied.
 */
export function groupRows(rows: ReviewQueueRow[]): GuidelineGroup[] {
  const map = new Map<string, GuidelineGroup>();
  for (const row of rows) {
    const key = row.institution_id ?? row.guideline_document_id ?? row.id;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        nameKo: row.name_ko,
        nameEn: row.name_en,
        sourceUrl: row.source_url_ko,
        storagePath: row.storage_path,
        guidelineDocId: row.guideline_document_id,
        rows: [],
        documents: [],
      };
      map.set(key, g);
    }
    g.rows.push(row);

    const docKey = row.guideline_document_id ?? row.id;
    let doc = g.documents.find((d) => d.key === docKey);
    if (!doc) {
      doc = {
        key: docKey,
        guidelineDocId: row.guideline_document_id,
        sourceUrl: row.source_url_ko,
        storagePath: row.storage_path,
        academicYear: row.doc_academic_year ?? null,
        semester: row.doc_semester ?? null,
        rows: [],
      };
      g.documents.push(doc);
    }
    doc.rows.push(row);
  }
  return [...map.values()];
}

/**
 * "2027 · Bahor" for a document strip, or null when the document was never
 * classified. Never guesses: an unclassified document says so rather than
 * borrowing the crawl target's cycle.
 */
export function documentCycleLabel(
  doc: DocumentBlock,
  t: (key: string) => string,
): string | null {
  if (doc.academicYear == null && !doc.semester) return null;
  const season = doc.semester
    ? t(`uniReview.crawl.${doc.semester === 'spring' ? 'spring' : 'fall'}`)
    : null;
  if (doc.academicYear == null) return season;
  return season ? `${doc.academicYear} · ${season}` : String(doc.academicYear);
}

// ---------------------------------------------------------------------------
// Local decisions — a session-only record of approved/rejected rows so each
// card can collapse to a result strip (and the rail can show "Yakunlandi")
// until the queue refetch removes the rows from the server payload.
// ---------------------------------------------------------------------------

export interface DecidedInfo {
  status: 'approved' | 'rejected';
  /** Human reason label (already localized) for rejected rows. */
  reasonLabel?: string;
  /** Snapshot of the row so the strip survives query invalidation. */
  row: ReviewQueueRow;
}

export type DecidedMap = Record<string, DecidedInfo>;

/**
 * Server rows merged with locally-decided snapshots that the refetch already
 * removed — grouping semantics identical to `groupRows` on the union.
 */
export function mergeWithDecided(rows: ReviewQueueRow[], decided: DecidedMap): ReviewQueueRow[] {
  const present = new Set(rows.map((r) => r.id));
  const phantoms = Object.values(decided)
    .filter((d) => !present.has(d.row.id))
    .map((d) => d.row);
  return [...rows, ...phantoms];
}

/** Worst reliability color among the group's OPEN (undecided) rows. */
export function openRollup(
  group: GuidelineGroup,
  decided: DecidedMap,
): { done: boolean; color: ReliabilityColor | null; open: ReviewQueueRow[] } {
  const open = group.rows.filter((r) => !decided[r.id]);
  if (open.length === 0) return { done: true, color: null, open };
  return {
    done: false,
    color: rollupColor(open.map((r) => parseReliability(r.reviewer_notes, r.needs_attention).color)),
    open,
  };
}

const COLOR_RANK: Record<ReliabilityColor, number> = { red: 0, amber: 1, green: 2 };

/**
 * Rail order: red(0) → amber(1) → green(2) → unscored(3) → done(9); stable
 * within a rank so the view's own order (priority asc, created_at) holds.
 */
export function sortGroups(groups: GuidelineGroup[], decided: DecidedMap): GuidelineGroup[] {
  const rank = (g: GuidelineGroup): number => {
    const r = openRollup(g, decided);
    if (r.done) return 9;
    return r.color ? COLOR_RANK[r.color] : 3;
  };
  return [...groups].sort((a, b) => rank(a) - rank(b));
}

export function institutionName(g: GuidelineGroup): string {
  return g.nameEn || g.nameKo || '—';
}

/** "Kyung Hee University" → "Kyung Hee" for compact toast copy. */
export function shortName(g: GuidelineGroup): string {
  return institutionName(g).replace(/\s+University$/i, '');
}

// ---------------------------------------------------------------------------
// Section metadata — label key + icon per field_group (design §B).
// ---------------------------------------------------------------------------

export const SECTION_ORDER = [
  'calendar',
  'requirements',
  'tuition',
  'documents_required',
  'scholarships',
] as const;

/** Pipeline aliases seen in v_needs_attention rows map onto the 5 sections. */
const SECTION_ALIAS: Record<string, string> = {
  admission_cycles: 'calendar',
  admission_periods: 'calendar',
  basic_requirements: 'requirements',
  document_checklist: 'documents_required',
};

export function sectionLabelKey(fieldGroup: string | null): string {
  const canonical = SECTION_ALIAS[fieldGroup ?? ''] ?? fieldGroup;
  return (SECTION_ORDER as readonly string[]).includes(canonical ?? '')
    ? `uniReview.section.${canonical}`
    : 'uniReview.section.unknown';
}

export const SECTION_ICON: Record<string, LucideIcon> = {
  calendar: CalendarClock,
  requirements: GraduationCap,
  tuition: Banknote,
  documents_required: FileText,
  scholarships: Award,
};

// ---------------------------------------------------------------------------
// Formats (design tokens: mono, space thousands, DD.MM.YYYY · HH:mm KST).
// ---------------------------------------------------------------------------

export function fmtKRW(value: unknown): string | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return null;
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} KRW`;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function fmtDateKST(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const s = value.trim();
  if (DATE_ONLY_RE.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  }
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const base = `${get('day')}.${get('month')}.${get('year')}`;
  return /T\d{2}:\d{2}/.test(s) ? `${base} · ${get('hour')}:${get('minute')} KST` : base;
}

/**
 * One human line for the reliability note strip: the first meaningful finding
 * from `parseReliability().detail` (skips the "[COLOR] reliability" header and
 * the all-passed line), per design §B — never the raw multi-line block.
 */
export function firstNoteLine(detail: string | null): string | null {
  if (!detail) return null;
  const lines = detail
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^\[(RED|AMBER|GREEN)\]/i.test(l))
    .filter((l) => !/all checks passed/i.test(l));
  return lines[0] ?? null;
}
