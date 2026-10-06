import type { SocialComment } from '../../types';

/** The seeded forbidden words (lead_settings.forbidden_words). */
export const DEFAULT_SETTINGS_FORBIDDEN = ['kafolat', '100%', 'bepul noutbuk', 'bitta narx', 'sertifikatsiz Koreya'];

let seq = 0;

export function comment(overrides: Partial<SocialComment> = {}): SocialComment {
  seq += 1;
  return {
    id: `row-${seq}`,
    platform: 'instagram',
    post_id: `post-${seq}`,
    post_label: 'reel «TOPIK 2 bilan kollej»',
    comment_id: `meta-${seq}`,
    author_username: `user${seq}`,
    text: 'Narxi qancha?',
    created_at: '2026-10-05T01:30:00.000Z',
    lead_id: `lead-${seq}`,
    replied_at: null,
    replied_by: null,
    reply_text: null,
    ...overrides,
  };
}
