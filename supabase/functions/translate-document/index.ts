import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
} from "https://esm.sh/docx@8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GEMINI_AI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const OUTPUT_BUCKET = "translation-documents";

// Uzbekistan regions and districts for handwriting disambiguation during OCR.
const UZBEKISTAN_REGIONS: Record<string, string[]> = {
  "Toshkent shahri": ["Bektemir", "Chilonzor", "Mirzo Ulugʻbek", "Mirobod", "Olmazor", "Sergeli", "Shayxontohur", "Uchtepa", "Yakkasaroy", "Yangihayot", "Yunusobod"],
  "Toshkent viloyati": ["Angren", "Olmaliq", "Chirchiq", "Bekobod", "Oqqo'rg'on", "Bo'stonliq", "Bo'ka", "Zangiota", "Qibray", "Parkent", "Piskent", "Chinoz"],
  "Samarqand viloyati": ["Samarqand", "Kattaqo'rg'on", "Bulung'ur", "Ishtixon", "Jomboy", "Narpay", "Nurobod", "Oqdaryo", "Payariq", "Toyloq", "Urgut"],
  "Buxoro viloyati": ["Buxoro", "Kogon", "Olot", "Gʻijduvon", "Jondor", "Peshku", "Qorakuʻl", "Romitan", "Shofirkon", "Vobkent"],
  "Farg'ona viloyati": ["Farg'ona", "Marg'ilon", "Quvasoy", "Qo'qon", "Beshariq", "Bog'dod", "Buvayda", "Dang'ara", "Furqat", "Oltiariq", "Quva", "Rishton", "Uchko'prik"],
  "Andijon viloyati": ["Andijon", "Xonobod", "Asaka", "Baliqchi", "Bo'z", "Buloqboshi", "Jalolquduq", "Marhamat", "Oltinko'l", "Shahrixon", "Xo'jaobod"],
  "Namangan viloyati": ["Namangan", "Chortoq", "Chust", "Kosonsoy", "Mingbuloq", "Norin", "Pop", "To'raqo'rg'on", "Uchqo'rg'on"],
  "Qashqadaryo viloyati": ["Qarshi", "Shahrisabz", "Chiroqchi", "Dehqonobod", "Gʻuzor", "Kasbi", "Kitob", "Koson", "Mirishkor", "Muborak", "Nishon", "Qamashi"],
  "Surxondaryo viloyati": ["Termiz", "Angor", "Bandixon", "Boysun", "Denov", "Jarqo'rg'on", "Muzrabot", "Oltinsoy", "Qiziriq", "Sherobod", "Uzun"],
  "Xorazm viloyati": ["Urganch", "Xiva", "Bog'ot", "Gurlan", "Xonqa", "Xazorasp", "Qo'shko'pir", "Shovot", "Yangiariq"],
  "Navoiy viloyati": ["Navoiy", "Zarafshon", "Konimex", "Karmana", "Navbahor", "Nurota", "Qiziltepa", "Tomdi", "Uchquduq"],
  "Jizzax viloyati": ["Jizzax", "Arnasoy", "Baxmal", "Do'stlik", "Forish", "G'allaorol", "Mirzacho'l", "Paxtakor", "Zafarobod", "Zomin"],
  "Sirdaryo viloyati": ["Guliston", "Yangiyer", "Shirin", "Boyovut", "Mirzaobod", "Oqoltin", "Sayxunobod", "Sardoba", "Xovos"],
  "Qoraqalpog'iston": ["Nukus", "Amudaryo", "Beruniy", "Chimboy", "Ellikqala", "Kegeyli", "Mo'ynoq", "Qanliko'l", "Qo'ng'irot", "Shumanay", "Taxtako'pir", "To'rtko'l", "Xo'jayli"],
};

// ---------- Types ----------
type Block =
  | { type: "title"; text: string }
  | { type: "heading"; text: string }
  | { type: "field"; label: string; value: string }
  | { type: "paragraph"; text: string }
  | { type: "table"; header?: string[]; rows: string[][] }
  | { type: "annotation"; text: string }
  | { type: "spacer" };

