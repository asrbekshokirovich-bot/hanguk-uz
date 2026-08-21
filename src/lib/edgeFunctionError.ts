/**
 * Turn a `supabase.functions.invoke` error into the message the function meant
 * to send.
 *
 * supabase-js v2 does not read the response body of a non-2xx: it hands back
 * `data: null` and a `FunctionsHttpError` whose `message` is always the generic
 * "Edge Function returned a non-2xx status code". Our edge functions answer with
 * `{ error: "..." }` and a real status (401 unauthorized, 403 staff-only, 400
 * not a PDF, 404 unknown institution, 500 storage/DB failure), and all of that
 * detail is reachable only through `error.context` — the raw `Response`.
 *
 * Every caller that shows an invoke failure to a human should route it through
 * here, otherwise the operator sees the wrapper string and cannot tell a
 * permission problem from a bad file.
 */

interface InvokeErrorLike {
  message?: string;
  context?: unknown;
}

function isResponseLike(value: unknown): value is Response {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Response).json === 'function'
  );
}

/**
 * Read `{ error }` (or `{ message }`) out of the failed response body.
 *
 * The body is consumed via `clone()` where available, so callers that also want
 * to inspect the original `Response` are not left with a used-up stream.
 */
export async function edgeFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  const ctx = (error as InvokeErrorLike | null)?.context;

  if (isResponseLike(ctx)) {
    try {
      const source = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
      const body = (await source.json()) as { error?: unknown; message?: unknown } | null;
      const detail = body?.error ?? body?.message;
      if (typeof detail === 'string' && detail.trim()) return detail;
    } catch {
      // Not JSON — a gateway/HTML error page. Fall through to the status below.
    }

    const { status } = ctx;
    if (typeof status === 'number' && status > 0) return `${fallback} (HTTP ${status})`;
  }

  const message = (error as InvokeErrorLike | null)?.message;
  // The wrapper string carries no information; prefer the caller's own wording.
  if (typeof message === 'string' && message.trim() && !/non-2xx status code/i.test(message)) {
    return message;
  }

  return fallback;
}

/** Same as `edgeFunctionErrorMessage`, wrapped in an `Error` ready to throw. */
export async function edgeFunctionError(error: unknown, fallback: string): Promise<Error> {
  return new Error(await edgeFunctionErrorMessage(error, fallback));
}
