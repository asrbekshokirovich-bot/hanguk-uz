// get-pdf-url — mint a 15-minute signed URL for a guideline PDF blob.
//
// ADR-009 + PHASE_3_DESIGN.md §2. The Flutter client calls this when
// the user taps "Open original PDF". The function:
//   1. Verifies the caller is authenticated (JWT bearer)
//   2. Verifies the caller is an app user (rpc fn_is_app_user())
//   3. Looks up the document's storage_object_path from public.documents
//   4. Calls supabase.storage.createSignedUrl with a 15-minute TTL
//   5. Inserts an audit row into public.pdf_access_log
//   6. Returns { signed_url, expires_at }
//
// All inserts to pdf_access_log happen via the service-role client so
// RLS doesn't block the audit row even though regular users can only
// SELECT their own rows.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface RequestBody {
  document_id?: string;
  // The review view exposes `storage_path` directly, so accept it too — the
  // staff site has it without a separate document_id lookup.
  storage_path?: string;
  reason?: string;
}

interface DocumentRow {
  id: string;
  storage_path: string | null;
}

const SIGNED_URL_TTL_SECONDS = 60 * 15;
const DEFAULT_BUCKET = 'guideline-blobs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  // Fail loud at boot so a misconfigured deploy doesn't 500 every call.
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// CORS so the browser-based staff review site can call this. Without these
// (and OPTIONS handling) the preflight 405'd and every browser POST was
// blocked — mirrors translate-fields, which works.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });
}

async function verifyCaller(authHeader: string | null): Promise<{ userId: string } | Response> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'missing_bearer' });
  }
  const jwt = authHeader.slice(7);
  // Use a per-request anon client with the user's JWT to resolve auth.uid().
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    return jsonResponse(401, { error: 'invalid_token' });
  }
  // Confirm the caller is an app user (not a service-role token, not a
  // signed-out request that somehow carries a JWT).
  const { data: ok, error: rpcErr } = await userClient.rpc('fn_is_app_user');
  if (rpcErr) {
    console.error('fn_is_app_user rpc failed', rpcErr);
    return jsonResponse(403, { error: 'role_check_failed' });
  }
  if (!ok) {
    return jsonResponse(403, { error: 'not_app_user' });
  }
  return { userId: data.user.id };
}

Deno.serve(async (req) => {
  // Browser preflight — must answer 200 with CORS headers, not 405.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const verified = await verifyCaller(req.headers.get('Authorization'));
  if (verified instanceof Response) return verified;
  const { userId } = verified;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'invalid_json' });
  }
  const documentId = typeof body.document_id === 'string' ? body.document_id : null;
  const storagePath = typeof body.storage_path === 'string' ? body.storage_path : null;
  if (!documentId && !storagePath) {
    return jsonResponse(400, { error: 'missing_document_id_or_storage_path' });
  }

  // Resolve to a real guideline_documents row either way (so we never sign an
  // arbitrary path). Service role bypasses RLS to read across institutions.
  const query = serviceClient.from('guideline_documents').select('id, storage_path');
  const { data: doc, error: docErr } = await (
    documentId ? query.eq('id', documentId) : query.eq('storage_path', storagePath)
  ).maybeSingle<DocumentRow>();
  if (docErr) {
    console.error('guideline_documents lookup failed', docErr);
    return jsonResponse(500, { error: 'lookup_failed' });
  }
  if (!doc || !doc.storage_path) {
    return jsonResponse(404, { error: 'document_not_found' });
  }

  // guideline_documents has no bucket column — every blob lives in
  // guideline-blobs per ADR-009. The pdf_access_log row records it for
  // future-proofing if we ever shard buckets per institution.
  const bucket = DEFAULT_BUCKET;
  const { data: signed, error: signErr } = await serviceClient.storage
    .from(bucket)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) {
    console.error('createSignedUrl failed', signErr);
    return jsonResponse(500, { error: 'signing_failed' });
  }

  const grantedAt = new Date();
  const expiresAt = new Date(grantedAt.getTime() + SIGNED_URL_TTL_SECONDS * 1000);

  // Best-effort audit. If the audit insert fails, we still return the
  // signed URL — the alternative (refusing access) is a worse failure
  // mode for the student and the audit gap will surface in monitoring.
  // Column names come from the Phase 2 storage_bucket migration:
  //   guideline_document_id, storage_path, signed_url_ttl_sec, ip_address
  // Phase 3's pdf_access_log migration adds bucket, expires_at, reason.
  const { error: logErr } = await serviceClient.from('pdf_access_log').insert({
    user_id: userId,
    guideline_document_id: doc.id,
    bucket,
    storage_path: doc.storage_path,
    signed_url_ttl_sec: SIGNED_URL_TTL_SECONDS,
    granted_at: grantedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    ip_address: req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || null,
    user_agent: req.headers.get('user-agent'),
    reason: body.reason || 'open_original',
  });
  if (logErr) {
    console.error('pdf_access_log insert failed', logErr);
  }

  return jsonResponse(200, {
    signed_url: signed.signedUrl,
    expires_at: expiresAt.toISOString(),
  });
});
