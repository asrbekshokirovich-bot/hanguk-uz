import type { DeskRow } from '../../types';

/** A `lead_desk()` row with sensible defaults; override what the test is about. */
export function deskRow(overrides: Partial<DeskRow> = {}): DeskRow {
  return {
    id: 'lead-1',
    full_name: 'Dilnoza Abdullayeva',
    phone: '+998 90 123 45 67',
    source: 'instagram',
    contact_channel: 'instagram',
    channels: ['instagram'],
    handle: null,
    campaign_name: null,
    form_name: null,
    ad_name: null,
    stage: 'new',
    owner_id: null,
    crm_generation: 'new',
    timer_kind: null,
    timer_start_at: null,
    due_at: null,
    next_action_at: null,
    next_action_kind: null,
    next_action_note: null,
    attempt_no: 0,
    ladder_state: 'idle',
    last_client_msg_at: null,
    priority_score: null,
    pinned: false,
    missing: 0,
    pending_drafts: 0,
    referral: false,
    ai_summary: null,
    bucket: 'bugun',
    sort_at: null,
    ...overrides,
  };
}

/** 2026-10-06 15:00 in Tashkent (UTC+5). */
export const NOW = new Date('2026-10-06T10:00:00Z');

/** An ISO instant `seconds` after NOW. */
export const inSeconds = (seconds: number) => new Date(NOW.getTime() + seconds * 1000).toISOString();
