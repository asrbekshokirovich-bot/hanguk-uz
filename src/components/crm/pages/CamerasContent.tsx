import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AlertTriangle, Camera as CameraIcon, RefreshCw, Video } from 'lucide-react';
import { useCameras, cameraBridgeUrl, type Camera } from '@/hooks/useCameras';

// Office camera surveillance.
//
// Live video is served by the on-prem bridge (go2rtc), not by Supabase — the
// Xiaomi C300/C301 have no RTSP/ONVIF, so the stream only exists once the
// bridge has re-served it. See camera-bridge/README.md. Recordings stay on
// the bridge's disk; what arrives here is event metadata only.

function LiveView({ camera, bridge }: { camera: Camera; bridge: string }) {
  const { t } = useTranslation();

  if (!bridge) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
        <Video className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">
          {t('cameras.bridgeMissing', { defaultValue: 'Kamera ko‘prigi sozlanmagan' })}
        </p>
        <p className="max-w-md text-xs text-muted-foreground">
          {t('cameras.bridgeMissingHint', {
            defaultValue:
              'VITE_CAMERA_BRIDGE_URL ni ofisdagi ko‘prik manziliga sozlang (masalan http://192.168.1.50:1984).',
          })}
        </p>
      </div>
    );
  }

  // go2rtc's own player handles WebRTC negotiation and falls back to MSE on
  // its own, which is a lot more robust than hand-rolling RTCPeerConnection
  // against a stream that may still be waking up from P2P.
  return (
    <iframe
      title={camera.name}
      src={`${bridge}/stream.html?src=${encodeURIComponent(camera.stream_key)}&mode=webrtc`}
      className="aspect-video w-full rounded-lg border border-border bg-black"
      allow="autoplay; fullscreen"
    />
  );
}

export default function CamerasContent() {
  const { t } = useTranslation();
  const { cameras, events, loading, error, refetch } = useCameras();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const bridge = cameraBridgeUrl();

  useEffect(() => {
    if (!selectedId && cameras.length) setSelectedId(cameras[0].id);
  }, [cameras, selectedId]);

  const selected = cameras.find((c) => c.id === selectedId) || null;
  const visibleEvents = selected ? events.filter((e) => e.camera_id === selected.id) : events;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="aspect-video w-full max-w-3xl rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="flex items-start gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {t('cameras.loadFailed', { defaultValue: 'Kameralarni yuklab bo‘lmadi' })}
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t('common.retry', { defaultValue: 'Qayta urinish' })}
          </Button>
        </div>
      </Card>
    );
  }

  if (!cameras.length) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <CameraIcon className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-semibold text-foreground">
          {t('cameras.none', { defaultValue: 'Hech qanday kamera qo‘shilmagan' })}
        </p>
        <p className="max-w-md text-xs text-muted-foreground">
          {t('cameras.noneHint', {
            defaultValue:
              'Ofisdagi ko‘prikni ishga tushiring va cameras jadvaliga kamera qo‘shing — camera-bridge/README.md ga qarang.',
          })}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {cameras.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {cameras.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={c.id === selectedId ? 'default' : 'outline'}
              onClick={() => setSelectedId(c.id)}
            >
              <CameraIcon className="mr-1.5 h-3.5 w-3.5" />
              {c.name}
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="p-3">
          {selected && <LiveView camera={selected} bridge={bridge} />}
          {selected && (
            <div className="mt-2 flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                {selected.location && (
                  <p className="text-xs text-muted-foreground">{selected.location}</p>
                )}
              </div>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                {t('cameras.live', { defaultValue: 'Jonli' })}
              </span>
            </div>
          )}
        </Card>

        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">
              {t('cameras.events', { defaultValue: 'Hodisalar' })}
            </p>
            <Button size="sm" variant="ghost" onClick={refetch}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {visibleEvents.length === 0 ? (
            <div className="space-y-1 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                {t('cameras.noEvents', { defaultValue: 'Hodisalar yo‘q' })}
              </p>
              <p className="mx-auto max-w-xs text-[11px] text-muted-foreground/70">
                {t('cameras.noEventsHint', {
                  defaultValue:
                    'Aniqlash (detection) hali yoqilmagan. Yozib olish ishlayapti — yozuvlar ofisdagi diskda saqlanadi.',
                })}
              </p>
            </div>
          ) : (
            <div className="max-h-[28rem] space-y-1.5 overflow-y-auto">
              {visibleEvents.map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    'rounded-lg border border-border px-2.5 py-2',
                    e.ai_summary && 'bg-muted/40',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {e.label || t('cameras.motion', { defaultValue: 'Harakat' })}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {new Date(e.started_at).toLocaleString()}
                    </span>
                  </div>
                  {e.ai_summary && (
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      {e.ai_summary}
                    </p>
                  )}
                  {e.clip_path && (
                    <p className="mt-1 truncate text-[10px] text-muted-foreground/60" title={e.clip_path}>
                      {e.clip_path}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
