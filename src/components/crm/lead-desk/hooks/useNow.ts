import { useEffect, useReducer, useSyncExternalStore } from 'react';

/**
 * A ticking `Date` (once a second) for the desk's live countdowns.
 *
 * One interval is shared by every component that calls `useNow()`: it starts
 * with the first subscriber and stops with the last, so a page of 40 rows costs
 * one timer, not 40. The snapshot is the same object for the whole second, which
 * is what `useSyncExternalStore` needs.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let snapshotSecond = -1;
let snapshot = new Date();

function currentSnapshot(): Date {
  const second = Math.floor(Date.now() / 1000);
  if (second !== snapshotSecond) {
    snapshotSecond = second;
    snapshot = new Date(second * 1000);
  }
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    timer = setInterval(() => {
      for (const l of [...listeners]) l();
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** The current time, re-rendering the caller every second. */
export function useNow(): Date {
  return useSyncExternalStore(subscribe, currentSnapshot, currentSnapshot);
}

/**
 * Re-render the caller once, when `iso` passes — for a decision that flips at a
 * known moment (a deadline) without paying for a render every second.
 */
export function useRerenderAt(iso: string | null | undefined): void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!iso) return;
    const wait = Date.parse(iso) - Date.now();
    if (!Number.isFinite(wait) || wait <= 0 || wait > 2_000_000_000) return;
    const id = setTimeout(bump, wait + 50);
    return () => clearTimeout(id);
  }, [iso]);
}
