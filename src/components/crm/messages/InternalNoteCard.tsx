import { useTranslation } from 'react-i18next';
import type { MessageVM } from './types';

/**
 * Internal note — amber, dashed, centred, and explicitly labelled "not sent to
 * student". The visual language is deliberately unlike a message bubble: an
 * operator scanning the stream must never mistake a note for something the
 * student can read.
 */
export function InternalNoteCard({ message: m }: { message: MessageVM }) {
  const { t, i18n } = useTranslation();
  const time = new Date(m.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[600px] rounded-lg border border-dashed border-warning bg-warning/10 px-3.5 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-warning">
          {t('messages.thread.internalNoteLabel')}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.5] text-foreground/75">{m.text}</p>
        <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
          {[m.senderLabel, time].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  );
}
