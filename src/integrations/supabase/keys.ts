/**
 * Supabase API key used by the browser.
 *
 * This is the project's *publishable* key (sb_publishable_...). It is public by
 * design and replaces the legacy anon JWT. It is NOT a JWT: send it only in the
 * `apikey` header, never as `Authorization: Bearer`. For Authorization, use the
 * signed-in user's access_token (see authHeaders) or send no Authorization at all.
 */
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Ne64VlXnQ7tWJJ1e7aQLGg_5OgQiof3';

/**
 * Pick the key: an env override is honoured only when it is a new-style
 * publishable key, so a stale legacy anon JWT in the env cannot sneak back in.
 */
export function resolvePublishableKey(envValue: unknown): string {
  if (typeof envValue === 'string') {
    const v = envValue.trim();
    if (v.startsWith('sb_publishable_')) return v;
  }
  return DEFAULT_SUPABASE_PUBLISHABLE_KEY;
}

export const SUPABASE_PUBLISHABLE_KEY = resolvePublishableKey(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * Headers for a direct fetch to Supabase (REST / edge functions):
 * `apikey` always, `Authorization: Bearer <access_token>` only when there is a session.
 */
export function supabaseAuthHeaders(accessToken?: string | null): Record<string, string> {
  return accessToken
    ? { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` }
    : { apikey: SUPABASE_PUBLISHABLE_KEY };
}
