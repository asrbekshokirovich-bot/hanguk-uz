import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useInvestorSeason } from '@/contexts/InvestorSeasonContext';

/* ---------------------------------------------------------------------------
 * The four investor exports.
 *
 * These are built by the `investor-export` edge function, not in the browser.
 * Two reasons that matters. First, the function runs every query as
 * auth.uid() - it is handed the caller's own access token and builds a client
 * from the anon key, never the service-role key - so RLS decides what lands in
 * the file exactly as it decides what lands on screen. A file cannot leak what
 * a screen would not show. Second, the season has to appear in the filename
 * (`hanguk-pnl-2027-spring.pdf`), and the server is the one place that knows
 * for certain which season it just read.
 *
 * `supabase.functions.invoke` is deliberately not used: it does not surface
 * response headers, and the filename lives in content-disposition. A plain
 * fetch keeps the server as the single source of truth for the name instead of
 * duplicating the slug rules here.
 * ------------------------------------------------------------------------ */

export type InvestorExportKind =
  | 'pnl-pdf'
  | 'pnl-xlsx'
  | 'applications-xlsx'
  | 'season-report-pdf';

const LABELS: Record<InvestorExportKind, string> = {
  'pnl-pdf': 'P&L (PDF)',
  'pnl-xlsx': 'P&L (Excel)',
  'applications-xlsx': 'Application list',
  'season-report-pdf': 'Season report',
};

/** Fallbacks only - the server normally names the file. */
const EXTENSIONS: Record<InvestorExportKind, string> = {
  'pnl-pdf': 'pdf',
  'pnl-xlsx': 'xlsx',
  'applications-xlsx': 'xlsx',
  'season-report-pdf': 'pdf',
};

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/** RFC 5987 first, then the plain form. */
function filenameFrom(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}

/** What the function returns for a caller it will not serve. */
const MESSAGES: Record<string, string> = {
  NOT_AN_INVESTOR: 'This export is only available to an investor account.',
  INVALID_TOKEN: 'Your session has expired. Sign in again to export.',
  MISSING_AUTH: 'Your session has expired. Sign in again to export.',
};

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const code = typeof body?.error === 'string' ? body.error : '';
    if (MESSAGES[code]) return MESSAGES[code];
  } catch {
    /* not JSON - fall back to the status */
  }
  if (res.status === 403) return MESSAGES.NOT_AN_INVESTOR;
  if (res.status === 401) return MESSAGES.INVALID_TOKEN;
  return 'The export could not be generated. Please try again.';
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a beat to start the download before the handle goes away.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function useInvestorExport() {
  const { activeIntakeId, activeIntake } = useInvestorSeason();
  const [pending, setPending] = useState<InvestorExportKind | null>(null);

  const run = useCallback(
    async (kind: InvestorExportKind) => {
      // One at a time. Two concurrent downloads from the same click target is
      // never what someone meant, and the second would win the toast.
      if (pending) return;
      setPending(kind);

      const toastId = toast.loading(`Preparing ${LABELS[kind]}...`);
      try {
        const { data, error } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (error || !token) throw new Error(MESSAGES.INVALID_TOKEN);

        const res = await fetch(`${FUNCTIONS_BASE}/investor-export`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ kind, intakeId: activeIntakeId }),
        });

        if (!res.ok) throw new Error(await errorMessage(res));

        const blob = await res.blob();
        if (blob.size === 0) throw new Error('The export came back empty.');

        const season = activeIntake
          ? `${activeIntake.year}-${activeIntake.season}`
          : 'season';
        const filename =
          filenameFrom(res.headers.get('content-disposition')) ??
          `hanguk-${kind}-${season}.${EXTENSIONS[kind]}`;

        saveBlob(blob, filename);
        toast.success(`${LABELS[kind]} downloaded`, { id: toastId });
      } catch (e) {
        const message =
          e instanceof Error && e.message
            ? e.message
            : 'The export could not be generated. Please try again.';
        toast.error(message, { id: toastId });
      } finally {
        setPending(null);
      }
    },
    [activeIntake, activeIntakeId, pending],
  );

  return {
    run,
    /** The kind currently downloading, or null. */
    pending,
    isPending: (kind: InvestorExportKind) => pending === kind,
    /** True while any export is in flight - used to disable siblings. */
    isBusy: pending !== null,
  };
}
