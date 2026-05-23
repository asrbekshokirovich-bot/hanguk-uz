import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "https://esm.sh/pdf-lib@1.17.1";

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

// ---------- Types for the structured translation model ----------
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

// ---------- PDF text sanitisation ----------
// StandardFonts use WinAnsi encoding and crash on characters outside it
// (e.g. the Uzbek turned-comma ʻ in Oʻzbek / Gʻ). Normalise to safe ASCII.
function sanitizeWinAnsi(input: string): string {
  if (!input) return "";
  let s = input
    .replace(/[ʻʼ‘’‛`´]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/[…]/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/\t/g, "    ");
  // Drop control chars (except newline) and anything the WinAnsi font can't draw.
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === "\n") { out += ch; continue; }
    if (code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f)) continue;
    if (code > 0xff) { out += "?"; continue; }
    out += ch;
  }
  return out;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safe = sanitizeWinAnsi(text);
  const lines: string[] = [];
  for (const rawLine of safe.split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(""); continue; }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // Hard-break words that are wider than the column.
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const c of word) {
            if (font.widthOfTextAtSize(chunk + c, size) > maxWidth) {
              lines.push(chunk);
              chunk = c;
            } else {
              chunk += c;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

// ---------- PDF renderer (certified-translation layout) ----------
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

async function renderPdf(structured: StructuredTranslation, meta: { documentTitle: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const drawLines = (
    text: string,
    opts: { font?: PDFFont; size?: number; align?: "left" | "center"; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {},
  ) => {
    const font = opts.font ?? fontRegular;
    const size = opts.size ?? 11;
    const lineHeight = size * 1.35;
    const indent = opts.indent ?? 0;
    const lines = wrapText(text, font, size, CONTENT_W - indent);
    for (const line of lines) {
      ensureSpace(lineHeight);
      const width = font.widthOfTextAtSize(line, size);
      const x = opts.align === "center" ? (PAGE_W - width) / 2 : MARGIN + indent;
      page.drawText(line, { x, y: y - size, size, font, color: opts.color ?? rgb(0, 0, 0) });
      y -= lineHeight;
    }
    if (opts.gap) y -= opts.gap;
  };

  const drawRule = (color = rgb(0.7, 0.7, 0.7)) => {
    ensureSpace(12);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color });
    y -= 12;
  };

  // Top label
  drawLines("CERTIFIED TRANSLATION FROM UZBEK INTO ENGLISH", {
    font: fontItalic, size: 9, align: "center", color: rgb(0.45, 0.45, 0.45), gap: 10,
  });

  for (const block of structured.blocks ?? []) {
    switch (block.type) {
      case "title":
        drawLines(block.text.toUpperCase(), { font: fontBold, size: 15, align: "center", gap: 10 });
        break;
      case "heading":
        y -= 4;
        drawLines(block.text, { font: fontBold, size: 12, gap: 4 });
        break;
      case "field": {
        const label = `${block.label}: `;
        const labelWidth = fontBold.widthOfTextAtSize(sanitizeWinAnsi(label), 11);
        const lineHeight = 11 * 1.35;
        ensureSpace(lineHeight);
        page.drawText(sanitizeWinAnsi(label), { x: MARGIN, y: y - 11, size: 11, font: fontBold });
        // Value wrapped, first line continues after label.
        const valueLines = wrapText(block.value ?? "", fontRegular, 11, CONTENT_W - labelWidth);
        if (valueLines.length === 0) valueLines.push("");
        page.drawText(valueLines[0], { x: MARGIN + labelWidth, y: y - 11, size: 11, font: fontRegular });
        y -= lineHeight;
        for (let i = 1; i < valueLines.length; i++) {
          ensureSpace(lineHeight);
          page.drawText(valueLines[i], { x: MARGIN + labelWidth, y: y - 11, size: 11, font: fontRegular });
          y -= lineHeight;
        }
        y -= 2;
        break;
      }
      case "paragraph":
        drawLines(block.text, { size: 11, gap: 6 });
        break;
      case "annotation":
        drawLines(`[${block.text.replace(/^\[|\]$/g, "")}]`, { font: fontItalic, size: 10, color: rgb(0.4, 0.4, 0.4), gap: 4 });
        break;
      case "spacer":
        y -= 8;
        break;
      case "table": {
        const cols = Math.max(1, block.header?.length ?? (block.rows[0]?.length ?? 1));
        const colW = CONTENT_W / cols;
        const pad = 4;
        const cellSize = 10;
        const drawRow = (cells: string[], bold: boolean) => {
          const wrapped = cells.map((c) => wrapText(c ?? "", bold ? fontBold : fontRegular, cellSize, colW - pad * 2));
          const rowLines = Math.max(1, ...wrapped.map((w) => w.length));
          const rowH = rowLines * cellSize * 1.3 + pad * 2;
          ensureSpace(rowH);
          const top = y;
          for (let c = 0; c < cols; c++) {
            const x = MARGIN + c * colW;
            page.drawRectangle({ x, y: top - rowH, width: colW, height: rowH, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
            const lines = wrapped[c] ?? [];
            for (let li = 0; li < lines.length; li++) {
              page.drawText(lines[li], { x: x + pad, y: top - pad - cellSize - li * cellSize * 1.3, size: cellSize, font: bold ? fontBold : fontRegular });
            }
          }
          y = top - rowH;
        };
        if (block.header && block.header.length) drawRow(block.header, true);
        for (const row of block.rows ?? []) drawRow(row, false);
        y -= 8;
        break;
      }
    }
  }

  // Translator's certification block
  y -= 16;
  drawRule();
  drawLines("TRANSLATOR'S CERTIFICATION", { font: fontBold, size: 11, gap: 6 });
  drawLines(
    "I hereby certify that the foregoing is a true, complete and accurate translation from Uzbek into English of the attached document, to the best of my knowledge and ability.",
    { size: 10, gap: 10 },
  );
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  drawLines(`Date of translation: ${dateStr}`, { size: 10, gap: 4 });
  drawLines("Signature: ______________________________", { size: 10, gap: 2 });
  drawLines("Translator / Authorised representative", { font: fontItalic, size: 9, color: rgb(0.45, 0.45, 0.45) });

  return await pdf.save();
}

// ---------- Plain text projection (for search / preview) ----------
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
  // Strip code fences if present.
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

    // Staff-only gate: this function can read from the student-documents bucket,
    // so restrict it to staff (mirrors the document-proxy policy).
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
      source,                // { path, bucket }
      supporting = [],       // [{ path, bucket, role }]
      studentName,
      verifiedNames: providedNames,
      regenerate,            // { structured } -> re-render PDF only, no AI call
    } = body;

    if (!documentTypeId) return json({ error: "documentTypeId is required" }, 400);

    const { data: docType, error: typeError } = await supabase
      .from("translation_document_types")
      .select("*")
      .eq("id", documentTypeId)
      .maybeSingle();
    if (typeError || !docType) return json({ error: "Document type not found" }, 404);

    const documentTitle = docType.name_en || docType.name_uz || docType.code;

    // ---- Fast path: re-render PDF from staff-edited structured data ----
    if (regenerate?.structured) {
      const structured: StructuredTranslation = {
        detectedSupportingDocs: regenerate.structured.detectedSupportingDocs ?? [],
        verifiedNames: regenerate.structured.verifiedNames ?? {},
        blocks: regenerate.structured.blocks ?? [],
        unclearItems: regenerate.structured.unclearItems ?? [],
      };
      const pdfBytes = await renderPdf(structured, { documentTitle });
      const pdfPath = `output/${Date.now()}_${docType.code}_translation.pdf`;
      const { error: upErr } = await supabase.storage.from(OUTPUT_BUCKET)
        .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
      if (upErr) return json({ error: `PDF upload failed: ${upErr.message}` }, 500);
      return json({
        structured,
        plainText: blocksToPlainText(structured),
        pdfPath,
        documentType: { code: docType.code, name: docType.name_uz, nameEn: docType.name_en },
      });
    }

    if (!geminiApiKey) return json({ error: "AI service not configured" }, 500);
    if (!source?.path) return json({ error: "source.path is required" }, 400);

    // ---- Download source + supporting files from their respective buckets ----
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

    // ---- Few-shot examples from approved templates (terminology guidance only) ----
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
- The STUDENT's name MUST be copied EXACTLY from their international (foreign) passport — letter for letter, including the MRZ section. Take the patronymic/middle name from the top section if absent from the MRZ.
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
Rules for blocks: the first block should be a "title". Reproduce the source's field order. Use "field" for label/value pairs, "table" for grids (e.g. transcripts), "annotation" for seals/signatures/photos. Only include keys that exist for that block type. Omit father/mother from verifiedNames if not applicable.`;

    const userContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
      ...imageContents,
      { type: "text", text: `Translate the main document (image 1) into English. Identify each supporting identity document and extract names from them. Return the JSON object described in the system prompt.` },
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
    // Apply staff-provided name overrides if present.
    if (providedNames) structured.verifiedNames = { ...structured.verifiedNames, ...providedNames };

    const pdfBytes = await renderPdf(structured, { documentTitle });
    const pdfPath = `output/${Date.now()}_${docType.code}_translation.pdf`;
    const { error: upErr } = await supabase.storage.from(OUTPUT_BUCKET)
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("PDF upload failed:", upErr);
      return json({ error: `PDF upload failed: ${upErr.message}` }, 500);
    }

    return json({
      structured,
      plainText: blocksToPlainText(structured),
      pdfPath,
      documentType: { code: docType.code, name: docType.name_uz, nameEn: docType.name_en },
    });
  } catch (error) {
    console.error("translate-document error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