interface StructuredTranslation {
  detectedSupportingDocs: { role: string; documentType: string; extractedName: string }[];
  verifiedNames: { student?: string; father?: string; mother?: string };
  blocks: Block[];
  unclearItems: string[];
}

// ---------- File helpers ----------
async function fileToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    default: return "application/octet-stream";
  }
}

// ---------- DOCX renderer ----------
async function renderDocx(structured: StructuredTranslation, meta: { documentTitle: string }): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [];

  // Header label
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "CERTIFIED TRANSLATION FROM UZBEK INTO ENGLISH", italics: true, size: 18, color: "777777" })],
      spacing: { after: 200 },
    })
  );

  for (const block of structured.blocks ?? []) {
    switch (block.type) {
      case "title":
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: block.text.toUpperCase(), bold: true, size: 32 })],
            spacing: { after: 200 },
          })
        );
        break;

      case "heading":
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: block.text, bold: true, size: 24 })],
            spacing: { before: 200, after: 100 },
          })
        );
        break;

      case "field":
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${block.label}: `, bold: true, size: 22 }),
              new TextRun({ text: block.value ?? "", size: 22 }),
            ],
            spacing: { after: 60 },
          })
        );
        break;

      case "paragraph":
        children.push(
          new Paragraph({
            children: [new TextRun({ text: block.text, size: 22 })],
            spacing: { after: 120 },
          })
        );
        break;

      case "annotation":
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `[${block.text.replace(/^\[|\]$/g, "")}]`, italics: true, size: 20, color: "666666" })],
            spacing: { after: 80 },
          })
        );
        break;

      case "spacer":
        children.push(new Paragraph({ children: [], spacing: { after: 160 } }));
        break;

      case "table": {
        const cols = Math.max(1, block.header?.length ?? (block.rows[0]?.length ?? 1));
        const colWidth = Math.floor(9000 / cols);

        const makeCell = (text: string, isHeader = false) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: text ?? "", bold: isHeader, size: isHeader ? 20 : 18 })],
              }),
            ],
            shading: isHeader ? { type: ShadingType.SOLID, color: "F0F0F0", fill: "F0F0F0" } : undefined,
          });

        const tableRows: TableRow[] = [];
        if (block.header?.length) {
          tableRows.push(new TableRow({ children: block.header.map((h) => makeCell(h, true)) }));
        }
        for (const row of block.rows ?? []) {
          const cells = row.map((c) => makeCell(c));
          while (cells.length < cols) cells.push(makeCell(""));
          tableRows.push(new TableRow({ children: cells }));
        }

        children.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        children.push(new Paragraph({ children: [], spacing: { after: 160 } }));
        break;
      }
    }
  }

  // Certification footer
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  children.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: "AAAAAA" } },
      spacing: { before: 400, after: 160 },
      children: [new TextRun({ text: "TRANSLATOR'S CERTIFICATION", bold: true, size: 22 })],
    }),
    new Paragraph({
      children: [new TextRun({
        text: "I hereby certify that the foregoing is a true, complete and accurate translation from Uzbek into English of the attached document, to the best of my knowledge and ability.",
        size: 20,
      })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Date of translation: ${dateStr}`, size: 20 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Signature: ______________________________", size: 20 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Translator / Authorised representative", italics: true, size: 18, color: "777777" })],
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
    creator: "Hanguk.uz Translation System",
    title: `Certified Translation — ${meta.documentTitle}`,
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

// ---------- Plain text projection ----------
function blocksToPlainText(structured: StructuredTranslation): string {
  const parts: string[] = [];
  for (const b of structured.blocks ?? []) {
    switch (b.type) {
      case "title": parts.push(b.text.toUpperCase()); break;
      case "heading": parts.push(`\n${b.text}`); break;
      case "field": parts.push(`${b.label}: ${b.value}`); break;
      case "paragraph": parts.push(b.text); break;
      case "annotation": parts.push(`[${b.text}]`); break;
      case "table":
        if (b.header) parts.push(b.header.join(" | "));
        for (const r of b.rows ?? []) parts.push(r.join(" | "));
        break;
      case "spacer": parts.push(""); break;
    }
  }
  return parts.join("\n");
}

