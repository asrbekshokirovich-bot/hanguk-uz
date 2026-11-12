/**
 * What breaks in the browser, sent to the database (web_error_log) so that a
 * page that crashed for an operator leaves a trace somewhere other than their
 * console. Only for someone signed in — visitors are not logged — and never
 * in the way: a report that fails is dropped silently.
 */
import { supabase } from '@/integrations/supabase/client';
import { isReloadingForNewBuild } from '@/lib/buildReload';

declare const __BUILD_ID__: string | undefined;

export type ClientErrorKind = 'crash' | 'error' | 'rejection';

export interface ClientErrorReport {
  kind: ClientErrorKind;
  message: string;
  stack: string | null;
  path: string;
  build: string;
  userAgent: string;
}

/** The network's or the browser's doing, not a fault in a page of ours. */
const NOISE: RegExp[] = [
  /^Script error\.?$/i, // another origin's script: the browser tells us nothing
  /ResizeObserver loop/i,
  /Failed to fetch/i, // offline, or a request cut short (a stale chunk reloads the page: buildReload.ts)
  /Load failed/i, // the same, in Safari's words
  /dynamically imported module|Importing a module script failed/i, // a chunk that did not load, in Firefox's and Safari's words
  /NetworkError/i,
  /AbortError|operation was aborted|signal is aborted/i,
  /Should have a queue/, // React hot reload, development only
];

export function isNoise(message: string): boolean {
  return NOISE.some((re) => re.test(message));
}

/** A message and a stack out of whatever was thrown. */
export function describeError(reason: unknown): { message: string; stack: string | null } {
  if (reason instanceof Error) {
    return { message: reason.message || reason.name, stack: reason.stack ?? null };
  }
  if (typeof reason === 'string') return { message: reason, stack: null };
  if (reason && typeof reason === 'object') {
    const { message, stack } = reason as { message?: unknown; stack?: unknown };
    if (typeof message === 'string' && message) {
      return { message, stack: typeof stack === 'string' ? stack : null };
    }
    try {
      return { message: JSON.stringify(reason).slice(0, 300), stack: null };
    } catch {
      return { message: Object.prototype.toString.call(reason), stack: null };
    }
  }
  return { message: reason === undefined || reason === null ? '' : String(reason), stack: null };
}

const buildId = (): string => (typeof __BUILD_ID__ === 'string' && __BUILD_ID__ ? __BUILD_ID__ : 'local');

async function sendToServer(report: ClientErrorReport): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  await supabase.rpc('web_error_log', {
    p_kind: report.kind,
    p_message: report.message,
    p_stack: report.stack ?? undefined,
    p_path: report.path,
    p_build: report.build,
    p_user_agent: report.userAgent,
  });
}

/**
 * A reporter with its own memory: the same error on the same page is sent
 * once per page load (the server counts people and hours, not renders), and
 * a page stuck in a loop stops after `max` reports.
 */
export function createErrorReporter(send: (report: ClientErrorReport) => Promise<void> = sendToServer, max = 25) {
  const seen = new Set<string>();
  let sent = 0;

  return function report(kind: ClientErrorKind, reason: unknown, extra?: { componentStack?: string | null }): boolean {
    try {
      // The page is being replaced by a new build: what breaks meanwhile is
      // the old build's missing files, not a fault to write down.
      if (isReloadingForNewBuild()) return false;
      const { message, stack } = describeError(reason);
      const text = message.trim();
      if (!text || isNoise(text)) return false;
      const path = window.location.pathname;
      const key = `${kind}|${text}|${path}`;
      if (seen.has(key) || sent >= max) return false;
      seen.add(key);
      sent += 1;
      const fullStack = [stack, extra?.componentStack].filter(Boolean).join('\n') || null;
      void send({ kind, message: text, stack: fullStack, path, build: buildId(), userAgent: navigator.userAgent }).catch(() => {
        // The report is a courtesy; it must never become an error itself.
      });
      return true;
    } catch {
      return false;
    }
  };
}

/** The page's reporter. */
export const reportClientError = createErrorReporter();
