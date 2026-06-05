import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RecordingPlayerProps {
  callId: string;
}

/**
 * Streams a Mediateka call recording from the `mediateka-recording` edge
 * function. The function requires the user's Supabase JWT and returns the
 * MP3 bytes — we wrap them in a blob: URL so a plain <audio> tag can play
 * them without leaking the upstream URL or the Mediateka API key into the
 * browser.
 */
export function RecordingPlayer({ callId }: RecordingPlayerProps) {
  const { t } = useTranslation();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setError(t('calls.recording.notSignedIn', 'Sign in required'));
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mediateka-recording?call_id=${encodeURIComponent(callId)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`${response.status} ${body || response.statusText}`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setAudioUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [callId, t]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('calls.recording.loading', 'Loading recording…')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span className="break-all">{error}</span>
      </div>
    );
  }

  if (!audioUrl) return null;

  return <audio controls preload="none" src={audioUrl} className="w-full" />;
}
