import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewParsedOutput } from '../ReviewParsedOutput';

// Foreign-applicant (외국인전형) tracks — these render directly. Middle row uses
// the topik_status enum to assert "Not required" vs "Not specified".
const foreignRequirements = {
  rows: [
    { applicant_category: '외국인전형 (인문)', prose_ko: '…', topik_min_level: null, topik_deferred: false, interview_required: true, practical_exam_required: true, extractor_confidence: 0.87 },
    { applicant_category: '외국인전형 (자연)', prose_ko: '…', topik_status: 'not_required', english_status: 'not_stated', interview_required: false, practical_exam_required: false, extractor_confidence: 0.91 },
    { applicant_category: '외국인 특별전형', prose_ko: '…', topik_status: 'required', topik_min_level: 3, extractor_confidence: 0.93 },
  ],
};

const mixedRequirements = {
  rows: [
    { applicant_category: '외국인전형', prose_ko: '…', extractor_confidence: 0.9 },
    { applicant_category: '재외국민특별전형', prose_ko: '재외국민(2%)…', extractor_confidence: 0.7 },
  ],
};

const kaistDocuments = {
  rows: [
    {
      document_type: 'transcript',
      is_required: true,
      is_apostille_required: true,
      notes_ko: '성적증명서…',
      deadline: '2026-10-22T18:00:00+09:00',
      applies_to_round: 'early',
      country_specific: { UZ: { consular: true }, CN: { notarization: true } },
      extractor_confidence: 0.88,
    },
  ],
};

const koreaCalendar = {
  events: [
    { event_type: 'apply_open', starts_at: '2026-09-22T00:00:00+09:00' },
    { event_type: 'document_submission_close', starts_at: '2026-10-29T18:00:00+09:00' },
    { event_type: 'other', starts_at: '2026-03-01T00:00:00+09:00', notes_ko: '모바일 학생증' },
  ],
};

describe('ReviewParsedOutput — requirements', () => {
  it('renders each foreign row exactly once (no duplicate cards)', () => {
    render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={foreignRequirements} />);
    expect(screen.getAllByText('Applicant category (track)')).toHaveLength(3);
    expect(screen.getAllByText('외국인전형 (자연)')).toHaveLength(2); // title + field, one card
  });

  it('renders "Not required" for topik_status=not_required', () => {
    render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={foreignRequirements} />);
    expect(screen.getByText('Not required')).toBeInTheDocument();
  });

  it('renders the concrete level when topik_status=required', () => {
    render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={foreignRequirements} />);
    expect(screen.getByText('Level 3')).toBeInTheDocument();
  });

  it('shows per-row extractor confidence', () => {
    render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={foreignRequirements} />);
    expect(screen.getByText('conf 87%')).toBeInTheDocument();
    expect(screen.getByText('conf 91%')).toBeInTheDocument();
  });

  it('collapses Korean-heritage tracks behind a disclosure (foreign track stays visible)', () => {
    render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={mixedRequirements} />);
    expect(screen.getAllByText('외국인전형').length).toBeGreaterThan(0);
    // The overseas-Korean track is not rendered until the disclosure is opened.
    expect(screen.queryByText('재외국민특별전형')).toBeNull();
    expect(screen.getByText(/Korean-heritage/)).toBeInTheDocument();
  });
});

describe('ReviewParsedOutput — documents_required', () => {
  it('surfaces deadline, round, and country-specific legalization (UZ consular)', () => {
    render(<ReviewParsedOutput fieldGroup="documents_required" parsedOutput={kaistDocuments} />);
    expect(screen.getByText('Early')).toBeInTheDocument();
    expect(screen.getByText('2026-10-22 18:00 KST')).toBeInTheDocument();
    expect(screen.getByText(/UZ/)).toBeInTheDocument();
    expect(screen.getByText(/Consular/i)).toBeInTheDocument();
  });
});

describe('ReviewParsedOutput — calendar', () => {
  it('maps document_submission_close and surfaces unmapped events in "Other dates"', () => {
    render(<ReviewParsedOutput fieldGroup="calendar" parsedOutput={koreaCalendar} />);
    // The mapped Document deadline slot is populated by document_submission_close.
    expect(screen.getByText('Document deadline')).toBeInTheDocument();
    // The unmapped "other" event is shown rather than dropped.
    expect(screen.getByText(/Other dates from the source/)).toBeInTheDocument();
    expect(screen.getByText(/모바일 학생증/)).toBeInTheDocument();
  });
});

describe('ReviewParsedOutput — translated display', () => {
  // When the displayed rows have been translated to English, track relevance
  // must be derived from the original Korean via `classifyFrom`, otherwise the
  // 외국인 / 재외국민 markers are gone and heritage tracks wouldn't collapse.
  const translatedRows = {
    rows: [
      { applicant_category: 'International applicants (Humanities)', prose_ko: '…', extractor_confidence: 0.9 },
      { applicant_category: 'Overseas Korean special admission', prose_ko: 'Overseas Korean (2%)…', extractor_confidence: 0.7 },
    ],
  };

  it('collapses heritage tracks using classifyFrom even when display text is English', () => {
    render(
      <ReviewParsedOutput
        fieldGroup="requirements"
        parsedOutput={translatedRows}
        classifyFrom={mixedRequirements}
      />,
    );
    expect(screen.getAllByText('International applicants (Humanities)').length).toBeGreaterThan(0);
    // The heritage row's data stays hidden behind the disclosure.
    expect(screen.queryByText('Overseas Korean special admission')).toBeNull();
    expect(screen.getByText(/Korean-heritage/)).toBeInTheDocument();
  });
});

describe('ReviewParsedOutput — render stability', () => {
  it('produces identical text across renders (deterministic, no re-translation)', () => {
    const a = render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={foreignRequirements} />);
    const first = a.container.textContent;
    a.unmount();
    const b = render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={foreignRequirements} />);
    expect(b.container.textContent).toBe(first);
  });
});
