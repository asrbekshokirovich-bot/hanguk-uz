/**
 * Shared client-side rules for a guideline (모집요강) PDF upload.
 *
 * These mirror the `upload-guideline` edge function's own validation. Checking
 * here as well is not redundant: a rejected file would otherwise be base64'd
 * (which inflates it by ~33%) and pushed over the wire before the server can
 * say no — and an oversize body can be cut off by the platform before the
 * function runs at all, which surfaces as a bare HTTP error with no reason in
 * it. Failing locally gives the operator the actual limit, instantly.
 *
 * The server stays the authority; nothing here is a substitute for its checks.
 */

/** Keep in sync with MAX_BYTES in supabase/functions/upload-guideline/index.ts. */
export const MAX_GUIDELINE_PDF_BYTES = 25 * 1024 * 1024;

export const MAX_GUIDELINE_PDF_MB = MAX_GUIDELINE_PDF_BYTES / 1024 / 1024;

/** True when the file looks like a PDF by extension or reported MIME type. */
export function looksLikePdf(file: File): boolean {
  if (file.name.toLowerCase().endsWith('.pdf')) return true;
  // Some browsers report an empty type for a file dragged from an odd source.
  return !file.type || file.type === 'application/pdf';
}

/** File size in MB, rounded to one decimal, for an error message. */
export function fileSizeMb(file: File): string {
  return (file.size / 1024 / 1024).toFixed(1);
}

/** True when the file exceeds what the edge function will accept. */
export function isTooLarge(file: File): boolean {
  return file.size > MAX_GUIDELINE_PDF_BYTES;
}
