import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import { CameraSessionLoadError, type CameraSession } from '@/lib/cameraSession';
import { useCameraSession } from '../useCameraSession';

const T0 = Date.parse('2026-11-03T10:00:00Z');

/** 5 daqiqalik kalit, `ms` paytida berilgan. */
function sessionAt(ms: number, token: string): CameraSession {
  return {
    gate: 'https://cam.hanguk.uz',
    token,
    expires_at: new Date(ms + 300_000).toISOString(),
    ttl: 300,
    cameras: [{ id: 'kirish', name: 'Kirish' }],
  };
}

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Va'dalar va React yangilanishlari tugashini kutish. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useCameraSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ochilganda oladi va tugashidan 60 s oldin yangilaydi', async () => {
    let n = 0;
    const load = vi.fn(async () => sessionAt(Date.now(), `k${++n}`));
    const { result } = renderHook(() => useCameraSession(load));
    expect(result.current.loading).toBe(true);
    await flush();
    expect(result.current.loading).toBe(false);
    expect(result.current.session?.token).toBe('k1');

    await advance(239_000);
    expect(load).toHaveBeenCalledTimes(1);
    await advance(1_000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.session?.token).toBe('k2');
  });

  it("tab yashirin bo'lsa yangilamaydi; qaytganda kalit tugayotgan bo'lsa darrov oladi", async () => {
    let n = 0;
    const load = vi.fn(async () => sessionAt(Date.now(), `k${++n}`));
    const { result } = renderHook(() => useCameraSession(load));
    await flush();
    setVisibility('hidden');
    await advance(600_000);
    expect(load).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.session?.token).toBe('k2');
  });

  it("qaytganda kalit hali yangi bo'lsa so'ramaydi (har so'rov jurnalga yoziladi)", async () => {
    const load = vi.fn(async () => sessionAt(Date.now(), 'k'));
    renderHook(() => useCameraSession(load));
    await flush();
    setVisibility('hidden');
    await advance(30_000);
    setVisibility('visible');
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("vaqtinchalik xatoda eski kalit qoladi va 30 s dan keyin qayta so'raladi", async () => {
    const load = vi
      .fn<() => Promise<CameraSession>>()
      .mockResolvedValueOnce(sessionAt(T0, 'k1'))
      .mockRejectedValueOnce(new CameraSessionLoadError('load_failed'))
      .mockResolvedValueOnce(sessionAt(T0 + 270_000, 'k3'));
    const { result } = renderHook(() => useCameraSession(load));
    await flush();

    await advance(240_000); // 10:04 — yangilash xato, 'k1' 10:05 gacha ishlaydi
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.session?.token).toBe('k1');
    expect(result.current.error).toBeNull();

    await advance(29_000);
    expect(load).toHaveBeenCalledTimes(2);
    await advance(1_000);
    expect(load).toHaveBeenCalledTimes(3);
    expect(result.current.session?.token).toBe('k3');
  });

  it("eski kalit tugab qolsa xato ko'rsatiladi", async () => {
    const load = vi
      .fn<() => Promise<CameraSession>>()
      .mockResolvedValueOnce(sessionAt(T0, 'k1'))
      .mockRejectedValueOnce(new CameraSessionLoadError('load_failed'))
      .mockRejectedValueOnce(new CameraSessionLoadError('load_failed'));
    const { result } = renderHook(() => useCameraSession(load));
    await flush();
    await advance(240_000);
    expect(result.current.session?.token).toBe('k1');
    await advance(30_000); // 10:04:30 — 30 s qoldi
    expect(load).toHaveBeenCalledTimes(3);
    expect(result.current.session).toBeNull();
    expect(result.current.error).toBe('load_failed');
  });

  it("ruxsat olib qo'yilsa video yopiladi (forbidden) va boshqa so'ralmaydi", async () => {
    const load = vi
      .fn<() => Promise<CameraSession>>()
      .mockResolvedValueOnce(sessionAt(T0, 'k1'))
      .mockRejectedValueOnce(new CameraSessionLoadError('forbidden'));
    const { result } = renderHook(() => useCameraSession(load));
    await flush();
    await advance(240_000);
    expect(result.current.session).toBeNull();
    expect(result.current.error).toBe('forbidden');
    await advance(600_000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('«Qayta urinish»: xatodan keyin qayta oladi', async () => {
    const load = vi
      .fn<() => Promise<CameraSession>>()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(sessionAt(T0, 'k2'));
    const { result } = renderHook(() => useCameraSession(load));
    await flush();
    expect(result.current.error).toBe('load_failed');
    expect(result.current.session).toBeNull();

    act(() => result.current.reload());
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    await flush();
    expect(result.current.loading).toBe(false);
    expect(result.current.session?.token).toBe('k2');
  });

  it("yopilgandan keyin so'ramaydi", async () => {
    const load = vi.fn(async () => sessionAt(Date.now(), 'k'));
    const { unmount } = renderHook(() => useCameraSession(load));
    await flush();
    unmount();
    await advance(600_000);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
