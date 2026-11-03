import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

import {
  CAMERA_ID_RE,
  fetchCameraSession,
  fmtClock,
  isCameraSession,
  isExpiring,
  liveUrl,
  refreshDelayMs,
  snapshotUrl,
  toSessionError,
  type CameraSession,
} from '../cameraSession';

const session: CameraSession = {
  gate: 'https://cam.hanguk.uz',
  token: 'v1.eyJ1IjoieCJ9.c2ln',
  expires_at: '2026-11-03T10:05:00.000Z',
  ttl: 300,
  cameras: [
    { id: 'kirish', name: 'Kirish' },
    { id: 'zal', name: 'Zal' },
  ],
};

/** supabase-js v2 FunctionsHttpError: umumiy matn + Response. */
function httpError(status: number, body: unknown) {
  return {
    name: 'FunctionsHttpError',
    message: 'Edge Function returned a non-2xx status code',
    context: new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  };
}

describe('isCameraSession', () => {
  it('camera-session javobini qabul qiladi', () => {
    expect(isCameraSession(session)).toBe(true);
    expect(isCameraSession({ ...session, gate: 'http://127.0.0.1:8080' })).toBe(true);
  });

  it("noto'g'ri javobni rad etadi", () => {
    expect(isCameraSession(null)).toBe(false);
    expect(isCameraSession({ ...session, gate: 'https://cam.hanguk.uz/x' })).toBe(false);
    expect(isCameraSession({ ...session, gate: 'cam.hanguk.uz' })).toBe(false);
    expect(isCameraSession({ ...session, expires_at: 'ertaga' })).toBe(false);
    expect(isCameraSession({ ...session, token: 1 })).toBe(false);
    expect(isCameraSession({ ...session, cameras: [{ id: 'Kirish', name: 'Kirish' }] })).toBe(false);
    expect(isCameraSession({ ...session, cameras: [{ id: '../api', name: 'x' }] })).toBe(false);
  });
});

describe('manzillar', () => {
  it('rasm: /api/frame.jpeg?src&q&t&_', () => {
    const u = new URL(snapshotUrl(session, 'kirish', 1730628000000));
    expect(`${u.origin}${u.pathname}`).toBe('https://cam.hanguk.uz/api/frame.jpeg');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      src: 'kirish',
      q: 'sd',
      t: session.token,
      _: '1730628000000',
    });
    expect(new URL(snapshotUrl(session, 'zal', 1, 'hd')).searchParams.get('q')).toBe('hd');
  });

  it("jonli: https → wss, http → ws", () => {
    const u = new URL(liveUrl(session, 'zal', 'hd'));
    expect(`${u.protocol}//${u.host}${u.pathname}`).toBe('wss://cam.hanguk.uz/api/ws');
    expect(Object.fromEntries(u.searchParams)).toEqual({ src: 'zal', q: 'hd', t: session.token });
    expect(liveUrl({ ...session, gate: 'http://127.0.0.1:8080' }, 'zal', 'sd')).toMatch(/^ws:\/\/127\.0\.0\.1:8080\/api\/ws\?/);
  });
});

describe('kalitni yangilash vaqti', () => {
  const now = Date.parse('2026-11-03T10:00:00Z');

  it('tugashidan 60 s oldin (5 daqiqalik kalit — 4 daqiqada)', () => {
    expect(refreshDelayMs(session.expires_at, now)).toBe(240_000);
  });

  it('kamida 15 s keyin', () => {
    expect(refreshDelayMs(session.expires_at, Date.parse('2026-11-03T10:04:30Z'))).toBe(15_000);
    expect(refreshDelayMs(session.expires_at, Date.parse('2026-11-03T10:09:00Z'))).toBe(15_000);
  });

  it('60 s dan kam qolsa — tugayapti', () => {
    expect(isExpiring(session.expires_at, now)).toBe(false);
    expect(isExpiring(session.expires_at, Date.parse('2026-11-03T10:04:00Z'))).toBe(false);
    expect(isExpiring(session.expires_at, Date.parse('2026-11-03T10:04:01Z'))).toBe(true);
  });
});

describe('fmtClock', () => {
  it('Toshkent vaqti (UTC+5)', () => {
    expect(fmtClock(Date.parse('2026-11-03T10:42:10Z'))).toBe('15:42:10');
    expect(fmtClock(Date.parse('2026-11-03T19:05:09Z'))).toBe('00:05:09');
  });
});

describe('toSessionError', () => {
  it('faqat camera-session kodlari, qolgani load_failed', () => {
    expect(toSessionError('forbidden')).toBe('forbidden');
    expect(toSessionError('no_cameras')).toBe('no_cameras');
    expect(toSessionError('not_configured')).toBe('not_configured');
    expect(toSessionError('internal')).toBe('load_failed');
    expect(toSessionError('load_failed (HTTP 502)')).toBe('load_failed');
  });
});

describe('fetchCameraSession', () => {
  beforeEach(() => invoke.mockReset());

  it('kalitni POST bilan oladi', async () => {
    invoke.mockResolvedValueOnce({ data: session, error: null });
    await expect(fetchCameraSession()).resolves.toEqual(session);
    expect(invoke).toHaveBeenCalledWith('camera-session', { method: 'POST', body: {} });
  });

  it('funksiya kodlarini saqlaydi', async () => {
    const cases: [number, string][] = [
      [403, 'forbidden'],
      [409, 'no_cameras'],
      [503, 'not_configured'],
    ];
    for (const [status, code] of cases) {
      invoke.mockResolvedValueOnce({ data: null, error: httpError(status, { error: code }) });
      await expect(fetchCameraSession()).rejects.toMatchObject({ code });
    }
  });

  it('har qanday 401 — unauthorized (shlyuzning "Invalid JWT" i ham)', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: httpError(401, { error: 'unauthorized' }) });
    await expect(fetchCameraSession()).rejects.toMatchObject({ code: 'unauthorized' });
    invoke.mockResolvedValueOnce({ data: null, error: httpError(401, { code: 401, message: 'Invalid JWT' }) });
    await expect(fetchCameraSession()).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('boshqa xato va buzuq javob — load_failed', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: httpError(500, { error: 'internal' }) });
    await expect(fetchCameraSession()).rejects.toMatchObject({ code: 'load_failed' });
    invoke.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') });
    await expect(fetchCameraSession()).rejects.toMatchObject({ code: 'load_failed' });
    invoke.mockResolvedValueOnce({ data: { gate: 'https://cam.hanguk.uz' }, error: null });
    await expect(fetchCameraSession()).rejects.toMatchObject({ code: 'load_failed' });
  });
});

describe('kamera ID qoidasi uch joyda bir xil', () => {
  const root = resolve(__dirname, '../../..');
  const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

  it('CRM = camera-gate = edge funksiya = cameras jadvali CHECK', () => {
    const source = CAMERA_ID_RE.source;
    expect(read('deploy/camera/gate/token.ts')).toContain(`CAMERA_ID_RE = /${source}/;`);
    expect(read('supabase/functions/_shared/camera-token.ts')).toContain(`CAMERA_ID_RE = /${source}/;`);
    expect(read('supabase/migrations/20261103120000_cameras.sql')).toContain(`check (id ~ '${source}')`);
  });
});
