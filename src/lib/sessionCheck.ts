import { isAuthApiError, isAuthSessionMissingError } from '@supabase/supabase-js';

/**
 * True when the auth server says this browser's session no longer exists —
 * e.g. the same account signed out on another computer, the password was
 * changed, or the account was deleted.
 *
 * The access token in memory stays valid for up to an hour after that, so the
 * page keeps looking signed in and storage uploads still work, while anything
 * that checks the session server-side (`auth.getUser()` inside edge functions
 * such as create-student) answers 401 "Session not found".
 *
 * Network failures are deliberately NOT treated as a lost session.
 */
export function isSessionGoneError(error: unknown): boolean {
  if (!error) return false;
  if (isAuthSessionMissingError(error)) return true;
  if (isAuthApiError(error)) {
    const status = (error as { status?: number }).status;
    return status === 401 || status === 403;
  }
  return false;
}

/** HTTP status of a failed `supabase.functions.invoke`, if it has one. */
export function edgeFunctionStatus(error: unknown): number | null {
  const ctx = (error as { context?: unknown } | null)?.context as { status?: unknown } | undefined;
  return ctx && typeof ctx.status === 'number' ? ctx.status : null;
}
