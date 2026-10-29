/**
 * Per-browser alert preferences for the inbox. Stored in localStorage — they
 * are a convenience of this operator on this computer, nothing more — and
 * every access is guarded: storage can be blocked or throw.
 */
export interface InboxAlertPrefs {
  sound: boolean;
  desktop: boolean;
}

const KEY = 'hanguk-inbox-alerts';
const DEFAULTS: InboxAlertPrefs = { sound: true, desktop: true };
const EVENT = 'hanguk-inbox-alerts-changed';

export function readAlertPrefs(): InboxAlertPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<InboxAlertPrefs>;
    return {
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULTS.sound,
      desktop: typeof parsed.desktop === 'boolean' ? parsed.desktop : DEFAULTS.desktop,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeAlertPrefs(prefs: InboxAlertPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Blocked storage: the preference lasts for this page only.
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: prefs }));
  } catch {
    // Older browsers without CustomEvent: nothing listens anyway.
  }
}

export function onAlertPrefsChange(listener: (prefs: InboxAlertPrefs) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<InboxAlertPrefs>).detail ?? readAlertPrefs());
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** 'unsupported' where the Notification API does not exist (older Safari, in-app webviews). */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}
