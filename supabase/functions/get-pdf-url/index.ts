// get-pdf-url — mint a 15-minute signed URL for a guideline PDF blob.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface RequestBody { document_id?: string; storage_path?: string; reason?: string; }
interface DocumentRow { id: string; storage_path: string | null; }

const SIGNED_URL_TTL_SECONDS = 60 * 15;
const DEFAULT_BUCKET = 'guideline-blobs';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}
const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });
}
async function verifyCaller(authHeader: string | null): Promise<{ userId: string } | Response> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return jsonResponse(401, { error: 'missing_bearer' });
  const jwt = authHeader.slice(7);
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return jsonResponse(401, { error: 'invalid_token' });
  const { data: ok, error: rpcErr } = await userClient.rpc('fn_is_app_user');
  if (rpcErr) { console.error('fn_is_app_user rpc failed', rpcErr); return jsonResponse(403, { error: 'role_check_failed' }); }
  if (!ok) return jsonResponse(403, { error: 'not_app_user' });
  return { userId: data.user.id };
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });
  const verified = await verifyCaller(req.headers.get('Authorization'));
  if (verified instanceof Response) return verified;
  const { userId } = verified;
  let body: RequestBody;
  try { body = await req.json(); } catch { return jsonResponse(400, { error: 'invalid_json' }); }
  const documentId = typeof body.document_id === 'string' ? body.document_id : null;
  const storagePath = typeof body.storage_path === 'string' ? body.storage_path : null;
  if (!documentId && !storagePath) return jsonResponse(400, { error: 'missing_document_id_or_storage_path' });
  const query = serviceClient.from('guideline_documents').select('id, storage_path');
  const { data: doc, error: docErr } = await (
    documentId ? query.eq('id', documentId) : query.eq('storage_path', storagePath)
  ).maybeSingle<DocumentRow>();
  if (docErr) { console.error('lookup failed', docErr); return jsonResponse(500, { error: 'lookup_failed' }); }
  if (!doc || !doc.storage_path) return jsonResponse(404, { error: 'document_not_found' });
  const bucket = DEFAULT_BUCKET;
  const { data: signed, error: signErr } = await serviceClient.storage
    .from(bucket).createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) { console.error('sign failed', signErr); return jsonResponse(500, { error: 'signing_failed' }); }
  const grantedAt = new Date();
  const expiresAt = new Date(grantedAt.getTime() + SIGNED_URL_TTL_SECONDS * 1000);
  await serviceClient.from('pdf_access_log').insert({
    user_id: userId, guideline_document_id: doc.id, bucket, storage_path: doc.storage_path,
    signed_url_ttl_sec: SIGNED_URL_TTL_SECONDS, granted_at: grantedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    ip_address: req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || null,
    user_agent: req.headers.get('user-agent'), reason: body.reason || 'open_original',
  });
  return jsonResponse(200, { signed_url: signed.signedUrl, expires_at: expiresAt.toISOString() });
});
