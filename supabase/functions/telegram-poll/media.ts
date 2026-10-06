// The pure helpers of telegram-poll's attachment and ingest handling. No
// imports, so vitest runs them (index.ts pulls in GramJS and cannot be tested).
//
// Background — the outage of 2026-09-30: pullDifference saved the poller's
// position only after ingestMessages had downloaded every attachment, and
// `client.downloadMedia` has no timeout. One download that never finished held
// the position, the run ended on its lease, and the next run started from the
// same position, met the same message and hung the same way — for as long as it
// took somebody to notice. The position is now saved BEFORE any download, every
// download is bounded, and an oversized file is skipped without being fetched.
// deno-lint-ignore-file no-explicit-any

/**
 * The size of what downloadMedia would fetch, when Telegram tells us without
 * downloading: a document's `size`, or the largest size of a photo (a photo has
 * no single size; downloadMedia takes the biggest one). null = not knowable.
 */
export function knownMediaSize(media: any): number | null {
  if (!media) return null;
  const doc = media.document;
  if (doc && doc.size != null) {
    const n = Number(doc.size);
    return Number.isFinite(n) ? n : null;
  }
  const sizes = media.photo?.sizes;
  if (Array.isArray(sizes)) {
    let best = 0;
    for (const s of sizes) {
      const candidates: number[] = [];
      if (s?.size != null) candidates.push(Number(s.size));
      if (Array.isArray(s?.sizes)) candidates.push(...s.sizes.map(Number)); // PhotoSizeProgressive
      if (s?.bytes?.length != null) candidates.push(Number(s.bytes.length)); // cached / stripped thumbnails
      for (const c of candidates) if (Number.isFinite(c) && c > best) best = c;
    }
    return best > 0 ? best : null;
  }
  return null;
}

export type MediaVerdict = { download: true; size: number | null } | { download: false; reason: "too_large"; size: number };

/** Download unless Telegram already says the file is over the limit. */
export function mediaVerdict(media: any, maxBytes: number): MediaVerdict {
  const size = knownMediaSize(media);
  if (size != null && size > maxBytes) return { download: false, reason: "too_large", size };
  return { download: true, size };
}

/** Below this a download is not worth starting: it could not finish before the deadline. */
export const MIN_DOWNLOAD_MS = 2_000;

/**
 * How long one download may take: `perFileMs`, but never past `deadline`.
 * 0 = skip it (the run has no time left).
 */
export function downloadBudget(nowMs: number, deadlineMs: number, perFileMs: number): number {
  const left = deadlineMs - nowMs;
  const allowed = Math.min(perFileMs, left);
  return allowed >= MIN_DOWNLOAD_MS ? allowed : 0;
}

/**
 * Reject if `p` has not settled within `ms`. The work itself cannot be
 * cancelled (GramJS has no AbortSignal), so it is left to finish or fail in the
 * background — its late rejection is swallowed here so it never surfaces as an
 * unhandled one — and client.destroy() ends it when the run ends.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  p.catch(() => {});
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * telegram-ingest answers HTTP 200 even when single events failed: the body is
 * { ok, received, stored, ..., errors: string[] }. The error texts it returns
 * (it does not say which event) — empty when all went in.
 */
export function ingestErrors(body: any): string[] {
  return Array.isArray(body?.errors) ? body.errors.map((e: unknown) => String(e)) : [];
}

/**
 * Is a message still young enough that its rejection is worth holding the
 * poller's position for? A rejection that lasts is a poison message, and one
 * poison message must not stall everyone behind it: past `windowSeconds` it is
 * logged and let go. A message without a date counts as young.
 */
export function youngEnough(messageDateSeconds: number | null | undefined, nowSeconds: number, windowSeconds: number): boolean {
  if (messageDateSeconds == null || !Number.isFinite(Number(messageDateSeconds))) return true;
  return nowSeconds - Number(messageDateSeconds) <= windowSeconds;
}
