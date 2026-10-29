import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMessages } from '@/hooks/useMessages';
import { useVoiceNotification } from '@/hooks/useVoiceNotification';
import { countWaiting, titleWithCount } from './inboxCounts';
import { notificationPermission, onAlertPrefsChange, readAlertPrefs } from './inboxAlertPrefs';
import { isMediaPlaceholder, mediaPreviewKey } from './media';
import { isHiddenMessage } from './hiddenMessages';

/** One chime per burst: a person sending five lines in a row is one event. */
const SOUND_GAP_MS = 4000;

/**
 * The inbox's voice. Mounted once for the whole CRM (CRMPortal), so a new
 * message is heard on every page, not only while Xabarlar is open — the gap
 * the 2026-10-29 audit found first: Telegram on the phone rang, the CRM sat
 * silent, and operators answered from the phone.
 *
 *   • a chime for every new incoming message from a lead conversation;
 *   • a browser notification when the CRM tab is in the background or the
 *     operator is on another page (click → that conversation);
 *   • "(N) …" in the tab title, N = conversations waiting for a reply.
 *
 * Nothing fires for the conversation the operator is looking at right now,
 * for staff / partner / service chats, or for hidden rows.
 */
export function InboxAlerts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { threads, selectedThread, onIncoming } = useMessages();
  const { playNotificationSound } = useVoiceNotification({ volume: 0.4 });

  const prefsRef = useRef(readAlertPrefs());
  const lastSoundRef = useRef(0);
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;
  const selectedRef = useRef(selectedThread);
  selectedRef.current = selectedThread;

  useEffect(() => onAlertPrefsChange((p) => (prefsRef.current = p)), []);

  // Tab title.
  const waiting = countWaiting(threads);
  useEffect(() => {
    document.title = titleWithCount(document.title, waiting);
  }, [waiting]);
  useEffect(
    () => () => {
      document.title = titleWithCount(document.title, 0);
    },
    [],
  );

  useEffect(
    () =>
      onIncoming((message, thread) => {
        if (message.source !== 'telegram' && message.source !== 'instagram') return;
        if (thread && thread.kind && thread.kind !== 'lead') return;
        if (isHiddenMessage(message)) return;

        const onInbox = locationRef.current.startsWith('/crm/messages');
        const sel = selectedRef.current;
        const looking =
          !document.hidden &&
          onInbox &&
          !!sel &&
          sel.source === message.source &&
          sel.sender_id === message.sender_id;
        if (looking) return;

        const prefs = prefsRef.current;
        const now = Date.now();
        if (prefs.sound && now - lastSoundRef.current > SOUND_GAP_MS) {
          lastSoundRef.current = now;
          playNotificationSound();
        }

        if (!prefs.desktop || (!document.hidden && onInbox)) return;
        if (notificationPermission() !== 'granted') return;
        const name = thread?.sender_name?.trim() || message.sender_name?.trim() || t('messages.alerts.newMessage');
        const key = mediaPreviewKey(String(message.message_type));
        const raw = (message.content ?? '').replace(/\s+/g, ' ').trim();
        const body = key && (!raw || isMediaPlaceholder(raw)) ? t(key) : raw.slice(0, 140);
        try {
          const n = new Notification(name, {
            body,
            tag: `${message.source}:${message.sender_id}`,
            icon: '/brand-mark.png',
          });
          n.onclick = () => {
            window.focus();
            if (thread) navigate(`/crm/messages?thread=${thread.id}`);
            else navigate('/crm/messages');
            n.close();
          };
        } catch {
          // Some browsers allow the API but refuse it outside a service worker.
        }
      }),
    [onIncoming, playNotificationSound, navigate, t],
  );

  return null;
}
