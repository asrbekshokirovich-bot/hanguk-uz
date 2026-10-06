import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { detectNewHozir, displayName, hozirIds, sourceText } from '../desk/deskModel';
import type { DeskRow } from '../types';

/**
 * Alerts for a lead that NEWLY appears in HOZIR (spec §4: "brauzer
 * bildirishnomasi + ovoz, operator yoqib qo'ygan bo'lsa").
 *
 * - An in-page toast always shows.
 * - A browser `Notification` and a short beep are the operator's choice; both
 *   switches live in localStorage (read and written inside try/catch: storage
 *   can be blocked) and default to off.
 * - "Newly" means: not in HOZIR at the previous refresh. The first load is the
 *   baseline and never alerts, so opening the desk does not ring for what is
 *   already there.
 * - Nothing here may throw: no `Notification` (Safari iOS, old browsers), a
 *   suspended audio context or a denied permission just means that one channel
 *   stays silent.
 */
export const NOTIFY_STORAGE_KEY = 'lead-desk:alert-notification';
export const SOUND_STORAGE_KEY = 'lead-desk:alert-sound';

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    window.localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* storage blocked: the switch still works for this visit */
  }
}

/** The browser's Notification API, or null where there is none (Safari iOS, old browsers). */
function notificationApi(): typeof Notification | null {
  try {
    return typeof window !== 'undefined' && typeof window.Notification === 'function' ? window.Notification : null;
  } catch {
    return null;
  }
}

export const notificationsSupported = (): boolean => notificationApi() !== null;

// ---- the beep -------------------------------------------------------------------

let audio: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    if (audio && audio.state !== 'closed') return audio;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audio = new Ctor();
    return audio;
  } catch {
    return null;
  }
}

/**
 * A short two-tone beep from the Web Audio API (no sound file to ship). Browsers
 * only let audio start after the page has had a click, so the sound switch calls
 * this once when it is turned on.
 */
export function playBeep(): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const start = ctx.currentTime;
    for (const [i, hz] of [880, 1175].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + i * 0.18;
      osc.type = 'sine';
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.18);
    }
  } catch {
    /* silent */
  }
}

// ---- the announcement --------------------------------------------------------------

const describe = (row: DeskRow) => [sourceText(row), row.phone ? 'telefon bor' : "telefon yo'q"].filter(Boolean).join(' · ');

function showNotification(rows: DeskRow[], onOpen?: (id: string) => void) {
  try {
    const Api = notificationApi();
    if (!Api || Api.permission !== 'granted') return;
    const first = rows[0];
    const title = rows.length === 1 ? `HOZIR: ${displayName(first)}` : `HOZIR: ${rows.length} ta yangi lid`;
    const body = rows.length === 1 ? describe(first) : rows.map(displayName).join(', ');
    const n = new Api(title, { body, tag: rows.length === 1 ? `lead-hozir-${first.id}` : 'lead-hozir' });
    n.onclick = () => {
      try {
        window.focus();
        if (rows.length === 1) onOpen?.(first.id);
        n.close();
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* some browsers (Android Chrome) refuse `new Notification` */
  }
}

function showToast(rows: DeskRow[], onOpen?: (id: string) => void) {
  const first = rows[0];
  const action = onOpen ? { label: 'Ochish', onClick: () => onOpen(first.id) } : undefined;
  if (rows.length === 1) {
    toast.warning(`HOZIR: ${displayName(first)}`, {
      id: `hozir-${first.id}`,
      description: `${describe(first)} — 10 daqiqa ichida javob bering`,
      duration: 15_000,
      action,
    });
    return;
  }
  const shown = rows.slice(0, 3).map(displayName).join(', ');
  toast.warning(`HOZIR: ${rows.length} ta yangi lid`, {
    description: rows.length > 3 ? `${shown} va yana ${rows.length - 3} ta` : shown,
    duration: 15_000,
    action,
  });
}

export function useHozirAlerts(rows: readonly DeskRow[] | undefined, options: { onOpen?: (leadId: string) => void } = {}) {
  // "On" only counts while the browser still allows it (permission can be revoked later).
  const [notify, setNotifyState] = useState<boolean>(
    () => readFlag(NOTIFY_STORAGE_KEY) && notificationApi()?.permission === 'granted',
  );
  const [sound, setSoundState] = useState<boolean>(() => readFlag(SOUND_STORAGE_KEY));

  // The effect below must not re-run (and re-alert) when a switch or callback changes.
  const live = useRef({ notify, sound, onOpen: options.onOpen });
  live.current = { notify, sound, onOpen: options.onOpen };

  const previous = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!rows) return; // loading or failed: no baseline yet
    const fresh = detectNewHozir(previous.current, rows);
    previous.current = hozirIds(rows);
    if (fresh.length === 0) return;

    const { notify: wantNotification, sound: wantSound, onOpen } = live.current;
    showToast(fresh, onOpen);
    if (wantNotification) showNotification(fresh, onOpen);
    if (wantSound) playBeep();
  }, [rows]);

  const setNotify = useCallback(async (on: boolean) => {
    if (!on) {
      writeFlag(NOTIFY_STORAGE_KEY, false);
      setNotifyState(false);
      return;
    }
    const Api = notificationApi();
    if (!Api) {
      toast.info('Bu brauzer bildirishnomalarni qo‘llab-quvvatlamaydi');
      return;
    }
    let permission: NotificationPermission = Api.permission;
    if (permission === 'default') {
      try {
        permission = await Api.requestPermission();
      } catch {
        permission = 'denied';
      }
    }
    if (permission !== 'granted') {
      toast.info('Bildirishnomaga ruxsat berilmadi. Brauzer sozlamalarida saytga ruxsat bering.');
      return;
    }
    writeFlag(NOTIFY_STORAGE_KEY, true);
    setNotifyState(true);
  }, []);

  const setSound = useCallback((on: boolean) => {
    writeFlag(SOUND_STORAGE_KEY, on);
    setSoundState(on);
    if (on) playBeep(); // a click is the moment the browser lets audio start
  }, []);

  return { notify, sound, setNotify, setSound, notificationsSupported: notificationsSupported() };
}

