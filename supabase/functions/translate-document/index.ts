import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { DIPLOMA_TEMPLATE_BASE64 } from "./templates/diploma-template.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Native Gemini endpoint (NOT the OpenAI-compat one): the OpenAI-compat
// image_url path rasterises a PDF to a single image (first page only), which
// dropped every page after page 1. The native generateContent endpoint with
// inline_data reads ALL pages of a multi-page PDF.
const GEMINI_AI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const OUTPUT_BUCKET = "translation-documents";

const UZBEKISTAN_REGIONS: Record<string, string[]> = {
  "Toshkent shahri": ["Bektemir", "Chilonzor", "Mirzo Ulugbek", "Mirobod", "Olmazor", "Sergeli", "Shayxontohur", "Uchtepa", "Yakkasaroy", "Yangihayot", "Yunusobod"],
  "Toshkent viloyati": ["Angren", "Olmaliq", "Chirchiq", "Bekobod", "Oqqo'rg'on", "Bo'stonliq", "Bo'ka", "Zangiota", "Qibray", "Parkent", "Piskent", "Chinoz"],
  "Samarqand viloyati": ["Samarqand", "Kattaqo'rg'on", "Bulung'ur", "Ishtixon", "Jomboy", "Narpay", "Nurobod", "Oqdaryo", "Payariq", "Toyloq", "Urgut"],
  "Buxoro viloyati": ["Buxoro", "Kogon", "Olot", "G'ijduvon", "Jondor", "Peshku", "Qorako'l", "Romitan", "Shofirkon", "Vobkent"],
  "Farg'ona viloyati": ["Farg'ona", "Marg'ilon", "Quvasoy", "Qo'qon", "Beshariq", "Bog'dod", "Buvayda", "Dang'ara", "Furqat", "Oltiariq", "Quva", "Rishton", "Uchko'prik"],
  "Andijon viloyati": ["Andijon", "Xonobod", "Asaka", "Baliqchi", "Bo'z", "Buloqboshi", "Jalolquduq", "Marhamat", "Oltinko'l", "Shahrixon", "Xo'jaobod"],
  "Namangan viloyati": ["Namangan", "Chortoq", "Chust", "Kosonsoy", "Mingbuloq", "Norin", "Pop", "To'raqo'rg'on", "Uchqo'rg'on"],
  "Qashqadaryo viloyati": ["Qarshi", "Shahrisabz", "Chiroqchi", "Dehqonobod", "G'uzor", "Kasbi", "Kitob", "Koson", "Mirishkor", "Muborak", "Nishon", "Qamashi"],
  "Surxondaryo viloyati": ["Termiz", "Angor", "Bandixon", "Boysun", "Denov", "Jarqo'rg'on", "Muzrabot", "Oltinsoy", "Qiziriq", "Sherobod", "Uzun"],
  "Xorazm viloyati": ["Urganch", "Xiva", "Bog'ot", "Gurlan", "Xonqa", "Xazorasp", "Qo'shko'pir", "Shovot", "Yangiariq"],
  "Navoiy viloyati": ["Navoiy", "Zarafshon", "Konimex", "Karmana", "Navbahor", "Nurota", "Qiziltepa", "Tomdi", "Uchquduq"],
  "Jizzax viloyati": ["Jizzax", "Arnasoy", "Baxmal", "Do'stlik", "Forish", "G'allaorol", "Mirzacho'l", "Paxtakor", "Zafarobod", "Zomin"],
  "Sirdaryo viloyati": ["Guliston", "Yangiyer", "Shirin", "Boyovut", "Mirzaobod", "Oqoltin", "Sayxunobod", "Sardoba", "Xovos"],
  "Qoraqalpog'iston": ["Nukus", "Amudaryo", "Beruniy", "Chimboy", "Ellikqala", "Kegeyli", "Mo'ynoq", "Qanliko'l", "Qo'ng'irot", "Shumanay", "Taxtako'pir", "To'rtko'l", "Xo'jayli"],
};

