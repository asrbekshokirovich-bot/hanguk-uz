import { describe, expect, it, vi } from 'vitest';

// The pages' data calls are not under test; the client needs env settings.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { deviceCode } from '../api';
import { coverageOf, share, tabOf } from '../helpers';
import type { QualityData } from '../api';

describe('app analytics', () => {
  it('opens the tab the address names; the old address opens the overview', () => {
    expect(tabOf('/crm/app-analytics')).toBe('overview');
    expect(tabOf('/crm/app-analytics/quality')).toBe('quality');
    expect(tabOf('/crm/app-analytics/settings')).toBe('settings');
    expect(tabOf('/crm/app-analytics/nothing')).toBe('overview');
    expect(tabOf('/crm/app-activity')).toBe('overview');
  });

  it('shows a device code the way the app does', () => {
    expect(deviceCode('3f2a9c1e-7b44-4d2e-9a10-0c5d6e7f8a9b')).toBe('3F2A-9C1E');
  });

  it('measures stage 1: named taps and timed screens per build', () => {
    const q = {
      coverage: [{ build: 2102, taps: 200, named_taps: 193, screen_views: 50, timed_leaves: 47 }],
    } as unknown as QualityData;
    expect(coverageOf(q, 2102)).toEqual({ named: 97, timed: 94 });
    expect(coverageOf(q, 2101)).toEqual({ named: null, timed: null });
    expect(share(1, 0)).toBeNull();
  });
});
