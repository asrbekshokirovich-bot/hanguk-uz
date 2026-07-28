import { useCallback, useEffect, useState } from 'react';

/**
 * Owns inline-translation visibility for the open thread.
 *
 * `autoTranslate` expands every translatable message by default; a per-message
 * toggle overrides it in either direction, exactly as the mockup behaves.
 * Flipping the auto switch clears the per-message overrides so the thread
 * snaps back to a consistent state.
 *
 * Overrides are keyed by message id and reset when the thread changes.
 */
export function useThreadTranslation(threadId: string | null, defaultAuto = true) {
  const [autoTranslate, setAutoTranslate] = useState(defaultAuto);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOverrides({});
  }, [threadId]);

  const isExpanded = useCallback(
    (messageId: string, hasTranslation: boolean) => {
      const override = overrides[messageId];
      if (override !== undefined) return override;
      return autoTranslate && hasTranslation;
    },
    [overrides, autoTranslate],
  );

  const toggleMessage = useCallback(
    (messageId: string, currentlyExpanded: boolean) => {
      setOverrides((prev) => ({ ...prev, [messageId]: !currentlyExpanded }));
    },
    [],
  );

  const toggleAuto = useCallback(() => {
    setAutoTranslate((prev) => !prev);
    setOverrides({});
  }, []);

  return { autoTranslate, toggleAuto, isExpanded, toggleMessage };
}
