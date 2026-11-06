import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import { inviteBody, nothingSent } from '../appInvite';

describe('appInvite', () => {
  it('sends the students or all, and dry on the first click', () => {
    expect(inviteBody({ studentIds: ['a'] })).toEqual({ student_ids: ['a'] });
    expect(inviteBody({ all: true }, true)).toEqual({ all: true, dry: true });
  });

  it('nothing sent when the student is in the app or invited this week', () => {
    expect(nothingSent({ telegram: 0, task: 0, skipped: 1 })).toBe(true);
    expect(nothingSent({ telegram: 1, task: 0, skipped: 0 })).toBe(false);
    expect(nothingSent({ telegram: 0, task: 0, skipped: 0, error: 'x' })).toBe(false);
  });
});
