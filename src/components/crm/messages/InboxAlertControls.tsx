import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  notificationPermission,
  onAlertPrefsChange,
  readAlertPrefs,
  writeAlertPrefs,
  type InboxAlertPrefs,
} from './inboxAlertPrefs';

/**
 * Two small switches above the inbox: the chime, and browser notifications.
 * The first click on the bell asks the browser for permission; a refusal is
 * the browser's to undo, so the control then says so instead of pretending.
 */
export function InboxAlertControls() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<InboxAlertPrefs>(() => readAlertPrefs());
  const [permission, setPermission] = useState(() => notificationPermission());

  useEffect(() => onAlertPrefsChange(setPrefs), []);

  const update = (next: InboxAlertPrefs) => {
    setPrefs(next);
    writeAlertPrefs(next);
  };

  const toggleDesktop = async () => {
    if (permission === 'unsupported') return;
    if (permission === 'default') {
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') update({ ...prefs, desktop: true });
      } catch {
        setPermission(notificationPermission());
      }
      return;
    }
    if (permission === 'granted') update({ ...prefs, desktop: !prefs.desktop });
  };

  const desktopOn = permission === 'granted' && prefs.desktop;
  const desktopLabel =
    permission === 'unsupported'
      ? t('messages.alerts.desktopUnsupported')
      : permission === 'denied'
        ? t('messages.alerts.desktopDenied')
        : permission === 'default'
          ? t('messages.alerts.desktopEnable')
          : desktopOn
            ? t('messages.alerts.desktopOn')
            : t('messages.alerts.desktopOff');

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => update({ ...prefs, sound: !prefs.sound })}
        aria-pressed={prefs.sound}
        title={prefs.sound ? t('messages.alerts.soundOn') : t('messages.alerts.soundOff')}
        className={chip(prefs.sound)}
      >
        {prefs.sound ? <Volume2 className="h-3.5 w-3.5" aria-hidden /> : <VolumeX className="h-3.5 w-3.5" aria-hidden />}
        <span>{prefs.sound ? t('messages.alerts.soundOn') : t('messages.alerts.soundOff')}</span>
      </button>
      <button
        type="button"
        onClick={() => void toggleDesktop()}
        aria-pressed={desktopOn}
        disabled={permission === 'unsupported' || permission === 'denied'}
        title={desktopLabel}
        className={cn(chip(desktopOn), permission === 'default' && 'border-accent bg-accent/15 text-foreground')}
      >
        {desktopOn ? <Bell className="h-3.5 w-3.5" aria-hidden /> : <BellOff className="h-3.5 w-3.5" aria-hidden />}
        <span>{desktopLabel}</span>
      </button>
    </div>
  );
}

function chip(on: boolean) {
  return cn(
    'flex h-7 min-h-0 items-center gap-1.5 rounded-pill border px-2.5 text-[11.5px] font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
    on ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted',
  );
}
