import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const listeners: Record<string, (arg: unknown) => void> = {};
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    addListener: vi.fn(async (event: string, cb: (arg: unknown) => void) => {
      listeners[event] = cb;
      return { remove: vi.fn() };
    }),
    checkPermissions: vi.fn(async () => ({ receive: 'granted' })),
    requestPermissions: vi.fn(async () => ({ receive: 'granted' })),
    register: vi.fn(async () => undefined),
  },
}));
vi.mock('../usePlatform', () => ({ usePlatform: () => ({ isDespia: true, platform: 'despia-ios' }) }));

const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }));
const from = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    functions: { invoke: (...args: unknown[]) => invoke(...(args as [])) },
    from: (...args: unknown[]) => from(...args),
  },
}));

import { useNativePushNotifications } from '../useNativePushNotifications';

describe('useNativePushNotifications', () => {
  it('registers the device token through the register-push-token function', async () => {
    renderHook(() => useNativePushNotifications());
    await waitFor(() => expect(listeners.registration).toBeDefined());

    listeners.registration({ value: 'tok-123' });

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith('register-push-token', {
      body: { platform: 'ios', token: 'tok-123' },
    });
    // No direct table writes: push_tokens no longer exists.
    expect(from).not.toHaveBeenCalled();
  });
});
