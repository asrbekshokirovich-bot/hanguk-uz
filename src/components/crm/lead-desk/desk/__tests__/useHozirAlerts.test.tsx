import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DeskRow } from '../../types';
import { deskRow } from './fixtures';

const warning = vi.fn();
const info = vi.fn();
vi.mock('sonner', () => ({ toast: { warning: (...a: unknown[]) => warning(...a), info: (...a: unknown[]) => info(...a) } }));

import { NOTIFY_STORAGE_KEY, SOUND_STORAGE_KEY, useHozirAlerts } from '../../hooks/useHozirAlerts';

const hozir = (id: string, extra: Partial<DeskRow> = {}) => deskRow({ id, bucket: 'hozir', full_name: `Lead ${id}`, ...extra });

// ---- browser stand-ins ------------------------------------------------------------

const notifications: { title: string; options?: NotificationOptions }[] = [];
class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = vi.fn(async (): Promise<NotificationPermission> => FakeNotification.permission);
  onclick: (() => void) | null = null;
  constructor(title: string, options?: NotificationOptions) {
    notifications.push({ title, options });
  }
  close() {}
}

const oscillators: { start: ReturnType<typeof vi.fn> }[] = [];
class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => undefined);
  createGain() {
    return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  }
  createOscillator() {
    const osc = { type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    oscillators.push(osc);
    return osc;
  }
}

