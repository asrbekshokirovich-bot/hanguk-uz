import { useEffect, useState } from 'react';

/**
 * Above this width the detail pane is a third column; at or below it, the pane
 * is an overlay. 1440 is where the worklist's four zones plus a 400px pane stop
 * fitting side by side without crushing the rows.
 */
export const DOCK_BREAKPOINT = 1440;

export interface DetailDock {
  /** True when the pane sits in the layout rather than over it. */
  docked: boolean;
  open: boolean;
  toggle: () => void;
  close: () => void;
  /** Open the pane. Used when the operator picks a row deliberately. */
  show: () => void;
}

/**
 * Dock/overlay state for the lead detail pane.
 *
 * Docked, the pane is open by default — it costs the operator nothing. In
 * overlay mode it defaults *closed*, because an overlay open on first paint
 * would cover the Call button on every row, which is the one control the whole
 * screen exists to serve. The toggle is available at both widths either way.
 */
export function useDetailDock(): DetailDock {
  const [docked, setDocked] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > DOCK_BREAKPOINT,
  );
  const [open, setOpen] = useState(docked);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${DOCK_BREAKPOINT + 1}px)`);
    const sync = (event: MediaQueryList | MediaQueryListEvent) => {
      setDocked(event.matches);
      // Crossing the breakpoint resets to that mode's default: open when it
      // costs nothing, closed when it would cover the worklist.
      setOpen(event.matches);
    };
    query.addEventListener('change', sync);
    sync(query);
    return () => query.removeEventListener('change', sync);
  }, []);

  return {
    docked,
    open,
    toggle: () => setOpen((prev) => !prev),
    close: () => setOpen(false),
    show: () => setOpen(true),
  };
}
