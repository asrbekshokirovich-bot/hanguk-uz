import { supabase } from '@/integrations/supabase/client';

/**
 * Payment receipts live in the private `payment-receipts` bucket. Rows still
 * store the old public URL (`…/object/public/payment-receipts/<path>`), so the
 * UI turns every stored value into a short-lived signed URL when it shows it.
 */
export const RECEIPTS_BUCKET = 'payment-receipts';

const SIGNED_TTL_SECONDS = 60 * 60;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const PATH_IN_URL = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/payment-receipts\/([^?#]+)/;
const BARE_PATH = /^(?:receipts|application-fees)\//;

/** Storage path of a receipt, or null when the value is not one of ours. */
export function receiptPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(PATH_IN_URL);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return BARE_PATH.test(value) ? value : null;
}

const cache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Signed URL for a stored receipt value. Values that are not payment-receipt
 * paths (other buckets, external links) are returned unchanged.
 */
export async function signReceiptUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const path = receiptPath(value);
  if (!path) return value;

  const hit = cache.get(path);
  if (hit && hit.expiresAt - REFRESH_MARGIN_MS > Date.now()) return hit.url;

  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_TTL_SECONDS * 1000 });
  return data.signedUrl;
}
