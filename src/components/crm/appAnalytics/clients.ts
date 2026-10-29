import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { APPLICATION_PACK_SLOTS, slotLabel } from '@/lib/studentDocSlots';

/**
 * «Mijozlar faolligi» (plan v2, stage 5 — the documents team's page):
 * analytics_clients_activity — unanswered university offers, incomplete
 * application packs, students away from the app for 7 days.
 */
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export interface OfferRow {
  user_id: string;
  name: string | null;
  institution_id: string;
  university: string | null;
  offered_at: string;
  overdue: boolean;
  reminded_at: string | null;
  last_seen_at: string | null;
}

export interface DocsRow {
  user_id: string;
  name: string | null;
  contract_date: string | null;
  gaps: { slot: string; state: 'missing' | 'rejected' }[];
  last_upload_at: string | null;
  last_seen_at: string | null;
}

export interface InactiveRow {
  user_id: string;
  name: string | null;
  contract_date: string | null;
  last_seen_at: string | null;
}

export interface ClientsActivity {
  now: string;
  offers: OfferRow[];
  documents: DocsRow[];
  inactive: InactiveRow[];
}

export function useClientsActivity() {
  const [data, setData] = useState<ClientsActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    db.rpc('analytics_clients_activity').then(({ data, error }: { data: ClientsActivity | null; error: { message: string } | null }) => {
      if (!alive) return;
      setError(error ? error.message : null);
      if (!error) setData(data);
    });
    return () => {
      alive = false;
    };
  }, [tick]);
  return { data, error, reload: useCallback(() => setTick((n) => n + 1), []) };
}

/**
 * The selected season's students (the top bar's Bahor/Kuz switcher, as on
 * every other CRM page): its roster without cancelled contracts and those who
 * have left for Korea. undefined while loading; null if it could not be read
 * (the lists are then shown whole).
 */
export function useSeasonRoster(intakeId: string | null) {
  const [ids, setIds] = useState<Set<string> | null | undefined>(undefined);
  useEffect(() => {
    if (!intakeId) {
      setIds(null);
      return;
    }
    let alive = true;
    setIds(undefined);
    void supabase
      .from('student_intakes')
      .select('student_id')
      .eq('intake_id', intakeId)
      .is('contract_cancelled_at', null)
      .is('departed_at', null)
      .then(({ data, error }) => {
        if (alive) setIds(error ? null : new Set((data ?? []).map((r) => r.student_id)));
      });
    return () => {
      alive = false;
    };
  }, [intakeId]);
  return ids;
}

/** A slot's name as the documents page writes it. */
export function slotName(id: string, lang: string): string {
  const slot = APPLICATION_PACK_SLOTS.find((s) => s.id === id);
  return slot ? slotLabel(slot.name, lang) : id;
}

/** «3 kun», «5 soat» — how long since [iso]; «—» when never. */
export function waited(iso: string | null, t: (k: string, o?: Record<string, unknown>) => string, now: Date = new Date()): string {
  if (!iso) return '—';
  const h = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 3_600_000));
  return h < 48 ? t('clients.hours', { count: h }) : t('clients.days', { count: Math.floor(h / 24) });
}

/** Where a student opens in the CRM. */
export const studentPath = (userId: string) => `/crm/students?student=${encodeURIComponent(userId)}`;
