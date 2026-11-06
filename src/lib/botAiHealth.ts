/**
 * CRM «AI holati» (xodim boti, reja B0-5) uchun sof yordamchilar.
 * Baza: bot_ai_health(p_hours) — migratsiya 20261106060000_staff_bot_ai_layer.sql.
 * Har urinish (qayta urinish ham) alohida qator; narx faqat Claude (Gemini — bepul tarif, null).
 */

export interface AiHealthRow {
  purpose: string;
  provider: string;
  calls: number;
  errors: number;
  avg_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
}

export interface AiHealth {
  hours: number;
  calls: number;
  errors: number;
  avg_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  rows: AiHealthRow[];
  /** pending — hozir navbatda; failed/done — shu davrda yakunlangan. */
  jobs: { pending: number; failed: number; done: number };
  last_error: { at: string; purpose: string; provider: string; status: number | null; error: string | null } | null;
}

/** Ogohlantirish chegaralari — staff-bot/aiops.ts bilan bir xil. */
export const ALERT_MIN_CALLS = 5;
export const ALERT_ERROR_RATE = 0.2;

const TZ_OFFSET_MS = 5 * 60 * 60_000; // Asia/Tashkent, DST yo'q

const int = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** RPC javobini xavfsiz shaklga keltirish (yo'q maydon — 0 / null). */
export function normalizeHealth(raw: unknown): AiHealth | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const jobs = (r.jobs ?? {}) as Record<string, unknown>;
  const le = r.last_error as Record<string, unknown> | null | undefined;
  return {
    hours: int(r.hours) || 24,
    calls: int(r.calls),
    errors: int(r.errors),
    avg_ms: numOrNull(r.avg_ms),
    input_tokens: int(r.input_tokens),
    output_tokens: int(r.output_tokens),
    cost_usd: int(r.cost_usd),
    rows: (Array.isArray(r.rows) ? r.rows : []).map((x: Record<string, unknown>) => ({
      purpose: String(x.purpose ?? ''),
      provider: String(x.provider ?? ''),
      calls: int(x.calls),
      errors: int(x.errors),
      avg_ms: numOrNull(x.avg_ms),
      input_tokens: int(x.input_tokens),
      output_tokens: int(x.output_tokens),
      cost_usd: numOrNull(x.cost_usd),
    })),
    jobs: { pending: int(jobs.pending), failed: int(jobs.failed), done: int(jobs.done) },
    last_error: le && typeof le === 'object'
      ? {
        at: String(le.at ?? ''),
        purpose: String(le.purpose ?? ''),
        provider: String(le.provider ?? ''),
        status: numOrNull(le.status),
        error: le.error === null || le.error === undefined ? null : String(le.error),
      }
      : null,
  };
}

/** Xato foizi (butun) yoki null — chaqiruv yo'q. */
export function errorPct(calls: number, errors: number): number | null {
  return calls > 0 ? Math.round((100 * errors) / calls) : null;
}

/**
 * Umumiy holat: bad — xato >= 20% (kamida 5 chaqiruv) yoki bajarilmagan ish bor;
 * warn — xato yoki navbatda ish bor; ok — chaqiruvlar xatosiz; idle — chaqiruv yo'q.
 */
export function healthLevel(h: Pick<AiHealth, 'calls' | 'errors' | 'jobs'> | null): 'ok' | 'warn' | 'bad' | 'idle' {
  if (!h) return 'idle';
  if (h.jobs.failed > 0 || (h.calls >= ALERT_MIN_CALLS && h.errors / h.calls >= ALERT_ERROR_RATE)) return 'bad';
  if (h.errors > 0 || h.jobs.pending > 0) return 'warn';
  return h.calls > 0 ? 'ok' : 'idle';
}

/** USD: 0 → «$0»; 1 dan katta — 2 xona, 0,01 dan katta — 3 xona, kichigi — 2 ta ma'noli raqam. */
export function fmtUsd(v: number | null | undefined, locale = 'en'): string {
  const x = typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
  if (x === 0) return '$0';
  const opts: Intl.NumberFormatOptions = x >= 1
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : x >= 0.01
      ? { maximumFractionDigits: 3 }
      : { maximumSignificantDigits: 2 };
  return '$' + new Intl.NumberFormat(locale, opts).format(x);
}

/** Token soni: 950 → «950», 12 300 → «12.3K», 2 100 000 → «2.1M». */
export function fmtTokens(n: number | null | undefined): string {
  const x = typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
  if (x >= 1_000_000) return `${+(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000) return `${+(x / 1_000).toFixed(1)}K`;
  return String(Math.round(x));
}

/** Toshkent vaqtida «DD.MM HH:MM». */
export function fmtAt(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? '');
  if (Number.isNaN(t)) return '';
  const s = new Date(t + TZ_OFFSET_MS).toISOString();
  return `${s.slice(8, 10)}.${s.slice(5, 7)} ${s.slice(11, 16)}`;
}

export const PURPOSES = ['group_analysis', 'report_split'] as const;

/** Maqsad → i18n kaliti; noma'lum maqsad uchun null (asl nomi ko'rsatiladi). */
export function purposeKey(p: string): string | null {
  return (PURPOSES as readonly string[]).includes(p) ? `crm.botAiHealth.purpose_${p}` : null;
}
