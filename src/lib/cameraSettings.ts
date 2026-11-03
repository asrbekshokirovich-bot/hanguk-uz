// CRM → Sozlamalar → Kameralar: tekshiruvlar (cameras jadvalidagi CHECK bilan bir xil).
import { CAMERA_ID_RE } from '@/lib/cameraSession';

export interface CameraRow {
  id: string;
  name: string;
  sort: number;
  enabled: boolean;
}

export interface CameraLogRow {
  id: number;
  user_id: string | null;
  camera_ids: string[];
  ip: string | null;
  created_at: string;
}

export type CameraFieldError = 'invalidId' | 'duplicate' | 'invalidName' | 'invalidSort';

export function normalizeCameraId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateNewCamera(id: string, name: string, existing: readonly string[]): CameraFieldError | null {
  if (!CAMERA_ID_RE.test(id)) return 'invalidId';
  if (existing.includes(id)) return 'duplicate';
  return validateName(name);
}

export function validateName(name: string): CameraFieldError | null {
  const n = name.trim();
  return n.length >= 1 && n.length <= 60 ? null : 'invalidName';
}

export function parseSort(raw: string): number | null {
  if (!/^-?\d{1,6}$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

/** Keyingi tartib raqami: oxirgisidan 1 ko'p. */
export function nextSort(rows: readonly CameraRow[]): number {
  return rows.reduce((m, r) => Math.max(m, r.sort), 0) + 1;
}

/** "03.11 15:42" — Toshkent vaqti. */
export function fmtLogTime(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')} ${get('hour')}:${get('minute')}`;
}
