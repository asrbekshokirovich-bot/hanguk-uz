import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  fmtClock,
  liveUrl,
  snapshotUrl,
  SNAPSHOT_INTERVAL_MS,
  type CameraInfo,
  type CameraSession,
} from '@/lib/cameraSession';
import { LivePlayer } from './LivePlayer';
import type { PlayerState } from './hangukVideo';

export type TileStatus = 'loading' | 'online' | 'offline';

interface CameraTileProps {
  session: CameraSession;
  camera: CameraInfo;
  /** «Hammasi jonli»: rasm o'rnida kichik oqim (SD). */
  live: boolean;
  onOpen: (camera: CameraInfo) => void;
  onStatus?: (cameraId: string, status: TileStatus) => void;
}

/** Bitta kamera kartasi: har 10 soniyada rasm (yoki jonli SD), bosilsa HD oynasi ochiladi. */
export function CameraTile({ session, camera, live, onOpen, onStatus }: CameraTileProps) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<TileStatus>('loading');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [liveState, setLiveState] = useState<PlayerState>('connecting');
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Rasm: oldingisi kelgandan keyin 10 s kutib keyingisi so'raladi (sekin kamerada so'rovlar to'planmaydi).
  // Yangi rasm to'liq yuklangach almashtiriladi — miltillamaydi. Tab yashirin bo'lsa so'ralmaydi.
  useEffect(() => {
    if (live) return;
    let cancelled = false;
    let timer: number | undefined;
    const next = (ms: number) => {
      timer = window.setTimeout(tick, ms);
    };
    const tick = () => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') return next(2000);
      const url = snapshotUrl(sessionRef.current, camera.id, Date.now());
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setSrc(url);
        setStatus('online');
        setUpdatedAt(Date.now());
        next(SNAPSHOT_INTERVAL_MS);
      };
      img.onerror = () => {
        if (cancelled) return;
        setStatus('offline');
        next(SNAPSHOT_INTERVAL_MS);
      };
      img.src = url;
    };
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [camera.id, live]);

  const effective: TileStatus = live
    ? liveState === 'playing'
      ? 'online'
      : liveState === 'offline'
        ? 'offline'
        : 'loading'
    : status;
  useEffect(() => {
    onStatus?.(camera.id, effective);
  }, [camera.id, effective, onStatus]);

  const statusText =
    effective === 'online'
      ? live
        ? t('crm.cameras.live')
        : `${t('crm.cameras.online')}${updatedAt ? ` · ${fmtClock(updatedAt)}` : ''}`
      : effective === 'offline'
        ? t('crm.cameras.offline')
        : t('crm.cameras.connecting');

  return (
    <button
      type="button"
      onClick={() => onOpen(camera)}
      className="group block w-full overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t('crm.cameras.openLive', { name: camera.name })}
    >
      <div className="relative aspect-video bg-black">
        {live ? (
          <LivePlayer url={liveUrl(session, camera.id, 'sd')} className="h-full w-full" onState={setLiveState} />
        ) : src ? (
          <img
            src={src}
            alt={camera.name}
            className={cn('h-full w-full object-cover', status === 'offline' && 'opacity-40 grayscale')}
          />
        ) : status === 'offline' ? null : (
          <Skeleton className="h-full w-full rounded-none" />
        )}
        {live && liveState === 'playing' && (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
            ● {t('crm.cameras.live')}
          </span>
        )}
        {effective === 'offline' && (
          <span className="absolute inset-0 grid place-items-center px-4 text-center text-sm font-medium text-white/90">
            {t('crm.cameras.noSignal')}
          </span>
        )}
        <span className="absolute right-2 top-2 rounded-md bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="h-4 w-4" />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
        <span className="truncate font-medium">{camera.name}</span>
        <span
          className={cn(
            'shrink-0 text-xs tabular-nums',
            effective === 'online' ? 'text-success' : effective === 'offline' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {statusText}
        </span>
      </div>
    </button>
  );
}
