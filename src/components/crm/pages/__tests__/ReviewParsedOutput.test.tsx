import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewParsedOutput } from '../ReviewParsedOutput';

// Inha requirements: three distinct admission tracks. The middle row uses the
// new topik_status enum to assert "Not required" vs "Not specified".
const inhaRequirements = {
  rows: [
    { applicant_category: '재외국민특별전형', prose_ko: '재외국민(2%)…', topik_min_level: null, topik_deferred: false, interview_required: true, practical_exam_required: true, extractor_confidence: 0.87 },
    { applicant_category: '국외 전 교육과정 이수자', prose_ko: '국외에서 12년…', topik_status: 'not_required', english_status: 'not_stated', interview_required: false, practical_exam_required: false, extractor_confidence: 0.91 },
    { applicant_category: '북한이탈주민', prose_ko: '「북한이탈주민…」', topik_status: 'required', topik_min_level: 3, extractor_confidence: 0.93 },
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
      extractor_confidence: 0.88,
    },
  ],
};

describe('ReviewParsedOutput — requirements', () => {
  it('renders each row exactly once (no duplicate cards)', () => {
    render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={inhaRequirements} />);
    // One "Applicant category (track)" label per card → exactly 3 cards.
    expect(screen.getAllByText('Applicant category (track)')).toHaveLength(3);
    // A track name appears exactly twice (card title + field) — i.e. in one
    // card only. A duplicated card would yield four occurrences.
    expect(screen.getAllByText('국외 전 교육과정 이수자')).toHaveLength(2);
  });

  it('renders "Not required" for topik_status=not_required (not "Not specified")', () => {
    render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={inhaRequirements} />);
    expect(screen.getByText('Not required')).toBeInTheDocument();
  });

  it('renders the concrete level when topik_status=required', () => {
    render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={inhaRequirements} />);
    expect(screen.getByText('Level 3')).toBeInTheDocument();
  });

  it('shows per-row extractor confidence', () => {
    render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={inhaRequirements} />);
    expect(screen.getByText('conf 87%')).toBeInTheDocument();
    expect(screen.getByText('conf 91%')).toBeInTheDocument();
  });
});

describe('ReviewParsedOutput — documents_required', () => {
  it('surfaces per-document deadline and round', () => {
    render(<ReviewParsedOutput fieldGroup="documents_required" parsedOutput={kaistDocuments} />);
    expect(screen.getByText('Early')).toBeInTheDocument();
    expect(screen.getByText('2026-10-22 18:00 KST')).toBeInTheDocument();
  });
});

describe('ReviewParsedOutput — render stability', () => {
  it('produces identical text across renders (deterministic, no re-translation)', () => {
    const a = render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={inhaRequirements} />);
    const first = a.container.textContent;
    a.unmount();
    const b = render(<ReviewParsedOutput fieldGroup="requirements" parsedOutput={inhaRequirements} />);
    expect(b.container.textContent).toBe(first);
  });
});
