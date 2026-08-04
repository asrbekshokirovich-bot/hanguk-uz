import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AI_SETTER } from './nextCall';

/**
 * Persists a next-call assignment.
 *
 * The goal, its author and its reasoning live in the `next_call_*` columns
 * added by `20260804120000_leads_next_call.sql`. Until that migration is
 * applied those columns do not exist, and PostgREST rejects the whole update —
 * which would take the timing (`next_follow_up`, a column that *does* exist)
 * down with it.
 *
 * So the write is attempted in full, and on a missing-column error it is
 * retried with just the timing, with the plan kept in memory for the session.
 * The screen stays usable either way; it simply is not durable until the
 * migration lands. `degraded` says which mode is in force so the UI can be
 * honest about it.
 */

/** PostgREST's code for "column does not exist". */
const UNDEFINED_COLUMN = '42703';

export interface NextCallWrite {
  leadId: string;
  goal: string;
  dueAt: string;
  reason: string;
  /** Null when Hanguk AI assigned it; otherwise the operator's user id. */
  operatorId: string | null;
}

export interface NextCallWriter {
  write: (input: NextCallWrite) => Promise<boolean>;
  /** True once a write has proved the `next_call_*` columns are absent. */
  degraded: boolean;
  saving: boolean;
}

export function useNextCallWriter(): NextCallWriter {
  const [degraded, setDegraded] = useState(false);
  const [saving, setSaving] = useState(false);
  // Read inside the callback without making it a dependency, so one probe
  // result is reused for every later write in the session.
  const degradedRef = useRef(false);

  const write = useCallback(async (input: NextCallWrite) => {
    setSaving(true);
    try {
      const timing = { next_follow_up: input.dueAt };
      const full = {
        ...timing,
        next_call_goal: input.goal,
        next_call_set_by: input.operatorId ?? AI_SETTER,
        next_call_reason: input.reason,
      };

      if (!degradedRef.current) {
        // `next_call_*` is absent from the generated Supabase types until the
        // migration is applied, so the payload is widened deliberately here.
        const { error } = await supabase
          .from('leads')
          .update(full as never)
          .eq('id', input.leadId);
        if (!error) return true;
        if (error.code !== UNDEFINED_COLUMN) {
          console.error('Failed to save the next call:', error);
          return false;
        }
        // The migration has not been applied — fall back for the session.
        degradedRef.current = true;
        setDegraded(true);
      }

      const { error } = await supabase.from('leads').update(timing).eq('id', input.leadId);
      if (error) {
        console.error('Failed to save the next call time:', error);
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  return { write, degraded, saving };
}
