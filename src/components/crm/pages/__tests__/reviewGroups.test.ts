import { describe, it, expect } from 'vitest';
import type { ReviewQueueRow } from '@/hooks/useReviewQueue';
import {
  groupRows,
  documentCycleLabel,
  isDocumentFlag,
  isDegreeCheckFlag,
  sectionLabelKey,
} from '../uni-db-review/reviewGroups';

/**
 * Regression cover for the triage rail's grouping.
 *
 * The rail used to key its cards on `guideline_document_id`, so KAIST — which
 * had three stored guideline documents in the queue — rendered as three
 * identical "KAIST / 한국과학기술원" cards distinguishable only by a section
 * count. These tests pin the fix: one card per university, with the document
 * boundary preserved inside it so two intakes never merge into one list.
 */

function row(over: Partial<ReviewQueueRow> & { id: string }): ReviewQueueRow {
  return {
    priority: 1,
    reason: 'auto',
    entity_type: 'extraction_jobs',
    entity_id: `job-${over.id}`,
    created_at: '2026-08-12T00:00:00Z',
    name_ko: '한국과학기술원',
    name_en: 'KAIST',
    source_url_ko: null,
    storage_path: null,
    guideline_document_id: null,
    field_group: 'tuition',
    parsed_output: null,
    accuracy_self_score: null,
    ...over,
  } as ReviewQueueRow;
}

const KAIST = 'inst-kaist';

