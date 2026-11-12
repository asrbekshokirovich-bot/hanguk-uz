import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hanguk Ish lives in hanguk.uz's own Supabase project, in the schema `ish`
 * (P48): the CRM section works with hanguk.uz's client and the staff member's
 * hanguk.uz session, and ishApi() sends every call to `ish`. Who may use it
 * is the database's list: ish.staff_members.
 */
export function ishClient(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}
