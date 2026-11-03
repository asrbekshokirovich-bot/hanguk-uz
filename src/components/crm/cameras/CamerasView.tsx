import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Cctv, Image as ImageIcon, Maximize, RefreshCw, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { liveUrl, type CameraInfo, type CameraSessionError } from '@/lib/cameraSession';
import type { CameraSessionState } from '@/hooks/useCameraSession';
import { CameraTile, type TileStatus } from './CameraTile';
import { LivePlayer } from './LivePlayer';
import type { PlayerState } from './hangukVideo';

type Mode = 'snapshots' | 'live';

interface CamerasViewProps {
  state: CameraSessionState;
  isOwner: boolean;
}

/** «Kameralar» sahifasi (ma'lumot useCameraSession'dan; sinov uchun alohida beriladi). */
export function CamerasView({ state, isOwner }: CamerasViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('snapshots');
  const [open, setOpen] = useState<CameraInfo | null>(null);
  const [hdState, setHdState] = useState<PlayerState>('connecting');
  const [statuses, setStatuses] = useState<Record<string, TileStatus>>({});
  const { session, error, loading, reload } = state;

  const onStatus = useCallback((id: string, s: TileStatus) => {
    setStatuses((prev) => (prev[id] === s ? prev : { ...prev, [id]: s }));
  }, []);

  const cameras = session?.cameras ?? [];
  const online = cameras.filter((c) => statuses[c.id] === 'online').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Cctv className="h-6 w-6" /> {t('crm.cameras.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session ? t('crm.cameras.countLine', { count: cameras.length, online }) : t('crm.cameras.subtitle')}
          </p>
        </div>
        {session && (
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as Mode)}
            className="rounded-lg border bg-card p-1"
            aria-label={t('crm.cameras.modeLabel')}
          >
            <ToggleGroupItem value="snapshots" className="gap-1.5 px-3 text-sm">
              <ImageIcon className="h-4 w-4" /> {t('crm.cameras.modeSnapshots')}
            </ToggleGroupItem>
            <ToggleGroupItem value="live" className="gap-1.5 px-3 text-sm">
              <Video className="h-4 w-4" /> {t('crm.cameras.modeLive')}
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      {loading && !session ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <ErrorCard error={error} isOwner={isOwner} onRetry={reload} onSettings={() => navigate('/crm/settings?tab=cameras')} />
      ) : session ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cameras.map((camera) => (
              <CameraTile
                key={camera.id}
                session={session}
                camera={camera}
                live={mode === 'live'}
                onOpen={(c) => {
                  setHdState('connecting');
                  setOpen(c);
                }}
                onStatus={onStatus}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('crm.cameras.footnote')}</p>
        </>
      ) : null}

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-5xl gap-0 overflow-hidden border-0 bg-black p-0 sm:rounded-xl [&>button]:z-10 [&>button]:rounded-md [&>button]:bg-black/60 [&>button]:p-1 [&>button]:text-white [&>button]:opacity-100">
          <DialogHeader className="sr-only">
            <DialogTitle>{open?.name}</DialogTitle>
            <DialogDescription>{t('crm.cameras.liveHd')}</DialogDescription>
          </DialogHeader>
          {open && session && (
            <div id="camera-hd" className="relative aspect-video w-full bg-black">
              <LivePlayer url={liveUrl(session, open.id, 'hd')} className="h-full w-full" onState={setHdState} />
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
                <span className="rounded-md bg-black/60 px-2 py-1 text-sm font-semibold text-white">{open.name}</span>
                {hdState === 'playing' ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
                    ● {t('crm.cameras.liveHd')}
                  </span>
                ) : (
                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white/90">
                    {hdState === 'offline'
                      ? t('crm.cameras.offline')
                      : hdState === 'reconnecting'
                        ? t('crm.cameras.reconnecting')
                        : t('crm.cameras.connecting')}
                  </span>
                )}
              </div>
              {hdState === 'offline' && (
                <span className="pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-sm font-medium text-white/90">
                  {t('crm.cameras.noSignal')}
                </span>
              )}
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <span className="rounded-md bg-black/60 px-2 py-1 text-xs text-white/80">{t('crm.cameras.noSound')}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1.5"
                  onClick={() => void document.getElementById('camera-hd')?.requestFullscreen?.().catch(() => {})}
                >
                  <Maximize className="h-4 w-4" /> {t('crm.cameras.fullscreen')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ErrorCard({
  error,
  isOwner,
  onRetry,
  onSettings,
}: {
  error: CameraSessionError;
  isOwner: boolean;
  onRetry: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  const text: Record<CameraSessionError, string> = {
    unauthorized: t('crm.cameras.errors.unauthorized'),
    forbidden: t('crm.cameras.errors.forbidden'),
    no_cameras: t('crm.cameras.errors.noCameras'),
    not_configured: t('crm.cameras.errors.notConfigured'),
    load_failed: t('crm.cameras.errors.loadFailed'),
  };
  const ownerHint =
    error === 'no_cameras'
      ? t('crm.cameras.errors.noCamerasOwner')
      : error === 'not_configured'
        ? t('crm.cameras.errors.notConfiguredOwner')
        : null;
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 p-6">
        <p className="font-medium">{text[error]}</p>
        {isOwner && ownerHint && <p className="text-sm text-muted-foreground">{ownerHint}</p>}
        <div className="flex flex-wrap gap-2">
          {error === 'load_failed' && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> {t('crm.cameras.retry')}
            </Button>
          )}
          {isOwner && error === 'no_cameras' && (
            <Button size="sm" onClick={onSettings}>
              {t('crm.cameras.openSettings')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
