/**
 * Tashqi manbaga so'rov: tezlik chegarasi, kutish va tushunarli xato.
 */

/** Sekundiga N ta so'rovdan oshmaydigan oddiy navbat. */
export function createLimiter(perSecond) {
  const gap = perSecond > 0 ? 1000 / perSecond : 0;
  let next = 0;

  return async function limit() {
    if (!gap) return;
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + gap;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
}

/**
 * Manba rad etganini bildiruvchi xato.
 *
 * 401/403 qayta urinilmaydi: bu vaqtinchalik nosozlik emas, ruxsat yo'qligi.
 * Qayta urinish faqat manbaga ortiqcha yuk beradi.
 */
export class AccessDeniedError extends Error {
  constructor(status, host, body) {
    super(
      `${host} so'rovni rad etdi (HTTP ${status}). Bu tarmoq nosozligi emas — ` +
        `manbaga kirish huquqi yo'q. Qayta urinilmaydi.`,
    );
    this.name = "AccessDeniedError";
    this.status = status;
    this.body = body;
  }
}

export class SourceError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "SourceError";
    this.cause = cause;
  }
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Qayta urinishli so'rov.
 *
 * 429 va 5xx da eksponensial kutish; 401/403 da darhol to'xtaydi.
 */
export async function fetchJson(url, init, { limit, maxRetries, timeoutMs }) {
  const host = new URL(url).host;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (limit) await limit();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();

      if (response.status === 401 || response.status === 403) {
        throw new AccessDeniedError(response.status, host, text.slice(0, 400));
      }

      if (!response.ok) {
        if (!RETRYABLE.has(response.status) || attempt === maxRetries) {
          throw new SourceError(
            `${host} HTTP ${response.status}: ${text.slice(0, 200)}`,
          );
        }
        lastError = new SourceError(`${host} HTTP ${response.status}`);
      } else {
        try {
          return JSON.parse(text);
        } catch (cause) {
          throw new SourceError(`${host} JSON qaytarmadi: ${text.slice(0, 200)}`, cause);
        }
      }
    } catch (error) {
      if (error instanceof AccessDeniedError) throw error;
      if (error instanceof SourceError && !lastError) throw error;
      lastError = error;
      if (attempt === maxRetries) break;
    } finally {
      clearTimeout(timer);
    }

    // 2s, 4s, 8s, 16s
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt + 1)));
  }

  throw new SourceError(`${host} javob bermadi: ${lastError?.message ?? "noma'lum"}`, lastError);
}
