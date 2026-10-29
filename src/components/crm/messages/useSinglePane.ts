import { useEffect, useState } from 'react';

/**
 * Below this width the inbox shows one pane at a time — the list, or the open
 * conversation with a back arrow — the way Telegram does on a phone. Above it
 * the panes sit side by side. 1024 rather than the app's 768 mobile cut-off:
 * a 900px tablet cannot fit a 320px list and a readable thread either.
 */
export const SINGLE_PANE_MAX = 1023;

export function useSinglePane(): boolean {
  const query = `(max-width: ${SINGLE_PANE_MAX}px)`;
  const [single, setSingle] = useState(() => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia(query);
    } catch {
      return;
    }
    const onChange = () => setSingle(mql.matches);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return single;
}
