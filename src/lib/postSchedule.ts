/**
 * Paper documents go to Korea by post, which leaves Uzbekistan only on
 * Mondays and Wednesdays and takes three days: Monday's post arrives on
 * Thursday, Wednesday's on Saturday.
 *
 * The owner's rule (2026-10-14): find the last post that still reaches the
 * university by its offline-document deadline, then step back two more post
 * days — that is the latest day the documents may leave. Example: deadline
 * Sat 31 Oct → the last post that makes it is Wed 28 (arrives Sat 31) → two
 * post days earlier is Wed 21 Oct, the latest dispatch.
 *
 * Dates are plain calendar days (YYYY-MM-DD), compared in UTC so a local
 * time zone can't shift them.
 */

const DAY = 86_400_000;
const POST_WEEKDAYS = new Set([1, 3]); // Monday, Wednesday
export const TRANSIT_DAYS = 3;
export const SAFETY_POST_DAYS = 2;

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isPostDay(date: Date): boolean {
  return POST_WEEKDAYS.has(date.getUTCDay());
}

export function arrivalDate(dispatch: Date): Date {
  return new Date(dispatch.getTime() + TRANSIT_DAYS * DAY);
}

function previousPostDay(date: Date): Date {
  let d = new Date(date.getTime() - DAY);
  while (!isPostDay(d)) d = new Date(d.getTime() - DAY);
  return d;
}

/** The last post day whose arrival is on or before the deadline. */
export function finalDispatchDate(deadline: Date): Date {
  let d = new Date(deadline.getTime() - TRANSIT_DAYS * DAY);
  while (!isPostDay(d)) d = new Date(d.getTime() - DAY);
  return d;
}

/** The recommended latest day: two post days before the final one. */
export function lastDispatchDate(deadline: Date): Date {
  let d = finalDispatchDate(deadline);
  for (let i = 0; i < SAFETY_POST_DAYS; i += 1) d = previousPostDay(d);
  return d;
}

/** The first post day on or after `from`. */
export function nextPostDay(from: Date): Date {
  let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (!isPostDay(d)) d = new Date(d.getTime() + DAY);
  return d;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY);
}

export interface PostPlan {
  /** The university's offline-document deadline. */
  deadline: Date;
  /** Recommended latest day the documents leave. */
  lastDispatch: Date;
  /** The final post that still arrives by the deadline (end of the reserve). */
  finalDispatch: Date;
  /** The next post day from today, if it is not past the final dispatch. */
  nextDispatch: Date | null;
  /** Days from today to the recommended last dispatch (negative once passed). */
  daysLeft: number;
  /** The recommended day has passed but a reserve post can still make it. */
  reserve: boolean;
  /** Even the final post has gone. */
  passed: boolean;
}

export function planPost(deadlineIso: string, today: Date): PostPlan {
  const deadline = parseDay(deadlineIso);
  const lastDispatch = lastDispatchDate(deadline);
  const finalDispatch = finalDispatchDate(deadline);
  const todayDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const next = nextPostDay(todayDay);
  const daysLeft = daysBetween(todayDay, lastDispatch);
  const passed = todayDay.getTime() > finalDispatch.getTime();
  return {
    deadline,
    lastDispatch,
    finalDispatch,
    nextDispatch: next.getTime() <= finalDispatch.getTime() ? next : null,
    daysLeft,
    reserve: daysLeft < 0 && !passed,
    passed,
  };
}
