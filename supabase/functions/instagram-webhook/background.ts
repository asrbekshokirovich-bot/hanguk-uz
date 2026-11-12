// What lets the webhook answer Meta at once and do its work after.
// Kept apart from index.ts so it can be tested without starting the server.

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

/**
 * Hands `work` to the runtime to finish after the response has gone
 * (EdgeRuntime.waitUntil keeps the instance alive for it) and says whether
 * it did. Without the runtime — a test, a local run — the caller awaits the
 * work itself, as the webhook always used to.
 */
export function runAfterResponse(work: Promise<unknown>): boolean {
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
    return true;
  }
  return false;
}

/**
 * How long an event may sit unprocessed with no error before upkeep takes it
 * for abandoned: a background run cut short leaves exactly that. Far longer
 * than any event takes (the slowest in a day: 11 seconds).
 */
export const STALE_EVENT_MS = 5 * 60 * 1000;

/**
 * The PostgREST `or` filter for the events upkeep should run again: the ones
 * that failed, and the ones nobody finished.
 */
export function retryFilter(now: number): string {
  return `error.not.is.null,created_at.lt.${new Date(now - STALE_EVENT_MS).toISOString()}`;
}
