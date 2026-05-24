import { describe, it, expect } from 'vitest';
import {
  validateParsedOutput,
  minRowConfidence,
  itemConfidence,
  resolveStatusField,
  confidencePct,
  diffParsedOutput,
  itemsKey,
  NOT_SPECIFIED,
} from '../reviewLogic';

// Trimmed but faithful shapes from v_review_queue_dashboard (Inha requirements,
// KAIST documents_required).
const inhaRequirements = {
  rows: [
    {
      applicant_category: '재외국민특별전형',
      prose_ko: '재외국민(2%) 전형…',
      english_test: null,
      gpa_floor_pct: null,
      topik_deferred: false,
      topik_min_level: null,
      interview_required: true,
      practical_exam_required: true,
      extractor_confidence: 0.87,
    },
    {
      applicant_category: '국외 전 교육과정 이수자',
      prose_ko: '국외에서 12년…',
      extractor_confidence: 0.91,
    },
    {
      applicant_category: '북한이탈주민',
      prose_ko: '「북한이탈주민…」',
      extractor_confidence: 0.91,
    },
  ],
};

const kaistDocuments = {
  rows: [
    {
      document_type: 'application_form',
      is_required: true,
      is_apostille_required: false,
      notes_ko: '온라인 지원서…',
      extractor_confidence: 0.88,
    },
    {
      document_type: 'english_proficiency',
      is_required: true,
      is_apostille_required: false,
      notes_ko: '영어 능력 시험…',
      extractor_confidence: 0.72,
    },
  ],
};

describe('validateParsedOutput', () => {
  it('accepts a real requirements payload (extra keys passthrough)', () => {
    expect(validateParsedOutput('requirements', inhaRequirements).ok).toBe(true);
  });

  it('accepts a real documents_required payload', () => {
    expect(validateParsedOutput('documents_required', kaistDocuments).ok).toBe(true);
  });

  it('accepts the new status enums', () => {
    const v = validateParsedOutput('requirements', {
      rows: [{ applicant_category: 'x', topik_status: 'not_required', english_status: 'not_stated', gpa_status: 'required' }],
    });
    expect(v.ok).toBe(true);
  });

  it('rejects an invalid status enum', () => {
    const v = validateParsedOutput('requirements', {
      rows: [{ topik_status: 'maybe' }],
    });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.path.includes('topik_status'))).toBe(true);
  });

  it('rejects when rows is not an array', () => {
    expect(validateParsedOutput('requirements', { rows: 'nope' }).ok).toBe(false);
  });

  it('rejects a non-object top level', () => {
    expect(validateParsedOutput('requirements', [1, 2, 3]).ok).toBe(false);
    expect(validateParsedOutput('requirements', null).ok).toBe(false);
  });

  it('requires the calendar events key', () => {
    expect(validateParsedOutput('calendar', { events: [] }).ok).toBe(true);
    expect(validateParsedOutput('calendar', { rows: [] }).ok).toBe(false);
  });

  it('falls back to "non-empty object" for unknown field groups', () => {
    expect(validateParsedOutput('mystery', { anything: 1 }).ok).toBe(true);
    expect(validateParsedOutput('mystery', {}).ok).toBe(false);
  });
});

describe('confidence', () => {
  it('computes the lowest per-row confidence', () => {
    expect(minRowConfidence(inhaRequirements)).toBe(0.87);
    expect(minRowConfidence(kaistDocuments)).toBe(0.72);
    expect(minRowConfidence({ rows: [] })).toBeNull();
  });

  it('itemConfidence prefers the column, then computed, then job score', () => {
    expect(itemConfidence({ min_row_confidence: 0.5, parsed_output: inhaRequirements, accuracy_self_score: 0.85 })).toBe(0.5);
    expect(itemConfidence({ min_row_confidence: null, parsed_output: inhaRequirements, accuracy_self_score: 0.85 })).toBe(0.87);
    expect(itemConfidence({ parsed_output: { rows: [] }, accuracy_self_score: 0.85 })).toBe(0.85);
    expect(itemConfidence({ parsed_output: { rows: [] } })).toBeNull();
  });

  it('formats a percentage', () => {
    expect(confidencePct(0.85)).toBe('85%');
    expect(confidencePct(0.724)).toBe('72%');
    expect(confidencePct(null)).toBeNull();
  });
});

describe('resolveStatusField', () => {
  it('renders "Not required" for not_required (definite, not muted)', () => {
    expect(resolveStatusField('not_required', null)).toEqual({ text: 'Not required', muted: false });
  });

  it('renders "Not specified" for not_stated (muted)', () => {
    expect(resolveStatusField('not_stated', 'Level 4')).toEqual({ text: NOT_SPECIFIED, muted: true });
  });

  it('renders the concrete value when required', () => {
    expect(resolveStatusField('required', 'Level 4')).toEqual({ text: 'Level 4', muted: false });
    expect(resolveStatusField('required', null)).toEqual({ text: 'Required', muted: false });
  });

  it('falls back when the status enum is absent', () => {
    expect(resolveStatusField(undefined, 'Level 3')).toEqual({ text: 'Level 3', muted: false });
    expect(resolveStatusField(undefined, null)).toEqual({ text: NOT_SPECIFIED, muted: true });
  });
});

describe('diffParsedOutput', () => {
  it('returns no entries for identical payloads', () => {
    expect(diffParsedOutput(inhaRequirements, structuredClone(inhaRequirements))).toEqual([]);
  });

  it('detects a changed leaf with before/after', () => {
    const after = structuredClone(inhaRequirements);
    after.rows[0].interview_required = false;
    const d = diffParsedOutput(inhaRequirements, after);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ path: 'rows[0].interview_required', before: true, after: false, kind: 'changed' });
  });

  it('detects added and removed fields', () => {
    const after = structuredClone(inhaRequirements) as Record<string, unknown>;
    (after.rows as Array<Record<string, unknown>>)[1].topik_status = 'not_required';
    delete (after.rows as Array<Record<string, unknown>>)[2].prose_ko;
    const d = diffParsedOutput(inhaRequirements, after);
    const kinds = d.map((e) => e.kind).sort();
    expect(kinds).toEqual(['added', 'removed']);
  });
});

describe('itemsKey', () => {
  it('maps calendar to events and everything else to rows', () => {
    expect(itemsKey('calendar')).toBe('events');
    expect(itemsKey('requirements')).toBe('rows');
    expect(itemsKey(null)).toBe('rows');
  });
});
