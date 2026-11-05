import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  resolvePublishableKey,
  supabaseAuthHeaders,
  SUPABASE_PUBLISHABLE_KEY,
} from './keys';

describe('resolvePublishableKey', () => {
  it('defaults to the built-in publishable key', () => {
    expect(resolvePublishableKey(undefined)).toBe(DEFAULT_SUPABASE_PUBLISHABLE_KEY);
    expect(resolvePublishableKey('')).toBe(DEFAULT_SUPABASE_PUBLISHABLE_KEY);
    expect(DEFAULT_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')).toBe(true);
  });

  it('ignores a legacy anon JWT in the env', () => {
    expect(resolvePublishableKey('eyJhbGciOiJIUzI1NiJ9.e30.x')).toBe(
      DEFAULT_SUPABASE_PUBLISHABLE_KEY,
    );
  });

  it('accepts an sb_publishable_ override', () => {
    expect(resolvePublishableKey(' sb_publishable_other ')).toBe('sb_publishable_other');
  });

  it('never resolves to a secret key', () => {
    expect(resolvePublishableKey('sb_secret_abc')).toBe(DEFAULT_SUPABASE_PUBLISHABLE_KEY);
  });
});

describe('supabaseAuthHeaders', () => {
  it('sends only apikey without a session', () => {
    expect(supabaseAuthHeaders(null)).toEqual({ apikey: SUPABASE_PUBLISHABLE_KEY });
    expect(supabaseAuthHeaders(undefined)).not.toHaveProperty('Authorization');
  });

  it('sends the user token as Bearer with a session', () => {
    expect(supabaseAuthHeaders('user.jwt.token')).toEqual({
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer user.jwt.token',
    });
  });
});