function parseStructured(raw: string): StructuredTranslation {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("AI did not return valid JSON");
    parsed = JSON.parse(text.slice(start, end + 1));
  }
  return {
    detectedSupportingDocs: Array.isArray(parsed.detectedSupportingDocs) ? parsed.detectedSupportingDocs : [],
    verifiedNames: parsed.verifiedNames && typeof parsed.verifiedNames === "object" ? parsed.verifiedNames : {},
    blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
    unclearItems: Array.isArray(parsed.unclearItems) ? parsed.unclearItems : [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const {
      documentTypeId,
      source,
      supporting = [],
      studentName,
      verifiedNames: providedNames,
      regenerate,
    } = body;

    if (!documentTypeId) return json({ error: "documentTypeId is required" }, 400);

    const { data: docType, error: typeError } = await supabase
      .from("translation_document_types")
      .select("*")
      .eq("id", documentTypeId)
      .maybeSingle();
    if (typeError || !docType) return json({ error: "Document type not found" }, 404);

    const documentTitle = docType.name_en || docType.name_uz || docType.code;

    // ---- Fast path: re-render DOCX from staff-edited structured data ----
    if (regenerate?.structured) {
      const structured: StructuredTranslation = {
        detectedSupportingDocs: regenerate.structured.detectedSupportingDocs ?? [],
        verifiedNames: regenerate.structured.verifiedNames ?? {},
        blocks: regenerate.structured.blocks ?? [],
        unclearItems: regenerate.structured.unclearItems ?? [],
      };
      const docxBytes = await renderDocx(structured, { documentTitle });
      const docxPath = `output/${Date.now()}_${docType.code}_translation.docx`;
      const { error: upErr } = await supabase.storage.from(OUTPUT_BUCKET)
        .upload(docxPath, docxBytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
      if (upErr) return json({ error: `DOCX upload failed: ${upErr.message}` }, 500);
      return json({
        structured,
        plainText: blocksToPlainText(structured),
        docxPath,
        documentType: { code: docType.code, name: docType.name_uz, nameEn: docType.name_en },
      });
    }

    if (!geminiApiKey) return json({ error: "AI service not configured" }, 500);
    if (!source?.path) return json({ error: "source.path is required" }, 400);

    // ---- Download files ----
    const downloadFile = async (path: string, bucket: string) => {
      const { data, error } = await supabase.storage.from(bucket || OUTPUT_BUCKET).download(path);
      if (error || !data) throw new Error(`Could not download ${bucket}/${path}: ${error?.message ?? "not found"}`);
      return data;
    };

    const imageContents: Array<{ type: "image_url"; image_url: { url: string } }> = [];
    const srcBlob = await downloadFile(source.path, source.bucket);
    imageContents.push({ type: "image_url", image_url: { url: `data:${getMimeType(source.path)};base64,${await fileToBase64(srcBlob)}` } });

    const supportingRoles: string[] = [];
    for (const sup of supporting) {
      try {
        const blob = await downloadFile(sup.path, sup.bucket);
        imageContents.push({ type: "image_url", image_url: { url: `data:${getMimeType(sup.path)};base64,${await fileToBase64(blob)}` } });
        supportingRoles.push(sup.role || "supporting document");
      } catch (e) {
        console.warn("Skipping supporting file:", sup.path, (e as Error).message);
      }
    }

    // ---- Few-shot examples from approved templates ----
    const { data: templates } = await supabase
      .from("translation_templates")
      .select("original_text, translated_text")
      .eq("document_type_id", documentTypeId)
      .eq("is_approved", true)
      .limit(3);
    const trainingExamples = (templates ?? [])
      .filter((t) => t.original_text && t.translated_text)
      .map((t, i) => `=== Example ${i + 1} ===\nUZBEK:\n${t.original_text}\n\nENGLISH:\n${t.translated_text}`)
      .join("\n\n");

    const systemPrompt = `You are an expert sworn translator producing certified Uzbek-to-English translations of official documents for Korean university applications.

DOCUMENT TYPE: ${docType.name_uz} (${docType.name_en || docType.code})

You receive images. Image 1 is the MAIN document to translate. Any further images are SUPPORTING identity documents (passports / ID cards) provided so you spell names correctly.
${supportingRoles.length ? `Supporting documents provided (in order): ${supportingRoles.join(", ")}.` : ""}

=== NAME ACCURACY (CRITICAL) ===
- The STUDENT's name MUST be copied EXACTLY from their international (biometric/foreign) passport — letter for letter, including the MRZ section. Take the patronymic/middle name from the top section if absent from the MRZ.
- PARENTS' names MUST be copied EXACTLY from their passport / ID card, NEVER from the birth certificate (birth certificates often misspell). Use the certificate only to learn the relationship (Otasi = father, Onasi = mother).
- For ID cards the name is already in Latin script — copy it verbatim.
- If a name cannot be confirmed from an identity document, add it to "unclearItems" rather than guessing.
${providedNames ? `\nSTAFF-VERIFIED NAMES (authoritative — use these exactly): ${JSON.stringify(providedNames)}` : ""}

=== OCR RULES ===
- Cyrillic→Latin: Ў→O', Қ→Q, Ғ→G', Ҳ→H, Ш→Sh, Ч→Ch, Ё→Yo, Ю→Yu, Я→Ya, Ж→J, Х→X.
- Dates are usually DD.MM.YYYY. Preserve registry/serial numbers exactly.
- Represent stamps, seals, signatures and photos as annotation blocks, e.g. text "Official Seal", "Signature", "Photograph".
- For unclear handwriting use the value with a trailing " [unclear]" and also list it in unclearItems.

=== HANDWRITING: UZBEKISTAN PLACES ===
${Object.entries(UZBEKISTAN_REGIONS).map(([r, d]) => `${r}: ${d.join(", ")}`).join("\n")}

${trainingExamples ? `=== APPROVED TRANSLATION EXAMPLES (match terminology and field labels) ===\n${trainingExamples}\n` : ""}
${studentName ? `Student (from CRM, cross-check against passport): ${studentName}` : ""}

=== OUTPUT FORMAT ===
Return ONLY a JSON object (no prose, no markdown) with this exact shape:
{
  "detectedSupportingDocs": [{ "role": "student_passport|father_id|mother_id|other", "documentType": "international passport|local passport|id card", "extractedName": "FULL NAME" }],
  "verifiedNames": { "student": "...", "father": "...", "mother": "..." },
  "blocks": [
    { "type": "title", "text": "..." },
    { "type": "heading", "text": "..." },
    { "type": "field", "label": "...", "value": "..." },
    { "type": "paragraph", "text": "..." },
    { "type": "table", "header": ["..."], "rows": [["..."]] },
    { "type": "annotation", "text": "Official Seal" },
    { "type": "spacer" }
  ],
  "unclearItems": ["..."]
}
Rules: first block must be "title". Use "field" for label/value pairs, "table" for grids, "annotation" for seals/signatures. Only include keys that exist for that block type. Omit father/mother from verifiedNames if not applicable.`;

    const userContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
      ...imageContents,
      { type: "text", text: "Translate the main document (image 1) into English. Identify each supporting identity document and extract names from them. Return the JSON object described in the system prompt." },
    ];

    const aiResponse = await fetch(GEMINI_AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${geminiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 12000,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) return json({ error: "Tizim band. Keyinroq urinib ko'ring." }, 429);
      if (aiResponse.status === 402) return json({ error: "AI xizmati uchun kredit tugagan." }, 402);
      return json({ error: "AI xizmatida xatolik" }, 500);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return json({ error: "Tarjima olinmadi" }, 500);

    const structured = parseStructured(content);
    if (providedNames) structured.verifiedNames = { ...structured.verifiedNames, ...providedNames };

    const docxBytes = await renderDocx(structured, { documentTitle });
    const docxPath = `output/${Date.now()}_${docType.code}_translation.docx`;
    const { error: upErr } = await supabase.storage.from(OUTPUT_BUCKET)
      .upload(docxPath, docxBytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
    if (upErr) {
      console.error("DOCX upload failed:", upErr);
      return json({ error: `DOCX upload failed: ${upErr.message}` }, 500);
    }

    return json({
      structured,
      plainText: blocksToPlainText(structured),
      docxPath,
      documentType: { code: docType.code, name: docType.name_uz, nameEn: docType.name_en },
    });
  } catch (error) {
    console.error("translate-document error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