// ---------------------------------------------------------------------------
// Fixed per-document-type layouts. Keyed by translation_document_types.code.
// When a layout exists for the document being translated, the model MUST emit
// the blocks in exactly this order, with these exact English labels/wording, so
// the same document type always comes out in the same certified format.
// ---------------------------------------------------------------------------
const LAYOUT_TEMPLATES: Record<string, string> = {
  birth_certificate: `=== REQUIRED LAYOUT (Birth Certificate) ===
A birth certificate MUST be translated using EXACTLY the block sequence, labels
and wording below. Keep every English label verbatim. Fill each value from the
document (and from the supporting passports / ID cards for names). Skip a "field"
only when that information is genuinely not present on the certificate.
Do NOT put a trailing colon in any field "label" — the renderer adds ": "
automatically (so label "Father" renders as "Father: ...").

1.  title       text="BIRTH CERTIFICATE"
2.  spacer
3.  field   label="This is to certify that citizen"  value=<child's full name (from passport)>
4.  field   label="Was born on"                       value=<date of birth, numeric DD.MM.YYYY>
5.  field   label="Place of birth: city"              value=<city / settlement>
6.  field   label="District of"                       value=<district>
7.  field   label="Region of"                         value=<region>
8.  field   label="Republic of"                       value=<country, e.g. UZBEKISTAN>
9.  paragraph  text="Of which in the Book of birth registration on <registration date>"
10. spacer
11. paragraph  text="a corresponding record was entered under No. <record number>"
12. spacer
13. field   label="Father"                            value=<father's full name (from his passport/ID)>
14. field   label="Nationality"                       value=<father's nationality, e.g. UZBEK>
15. field   label="Mother"                             value=<mother's full name (from her passport/ID)>
16. field   label="Nationality"                        value=<mother's nationality, e.g. UZBEK>
17. paragraph  text="Place of registration Civil Registry Office <office / city>"
18. field   label="Date of issue"                      value=<date of issue>
19. field   label="Head of Civil Registry office"      value="signed"
20. annotation text="Office Seal"
21. spacer
22. paragraph  text="<series> № <number>"   (certificate serial, e.g. "I-TV № 0255200")

DATE STYLE for this document:
- "Was born on" stays numeric DD.MM.YYYY (e.g. 01.09.2008).
- The registration date and "Date of issue" use the English month name, then the
  day and year: "MONTH DD.YYYY" (e.g. 11.01.2008 -> "JANUARY 11.2008").

PLACE NAMES (Place of birth / District / Region / Place of registration):
- Write every place name in its ENGLISH (international) spelling — NOT the Uzbek
  Latin form, and WITHOUT Uzbek apostrophes. They are proper nouns: never translate
  the descriptor words (tuman / shahar / shahri / viloyat / hudud / district /
  region / city / area) into the value.
- Use the standard English names. Examples:
  Toshkent -> TASHKENT, Farg'ona -> FERGANA, Buxoro -> BUKHARA,
  Samarqand -> SAMARKAND, Andijon -> ANDIJAN, Namangan -> NAMANGAN,
  Qashqadaryo -> KASHKADARYA, Surxondaryo -> SURKHANDARYA, Xorazm -> KHOREZM,
  Navoiy -> NAVOI, Jizzax -> JIZZAKH, Sirdaryo -> SYRDARYA,
  Qoraqalpog'iston -> KARAKALPAKSTAN, Qo'qon -> KOKAND, Marg'ilon -> MARGILAN,
  Xiva -> KHIVA, Bekobod -> BEKABAD, Nukus -> NUKUS, Termiz -> TERMEZ.
- Identify the place by matching the "UZBEKISTAN PLACES" list above, then output its
  English spelling. For a small district/town with no well-known English name,
  transcribe it without apostrophes (e.g. Quva -> QUVA, Beshariq -> BESHARIK).
- Only append " [unclear]" when the place genuinely cannot be identified — do NOT
  guess a word like "hudud".

CAPITALISATION (match the sample exactly):
- Every field VALUE is in UPPERCASE — full names, cities, districts, regions,
  nationalities (e.g. OMONOVA DILNOZAXON MUXTOR QIZI, FERGANA, UZBEKISTAN, UZBEK).
- In dates the month is in CAPITALS (e.g. JANUARY 10.2003).
- The only lowercase value is "signed" (Head of Civil Registry office).
- Keep the bold labels in normal sentence case exactly as written above.`,
};

