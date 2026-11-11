import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Hanguk Ish lives in its own Supabase project (hanguk_ish/supabase), not in
 * hanguk.uz's: its address and publishable key come from
 * VITE_ISH_SUPABASE_URL and VITE_ISH_SUPABASE_PUBLISHABLE_KEY. Until they are
 * set (the project is created), the section says so instead of failing.
 */
const url = import.meta.env.VITE_ISH_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_ISH_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const ishConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/**
 * The staff member's own session in Hanguk Ish (phone + SMS code, as in the
 * apps), stored apart from their hanguk.uz session.
 */
export function ishClient(): SupabaseClient | null {
  if (!ishConfigured) return null;
  client ??= createClient(url as string, key as string, {
    auth: { storageKey: 'hanguk-ish-staff', persistSession: true, autoRefreshToken: true },
  });
  return client;
}
