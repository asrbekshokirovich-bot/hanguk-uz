import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { saveSetting } from '../../api';
import { clock } from '../../time';
import type { LeadSettings } from '../../types';
import { useInvalidateLeadSettings } from '../../useLeadSettings';
import { explainLeadError } from '../labels';
import { sig } from '../settingsModel';

type Payloads = Partial<Record<keyof LeadSettings, unknown>>;

interface SettingsContextValue {
  userId: string | null;
  /** a section tells the page whether it holds unsaved edits (the dot in the left list) */
  report: (sectionId: string, dirty: boolean) => void;
}

export const SettingsContext = createContext<SettingsContextValue>({ userId: null, report: () => undefined });

export interface SectionOptions<F> {
  id: string;
  /** the form-state the saved settings give right now */
  server: F;
  /** form-state -> the `lead_settings` values (key -> JSON) it stands for */
  build: (form: F) => Payloads;
  /** a sentence when the form must not be saved yet, else null */
  validate?: (form: F) => string | null;
}

export interface SectionState<F> {
  draft: F;
  setDraft: (next: F | ((prev: F) => F)) => void;
  dirty: boolean;
  saving: boolean;
  /** why the last save did not happen (validation or the server) */
  error: string | null;
  savedAt: string | null;
  save: () => Promise<boolean>;
  revert: () => void;
}

/**
 * One settings section's edit state.
 *
 * - `draft` is what the person typed; it is never replaced while it differs
 *   from the saved value, so a failed save (or a refetch in the middle) keeps
 *   every edit.
 * - `save` writes only the keys whose value changed, one `saveSetting` each,
 *   and refreshes the settings; if the second of two keys fails the first is
 *   already saved and the draft still shows the unsaved rest.
 */
export function useSettingsSection<F>({ id, server, build, validate }: SectionOptions<F>): SectionState<F> {
  const { userId, report } = useContext(SettingsContext);
  const invalidate = useInvalidateLeadSettings();

  const [state, setState] = useState<{ base: F; draft: F }>({ base: server, draft: server });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // the saved value changed under us (our own save came back, or somebody else saved)
  const serverSig = sig(server);
  const serverRef = useRef(server);
  serverRef.current = server;
  useEffect(() => {
    const next = serverRef.current;
    setState((s) => {
      if (sig(s.base) === serverSig) return s;
      return sig(s.draft) === sig(s.base) ? { base: next, draft: next } : { base: next, draft: s.draft };
    });
  }, [serverSig]);

  const dirty = sig(state.draft) !== sig(state.base);
  useEffect(() => {
    report(id, dirty);
  }, [id, dirty, report]);

  const setDraft = useCallback((next: F | ((prev: F) => F)) => {
    setError(null);
    setState((s) => ({ ...s, draft: typeof next === 'function' ? (next as (prev: F) => F)(s.draft) : next }));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const problem = validate?.(state.draft) ?? null;
    if (problem) {
      setError(problem);
      return false;
    }
    const before = build(state.base) as Record<string, unknown>;
    const after = build(state.draft) as Record<string, unknown>;
    const changed = Object.keys(after).filter((k) => sig(after[k]) !== sig(before[k]));
    if (changed.length === 0) return true;

    setSaving(true);
    setError(null);
    let saved = 0;
    try {
      for (const key of changed) {
        await saveSetting(key as keyof LeadSettings, after[key], userId);
        saved += 1;
      }
      setState((s) => ({ base: s.draft, draft: s.draft }));
      setSavedAt(clock(new Date()));
      await invalidate();
      return true;
    } catch (e) {
      setError(explainLeadError(e));
      if (saved > 0) await invalidate();
      return false;
    } finally {
      setSaving(false);
    }
  }, [build, state.base, state.draft, userId, validate, invalidate]);

  const revert = useCallback(() => {
    setError(null);
    setState((s) => ({ base: s.base, draft: s.base }));
  }, []);

  return { draft: state.draft, setDraft, dirty, saving, error, savedAt, save, revert };
}