// ---------------------------------------------------------------------------
// Fixed-LAYOUT template fill. Some document types must come out in an EXACT
// certified Word layout (tables, borders, fonts) that the block renderer cannot
// reproduce. For those we keep a staff-approved .docx as a bundled template with
// {{TOKEN}} placeholders and only swap text inside it, so the layout stays
// byte-identical and only the student's data changes.
// ---------------------------------------------------------------------------
interface TemplateConfig { base64: string; fieldSchema: string }
const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {
  // PT — Primary/Professional ("kasbiy ta'lim") diploma + supplement (ilova).
  diploma: {
    base64: DIPLOMA_TEMPLATE_BASE64,
    fieldSchema: `"fields": {
  "STUDENT_NAME": "graduate full name in UPPERCASE, exactly as in the international passport",
  "SURNAME": "graduate surname only",
  "GIVEN_NAMES": "graduate given name(s)/patronymic only",
  "DIPLOMA_NUMBER": "digits after 'PT №' (e.g. 0213785)",
  "SCHOOL": "issuing vocational school in English (e.g. Angren city vocational school No.2)",
  "SPECIALTY": "specialty/kasb-hunar (e.g. Diagnostics and repair of motor vehicles)",
  "QUALIFICATIONS": "awarded qualifications, comma-separated",
  "FIELD_OF_STUDY": "field of study/yo'nalish (section 2.2)",
  "DOB": "date of birth DD.MM.YYYY",
  "PREV_EDU": "previous education line (years, school, document No.)",
  "GAC_DATE": "State Attestation Commission decision date, long form (e.g. June 28, 2024)",
  "GAC_DECISION": "GAC decision text (e.g. Decision No.1 dated June 28,2024)",
  "LEVEL": "education level (usually 'Primary professional education')",
  "LENGTH": "length of education (e.g. 2 Years)",
  "EDU_TYPE": "type of education (e.g. Day Time)",
  "DESC_34": "section 3.4 programme/competencies description",
  "CHAIRMAN": "GAC chairman name",
  "DIRECTOR": "director short name (e.g. Muminov Farkhod)",
  "DIRECTOR_FULL": "director full name incl. patronymic (signature block)",
  "DEPUTY_FULL": "deputy director full name incl. patronymic (signature block)",
  "REG_NUMBER": "registration number (e.g. 138)",
  "ISSUE_DATE": "date of issue, long form (e.g. July 05, 2024)",
  "ISSUE_PLACE": "place of issue (e.g. Tashkent)",
  "LANG": "language of instruction (e.g. Uzbek)",
  "ADDITIONAL_INFO": "section 4 additional information, or 'None'"
},
"subjects": [{ "name": "course/module name in English", "hours": "total hours (number)", "mark": "<digit> (excellent|good|satisfactory)" }],
"attestations": [{ "name": "state attestation/exam name in English", "hours": "hours (number)", "mark": "<digit> (excellent|good|satisfactory)" }]`,
  },
};

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Duplicate the single template <w:tr> containing {{MARKER}} once per data row.
function expandTemplateRows(xml: string, marker: string, rows: string[][], keys: string[]): string {
  const token = `{{${marker}}}`;
  return xml.replace(/<w:tr[ >][\s\S]*?<\/w:tr>/g, (rowXml) => {
    if (!rowXml.includes(token)) return rowXml;
    return rows.map((vals) => {
      let r = rowXml;
      keys.forEach((k, i) => { r = r.split(`{{${k}}}`).join(escXml(vals[i] ?? "")); });
      return r;
    }).join("");
  });
}

interface TemplateData {
  fields: Record<string, string>;
  subjects: Array<{ name?: string; hours?: string | number; mark?: string }>;
  attestations: Array<{ name?: string; hours?: string | number; mark?: string }>;
}

async function renderTemplateDocx(cfg: TemplateConfig, data: TemplateData): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(decodeBase64ToBytes(cfg.base64));
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) throw new Error("Template is missing word/document.xml");
  let xml = await docXmlFile.async("string");
  const subjRows = (data.subjects ?? []).map((s, i) => [String(i + 1), s.name ?? "", String(s.hours ?? ""), s.mark ?? ""]);
  const attRows = (data.attestations ?? []).map((a, i) => [String(i + 1), a.name ?? "", String(a.hours ?? ""), a.mark ?? ""]);
  xml = expandTemplateRows(xml, "S_NO", subjRows, ["S_NO", "S_NAME", "S_HOURS", "S_MARK"]);
  xml = expandTemplateRows(xml, "A_NO", attRows, ["A_NO", "A_NAME", "A_HOURS", "A_MARK"]);
  for (const [k, v] of Object.entries(data.fields ?? {})) xml = xml.split(`{{${k}}}`).join(escXml(String(v ?? "")));
  xml = xml.replace(/\{\{[A-Z_0-9]+\}\}/g, "");
  zip.file("word/document.xml", xml);
  return (await zip.generateAsync({ type: "uint8array", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })) as Uint8Array;
}

