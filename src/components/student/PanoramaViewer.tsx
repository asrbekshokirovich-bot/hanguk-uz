import { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, Footprints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHDTiles, useDragInertia, useSmoothYaw, usePreloadNextPano, usePanoramaGL } from '@/hooks/usePanoramaEngine';
import { useIsMobile } from '@/hooks/use-mobile';

export interface PanoLink {
  id: number;
  lat: number;
  lng: number;
  angle: number;
}

interface PanoramaViewerProps {
  imagePath: string;
  streetName?: string;
  links?: PanoLink[];
  onNavigate?: (panoId: number) => void;
  navigationVersion?: number;
  heading?: number;
}

export function PanoramaViewer({ imagePath, streetName, links = [], onNavigate, navigationVersion = 0, heading = 0 }: PanoramaViewerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();

  // Issue 1: Refs are the source of truth for rendering; state is for UI overlays only
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const zoomRef = useRef(1);

  // Track whether initial yaw has been set for current imagePath
  const initialYawSetForRef = useRef<string>('');

  // React state for UI overlays (compass, arrows, step counter) — synced from refs
  const [yawState, setYawState] = useState(0);
  const [pitchState, setPitchState] = useState(0);
  const [zoomState, setZoomState] = useState(1);

  const [isDragging, setIsDragging] = useState(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const prevImagePathRef = useRef(imagePath);
  const travelYawRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number>(0);
  // Throttle ref for decay sync
  const lastDecaySyncRef = useRef(0);

  // Pinch-to-zoom state
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef<number | null>(null);

  // HD tile loading
  const { previewUrl, canvasRef: hdCanvasRef, imageLoaded, imageError, hdLoaded } = useHDTiles(imagePath);

  // Heading ref for WebGL renderer
  const headingRef = useRef(heading);
  headingRef.current = heading;

  // Issue 6+3: WebGL renderer with preview texture for instant rendering
  usePanoramaGL(glCanvasRef, hdCanvasRef, hdLoaded, yawRef, pitchRef, zoomRef, previewUrl, headingRef);

  // Sync refs → state for UI overlays (throttled)
  const syncToState = useCallback(() => {
    setYawState(yawRef.current);
    setPitchState(pitchRef.current);
    setZoomState(zoomRef.current);
  }, []);

  const getContainerWidth = useCallback(() => containerRef.current?.clientWidth || 800, []);
  const getContainerHeight = useCallback(() => containerRef.current?.clientHeight || 400, []);

  // Issue 4: FOV-based pxToDeg for WebGL projection
  const pxToDeg = useCallback((px: number) => {
    const cw = getContainerWidth();
    const z = zoomRef.current;
    return (px / cw) * (90 / z);
  }, [getContainerWidth]);

  const pxToDegRef = useRef(pxToDeg);
  pxToDegRef.current = pxToDeg;

  // Smooth yaw animation — now writes directly to yawRef
  const { animateToYaw, cancelAnimation } = useSmoothYaw(yawRef, syncToState);

  // Drag inertia — delta handlers write directly to refs
  const yawDeltaHandler = useCallback((delta: number) => {
    yawRef.current += delta;
  }, []);
  const pitchDeltaHandler = useCallback((delta: number) => {
    pitchRef.current = Math.max(-60, Math.min(60, pitchRef.current + delta));
  }, []);

  // Problem 8 fix: throttled decay frame sync callback
  const decayFrameSync = useCallback(() => {
    const now = performance.now();
    if (now - lastDecaySyncRef.current > 80) {
      lastDecaySyncRef.current = now;
      syncToState();
    }
  }, [syncToState]);

  const { recordVelocity, startDrag, endDrag, isDecayingRef } = useDragInertia(
    yawDeltaHandler, pitchDeltaHandler, pxToDegRef as React.RefObject<(px: number) => number>,
    decayFrameSync,
  );

  // Preload next panorama
  usePreloadNextPano(links, imagePath);

  // Problem 2 fix: Set initial yaw to face nearest link on load/navigation
  useEffect(() => {
    if (links.length > 0 && initialYawSetForRef.current !== imagePath) {
      if (travelYawRef.current !== null) {
        yawRef.current = travelYawRef.current;
        travelYawRef.current = null;
      } else {
        yawRef.current = links[0].angle;
      }
      initialYawSetForRef.current = imagePath;
      syncToState();
    }
  }, [links, imagePath, syncToState]);

  // Issue 7 + Problem 6: Handle imagePath changes — reset pitch AND yaw to link direction
  useEffect(() => {
    if (imagePath !== prevImagePathRef.current) {
      setIsTransitioning(true);
      setTimeout(() => setIsTransitioning(false), 300);
      setStepCount(prev => prev + 1);
      // Reset pitch to 0 for natural forward-looking view
      pitchRef.current = 0;
      // Reset initial yaw tracker so Problem 2 effect re-fires
      initialYawSetForRef.current = '';
      prevImagePathRef.current = imagePath;
      syncToState();
    }
    setNavigating(false);
  }, [imagePath, syncToState]);

  useEffect(() => {
    setNavigating(false);
  }, [navigationVersion]);

  useEffect(() => {
    if (!navigating) return;
    const timeout = setTimeout(() => setNavigating(false), 8000);
    return () => clearTimeout(timeout);
  }, [navigating]);

  const fov = 90 / zoomState;

  // Pointer handlers — Issue 1: write directly to refs, not state
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      setIsDragging(true);
      setHasInteracted(true);
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      cancelAnimation();
      startDrag();
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      lastPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  }, [startDrag, cancelAnimation]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (lastPinchDistRef.current !== null) {
        const delta = dist - lastPinchDistRef.current;
        zoomRef.current = Math.max(1, Math.min(3, zoomRef.current + delta * 0.005));
      }
      lastPinchDistRef.current = dist;
      return;
    }

    if (!isDragging) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };

    // Issue 1: Write directly to refs — zero-lag, rAF reads immediately
    const yawDelta = pxToDeg(dx);
    yawRef.current -= yawDelta;

    const ch = getContainerHeight();
    const z = zoomRef.current;
    const pitchDelta = (dy / ch) * (90 / z);
    pitchRef.current = Math.max(-60, Math.min(60, pitchRef.current - pitchDelta));

    recordVelocity(dx, dy);
  }, [isDragging, pxToDeg, recordVelocity, getContainerHeight]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    lastPinchDistRef.current = null;

    if (pointersRef.current.size === 0) {
      setIsDragging(false);
      endDrag();
      syncToState(); // Sync final position to state for UI
    }
  }, [endDrag, syncToState]);

  // Issue 5: Throttled sync during drag for arrow positions
  useEffect(() => {
    if (!isDragging) return;

    const interval = setInterval(() => {
      syncToState();
    }, 100);

    return () => clearInterval(interval);
  }, [isDragging, syncToState]);

  // Wheel with passive:false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current = Math.max(1, Math.min(3, zoomRef.current - e.deltaY * 0.002));
      syncToState();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [syncToState]);

  // Problem 9: Keyboard controls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const step = 5 / (zoomRef.current);
      let handled = true;
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
          yawRef.current -= step;
          break;
        case 'ArrowRight':
        case 'd':
          yawRef.current += step;
          break;
        case 'ArrowUp':
        case 'w':
          pitchRef.current = Math.max(-60, pitchRef.current + step);
          break;
        case 'ArrowDown':
        case 's':
          pitchRef.current = Math.min(60, pitchRef.current - step);
          break;
        case '+':
        case '=':
          zoomRef.current = Math.min(3, zoomRef.current + 0.15);
          break;
        case '-':
        case '_':
          zoomRef.current = Math.max(1, zoomRef.current - 0.15);
          break;
        case 'Enter':
        case ' ':
          // Walk forward to nearest visible link
          if (links.length > 0 && onNavigate && !navigating) {
            const currentYaw = yawRef.current;
            let nearest = links[0];
            let bestDiff = Infinity;
            links.forEach(l => {
              const diff = Math.abs(((l.angle - currentYaw + 540) % 360) - 180);
              if (diff < bestDiff) { bestDiff = diff; nearest = l; }
            });
            handleNavClick(nearest);
          }
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        syncToState();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [links, onNavigate, navigating, syncToState]);

  // Navigation
  const handleNavClick = useCallback((link: PanoLink) => {
    if (!onNavigate || navigating) return;
    setNavigating(true);
    travelYawRef.current = link.angle;
    onNavigate(link.id);
  }, [onNavigate, navigating]);

  // Double-click to walk toward clicked direction (disabled on mobile to prevent zoom conflicts)
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isMobile || !onNavigate || navigating || links.length === 0) return;
    cancelAnimation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickRelative = (clickX / rect.width - 0.5) * fov;
    const clickYaw = yawRef.current + clickRelative;

    let nearest = links[0];
    let bestDiff = Infinity;
    links.forEach(l => {
      const diff = Math.abs(((l.angle - clickYaw + 540) % 360) - 180);
      if (diff < bestDiff) { bestDiff = diff; nearest = l; }
    });

    if (bestDiff < 90) handleNavClick(nearest);
  }, [isMobile, onNavigate, navigating, links, fov, handleNavClick, cancelAnimation]);

  // Compass — reads from state (synced from refs)
  const compassDeg = ((yawState % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const dirIndex = Math.round(compassDeg / 45) % 8;

  const containerWidth = getContainerWidth();
  const suppressTransition = isDragging || isDecayingRef.current;

  // Classify links into visible, left, right
  const visibleLinks: (PanoLink & { relAngle: number; xOffset: number })[] = [];
  const leftIndicators: PanoLink[] = [];
  const rightIndicators: PanoLink[] = [];

  links.forEach(link => {
    const relAngle = ((link.angle - compassDeg + 540) % 360) - 180;
    if (Math.abs(relAngle) <= fov / 2) {
      const xOffset = (relAngle / fov) * containerWidth + containerWidth / 2;
      visibleLinks.push({ ...link, relAngle, xOffset });
    } else if (relAngle < -fov / 2) {
      leftIndicators.push(link);
    } else {
      rightIndicators.push(link);
    }
  });

  // WebGL texture ready indicator — show canvas when preview or HD is uploaded
  const glHasTexture = imageLoaded || hdLoaded;

  // Problem 5: Zoom level info
  const zoomPercent = Math.round(zoomState * 100);
  const isMinZoom = zoomState <= 1.05;
  const isMaxZoom = zoomState >= 2.95;

  if (imageError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 gap-2">
        <Compass className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('student.panoramaTilesUnavailable', 'Panorama tiles unavailable')}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden select-none bg-black touch-none"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      tabIndex={0}
    >
      {/* WebGL canvas — visible as soon as preview texture is uploaded */}
      <canvas
        ref={glCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          opacity: glHasTexture && !isTransitioning ? 1 : isTransitioning ? 0.3 : 0,
          transition: 'opacity 0.3s',
          pointerEvents: 'none',
        }}
      />

      {/* HD loading indicator */}
      {imageLoaded && !hdLoaded && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-background/70 backdrop-blur-sm rounded-full px-3 py-1 z-10 pointer-events-none">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('student.loadingHD', 'Loading HD…')}
          </span>
        </div>
      )}

      {/* Loading spinner */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Navigation transition overlay */}
      {navigating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      )}

      {/* Ground-perspective navigation arrows */}
      {imageLoaded && !navigating && visibleLinks.map(link => {
        const bottomPercent = 5 + (1 - Math.abs(link.relAngle) / (fov / 2)) * 30;
        return (
          <button
            key={link.id}
            className="absolute z-20 group pointer-events-auto p-4"
            style={{
              left: `${link.xOffset}px`,
              bottom: `${bottomPercent}%`,
              transform: 'translateX(-50%)',
            }}
            onClick={(e) => { e.stopPropagation(); handleNavClick(link); }}
            onPointerDown={(e) => e.stopPropagation()}
            title={t('student.walkThisDirection', 'Walk this direction')}
          >
            <div
              className="flex flex-col items-center"
              style={{
                transform: 'rotateX(45deg)',
                transformOrigin: 'bottom center',
              }}
            >
              <svg width="56" height="48" viewBox="0 0 56 48" className="drop-shadow-lg opacity-75 group-hover:opacity-100 group-hover:scale-110 transition-all duration-150">
                {/* Outer chevron */}
                <path
                  d="M28 4 L50 44 L28 34 L6 44 Z"
                  fill="rgba(255,255,255,0.9)"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1.5"
                />
                {/* Inner chevron accent */}
                <path
                  d="M28 12 L42 40 L28 32 L14 40 Z"
                  fill="rgba(80,150,255,0.6)"
                />
              </svg>
            </div>
          </button>
        );
      })}

      {/* Edge indicators for arrows outside FOV — Problem 1: full event isolation */}
      {imageLoaded && !navigating && leftIndicators.length > 0 && (
        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const nearest = leftIndicators.reduce((best, l) => {
              const diff = Math.abs(((l.angle - compassDeg + 540) % 360) - 180);
              const bestDiff = Math.abs(((best.angle - compassDeg + 540) % 360) - 180);
              return diff < bestDiff ? l : best;
            });
            animateToYaw(nearest.angle);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          title={t('student.moreDirectionsLeft', 'More directions to the left')}
        >
          <div className="flex items-center gap-1 bg-white/60 backdrop-blur-sm rounded-full px-2 py-1.5 hover:bg-white/80 transition-colors">
            <ChevronLeft className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-medium text-primary">{leftIndicators.length}</span>
          </div>
        </button>
      )}

      {imageLoaded && !navigating && rightIndicators.length > 0 && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const nearest = rightIndicators.reduce((best, l) => {
              const diff = Math.abs(((l.angle - compassDeg + 540) % 360) - 180);
              const bestDiff = Math.abs(((best.angle - compassDeg + 540) % 360) - 180);
              return diff < bestDiff ? l : best;
            });
            animateToYaw(nearest.angle);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          title={t('student.moreDirectionsRight', 'More directions to the right')}
        >
          <div className="flex items-center gap-1 bg-white/60 backdrop-blur-sm rounded-full px-2 py-1.5 hover:bg-white/80 transition-colors">
            <span className="text-[10px] font-medium text-primary">{rightIndicators.length}</span>
            <ChevronRight className="h-4 w-4 text-primary" />
          </div>
        </button>
      )}

      {/* Compass overlay */}
      <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 z-10 pointer-events-none">
        <Compass className="h-4 w-4 text-primary" style={{ transform: `rotate(${-compassDeg}deg)` }} />
        <span className="text-xs font-medium">{directions[dirIndex]}</span>
      </div>

      {/* Step counter */}
      {stepCount > 0 && (
        <div className="absolute top-14 left-3 bg-background/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 z-10 pointer-events-none">
          <Footprints className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">{t('student.stepsCount', '{{count}} steps', { count: stepCount })}</span>
        </div>
      )}

      {/* Zoom controls — Problem 5: zoom level indicator + disable at min/max */}
      <div className="absolute bottom-10 right-3 flex flex-col gap-1 z-10 items-center">
        <Button size="icon" variant="secondary"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm shadow-md"
          disabled={isMaxZoom}
          onClick={(e) => { e.stopPropagation(); zoomRef.current = Math.min(3, zoomRef.current + 0.3); syncToState(); }}
          onPointerDown={(e) => e.stopPropagation()}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        {zoomPercent !== 100 && (
          <span className="text-[10px] font-medium text-white bg-black/50 rounded px-1.5 py-0.5 shadow-md">
            {zoomPercent}%
          </span>
        )}
        <Button size="icon" variant="secondary"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm shadow-md"
          disabled={isMinZoom}
          onClick={(e) => { e.stopPropagation(); zoomRef.current = Math.max(1, zoomRef.current - 0.3); syncToState(); }}
          onPointerDown={(e) => e.stopPropagation()}>
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Street name */}
      {streetName && (
        <div className="absolute bottom-2 left-3 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 z-10 pointer-events-none">
          <p className="text-xs text-foreground">{streetName}</p>
        </div>
      )}

      {/* Attribution */}
      <div className="absolute bottom-2 right-2 bg-background/60 backdrop-blur-sm rounded px-2 py-0.5 z-10 pointer-events-none">
        <span className="text-[10px] text-muted-foreground">© Kakao</span>
      </div>

      {/* Drag hint */}
      {imageLoaded && !isDragging && !hasInteracted && !navigating && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
          <div className="bg-background/70 backdrop-blur-sm rounded-full px-4 py-2 text-xs text-muted-foreground animate-pulse">
            {t('student.dragToLookAround', '← Drag to look around →')}
          </div>
        </div>
      )}
    </div>
  );
}
