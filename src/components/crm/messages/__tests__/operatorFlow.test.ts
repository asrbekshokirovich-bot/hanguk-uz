import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { countUnreadThreads, countWaiting, isThreadWaiting, titleWithCount } from '../inboxCounts';
import { detectLanguage, needsTranslation } from '../detectLanguage';
import { fillReply, matchReplies, type SavedReplyRow } from '../useSavedReplies';
import { isServerQuery } from '../useThreadSearch';

const now = new Date('2026-10-29T10:00:00Z').getTime();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
const H = 3600_000;

describe('inbox counts', () => {
  const base = { kind: 'lead', status: 'active', unread_count: 0, last_message_at: iso(H) };
  it('waiting = person wrote after our last human reply', () => {
    expect(isThreadWaiting({ ...base, last_incoming_at: iso(H), last_human_out_at: null })).toBe(true);
    expect(isThreadWaiting({ ...base, last_incoming_at: iso(2 * H), last_human_out_at: iso(H) })).toBe(false);
    expect(isThreadWaiting({ ...base, last_incoming_at: null, last_human_out_at: null })).toBe(false);
  });
  it('the badge counts recent lead conversations only', () => {
    const list = [
      { ...base, last_incoming_at: iso(H) },
      { ...base, kind: 'staff', last_incoming_at: iso(H) },
      { ...base, status: 'archived', last_incoming_at: iso(H) },
      { ...base, last_message_at: iso(40 * 24 * H), last_incoming_at: iso(40 * 24 * H) },
    ];
    expect(countWaiting(list, now)).toBe(1);
    expect(countUnreadThreads([{ ...base, unread_count: 2 }, { ...base, kind: 'service', unread_count: 1 }])).toBe(1);
  });
  it('title shows the number once', () => {
    expect(titleWithCount('Hanguk', 3)).toBe('(3) Hanguk');
    expect(titleWithCount('(3) Hanguk', 5)).toBe('(5) Hanguk');
    expect(titleWithCount('(5) Hanguk', 0)).toBe('Hanguk');
  });
});

describe('detectLanguage', () => {
  it('Uzbek in both scripts, Russian, Korean, English', () => {
    expect(detectLanguage('Ассалому алайкум')).toBe('uz');
    expect(detectLanguage('Менга ҳужжатлар керак')).toBe('uz');
    expect(detectLanguage('Здравствуйте, сколько стоит?')).toBe('ru');
    expect(detectLanguage('Salom, hujjatlar kerak')).toBe('uz');
    expect(detectLanguage('감사합니다.')).toBe('ko');
    expect(detectLanguage('Hello, how are you?')).toBe('en');
  });
  it('no "translate" under a message in the interface language', () => {
    expect(needsTranslation('Salom, hujjatlar kerak', 'uz')).toBe(false);
    expect(needsTranslation('Здравствуйте, сколько стоит?', 'uz')).toBe(true);
    expect(needsTranslation('감사합니다.', 'uz')).toBe(true);
    expect(needsTranslation('Ассалому алайкум', 'uz')).toBe(false);
  });
});

describe('saved replies', () => {
  const rows: SavedReplyRow[] = [
    { id: '1', key: '/docs', title: 'Hujjatlar', body: 'Assalomu alaykum, {{ism}}! Hujjatlar ro‘yxati…', sort_order: 1, active: true },
    { id: '2', key: '/pay', title: 'To‘lov', body: 'To‘lov…', sort_order: 2, active: true },
  ];
  it('{{ism}} becomes the first name, or disappears cleanly', () => {
    expect(fillReply(rows[0].body, 'Madina Karimova')).toBe('Assalomu alaykum, Madina! Hujjatlar ro‘yxati…');
    expect(fillReply(rows[0].body, '@madina_k')).toBe('Assalomu alaykum! Hujjatlar ro‘yxati…');
    expect(fillReply(rows[0].body, null)).toBe('Assalomu alaykum! Hujjatlar ro‘yxati…');
  });
  it('typing after "/" narrows by key', () => {
    expect(matchReplies(rows, '/').length).toBe(2);
    expect(matchReplies(rows, '/do').map((r) => r.key)).toEqual(['/docs']);
    expect(matchReplies(rows, '/x').length).toBe(0);
  });
});

describe('isServerQuery', () => {
  it('3+ characters or 4+ digits', () => {
    expect(isServerQuery('al')).toBe(false);
    expect(isServerQuery('ali')).toBe(true);
    expect(isServerQuery('3900')).toBe(true);
  });
});