beforeEach(() => {
  warning.mockClear();
  info.mockClear();
  notifications.length = 0;
  oscillators.length = 0;
  window.localStorage.clear();
  FakeNotification.permission = 'granted';
  FakeNotification.requestPermission = vi.fn(async (): Promise<NotificationPermission> => FakeNotification.permission);
  Object.defineProperty(window, 'Notification', { configurable: true, writable: true, value: FakeNotification });
  Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: FakeAudioContext });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useHozirAlerts', () => {
  it('stays silent on the first load, however many leads are already in HOZIR', () => {
    renderHook(({ rows }) => useHozirAlerts(rows), { initialProps: { rows: [hozir('a'), hozir('b')] as DeskRow[] | undefined } });
    expect(warning).not.toHaveBeenCalled();
    expect(notifications).toHaveLength(0);
  });

  it('does not count a failed or loading first fetch as the baseline', () => {
    const { rerender } = renderHook(({ rows }) => useHozirAlerts(rows), { initialProps: { rows: undefined as DeskRow[] | undefined } });
    rerender({ rows: [hozir('a')] }); // the first real data: still the baseline
    expect(warning).not.toHaveBeenCalled();
    rerender({ rows: [hozir('a'), hozir('b')] });
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('shows a toast, once, for a lead that newly appears in HOZIR', () => {
    const { rerender } = renderHook(({ rows }) => useHozirAlerts(rows), { initialProps: { rows: [hozir('a')] as DeskRow[] | undefined } });
    rerender({ rows: [hozir('a'), hozir('b')] });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0][0]).toBe('HOZIR: Lead b');

    // the same list again (a poll that found nothing new) must not repeat it
    rerender({ rows: [hozir('a'), hozir('b')] });
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('alerts when a lead moves up from BUGUN, not for one that stays in BUGUN', () => {
    const waiting = deskRow({ id: 'w', bucket: 'bugun', full_name: 'Waiting' });
    const { rerender } = renderHook(({ rows }) => useHozirAlerts(rows), { initialProps: { rows: [waiting] as DeskRow[] | undefined } });
    rerender({ rows: [deskRow({ id: 'x', bucket: 'bugun' }), waiting] });
    expect(warning).not.toHaveBeenCalled();
    rerender({ rows: [{ ...waiting, bucket: 'hozir' as const }] });
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('groups several new leads into one toast', () => {
    const { rerender } = renderHook(({ rows }) => useHozirAlerts(rows), { initialProps: { rows: [] as DeskRow[] | undefined } });
    rerender({ rows: [hozir('a'), hozir('b'), hozir('c'), hozir('d')] });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0][0]).toBe('HOZIR: 4 ta yangi lid');
  });

  it('adds a browser notification and a beep only when the operator switched them on', () => {
    const { rerender } = renderHook(({ rows }) => useHozirAlerts(rows), { initialProps: { rows: [] as DeskRow[] | undefined } });
    rerender({ rows: [hozir('a')] });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(notifications).toHaveLength(0);
    expect(oscillators).toHaveLength(0);

    window.localStorage.setItem(NOTIFY_STORAGE_KEY, '1');
    window.localStorage.setItem(SOUND_STORAGE_KEY, '1');
    const second = renderHook(({ rows }) => useHozirAlerts(rows), { initialProps: { rows: [] as DeskRow[] | undefined } });
    expect(second.result.current.notify).toBe(true);
    expect(second.result.current.sound).toBe(true);
    second.rerender({ rows: [hozir('b', { form_name: 'Hanbox 10-sent' })] });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('HOZIR: Lead b');
    expect(notifications[0].options?.body).toContain('Hanbox 10-sent');
    expect(oscillators.length).toBeGreaterThan(0);
    expect(oscillators[0].start).toHaveBeenCalled();
  });

  it('keeps the switches in localStorage', async () => {
    const { result } = renderHook(() => useHozirAlerts([]));
    expect(result.current.sound).toBe(false);

    act(() => result.current.setSound(true));
    expect(result.current.sound).toBe(true);
    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBe('1');

    await act(async () => {
      await result.current.setNotify(true);
    });
    expect(result.current.notify).toBe(true);
    expect(window.localStorage.getItem(NOTIFY_STORAGE_KEY)).toBe('1');

    await act(async () => {
      await result.current.setNotify(false);
    });
    expect(window.localStorage.getItem(NOTIFY_STORAGE_KEY)).toBe('0');
  });

  it('asks for the browser permission when the switch goes on, and stays off if it is refused', async () => {
    FakeNotification.permission = 'default';
    FakeNotification.requestPermission.mockImplementation(async () => 'denied');
    const { result } = renderHook(() => useHozirAlerts([]));
    await act(async () => {
      await result.current.setNotify(true);
    });
    expect(FakeNotification.requestPermission).toHaveBeenCalled();
    expect(result.current.notify).toBe(false);
    expect(info).toHaveBeenCalled();
  });

  it('never throws when Notification is unavailable', async () => {
    // simulating Safari iOS / an old browser
    delete (window as { Notification?: unknown }).Notification;
    window.localStorage.setItem(NOTIFY_STORAGE_KEY, '1');
    const { result, rerender } = renderHook(({ rows }) => useHozirAlerts(rows), { initialProps: { rows: [] as DeskRow[] | undefined } });
    expect(result.current.notificationsSupported).toBe(false);
    expect(result.current.notify).toBe(false); // a stored "on" does not count without the API
    expect(() => rerender({ rows: [hozir('a')] })).not.toThrow();
    expect(warning).toHaveBeenCalledTimes(1); // the toast still works

    await act(async () => {
      await result.current.setNotify(true);
    });
    expect(result.current.notify).toBe(false);
    expect(info).toHaveBeenCalled();
  });

  it('never throws when localStorage or the audio context is blocked', async () => {
    vi.resetModules(); // a fresh module has no cached audio context
    const fresh = await import('../../hooks/useHozirAlerts');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: function Broken() {
        throw new Error('no audio');
      },
    });
    const { result, rerender } = renderHook(({ rows }) => fresh.useHozirAlerts(rows), {
      initialProps: { rows: [] as DeskRow[] | undefined },
    });
    expect(result.current.notify).toBe(false);
    expect(() => act(() => result.current.setSound(true))).not.toThrow();
    expect(result.current.sound).toBe(true); // works for this visit even though nothing could be stored
    expect(() => rerender({ rows: [hozir('a')] })).not.toThrow();
    expect(warning).toHaveBeenCalledTimes(1);
  });
});