function parseTemplateData(raw: string): TemplateData {
  let text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch {
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s === -1 || e === -1) throw new Error("AI did not return valid JSON");
    parsed = JSON.parse(text.slice(s, e + 1));
  }
  return {
    fields: parsed.fields && typeof parsed.fields === "object" ? parsed.fields : {},
    subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
    attestations: Array.isArray(parsed.attestations) ? parsed.attestations : [],
  };
}

function templateToPlainText(data: TemplateData): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data.fields ?? {})) if (v) parts.push(`${k}: ${v}`);
  parts.push("", "Subjects:");
  (data.subjects ?? []).forEach((s, i) => parts.push(`${i + 1}. ${s.name ?? ""} — ${s.hours ?? ""} — ${s.mark ?? ""}`));
  parts.push("", "State attestations:");
  (data.attestations ?? []).forEach((a, i) => parts.push(`${i + 1}. ${a.name ?? ""} — ${a.hours ?? ""} — ${a.mark ?? ""}`));
  return parts.join("\n");
}

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
    case "jpg": case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

// ---------- XML helper ----------
function escXml(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------- DOCX generator (manual XML + JSZip) ----------
function makeParagraph(text: string, opts: { bold?: boolean; heading?: boolean; italic?: boolean; size?: number; center?: boolean; color?: string } = {}): string {
  const sz = (opts.size ?? 12) * 2; // half-points
  const boldTag = opts.bold || opts.heading ? "<w:b/>" : "";
  const italicTag = opts.italic ? "<w:i/>" : "";
  const colorTag = opts.color ? `<w:color w:val="${opts.color}"/>` : "";
  const szTag = `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`;
  const align = opts.center ? `<w:jc w:val="center"/>` : "";
  const outlineLvl = opts.heading ? `<w:outlineLvl w:val="1"/>` : "";
  const spacing = opts.heading ? `<w:spacing w:after="100" w:before="200"/>` : `<w:spacing w:after="80"/>`;

  const runs = text ? `<w:r><w:rPr>${boldTag}${italicTag}${colorTag}${szTag}</w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r>` : "";

  return `<w:p><w:pPr>${align}${outlineLvl}${spacing}</w:pPr>${runs}</w:p>`;
}

function makeFieldParagraph(label: string, value: string): string {
  const sz = 12 * 2;
  return `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escXml(label + ": ")}</w:t></w:r>` +
    `<w:r><w:rPr><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escXml(value ?? "")}</w:t></w:r>` +
    `</w:p>`;
}

function makeTableXml(header: string[] | undefined, rows: string[][]): string {
  const cols = Math.max(header?.length ?? 0, ...rows.map((r) => r.length), 1);
  const colWidthTwips = Math.floor(8640 / cols);

  const makeCell = (text: string, bold: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="${colWidthTwips}" w:type="dxa"/></w:tcPr>` +
    `<w:p><w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>` +
    `<w:t xml:space="preserve">${escXml(text ?? "")}</w:t></w:r></w:p></w:tc>`;

  const makeRow = (cells: string[], bold: boolean) =>
    `<w:tr>${cells.map((c) => makeCell(c, bold)).join("")}</w:tr>`;

  const gridCols = Array.from({ length: cols }, () => `<w:gridCol w:w="${colWidthTwips}"/>`).join("");

  let tableRows = "";
  if (header?.length) tableRows += makeRow(header, true);
  for (const row of rows) {
    const padded = [...row];
    while (padded.length < cols) padded.push("");
    tableRows += makeRow(padded, false);
  }

  return `<w:tbl><w:tblPr><w:tblW w:w="8640" w:type="dxa"/>` +
    `<w:tblBorders><w:top w:val="single" w:sz="4" w:color="AAAAAA"/><w:left w:val="single" w:sz="4" w:color="AAAAAA"/>` +
    `<w:bottom w:val="single" w:sz="4" w:color="AAAAAA"/><w:right w:val="single" w:sz="4" w:color="AAAAAA"/>` +
    `<w:insideH w:val="single" w:sz="4" w:color="AAAAAA"/><w:insideV w:val="single" w:sz="4" w:color="AAAAAA"/></w:tblBorders>` +
    `</w:tblPr><w:tblGrid>${gridCols}</w:tblGrid>${tableRows}</w:tbl>` +
    `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>`;
}

async function renderDocx(structured: StructuredTranslation, meta: { documentTitle: string }): Promise<Uint8Array> {
  const bodyParts: string[] = [];

  for (const block of structured.blocks ?? []) {
    switch (block.type) {
      case "title":
        bodyParts.push(makeParagraph(block.text.toUpperCase(), { bold: true, heading: true, size: 16, center: true }));
        break;
      case "heading":
        bodyParts.push(makeParagraph(block.text, { bold: true, size: 12 }));
        break;
      case "field":
        bodyParts.push(makeFieldParagraph(block.label, block.value));
        break;
      case "paragraph":
        bodyParts.push(makeParagraph(block.text));
        break;
      case "annotation":
        bodyParts.push(makeParagraph(`[${block.text.replace(/^\[|\]$/g, "")}]`, { italic: true, size: 10, color: "666666" }));
        break;
      case "spacer":
        bodyParts.push(`<w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>`);
        break;
      case "table":
        bodyParts.push(makeTableXml(block.header, block.rows));
        break;
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  mc:Ignorable="w14 wpc">
  <w:body>
${bodyParts.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsMain = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", relsMain);
  zip.file("word/document.xml", documentXml);

  const blob: Blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
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
    const isStaff = (roles ?? []).some((r: { role: string }) => ["owner", "admin", "document_handler", "call_operator"].includes(r.role));
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { documentTypeId, source, supporting = [], studentName, verifiedNames: providedNames, regenerate } = body;

    if (!documentTypeId) return json({ error: "documentTypeId is required" }, 400);

    const { data: docType, error: typeError } = await supabase
      .from("translation_document_types").select("*").eq("id", documentTypeId).maybeSingle();
    if (typeError || !docType) return json({ error: "Document type not found" }, 404);

    const documentTitle = docType.name_en || docType.name_uz || docType.code;

    // ---- Fast path: re-render DOCX ----
    if (regenerate?.structured) {
      // Fixed-layout (template) types re-fill the bundled template from stored fields.
      const regenCfg = TEMPLATE_CONFIGS[docType.code];
      if (regenCfg && regenerate.structured.template) {
        const data: TemplateData = {
          fields: regenerate.structured.fields ?? {},
          subjects: regenerate.structured.subjects ?? [],
          attestations: regenerate.structured.attestations ?? [],
        };
        const docxBytes = await renderTemplateDocx(regenCfg, data);
        const docxPath = `output/${Date.now()}_${docType.code}_translation.docx`;
        const { error: upErr } = await supabase.storage.from(OUTPUT_BUCKET)
          .upload(docxPath, docxBytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
        if (upErr) return json({ error: `DOCX upload failed: ${upErr.message}` }, 500);
        const structured = { template: docType.code, fields: data.fields, subjects: data.subjects, attestations: data.attestations, verifiedNames: regenerate.structured.verifiedNames ?? {} };
        return json({ structured, plainText: templateToPlainText(data), docxPath, documentType: { code: docType.code, name: docType.name_uz, nameEn: docType.name_en } });
      }
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
      return json({ structured, plainText: blocksToPlainText(structured), docxPath, documentType: { code: docType.code, name: docType.name_uz, nameEn: docType.name_en } });
    }

    if (!geminiApiKey) return json({ error: "AI service not configured" }, 500);
    if (!source?.path) return json({ error: "source.path is required" }, 400);

    // ---- Download files ----
    const downloadFile = async (path: string, bucket: string) => {
      const { data, error } = await supabase.storage.from(bucket || OUTPUT_BUCKET).download(path);
      if (error || !data) throw new Error(`Could not download ${bucket}/${path}: ${error?.message ?? "not found"}`);
      return data;
    };

    // Build native Gemini "parts": each file as inline_data so multi-page PDFs
    // are read in full. The MAIN document is the first part.
    const mediaParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    const srcBlob = await downloadFile(source.path, source.bucket);
    mediaParts.push({ inlineData: { mimeType: getMimeType(source.path), data: await fileToBase64(srcBlob) } });

    const supportingRoles: string[] = [];
    for (const sup of supporting) {
      try {
        const blob = await downloadFile(sup.path, sup.bucket);
        mediaParts.push({ inlineData: { mimeType: getMimeType(sup.path), data: await fileToBase64(blob) } });
        supportingRoles.push(sup.role || "supporting document");
      } catch (e) {
        console.warn("Skipping supporting file:", sup.path, (e as Error).message);
      }
    }

    // ---- Fixed-layout template path (PT professional-education diploma) ----
    // Produces the EXACT certified Word layout of the approved sample by filling
    // a bundled .docx template, instead of the generic block renderer.
    const templateCfg = TEMPLATE_CONFIGS[docType.code];
    if (templateCfg) {
      const tplSystemPrompt = `You are an expert sworn translator. The files are an Uzbek "Primary Professional Education" diploma (PT diploma) and its supplement/appendix (ilova); later files may be identity documents for name spelling.

Read EVERY page (the diploma AND the full supplement). Extract every value, translate to English, and return JSON to fill a fixed certified template. Include ALL subjects/modules (with hours and marks) and ALL state attestations — never summarise or skip rows.

=== NAME ACCURACY ===
- The graduate's name MUST match the international passport EXACTLY. UPPERCASE for STUDENT_NAME.
${providedNames ? `- STAFF-VERIFIED NAMES (use exactly): ${JSON.stringify(providedNames)}` : ""}

=== RULES ===
- Marks formatted as "<digit> (excellent|good|satisfactory)" (5=excellent, 4=good, 3=satisfactory).
- Hours are numbers. Keep subjects in original order. Missing value -> "".
- Cyrillic->Latin transliteration for names/places.

=== OUTPUT (JSON only, no prose) ===
{
${templateCfg.fieldSchema},
"verifiedNames": { "student": "..." },
"unclearItems": ["..."]
}`;

      const tplResp = await fetch(`${GEMINI_AI_URL}?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: tplSystemPrompt }] },
          contents: [{ role: "user", parts: [...mediaParts, { text: "Extract and translate the PT diploma and its full supplement into the JSON object. Include ALL subjects and state attestations." }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 32000, responseMimeType: "application/json" },
        }),
      });
      if (!tplResp.ok) {
        const errorText = await tplResp.text();
        console.error("AI error (template):", tplResp.status, errorText);
        if (tplResp.status === 429) return json({ error: "Tizim band. Keyinroq urinib ko'ring." }, 429);
        if (tplResp.status === 402) return json({ error: "AI xizmati uchun kredit tugagan." }, 402);
        return json({ error: `AI xizmatida xatolik: ${tplResp.status}` }, 500);
      }
      const tplData = await tplResp.json();
      const tplJson = (tplData.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      if (!tplJson) return json({ error: "Tarjima olinmadi" }, 500);

      const data = parseTemplateData(tplJson);
      if (providedNames?.student) data.fields.STUDENT_NAME = providedNames.student;
      const docxBytes = await renderTemplateDocx(templateCfg, data);
      const docxPath = `output/${Date.now()}_${docType.code}_translation.docx`;
      const { error: upErr } = await supabase.storage.from(OUTPUT_BUCKET)
        .upload(docxPath, docxBytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
      if (upErr) { console.error("DOCX upload failed:", upErr); return json({ error: `DOCX upload failed: ${upErr.message}` }, 500); }

      const structured = { template: docType.code, fields: data.fields, subjects: data.subjects, attestations: data.attestations, verifiedNames: data.fields.STUDENT_NAME ? { student: data.fields.STUDENT_NAME } : {} };
      return json({ structured, plainText: templateToPlainText(data), docxPath, documentType: { code: docType.code, name: docType.name_uz, nameEn: docType.name_en } });
    }

    // ---- Few-shot examples ----
    const { data: templates } = await supabase
      .from("translation_templates").select("original_text, translated_text")
      .eq("document_type_id", documentTypeId).eq("is_approved", true).limit(3);
    const trainingExamples = (templates ?? [])
      .filter((t) => t.original_text && t.translated_text)
      .map((t, i) => `=== Example ${i + 1} ===\nUZBEK:\n${t.original_text}\n\nENGLISH:\n${t.translated_text}`)
      .join("\n\n");

    // Per-document-type fixed layouts. When present, the model MUST follow the
    // exact block sequence/labels below so a given document type always comes
    // out in the same certified format (independent of few-shot examples).
    const documentLayout = LAYOUT_TEMPLATES[docType.code] ?? "";

    const systemPrompt = `You are an expert sworn translator producing certified Uzbek-to-English translations of official documents for Korean university applications.

DOCUMENT TYPE: ${docType.name_uz} (${docType.name_en || docType.code})

You receive one or more files. The FIRST file is the MAIN document to translate (it may be a multi-page PDF). Any further files are SUPPORTING identity documents (passports / ID cards) provided so you spell names correctly.
${supportingRoles.length ? `Supporting documents provided (in order): ${supportingRoles.join(", ")}.` : ""}

=== NAME ACCURACY (CRITICAL) ===
- The STUDENT's name MUST be copied EXACTLY from their international (biometric/foreign) passport — letter for letter, including the MRZ section.
- PARENTS' names MUST be copied EXACTLY from their passport / ID card, NEVER from the birth certificate.
- For ID cards the name is already in Latin script — copy it verbatim.
- If a name cannot be confirmed from an identity document, add it to "unclearItems".
${providedNames ? `\nSTAFF-VERIFIED NAMES (use these exactly): ${JSON.stringify(providedNames)}` : ""}

=== OCR RULES ===
- Cyrillic to Latin: U with breve -> O', Q with tail -> Q, G with stroke -> G', H with tail -> H, Sh -> Sh, Ch -> Ch.
- Dates are usually DD.MM.YYYY. Preserve registry/serial numbers exactly.
- Represent stamps, seals, signatures as annotation blocks.
- For unclear handwriting use " [unclear]" suffix and list in unclearItems.

=== MULTI-PAGE (CRITICAL) ===
- The MAIN document (the first file) may contain SEVERAL pages (e.g. a diploma or
  its grade transcript / supplement). You MUST translate EVERY page of the main
  document in full — never stop after the first page.
- Translate the pages in order. Before each page AFTER the first, insert a
  "heading" block with text "Page 2", "Page 3", ... so the pages are separated.
- Render grade/subject transcripts as "table" blocks (one row per subject), and
  keep ALL rows — do not summarise or omit any subject.
- Do NOT translate the SUPPORTING identity documents (the later files); they are
  only for spelling names.

=== UZBEKISTAN PLACES ===
${Object.entries(UZBEKISTAN_REGIONS).map(([r, d]) => `${r}: ${d.join(", ")}`).join("\n")}

${trainingExamples ? `=== APPROVED EXAMPLES ===\n${trainingExamples}\n` : ""}
${documentLayout ? `${documentLayout}\n` : ""}
${studentName ? `Student (cross-check against passport): ${studentName}` : ""}

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
First block must be "title". Use "field" for label/value pairs, "table" for grids, "annotation" for seals/stamps.`;

    const userParts = [
      ...mediaParts,
      { text: "Translate the MAIN document (the first file) into English — EVERY page, including all transcript/supplement pages, not just the first. Extract names from the supporting identity documents. Return the JSON object." },
    ];

    const aiResponse = await fetch(`${GEMINI_AI_URL}?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: userParts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 32000,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) return json({ error: "Tizim band. Keyinroq urinib ko'ring." }, 429);
      if (aiResponse.status === 402) return json({ error: "AI xizmati uchun kredit tugagan." }, 402);
      return json({ error: `AI xizmatida xatolik: ${aiResponse.status}` }, 500);
    }

    const aiData = await aiResponse.json();
    const content = (aiData.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (!content) {
      console.error("Empty AI content:", JSON.stringify(aiData).slice(0, 800));
      return json({ error: "Tarjima olinmadi" }, 500);
    }

    const structured = parseStructured(content);
    if (providedNames) structured.verifiedNames = { ...structured.verifiedNames, ...providedNames };

    // Birth certificates: the sample shows every field VALUE in UPPERCASE (names,
    // places, nationalities) with only "signed" left lowercase. Enforce this
    // deterministically so casing never drifts run to run.
    if (docType.code === "birth_certificate") {
      structured.blocks = structured.blocks.map((b) =>
        b.type === "field" && b.value && b.value.trim().toLowerCase() !== "signed"
          ? { ...b, value: b.value.toUpperCase() }
          : b
      );
    }

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
