import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: () => getSession() }, rpc: (...a: unknown[]) => rpc(...a) },
}));

import { createErrorReporter, describeError, isNoise, type ClientErrorReport } from '../errorReporter';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  getSession.mockReset();
  rpc.mockReset().mockResolvedValue({ error: null });
  window.history.replaceState({}, '', '/crm/leads?intake=spring-2027');
});

describe('describeError', () => {
  it('reads an Error, a string, a Supabase-style object and anything else', () => {
    const e = new TypeError("Cannot read properties of undefined (reading 'map')");
    expect(describeError(e)).toEqual({ message: e.message, stack: e.stack });
    expect(describeError('plain text')).toEqual({ message: 'plain text', stack: null });
    expect(describeError({ message: 'permission denied', code: '42501' })).toEqual({ message: 'permission denied', stack: null });
    expect(describeError({ code: 'PGRST301' }).message).toBe('{"code":"PGRST301"}');
    expect(describeError(undefined).message).toBe('');
    expect(describeError(null).message).toBe('');
    expect(describeError(42).message).toBe('42');
  });
});

describe('isNoise', () => {
  it('drops what the network or the browser did', () => {
    for (const m of [
      'Script error.',
      'ResizeObserver loop completed with undelivered notifications.',
      'TypeError: Failed to fetch',
      'Failed to fetch dynamically imported module: https://www.hanguk.uz/assets/Leads-abc.js',
      'Load failed',
      'NetworkError when attempting to fetch resource.',
      'AbortError: The operation was aborted.',
    ]) {
      expect(isNoise(m), m).toBe(true);
    }
    expect(isNoise("Cannot read properties of undefined (reading 'map')")).toBe(false);
    expect(isNoise('Minified React error #310')).toBe(false);
  });
});

describe('createErrorReporter', () => {
  it('sends a crash once per page load, with the page, the build and the stacks', async () => {
    const sent: ClientErrorReport[] = [];
    const report = createErrorReporter(async (r) => { sent.push(r); });
    const error = new Error('Boom in LeadsTable');

    expect(report('crash', error, { componentStack: '\n    at LeadsTable' })).toBe(true);
    expect(report('crash', error)).toBe(false); // the same again: a re-render, not news
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'crash', message: 'Boom in LeadsTable', path: '/crm/leads', build: 'local' });
    expect(sent[0].stack).toContain('at LeadsTable');
    expect(sent[0].userAgent).toBe(navigator.userAgent);

    // The same error on another page, or as another kind, is another report.
    window.history.replaceState({}, '', '/crm/students');
    expect(report('crash', error)).toBe(true);
    expect(report('rejection', error)).toBe(true);
    expect(sent).toHaveLength(3);
  });

  it('says nothing about noise or about nothing', () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const report = createErrorReporter(send);
    expect(report('rejection', new TypeError('Failed to fetch'))).toBe(false);
    expect(report('error', 'Script error.')).toBe(false);
    expect(report('rejection', undefined)).toBe(false);
    expect(report('error', '   ')).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('stops after the limit: a page in a loop does not flood the server', () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const report = createErrorReporter(send, 3);
    for (let i = 0; i < 10; i++) report('error', `error ${i}`);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('a report that fails is dropped without a sound', async () => {
    const report = createErrorReporter(() => Promise.reject(new Error('offline')));
    expect(report('crash', new Error('x'))).toBe(true);
    await flush(); // an unhandled rejection here would fail the test run
  });
});

describe('the default sender', () => {
  it('writes through web_error_log for someone signed in, and not at all for a visitor', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    createErrorReporter()('crash', new Error('visitor saw this'));
    await flush();
    expect(rpc).not.toHaveBeenCalled();

    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    createErrorReporter()('crash', new Error('operator saw this'));
    await flush();
    expect(rpc).toHaveBeenCalledWith('web_error_log', expect.objectContaining({
      p_kind: 'crash', p_message: 'operator saw this', p_path: '/crm/leads', p_build: 'local',
    }));
  });
});
