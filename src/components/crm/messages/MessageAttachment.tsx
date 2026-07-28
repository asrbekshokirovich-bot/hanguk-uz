import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Download, FileText, Loader2, Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { VoiceMessage } from '@/components/messages/VoiceMessage';
import { cn } from '@/lib/utils';
import { formatBytes, type MessageMedia } from './media';

const CHAT_MEDIA_BUCKET = 'chat-media';
const SIGNED_URL_TTL = 3600;

/**
 * Resolves an attachment to something the browser can load.
 *
 * Telegram media lives in the private `chat-media` bucket, so it needs a
 * short-lived signed URL. Instagram media is already a public CDN link and is
 * used as-is.
 */
function useMediaUrl(media: MessageMedia) {
  const [url, setUrl] = useState<string | null>(media.remoteUrl);
  const [loading, setLoading] = useState(!media.remoteUrl && !!media.storagePath);
  const [error, setError] = useState(!media.remoteUrl && !media.storagePath);

  useEffect(() => {
    if (media.remoteUrl) {
      setUrl(media.remoteUrl);
      setLoading(false);
      setError(false);
      return;
    }
    if (!media.storagePath) {
      setUrl(null);
      setLoading(false);
      setError(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .createSignedUrl(media.storagePath, SIGNED_URL_TTL)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err || !data?.signedUrl) {
          setError(true);
        } else {
          setUrl(data.signedUrl);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [media.remoteUrl, media.storagePath]);

  return { url, loading, error };
}

interface MessageAttachmentProps {
  media: MessageMedia;
  /** Outbound bubbles are on a filled primary background. */
  onPrimary: boolean;
}

/**
 * Renders a voice note, image or file attachment inside a message bubble.
 *
 * Voice notes reuse the existing `VoiceMessage` player when the audio is in
 * storage; Instagram audio arrives as a plain URL and gets a bare <audio>
 * element instead.
 */
export function MessageAttachment({ media, onPrimary }: MessageAttachmentProps) {
  if (media.kind === 'voice' && media.storagePath) {
    return (
      <div className={cn(onPrimary && 'text-primary-foreground')}>
        <VoiceMessage mediaPath={media.storagePath} durationSeconds={media.durationSeconds} />
      </div>
    );
  }
  return <ResolvedAttachment media={media} onPrimary={onPrimary} />;
}

function ResolvedAttachment({ media, onPrimary }: MessageAttachmentProps) {
  const { t } = useTranslation();
  const { url, loading, error } = useMediaUrl(media);
  const muted = onPrimary ? 'text-primary-foreground/80' : 'text-muted-foreground';

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 py-1 text-xs', muted)}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t('messages.media.loading')}
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={cn('flex items-center gap-2 py-1 text-xs', muted)}>
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t('messages.media.unavailable')}
      </div>
    );
  }

  if (media.kind === 'voice') {
    return (
      <div className="flex min-w-[200px] items-center gap-2">
        <Mic className={cn('h-4 w-4 shrink-0', muted)} aria-hidden="true" />
        <audio controls preload="none" src={url} className="h-9 max-w-[240px]" />
      </div>
    );
  }

  if (media.kind === 'image') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src={url}
          alt={media.filename ?? t('messages.media.image')}
          loading="lazy"
          className="max-h-[280px] w-auto max-w-full rounded-md object-cover"
        />
      </a>
    );
  }

  const size = formatBytes(media.sizeBytes);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={media.filename ?? undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md border px-3 py-2 transition-colors',
        onPrimary
          ? 'border-primary-foreground/25 hover:bg-primary-foreground/10'
          : 'border-border hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <FileText className={cn('h-5 w-5 shrink-0', muted)} aria-hidden="true" />
      <span className="min-w-0">
        <span
          className={cn(
            'block truncate text-[13px] font-medium',
            onPrimary ? 'text-primary-foreground' : 'text-foreground',
          )}
        >
          {media.filename ?? t('messages.media.file')}
        </span>
        {size && <span className={cn('block text-[11px]', muted)}>{size}</span>}
      </span>
      <Download className={cn('ml-auto h-4 w-4 shrink-0', muted)} aria-hidden="true" />
    </a>
  );
}
