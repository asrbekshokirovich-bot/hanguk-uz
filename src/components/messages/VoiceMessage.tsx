import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Mic, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceMessageProps {
  /** Storage path inside the private `chat-media` bucket. */
  mediaPath: string;
  /** Voice note length in seconds, when the channel reports it. */
  durationSeconds?: number | null;
}

const CHAT_MEDIA_BUCKET = 'chat-media';
const SIGNED_URL_TTL = 3600; // seconds

function formatDuration(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Plays a voice message that an inbox channel (Telegram / Instagram) delivered.
 * The bytes live in the private `chat-media` bucket, so we mint a short-lived
 * signed URL and hand it to a plain <audio> tag — no credentials leak into the
 * element and the link expires on its own.
 */
export function VoiceMessage({ mediaPath, durationSeconds }: VoiceMessageProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .createSignedUrl(mediaPath, SIGNED_URL_TTL)
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
  }, [mediaPath]);

  const duration = formatDuration(durationSeconds);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs py-1">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('messages.loadingAudio', 'Loading voice message…')}
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="flex items-center gap-2 text-xs py-1">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {t('messages.audioUnavailable', 'Voice message unavailable')}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <Mic className="h-4 w-4 shrink-0 opacity-80" />
      <audio controls preload="none" src={url} className="h-9 max-w-[240px]" />
      {duration && <span className="text-[10px] opacity-70 shrink-0 tabular-nums">{duration}</span>}
    </div>
  );
}
