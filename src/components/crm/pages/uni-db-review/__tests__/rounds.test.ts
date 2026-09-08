import { describe, it, expect } from 'vitest';
import {
  applicationLabels,
  isSupplementary,
  partitionByRound,
  roundKindOf,
  waveCount,
} from '../rounds';

/**
 * Every university in the review queue looked like it ran four admission
 * rounds. Korean universities run one to four, and the ones a reviewer was
 * looking at mostly ran one.
 *
 * The cause: `round_label` is free text and the guidelines number four
 * different things with 차 — application rounds, 추가합격 replacement waves,
 * 수시/정시 seasons, 전기/후기 semesters. All four rendered as a round.
 */

const ev = (o: Record<string, unknown>) => ({
  event_type: 'other',
  starts_at: '2026-12-24T10:00:00+09:00',
  source_text_ko: '',
  ...o,
});

describe('round classification', () => {
  it('reads round_kind when the extractor set it', () => {
    const labels = new Set<string>();
    expect(roundKindOf(ev({ round_label: '1차', round_kind: 'supplementary' }), labels))
      .toBe('supplementary');
    // The explicit field wins over every inference below it.
    expect(
      roundKindOf(
        ev({ round_label: '수시1차', round_kind: 'application' }),
        labels,
      ),
    ).toBe('application');
  });

  it('names the replacement wave from its own wording', () => {
    const labels = new Set<string>();
    for (const src of [
      '미등록 충원 합격자 발표 : 2026. 12. 31.(목) 21:00 까지',
      '추가합격자 발표',
      '추합 등록기간',
      '충원 등록 마감',
    ]) {
      expect(roundKindOf(ev({ round_label: '2차', source_text_ko: src }), labels))
        .toBe('supplementary');
    }
  });

  it('does not call an admission season or a semester a round', () => {
    const labels = new Set<string>();
    expect(roundKindOf(ev({ round_label: '수시1차' }), labels)).toBe('season');
    expect(roundKindOf(ev({ round_label: '정시' }), labels)).toBe('season');
    expect(roundKindOf(ev({ round_label: '2027년도 전기' }), labels)).toBe('term');
  });

  it('leaves an unlabelled event alone', () => {
    expect(roundKindOf(ev({}), new Set())).toBeNull();
    expect(roundKindOf(ev({ round_label: '   ' }), new Set())).toBeNull();
  });
});