describe('groupRows', () => {
  it('puts one university with three guideline documents into a single card', () => {
    const rows = [
      row({ id: 'a', institution_id: KAIST, guideline_document_id: 'doc-1', field_group: 'tuition' }),
      row({ id: 'b', institution_id: KAIST, guideline_document_id: 'doc-2', field_group: 'tuition' }),
      row({ id: 'c', institution_id: KAIST, guideline_document_id: 'doc-3', field_group: 'tuition' }),
      row({ id: 'd', institution_id: KAIST, guideline_document_id: 'doc-1', field_group: 'requirements' }),
    ];

    const groups = groupRows(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe(KAIST);
    expect(groups[0].rows).toHaveLength(4);
  });

  it('keeps the documents separate inside the card, in first-seen order', () => {
    const rows = [
      row({ id: 'a', institution_id: KAIST, guideline_document_id: 'doc-1', field_group: 'tuition' }),
      row({ id: 'b', institution_id: KAIST, guideline_document_id: 'doc-2', field_group: 'tuition' }),
      row({ id: 'c', institution_id: KAIST, guideline_document_id: 'doc-1', field_group: 'requirements' }),
    ];

    const [g] = groupRows(rows);

    // Two documents, not three rows flattened together — a spring figure must
    // never end up in the same undifferentiated list as an autumn one.
    expect(g.documents.map((d) => d.key)).toEqual(['doc-1', 'doc-2']);
    expect(g.documents[0].rows.map((r) => r.id)).toEqual(['a', 'c']);
    expect(g.documents[1].rows.map((r) => r.id)).toEqual(['b']);
  });

  it('keeps two different universities apart', () => {
    const rows = [
      row({ id: 'a', institution_id: KAIST, guideline_document_id: 'doc-1' }),
      row({
        id: 'b',
        institution_id: 'inst-sejong',
        guideline_document_id: 'doc-9',
        name_en: 'Sejong University',
        name_ko: '세종대학교',
      }),
    ];

    expect(groupRows(rows)).toHaveLength(2);
  });

  it('falls back to per-document grouping when institution_id is absent', () => {
    // The column arrives with migration 20260918000000; before it lands the
    // rail must still group sensibly rather than collapse everything into one.
    const rows = [
      row({ id: 'a', guideline_document_id: 'doc-1' }),
      row({ id: 'b', guideline_document_id: 'doc-2' }),
    ];

    expect(groupRows(rows)).toHaveLength(2);
  });

  it('deduplicates rows sharing the same section within a document', () => {
    const rows = [
      row({ id: 'old', institution_id: KAIST, guideline_document_id: 'doc-1', field_group: 'tuition', created_at: '2026-08-06T10:00:00Z' }),
      row({ id: 'new', institution_id: KAIST, guideline_document_id: 'doc-1', field_group: 'tuition', created_at: '2026-08-06T10:05:00Z' }),
      row({ id: 'other', institution_id: KAIST, guideline_document_id: 'doc-1', field_group: 'requirements', created_at: '2026-08-06T10:00:00Z' }),
    ];

    const [g] = groupRows(rows);
    // Only 2 rows survive: the newer tuition + the requirements row
    expect(g.rows).toHaveLength(2);
    expect(g.rows.map((r) => r.id).sort()).toEqual(['new', 'other']);
  });

  it('carries each document its own cycle, not the group\'s first', () => {
    const rows = [
      row({
        id: 'a',
        institution_id: KAIST,
        guideline_document_id: 'doc-1',
        doc_academic_year: 2027,
        doc_semester: 'spring',
      }),
      row({
        id: 'b',
        institution_id: KAIST,
        guideline_document_id: 'doc-2',
        doc_academic_year: 2027,
        doc_semester: 'fall',
      }),
    ];

    const [g] = groupRows(rows);

    expect(g.documents[0].semester).toBe('spring');
    expect(g.documents[1].semester).toBe('fall');
  });
});

describe('documentCycleLabel', () => {
  const t = (key: string) => (key.endsWith('spring') ? 'Bahor' : 'Kuz');

  it('reads "year · season" when the document was classified', () => {
    const [g] = groupRows([
      row({
        id: 'a',
        institution_id: KAIST,
        guideline_document_id: 'doc-1',
        doc_academic_year: 2027,
        doc_semester: 'spring',
      }),
    ]);
    expect(documentCycleLabel(g.documents[0], t)).toBe('2027 · Bahor');
  });

  it('returns null for an unclassified document rather than guessing', () => {
    const [g] = groupRows([
      row({ id: 'a', institution_id: KAIST, guideline_document_id: 'doc-1' }),
    ]);
    expect(documentCycleLabel(g.documents[0], t)).toBeNull();
  });

  it('falls back to the year alone when only the season is missing', () => {
    const [g] = groupRows([
      row({
        id: 'a',
        institution_id: KAIST,
        guideline_document_id: 'doc-1',
        doc_academic_year: 2027,
      }),
    ]);
    expect(documentCycleLabel(g.documents[0], t)).toBe('2027');
  });
});

/**
 * A document-level flag is not a section card.
 *
 * The parser raises these against `guideline_documents`, so the dashboard
 * view's field_group and parsed_output — both taken from its extraction_jobs
 * join — are NULL. The card therefore fell through to "Boshqa bo'lim" /
 * "Ko'rsatilmagan": a title that named nothing, a body that showed nothing,
 * and an Approve/Reject pair over it. The reviewer read that as "the AI
 * extracted nothing", when the explanation was sitting in reviewer_notes the
 * whole time.
 */
describe('document-level flags', () => {
  const flag = row({
    id: 'flag-1',
    entity_type: 'guideline_documents',
    field_group: null,
    parsed_output: null,
    reviewer_notes:
      "Combined undergraduate + graduate guideline detected (level=undergraduate " +
      "combined=True levels=['bachelor', 'master', 'doctoral'] ...).",
  });

  it('is recognised by entity_type', () => {
    expect(isDocumentFlag(flag)).toBe(true);
  });

  it('gets its own label instead of "other section"', () => {
    expect(sectionLabelKey(flag)).toBe('uniReview.section.documentFlag');
  });

  /**
   * The parser raises a second, weaker document card: a graduate programme is
   * named but no section header separates it, so there is no boundary to cut
   * at. It says so in the note. The UI used to render it with the split copy
   * — "this file mixes two levels, divide it into two admission cycles" —
   * because it decided on `levels=[...]`, which BOTH cards carry. The reviewer
   * was told to perform a split the parser had just ruled out.
   *
   * `field_group` cannot be the discriminator here: review_queue has no such
   * column, the document-level insert never writes one, and the view sources
   * it from the extraction_jobs join, which is NULL for these rows.
   */
  const checkFlag = row({
    id: 'flag-2',
    entity_type: 'guideline_documents',
    field_group: null,
    parsed_output: null,
    reviewer_notes:
      'Graduate programme named but no degree section header found ' +
      "(level=undergraduate combined=True levels=['bachelor', 'master'] " +
      'signals=[grad_general x1, master x1, undergrad x1]). No split boundary ' +
      'was located, so there is nothing to split at. Segments: undergraduate@0.',
  });

  it('separates "nothing to split at" from a real split', () => {
    expect(isDegreeCheckFlag(checkFlag)).toBe(true);
    expect(isDegreeCheckFlag(flag)).toBe(false);
  });

  it('gives the no-boundary card its own label, not the split one', () => {
    expect(sectionLabelKey(checkFlag)).toBe('uniReview.section.documentCheck');
    expect(sectionLabelKey(flag)).toBe('uniReview.section.documentFlag');
  });

  it('still treats the no-boundary card as a document flag', () => {
    expect(isDocumentFlag(checkFlag)).toBe(true);
  });

  it('never calls an ordinary section card a degree check', () => {
    expect(isDegreeCheckFlag(row({ id: 'x', field_group: 'tuition' }))).toBe(false);
  });

  it('does not swallow an ordinary card whose field_group is missing', () => {
    // Same NULL field_group, different cause — an extraction row that went
    // missing. That is genuinely an unknown section and must stay one.
    const orphan = row({ id: 'orphan', field_group: null });
    expect(isDocumentFlag(orphan)).toBe(false);
    expect(sectionLabelKey(orphan)).toBe('uniReview.section.unknown');
  });

  it('still maps the five real sections and their aliases', () => {
    expect(sectionLabelKey(row({ id: 'a', field_group: 'tuition' }))).toBe(
      'uniReview.section.tuition',
    );
    expect(sectionLabelKey(row({ id: 'b', field_group: 'admission_periods' }))).toBe(
      'uniReview.section.calendar',
    );
  });
});
