import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const filePath = url.searchParams.get('path');
    const bucket = url.searchParams.get('bucket') || 'student-documents';

    if (!filePath) {
      return new Response('Missing path parameter', { status: 400, headers: corsHeaders });
    }

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // Check user is staff OR owns the file (file_path starts with their user_id)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    // Keep in sync with the documents-table RLS policies: call_operator staff
    // attach documents, so they must be able to open them too (otherwise every
    // view returns 403 for them).
    const isStaff = roles?.some((r: { role: string }) =>
      ['owner', 'admin', 'document_handler', 'call_operator'].includes(r.role));
    const ownsFile = filePath.startsWith(user.id);

    if (!isStaff && !ownsFile) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    // Download the file using service role (bypasses RLS, bypasses storage domain)
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(filePath);

    if (error || !data) {
      return new Response('File not found', { status: 404, headers: corsHeaders });
    }

    // Determine content type from file extension
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    const fileName = filePath.split('/').pop() || 'document';

    return new Response(data, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    console.error('document-proxy error:', err);
    return new Response('Internal error', { status: 500, headers: corsHeaders });
  }
});
