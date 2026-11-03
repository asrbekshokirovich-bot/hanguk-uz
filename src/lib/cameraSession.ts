// Ofis kameralari: camera-session kaliti va camera-gate manzillari (docs/kameralar.md).
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionErrorMessage } from '@/lib/edgeFunctionError';

export interface CameraInfo {
  id: string;
  name: string;
}

/** camera-session javobi. */
export interface CameraSession {
  gate: string;
  token: string;
  expires_at: string;
  ttl: number;
  cameras: CameraInfo[];
}

export type CameraQuality = 'sd' | 'hd';

/** camera-session xato kodlari (body.error). Boshqasi — 'load_failed'. */
export type CameraSessionError = 'unauthorized' | 'forbidden' | 'no_cameras' | 'not_configured' | 'load_failed';

const KNOWN_ERRORS: CameraSessionError[] = ['unauthorized', 'forbidden', 'no_cameras', 'not_configured'];

/** Kamera nomi (id): camera-gate va cameras jadvali bilan bir xil qoida. */
export const CAMERA_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** Rasm yangilanish oralig'i. */
export const SNAPSHOT_INTERVAL_MS = 10_000;

export function isCameraSession(value: unknown): value is CameraSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.gate === 'string' &&
    /^https?:\/\/[^/\s]+$/.test(v.gate) &&
    typeof v.token === 'string' &&
    typeof v.expires_at === 'string' &&
    !Number.isNaN(Date.parse(v.expires_at)) &&
    Array.isArray(v.cameras) &&
    v.cameras.every(
      (c) => c && typeof c === 'object' && CAMERA_ID_RE.test(String((c as CameraInfo).id)) && typeof (c as CameraInfo).name === 'string',
    )
  );
}

export function toSessionError(detail: string): CameraSessionError {
  return (KNOWN_ERRORS as string[]).includes(detail) ? (detail as CameraSessionError) : 'load_failed';
}

export async function fetchCameraSession(): Promise<CameraSession> {
  const { data, error } = await supabase.functions.invoke('camera-session', { method: 'POST', body: {} });
  if (error) {
    // 401 ni Supabase shlyuzi ham qaytaradi (verify_jwt: "Invalid JWT") — body'da bizning kod bo'lmaydi.
    if ((error as { context?: { status?: unknown } }).context?.status === 401) {
      throw new CameraSessionLoadError('unauthorized');
    }
    throw new CameraSessionLoadError(toSessionError(await edgeFunctionErrorMessage(error, 'load_failed')));
  }
  if (!isCameraSession(data)) throw new CameraSessionLoadError('load_failed');
  return data;
}

export class CameraSessionLoadError extends Error {
  constructor(readonly code: CameraSessionError) {
    super(code);
    this.name = 'CameraSessionLoadError';
  }
}

/** Rasm manzili. `bust` — brauzer eski rasmni ko'rsatmasligi uchun (gate uni e'tiborsiz qoldiradi). */
export function snapshotUrl(session: CameraSession, cameraId: string, bust: number, quality: CameraQuality = 'sd'): string {
  const q = new URLSearchParams({ src: cameraId, q: quality, t: session.token, _: String(bust) });
  return `${session.gate}/api/frame.jpeg?${q}`;
}

/** Jonli video (go2rtc WebSocket API) manzili. */
export function liveUrl(session: CameraSession, cameraId: string, quality: CameraQuality): string {
  const q = new URLSearchParams({ src: cameraId, q: quality, t: session.token });
  return `${session.gate.replace(/^http/, 'ws')}/api/ws?${q}`;
}

/**
 * Kalitni qachon yangilash kerak: muddat tugashidan 60 s oldin (5 daqiqalik kalit — 4 daqiqada),
 * kamida 15 s keyin.
 */
export function refreshDelayMs(expiresAt: string, nowMs: number): number {
  const left = Date.parse(expiresAt) - nowMs;
  return Math.max(15_000, left - 60_000);
}

/** Kalit muddati tugashiga 60 s dan kam qolganmi (tab qayta ochilganda darrov yangilash uchun). */
export function isExpiring(expiresAt: string, nowMs: number): boolean {
  return Date.parse(expiresAt) - nowMs < 60_000;
}

/** "15:42:10" — Toshkent vaqti. */
export function fmtClock(ms: number): string {
  return new Intl.DateTimeFormat('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}
