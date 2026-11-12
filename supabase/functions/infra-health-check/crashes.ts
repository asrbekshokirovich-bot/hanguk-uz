// The crm_crashes line of the infra-health-check board (see index.ts, check 9).
// Kept apart from index.ts so it can be tested without starting the server.

/** A row of public.web_client_errors with kind = 'crash'. */
export interface CrashRow {
  path: string | null;
  message: string;
  hits: number;
  user_id: string;
  stack?: string | null;
}

/**
 * A tab opened before a deploy asking for a chunk the new build no longer has.
 * The page reloads itself for the new build (src/lib/buildReload.ts); builds
 * up to 2026-11-12 still reported the blink before the reload as a crash: the
 * lazy import resolved to nothing, so React threw exactly this, from `Lazy`.
 * Tabs still running those builds keep sending it until they are reloaded.
 */
export function isStaleChunk(r: Pick<CrashRow, "message" | "stack">): boolean {
  return /Cannot read properties of undefined \(reading 'default'\)/.test(r.message ?? "") &&
    /\bat Lazy\b/.test(r.stack ?? "");
}

/**
 * ok when no page fell over within the window; otherwise how often, for how
 * many people, and the three pages it happened on most.
 */
export function crashLine(all: CrashRow[], hours: number): { state: "ok" | "fail"; detail: string } {
  const rows = all.filter((r) => !isStaleChunk(r));
  if (rows.length === 0) return { state: "ok", detail: `so'nggi ${hours} soatda birorta sahifa yiqilmadi` };

  const byPage = new Map<string, { path: string; message: string; hits: number }>();
  let total = 0;
  for (const r of rows) {
    const hits = Math.max(1, Number(r.hits) || 1);
    total += hits;
    const path = r.path || "(sahifa noma'lum)";
    const message = (r.message ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    const key = `${path}|${message}`;
    const seen = byPage.get(key);
    if (seen) seen.hits += hits;
    else byPage.set(key, { path, message, hits });
  }
  const people = new Set(rows.map((r) => r.user_id)).size;
  const top = [...byPage.values()].sort((a, b) => b.hits - a.hits);
  const lines = top.slice(0, 3).map((p) => `${p.path} — ${p.message} (${p.hits} marta)`);
  if (top.length > 3) lines.push(`…va yana ${top.length - 3} xil xato`);
  return {
    state: "fail",
    detail: `so'nggi ${hours} soatda ${total} marta, ${people} xodimda:\n${lines.join("\n")}`,
  };
}
