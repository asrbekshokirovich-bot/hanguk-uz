// Certified translation for the CRM's "AI Tarjima" page: a staff member picks
// the student, the document and its identity documents, and gets a DOCX back.
// The translation itself lives in _shared/certified-translation.ts, which the
// background auto-translate-documents worker uses too.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  blocksToPlainText,
  normalizeStructured,
  renderDocx,
  translateDocument,
  TranslationError,
  uploadTranslationDocx,
} from "../_shared/certified-translation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Staff-only gate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = (roles ?? []).some((r: { role: string }) => ["owner", "admin", "document_handler"].includes(r.role));
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { documentTypeId, source, supporting = [], studentName, verifiedNames: providedNames, regenerate } = body;

    if (!documentTypeId) return json({ error: "documentTypeId is required" }, 400);

    const { data: docType, error: typeError } = await supabase
      .from("translation_document_types").select("*").eq("id", documentTypeId).maybeSingle();
    if (typeError || !docType) return json({ error: "Document type not found" }, 404);

    const documentType = { code: docType.code, name: docType.name_uz, nameEn: docType.name_en };

    // ---- Fast path: re-render DOCX ----
    if (regenerate?.structured) {
      const structured = normalizeStructured(regenerate.structured);
      const docxPath = await uploadTranslationDocx(supabase, await renderDocx(structured), docType.code);
      return json({ structured, plainText: blocksToPlainText(structured), docxPath, documentType });
    }

    if (!geminiApiKey) return json({ error: "AI service not configured" }, 500);
    if (!source?.path) return json({ error: "source.path is required" }, 400);

    const structured = await translateDocument(supabase, geminiApiKey, {
      docType, source, supporting, studentName, providedNames,
    });
    const docxPath = await uploadTranslationDocx(supabase, await renderDocx(structured), docType.code);

    return json({
      structured,
      plainText: blocksToPlainText(structured),
      docxPath,
      documentType,
    });
  } catch (error) {
    console.error("translate-document error:", error);
    const status = error instanceof TranslationError ? error.status : 500;
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, status);
  }
});