describe('the structural test: does the round have its own 원서접수?', () => {
  /**
   * The hard case, and the one that produced the report. Geochang announced
   * 1차/2차/3차 on three consecutive days, each with a registration cut-off
   * and no application window — 추가합격 waves written as bare "N차 발표",
   * with no 충원 anywhere near them. Word matching cannot catch that.
   */
  const geochang = [
    ev({ event_type: 'apply_open', starts_at: '2026-11-03T09:00:00+09:00' }),
    ev({ event_type: 'apply_close', starts_at: '2026-11-14T18:00:00+09:00' }),
    ev({
      event_type: 'final_results',
      round_label: '1차',
      starts_at: '2026-12-24T10:00:00+09:00',
      source_text_ko: '1차 발표: 2026. 12. 24.(목) 10:00',
    }),
    ev({
      event_type: 'registration_close',
      round_label: '1차',
      starts_at: '2026-12-24T18:00:00+09:00',
      source_text_ko: '~ 12. 24.(목) 18:00',
    }),
    ev({
      event_type: 'final_results',
      round_label: '2차',
      starts_at: '2026-12-25T10:00:00+09:00',
      source_text_ko: '2차 발표: 2026. 12. 25.(금) 10:00',
    }),
    ev({
      event_type: 'final_results',
      round_label: '3차',
      starts_at: '2026-12-26T10:00:00+09:00',
      source_text_ko: '3차 발표: 2026. 12. 26.(토) 10:00',
    }),
  ];

  it('treats numbered blocks with no application window as waves', () => {
    const { main, supplementary } = partitionByRound(geochang);
    expect(supplementary).toHaveLength(4);
    expect(main.map((e) => e.event_type)).toEqual(['apply_open', 'apply_close']);
    expect(waveCount(supplementary)).toBe(3);
  });

  it('keeps a genuine two-round document intact', () => {
    const twoRounds = [
      ev({ event_type: 'apply_open', round_label: '1차', starts_at: '2026-09-01T00:00:00+09:00' }),
      ev({ event_type: 'apply_close', round_label: '1차', starts_at: '2026-09-15T00:00:00+09:00' }),
      ev({ event_type: 'final_results', round_label: '1차', starts_at: '2026-09-25T00:00:00+09:00' }),
      ev({ event_type: 'apply_open', round_label: '2차', starts_at: '2026-10-05T00:00:00+09:00' }),
      ev({ event_type: 'apply_close', round_label: '2차', starts_at: '2026-10-19T00:00:00+09:00' }),
      ev({ event_type: 'final_results', round_label: '2차', starts_at: '2026-10-30T00:00:00+09:00' }),
    ];
    const { main, supplementary } = partitionByRound(twoRounds);
    expect(supplementary).toHaveLength(0);
    expect(main).toHaveLength(6);
    expect([...applicationLabels(twoRounds)].sort()).toEqual(['1차', '2차']);
  });

  it('a real round PLUS its waves keeps the round and drops the waves', () => {
    const mixed = [
      ev({ event_type: 'apply_open', round_label: '1차', starts_at: '2026-09-01T00:00:00+09:00' }),
      ev({ event_type: 'apply_close', round_label: '1차', starts_at: '2026-09-15T00:00:00+09:00' }),
      ev({ event_type: 'apply_open', round_label: '2차', starts_at: '2026-10-05T00:00:00+09:00' }),
      ev({
        event_type: 'additional_admit',
        round_label: '3차',
        starts_at: '2026-12-26T10:00:00+09:00',
        source_text_ko: '3차 발표',
      }),
    ];
    const { main, supplementary } = partitionByRound(mixed);
    expect(main).toHaveLength(3);
    expect(supplementary.map((e) => e.round_label)).toEqual(['3차']);
  });

  it('an unnumbered application window means every numbered block is a wave', () => {
    // The document applied once and did not number it. Anything numbered
    // after that cannot be a second application round.
    const oneUnnumberedRound = [
      ev({ event_type: 'apply_open', starts_at: '2026-09-01T00:00:00+09:00' }),
      ev({ event_type: 'final_results', round_label: '1차', starts_at: '2026-09-25T00:00:00+09:00' }),
      ev({ event_type: 'final_results', round_label: '2차', starts_at: '2026-10-30T00:00:00+09:00' }),
    ];
    const { main, supplementary } = partitionByRound(oneUnnumberedRound);
    expect(main.map((e) => e.event_type)).toEqual(['apply_open']);
    expect(supplementary).toHaveLength(2);
  });

  it('trusts the label when the span has no application window at all', () => {
    // Calendar sections are extracted per span; one may hold results only.
    // With nothing to reason from, hiding dates would be the worse error.
    const noApplyEvents = [
      ev({ event_type: 'final_results', round_label: '1차', starts_at: '2026-09-25T00:00:00+09:00' }),
      ev({ event_type: 'final_results', round_label: '2차', starts_at: '2026-10-30T00:00:00+09:00' }),
    ];
    const { supplementary } = partitionByRound(noApplyEvents);
    expect(supplementary).toHaveLength(0);
  });

  it('an unlabelled single-round document is untouched', () => {
    const single = [
      ev({ event_type: 'apply_open', starts_at: '2026-09-01T00:00:00+09:00' }),
      ev({ event_type: 'final_results', starts_at: '2026-12-13T00:00:00+09:00' }),
    ];
    const { main, supplementary } = partitionByRound(single);
    expect(main).toHaveLength(2);
    expect(supplementary).toHaveLength(0);
  });
});

describe('periods', () => {
  it('drops a period for a wave — a student cannot apply in one', () => {
    const events = [
      ev({ event_type: 'apply_open', round_label: '1차', starts_at: '2026-09-01T00:00:00+09:00' }),
    ];
    const labels = applicationLabels(events);
    expect(isSupplementary({ round_label: '1차' }, labels)).toBe(false);
    expect(isSupplementary({ round_label: '2차' }, labels)).toBe(true);
    expect(isSupplementary({ round_label: '2차', round_kind: 'application' }, labels)).toBe(false);
  });
});
