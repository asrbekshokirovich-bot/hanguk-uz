// The cron_jobs line of the infra-health-check board (see index.ts, check 8).
// Kept apart from index.ts so it can be tested without starting the server.

/** One row of public.fn_cron_failing_jobs(). */
export interface CronFailure {
  jobname: string;
  failed_runs: number;
  last_error: string | null;
  failing_since: string | null;
}

/** ok when no job is failing; otherwise the jobs by name and the first one's error. */
export function cronJobsLine(rows: CronFailure[]): { state: "ok" | "fail"; detail: string } {
  if (rows.length === 0) return { state: "ok", detail: "hamma cron ishi ishlayapti" };
  const shown = rows.slice(0, 5).map((r) => r.jobname).join(", ");
  const names = rows.length > 5 ? `${shown} va yana ${rows.length - 5} ta` : shown;
  const first = rows[0];
  const since = first.failing_since ? ` (${first.failing_since.slice(0, 16).replace("T", " ")} UTC dan beri)` : "";
  const err = (first.last_error ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  return {
    state: "fail",
    detail: `${rows.length} ta ish ketma-ket yiqilyapti: ${names}${since}` + (err ? `\n${first.jobname}: ${err}` : ""),
  };
}
