// The Instagram token's remaining life, for infra-health-check. Pure, so
// ig_token_test.ts runs it as is.
//
// A long-lived Instagram token lasts 60 days. instagram-token-refresh renews
// it every Monday, so a healthy one always has 53 days or more left. Nothing
// reads that function's answer: if Meta starts refusing the refresh, the cron
// run still "succeeds" (it only posts the request) and the channel that brings
// most of the leads goes dark two months later with nobody warned.

/** Under this many days left the weekly refresh has failed at least twice. */
export const IG_TOKEN_MIN_DAYS = 40;

export interface IgAccountRow {
  username?: string | null;
  token_expires_at: string | null;
}

export function igTokenLine(
  rows: IgAccountRow[],
  now: number,
  minDays: number = IG_TOKEN_MIN_DAYS,
): { state: "ok" | "fail"; detail: string } {
  if (!rows.length) return { state: "ok", detail: "faol Instagram akkaunti yo'q" };
  const faults: string[] = [];
  let least: number | null = null;
  for (const r of rows) {
    const name = r.username ? `@${r.username}` : "akkaunt";
    const at = r.token_expires_at ? new Date(r.token_expires_at).getTime() : NaN;
    if (Number.isNaN(at)) {
      faults.push(`${name}: token muddati yozilmagan`);
      continue;
    }
    const days = Math.floor((at - now) / 86_400_000);
    if (least === null || days < least) least = days;
    if (days < 0) faults.push(`${name}: token muddati ${-days} kun oldin tugagan`);
    else if (days < minDays) faults.push(`${name}: tokenga ${days} kun qoldi — haftalik yangilash ishlamayapti`);
  }
  if (faults.length) return { state: "fail", detail: faults.join("; ") };
  return { state: "ok", detail: `token yana ${least} kun amal qiladi` };
}
