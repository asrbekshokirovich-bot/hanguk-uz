/**
 * The manual ad-spend cells of the report (Meta spend is typed in by hand for
 * now, spec §14). Kept in localStorage, keyed by period + ad (see
 * `spendKey` in reportMath); every access is guarded because storage can be
 * blocked (private windows) or full.
 */
const KEY = 'hanguk:lead-report:ad-spend:v1';

export function loadSpend(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Returns false when the browser would not store it (the number is then only kept for this visit). */
export function saveSpend(map: Record<string, number>): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}
