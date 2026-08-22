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
export const MAX_GUIDELINE_PDF_BYTES = 100 * 1024 * 1024;

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

/**
 * Upload a guideline PDF via signed URL (two-step flow).
 *
 * Step 1: ask the edge function for a signed upload URL.
 * Step 2: PUT the raw file bytes directly to Storage.
 * Step 3: tell the edge function to validate and register the blob.
 *
 * This avoids sending the file through the edge function's memory, which
 * hits Supabase compute limits for anything over ~4 MB.
 */
export async function uploadGuidelineViaSignedUrl(
  supabase: { functions: { invoke: (name: string, opts: { body: unknown }) => Promise<{ data: any; error: any }> } },
  institutionId: string,
  file: File,
  edgeFunctionError: (error: unknown, fallback: string) => Promise<Error>,
  fallbackMsg: string,
): Promise<{ guideline_document_id: string; storage_path: string }> {
  // Step 1: get signed upload URL
  const { data: urlData, error: urlErr } = await supabase.functions.invoke('upload-guideline', {
    body: { mode: 'create_upload_url', institution_id: institutionId, filename: file.name },
  });
  if (urlErr) throw await edgeFunctionError(urlErr, fallbackMsg);
  if (urlData?.error) throw new Error(String(urlData.error));

  const { upload_url, upload_token, storage_path } = urlData;
  if (!upload_url || !storage_path) throw new Error('Server did not return upload URL');

  // Step 2: PUT the raw file to Storage via signed URL
  const uploadRes = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
      ...(upload_token ? { 'x-upsert': 'false' } : {}),
    },
    body: file,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    throw new Error(`Storage upload failed (HTTP ${uploadRes.status}): ${text.slice(0, 200)}`);
  }

  // Step 3: register the blob
  const { data: regData, error: regErr } = await supabase.functions.invoke('upload-guideline', {
    body: { mode: 'register', institution_id: institutionId, storage_path, filename: file.name },
  });
  if (regErr) throw await edgeFunctionError(regErr, fallbackMsg);
  if (regData?.error) throw new Error(String(regData.error));

  return {
    guideline_document_id: regData.guideline_document_id,
    storage_path: regData.storage_path,
  };
}
