import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  GraduationCap,
  Banknote,
  FileText,
  Award,
  SplitSquareVertical,
  FileSearch,
} from 'lucide-react';
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

  // Deduplicate: keep only the newest row per section within each document.
  // The backfill worker can insert multiple rows for the same
  // (guideline_document, field_group) because it lacks the supersede guard
  // that parse_worker has. Until migration 20260919 is applied, collapse
  // them here so the reviewer doesn't see the same card 2–3 times.
  for (const g of map.values()) {
    g.documents = g.documents.map((doc) => ({
      ...doc,
      rows: deduplicateSection(doc.rows),
    }));
    g.rows = g.documents.flatMap((d) => d.rows);
  }

  return [...map.values()];
}

/**
 * Within one document block, if multiple rows share the same section key
 * (field_group for extraction_jobs, or note-pattern for document flags),
 * keep only the one created most recently.
 */
function deduplicateSection(rows: ReviewQueueRow[]): ReviewQueueRow[] {
  const seen = new Map<string, ReviewQueueRow>();
  // Rows arrive ordered by (priority, created_at) from the view — later =
  // newer, so the last one wins.
  for (const row of rows) {
    const sectionKey = sectionDedupeKey(row);
    const existing = seen.get(sectionKey);
    if (!existing || row.created_at > existing.created_at) {
      seen.set(sectionKey, row);
    }
  }
  return [...seen.values()];
}

function sectionDedupeKey(row: ReviewQueueRow): string {
  if (row.entity_type === 'guideline_documents') {
    return isDegreeCheckFlag(row) ? '__doc_check__' : '__doc_split__';
  }
  return row.field_group ?? row.id;
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

/**
 * A card that flags the DOCUMENT rather than reviewing extracted data.
 *
 * The parser raises these when the PDF itself is wrong-shaped — today the only
 * kind is the combined undergraduate + graduate guideline, which has to be
 * split into two admission cycles before any of its figures mean anything.
 * They are inserted against `guideline_documents`, so the dashboard view's
 * `field_group` and `parsed_output` (both taken from the extraction_jobs join)
 * are NULL, and the explanation lives in `reviewer_notes`.
 *
 * Detected on entity_type, not on a null field_group: an ordinary section card
 * whose extraction row went missing would also have a null field_group, and
 * the two must not be shown as the same thing.
 */
export function isDocumentFlag(row: ReviewQueueRow): boolean {
  return row.entity_type === 'guideline_documents';
}

/**
 * A document flag that found NO place to split at.
 *
 * The parser raises two different document cards and distinguishes them by
 * `field_group` ('degree_split' vs 'degree_check') — but that key never
 * reaches us: `review_queue` has no field_group column, the document-level
 * insert writes only (entity_type, entity_id, reason, priority,
 * reviewer_notes), and the dashboard view takes field_group from the
 * extraction_jobs join, which is NULL for these rows. What does survive is the
 * note the parser wrote, so the wording is the discriminator.
 *
 * It matters because the two cards ask for opposite things. A real split card
 * carries segment offsets and means "cut this file in two". This one means
 * "a graduate programme is named but no section header was found — read the
 * document before trusting its figures", and it says outright that there is
 * nothing to split at. Rendering it with the split copy tells the reviewer to
 * perform a cut the parser just said does not exist.
 */
export function isDegreeCheckFlag(row: ReviewQueueRow): boolean {
  if (!isDocumentFlag(row)) return false;
  const note = row.reviewer_notes ?? '';
  return /no split boundary|no degree section header/i.test(note);
}

// ---------------------------------------------------------------------------
// Rejected rows that are back in the queue (migration 20260823120000).
// ---------------------------------------------------------------------------

/**
 * Reason codes that can appear on a rejected row, beyond the six a reviewer
 * can pick in the UI. `wrong_source` is written by fn_flag_source_wrong,
 * `auto_no_data` by the pipeline when an extraction came back empty — neither
 * is in REVIEW_REJECTION_REASONS, so both need their own label.
 */
const KNOWN_REJECT_REASONS = new Set([
  'wrong_year',
  'wrong_archetype',
  'hallucinated_field',
  'ocr_garbled',
  'source_404',
  'other',
  'wrong_source',
  'auto_no_data',
]);

export interface ServerRejection {
  /** i18n key under `uniReview.reasons`, or null when the code is unknown. */
  reasonKey: string | null;
  /** Free text the reviewer typed, when there was any. */
  detail: string | null;
}

/**
 * The rejection recorded on the server for a row the queue is showing again.
 *
 * Since migration 20260823120000 the dashboard also returns `rejected` rows, so
 * a card can arrive already carrying a verdict. It must SAY so: the reject
 * action overwrites `reviewer_notes` with "<reason>: <detail>", wiping the
 * "[RED]/[AMBER]" prefix the reliability strip keys on — so without this the
 * row would render with no pill and no note, indistinguishable from a fresh
 * card nobody has looked at.
 *
 * Returns null for anything not rejected, and for a locally-decided row (the
 * decided strip already speaks for those).
 */
export function serverRejection(row: ReviewQueueRow): ServerRejection | null {
  if (row.status !== 'rejected') return null;
  const note = (row.reviewer_notes ?? '').trim();
  const sep = note.indexOf(':');
  const head = (sep === -1 ? note : note.slice(0, sep)).trim();
  const tail = sep === -1 ? '' : note.slice(sep + 1).trim();
  if (KNOWN_REJECT_REASONS.has(head)) {
    return { reasonKey: head, detail: tail || null };
  }
  // Unrecognised shape — show the note verbatim rather than dropping it.
  return { reasonKey: null, detail: note || null };
}

export function sectionLabelKey(row: ReviewQueueRow): string {
  if (isDegreeCheckFlag(row)) return 'uniReview.section.documentCheck';
  if (isDocumentFlag(row)) return 'uniReview.section.documentFlag';
  const canonical = SECTION_ALIAS[row.field_group ?? ''] ?? row.field_group;
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

export function sectionIcon(row: ReviewQueueRow): LucideIcon {
  if (isDegreeCheckFlag(row)) return FileSearch;
  if (isDocumentFlag(row)) return SplitSquareVertical;
  return SECTION_ICON[row.field_group ?? ''] ?? SECTION_ICON.documents_required;
}

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
