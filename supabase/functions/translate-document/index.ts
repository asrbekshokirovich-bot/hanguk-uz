import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Uzbekistan regions and districts for handwriting disambiguation
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
  "Qoraqalpog'iston": ["Nukus", "Amudaryo", "Beruniy", "Chimboy", "Ellikqala", "Kegeyli", "Mo'ynoq", "Qanliko'l", "Qo'ng'irot", "Shumanay", "Taxtako'pir", "To'rtko'l", "Xo'jayli"]
};

// Convert file to base64 data URL for Gemini vision
async function fileToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Get MIME type from file path/extension
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    default: return 'application/octet-stream';
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function crc32(data: Uint8Array): number {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createZip(files: Map<string, Uint8Array>): Uint8Array {
  const parts: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();

  for (const [filename, content] of files) {
    const filenameBytes = encoder.encode(filename);
    const crc = crc32(content);
    
    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const localView = new DataView(localHeader.buffer);
    
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, filenameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(filenameBytes, 30);
    
    parts.push(localHeader);
    parts.push(content);
    
    const centralHeader = new Uint8Array(46 + filenameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, filenameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(filenameBytes, 46);
    
    centralDirectory.push(centralHeader);
    offset += localHeader.length + content.length;
  }
  
  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const cd of centralDirectory) {
    parts.push(cd);
    centralDirSize += cd.length;
    offset += cd.length;
  }
  
  const endOfCentral = new Uint8Array(22);
  const endView = new DataView(endOfCentral.buffer);
  
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.size, true);
  endView.setUint16(10, files.size, true);
  endView.setUint32(12, centralDirSize, true);
  endView.setUint32(16, centralDirOffset, true);
  endView.setUint16(20, 0, true);
  
  parts.push(endOfCentral);
  
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }
  
  return result;
}

// Parse template to extract exact formatting structure
interface TemplateFormatElement {
  type: 'heading' | 'field' | 'paragraph' | 'signature' | 'empty';
  text: string;
  label?: string;
  value?: string;
  style: {
    bold: boolean;
    italic: boolean;
    centered: boolean;
    fontSize: number;
    uppercase: boolean;
  };
}

function parseTemplateFormat(templateText: string): TemplateFormatElement[] {
  const lines = templateText.split('\n');
  const elements: TemplateFormatElement[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) {
      elements.push({
        type: 'empty',
        text: '',
        style: { bold: false, italic: false, centered: false, fontSize: 22, uppercase: false }
      });
      continue;
    }
    
    // Detect headings (all caps, typically titles)
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 100 && !trimmed.includes(':')) {
      elements.push({
        type: 'heading',
        text: trimmed,
        style: { bold: true, italic: false, centered: true, fontSize: 28, uppercase: true }
      });
    }
    // Detect section headings (Roman numerals or numbered)
    else if (/^[IVX]+\.\s/.test(trimmed) || /^[0-9]+\.\s[A-Z]/.test(trimmed)) {
      elements.push({
        type: 'heading',
        text: trimmed,
        style: { bold: true, italic: false, centered: false, fontSize: 24, uppercase: false }
      });
    }
    // Detect labeled fields (Label: Value)
    else if (/^[A-Za-z\s'()/]+:\s*.+/.test(trimmed)) {
      const colonIdx = trimmed.indexOf(':');
      const label = trimmed.substring(0, colonIdx).trim();
      const value = trimmed.substring(colonIdx + 1).trim();
      elements.push({
        type: 'field',
        text: trimmed,
        label,
        value,
        style: { bold: false, italic: false, centered: false, fontSize: 22, uppercase: false }
      });
    }
    // Detect signature lines
    else if (trimmed.includes('Signature') || trimmed.includes('___') || trimmed.includes('Seal') || trimmed.includes('L.S.') || trimmed.includes('M.P.')) {
      elements.push({
        type: 'signature',
        text: trimmed,
        style: { bold: false, italic: false, centered: false, fontSize: 22, uppercase: false }
      });
    }
    // Regular paragraphs
    else {
      elements.push({
        type: 'paragraph',
        text: trimmed,
        style: { bold: false, italic: false, centered: false, fontSize: 22, uppercase: false }
      });
    }
  }
  
  return elements;
}

// Generate DOCX with EXACT template formatting
function generateDocxFromTemplate(translatedText: string, templateElements: TemplateFormatElement[], documentTitle: string): Uint8Array {
  const translatedLines = translatedText.split('\n');
  let bodyContent = '';
  
  // If we have template elements, try to match structure
  if (templateElements.length > 0) {
    let translatedIdx = 0;
    
    for (const elem of templateElements) {
      if (translatedIdx >= translatedLines.length) break;
      
      const currentLine = translatedLines[translatedIdx]?.trim() || '';
      
      if (elem.type === 'empty') {
        bodyContent += `<w:p><w:pPr><w:spacing w:before="120" w:after="120"/></w:pPr></w:p>`;
        continue;
      }
      
      // Skip empty lines in translation
      while (translatedIdx < translatedLines.length && !translatedLines[translatedIdx].trim()) {
        translatedIdx++;
      }
      
      if (translatedIdx >= translatedLines.length) break;
      const line = translatedLines[translatedIdx].trim();
      
      const fontSize = elem.style.fontSize;
      const jc = elem.style.centered ? '<w:jc w:val="center"/>' : '';
      const boldTag = elem.style.bold ? '<w:b/>' : '';
      
      if (elem.type === 'heading') {
        bodyContent += `<w:p><w:pPr>${jc}<w:spacing w:before="240" w:after="120"/></w:pPr><w:r><w:rPr>${boldTag}<w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`;
      }
      else if (elem.type === 'field' && line.includes(':')) {
        const colonIdx = line.indexOf(':');
        const label = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        bodyContent += `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(label)}:</w:t></w:r><w:r><w:rPr><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr><w:t xml:space="preserve"> ${escapeXml(value)}</w:t></w:r></w:p>`;
      }
      else if (elem.type === 'signature') {
        bodyContent += `<w:p><w:pPr><w:spacing w:before="360" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`;
      }
      else {
        bodyContent += `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`;
      }
      
      translatedIdx++;
    }
    
    // Add any remaining lines
    while (translatedIdx < translatedLines.length) {
      const line = translatedLines[translatedIdx].trim();
      if (line) {
        bodyContent += `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`;
      }
      translatedIdx++;
    }
  } else {
    // Fallback: auto-detect formatting from translated text
    for (const line of translatedLines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        bodyContent += `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr></w:p>`;
        continue;
      }
      
      if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 5 && trimmedLine.length < 100) {
        bodyContent += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${escapeXml(trimmedLine)}</w:t></w:r></w:p>`;
      }
      else if (/^[IVX]+\.\s/.test(trimmedLine) || /^[0-9]+\.\s[A-Z]/.test(trimmedLine)) {
        bodyContent += `<w:p><w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${escapeXml(trimmedLine)}</w:t></w:r></w:p>`;
      }
      else if (/^[A-Za-z\s'()/]+:\s/.test(trimmedLine)) {
        const colonIdx = trimmedLine.indexOf(':');
        const label = trimmedLine.substring(0, colonIdx);
        const value = trimmedLine.substring(colonIdx + 1).trim();
        bodyContent += `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(label)}:</w:t></w:r><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve"> ${escapeXml(value)}</w:t></w:r></w:p>`;
      }
      else if (trimmedLine.includes('Signature') || trimmedLine.includes('___') || trimmedLine.includes('Seal') || trimmedLine.includes('L.S.')) {
        bodyContent += `<w:p><w:pPr><w:spacing w:before="360" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(trimmedLine)}</w:t></w:r></w:p>`;
      }
      else {
        bodyContent += `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(trimmedLine)}</w:t></w:r></w:p>`;
      }
    }
  }
  
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyContent}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  const files = new Map<string, Uint8Array>();
  const encoder = new TextEncoder();
  files.set('[Content_Types].xml', encoder.encode(contentTypes));
  files.set('_rels/.rels', encoder.encode(rels));
  files.set('word/_rels/document.xml.rels', encoder.encode(docRels));
  files.set('word/document.xml', encoder.encode(documentXml));
  
  return createZip(files);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      documentTypeId, 
      sourceText,
      sourceFilePath,
      studentName,
      parentNames,
      additionalContext,
      passportData,
      idCardData,
      supportingFilePaths,
      generateDocx: shouldGenerateDocx = true
    } = await req.json();

    console.log('Translation request:', { 
      documentTypeId, 
      hasSourceText: !!sourceText,
      hasSourceFilePath: !!sourceFilePath,
      hasPassportData: !!passportData,
      hasIdCardData: !!idCardData,
      supportingFilesCount: supportingFilePaths?.length || 0,
      generateDocx: shouldGenerateDocx
    });

    if (!documentTypeId) {
      return new Response(
        JSON.stringify({ error: 'documentTypeId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sourceText && !sourceFilePath) {
      return new Response(
        JSON.stringify({ error: 'Either sourceText or sourceFilePath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch document type
    const { data: docType, error: typeError } = await supabase
      .from('translation_document_types')
      .select('*')
      .eq('id', documentTypeId)
      .maybeSingle();

    if (typeError || !docType) {
      console.error('Document type not found:', typeError);
      return new Response(
        JSON.stringify({ error: 'Document type not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Document type:', docType.code, docType.name_uz);

    // Fetch approved training templates with their TRANSLATED TEXT for format matching
    const { data: templates, error: templatesError } = await supabase
      .from('translation_templates')
      .select('original_text, translated_text, notes, translated_file_path')
      .eq('document_type_id', documentTypeId)
      .eq('is_approved', true)
      .limit(5);

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
    }

    console.log('Training templates found:', templates?.length || 0);

    // Build training examples and extract EXACT format structure
    let trainingExamples = '';
    let templateElements: TemplateFormatElement[] = [];
    let primaryTemplateText = '';
    
    if (templates && templates.length > 0) {
      const primaryTemplate = templates.find(t => t.translated_text) || templates[0];
      if (primaryTemplate?.translated_text) {
        primaryTemplateText = primaryTemplate.translated_text;
        templateElements = parseTemplateFormat(primaryTemplateText);
        console.log('Parsed template elements:', templateElements.length);
      }
      
      trainingExamples = templates.filter(t => t.original_text && t.translated_text).map((t, i) => `
=== Training Example ${i + 1} ===
UZBEK ORIGINAL:
${t.original_text}

ENGLISH TRANSLATION (USE THIS EXACT FORMAT):
${t.translated_text}
${t.notes ? `Notes: ${t.notes}` : ''}
`).join('\n');
    }

    // Build comprehensive document identification instructions
    const documentIdentificationRules = `
=== CRITICAL: SUPPORTING DOCUMENT IDENTIFICATION ===

You will receive multiple images. You MUST identify each supporting document:

1. STUDENT'S INTERNATIONAL PASSPORT:
   - Look for "O'ZBEKISTON RESPUBLIKASI / REPUBLIC OF UZBEKISTAN" on cover or first page
   - Has "PASSPORT / PASPORT" text
   - Contains MRZ (Machine Readable Zone) with 2 lines of characters at bottom
   - Usually shows a young person (student age: 17-25)
   - Name appears in format: SURNAME<<GIVEN NAME

2. FATHER'S DOCUMENT (Passport or ID Card):
   - Male person, typically older (40-60 years)
   - May have relationship context from birth certificate (OTASI = Father)
   - If birth certificate shows "Otasi: ABDULLAYEV MUHAMMADJON" - look for passport/ID matching this name
   
3. MOTHER'S DOCUMENT (Passport or ID Card):
   - Female person, typically older (40-60 years)  
   - May have relationship context from birth certificate (ONASI = Mother)
   - If birth certificate shows "Onasi: ABDULLAYEVA GULNORA" - look for passport/ID matching this name

DOCUMENT TYPE IDENTIFICATION:
- UZBEK PASSPORT (Biometric): Blue cover, has chip symbol, MRZ at bottom, name in two sections (Uzbek on top, English in MRZ)
- UZBEK ID CARD: Plastic card format, has photo, name in Latin script already, no MRZ lines like passport
- INTERNATIONAL PASSPORT: Standard passport format, full English name in MRZ section

For each supporting document, report:
[DOCUMENT_IDENTIFIED: Student Passport / Father Passport / Father ID Card / Mother Passport / Mother ID Card]
[NAME_EXTRACTED: FULL NAME HERE]

=== NAME EXTRACTION PRIORITY ===
When you identify who each document belongs to, use these rules:

FOR STUDENT:
1. Use name from INTERNATIONAL PASSPORT MRZ (bottom section) - EXACTLY as written
2. Middle name from top section of passport if not in MRZ

FOR FATHER:
1. If PASSPORT: First/Last name from MRZ (bottom), Middle name from top section
2. If ID CARD: Use full name exactly as shown (already in Latin script)

FOR MOTHER:
1. If PASSPORT: First/Last name from MRZ (bottom), Middle name from top section  
2. If ID CARD: Use full name exactly as shown (already in Latin script)
`;

    // Build CRITICAL name extraction instructions
    const nameExtractionRules = `
=== CRITICAL NAME EXTRACTION RULES ===

1. FOR BIRTH CERTIFICATES:
   - The student's name MUST be written EXACTLY letter-by-letter as it appears in their INTERNATIONAL PASSPORT
   - Parents' names MUST be written EXACTLY as in their passports/ID cards, NOT as written in the birth certificate
   - Birth certificates often have misspellings - IGNORE those and use passport/ID versions

2. FOR UZBEK PASSPORTS (with two sections - top in Uzbek/Cyrillic, bottom in English/Latin MRZ):
   - FIRST NAME: Take from the BOTTOM section (MRZ area) - the English/Latin version
   - FAMILY NAME (Surname): Take from the BOTTOM section (MRZ area) - the English/Latin version  
   - MIDDLE NAME (Patronymic/Otasining ismi): Take from the TOP section (Uzbek part) - transliterate to English
   - The bottom MRZ section does NOT include middle name, so you MUST get it from the top
   - Example: If top shows "Исломжон ўғли" and bottom shows "ABDULLAYEV MUHSINBEK", write: "ABDULLAYEV MUHSINBEK ISLOMJON O'G'LI"
   - NEVER guess middle names - copy EXACTLY from document

3. FOR INTERNATIONAL PASSPORTS:
   - Take the full name EXACTLY as written in the English section
   - Do not modify or transliterate - copy character by character
   - This is the HIGHEST priority source for student names

4. FOR ID CARDS (Shaxsni tasdiqlovchi ID karta):
   - ID cards display the name in Latin/English script already
   - Take the FULL NAME exactly as written on the ID card, letter by letter
   - No transliteration needed - direct copy

5. PRIORITY ORDER for name sources:
   a) International passport (highest priority for students)
   b) Local passport (for parents if international passport not available)
   c) ID card (equally valid as local passport)
   d) NEVER use the name as written in birth certificate - only use it to understand the relationship

${passportData ? `
PROVIDED PASSPORT DATA:
${JSON.stringify(passportData, null, 2)}

EXTRACTION INSTRUCTIONS:
- If type is "international": Use the name exactly as provided
- If type is "local": Use firstName and lastName from MRZ, middleName from top section
` : ''}

${idCardData ? `
PROVIDED ID CARD DATA:
${JSON.stringify(idCardData, null, 2)}

EXTRACTION INSTRUCTIONS:
- Use fullName exactly as written
` : ''}
`;

    // Build handwriting disambiguation rules
    const handwritingRules = `
=== HANDWRITING DISAMBIGUATION FOR PLACES ===

When OCR'ing handwritten documents, if you can identify the REGION (viloyat/shahri) but struggle with the DISTRICT (tuman):
1. First identify the region clearly
2. Then search for matching districts within that region
3. Use character patterns from the handwriting to narrow down possibilities

UZBEKISTAN REGIONS AND THEIR DISTRICTS:
${Object.entries(UZBEKISTAN_REGIONS).map(([region, districts]) => 
  `${region}: ${districts.join(', ')}`
).join('\n')}

For dates that are unclear:
- Check context (birth dates should be reasonable - not future, not too old)
- Cross-reference with other documents if available
- If truly unreadable, mark as [UNCLEAR] for manual review
`;

    // Prepare image content for vision model
    const imageContents: Array<{ type: 'image_url'; image_url: { url: string } }> = [];
    
    if (sourceFilePath) {
      console.log('Downloading source file:', sourceFilePath);
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('translation-documents')
        .download(sourceFilePath);
      
      if (downloadError || !fileData) {
        console.error('Failed to download source file:', downloadError);
        return new Response(
          JSON.stringify({ error: 'Manba fayl topilmadi' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const base64 = await fileToBase64(fileData);
      const mimeType = getMimeType(sourceFilePath);
      imageContents.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64}` }
      });
      console.log('Source file encoded, MIME:', mimeType);
    }

    // Download supporting files (passports, IDs)
    if (supportingFilePaths && supportingFilePaths.length > 0) {
      for (const supportPath of supportingFilePaths) {
        try {
          console.log('Downloading supporting file:', supportPath);
          const { data: supportData, error: supportError } = await supabase.storage
            .from('translation-documents')
            .download(supportPath);
          
          if (!supportError && supportData) {
            const base64 = await fileToBase64(supportData);
            const mimeType = getMimeType(supportPath);
            imageContents.push({
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` }
            });
            console.log('Supporting file encoded:', supportPath);
          }
        } catch (err) {
          console.warn('Failed to download supporting file:', supportPath, err);
        }
      }
    }

    // Build the comprehensive system prompt with EXACT FORMAT requirement
    const systemPrompt = `You are an expert Uzbek-to-English document translator specializing in official documents for Korean university applications.

DOCUMENT TYPE: ${docType.name_uz} (${docType.name_en || docType.code})

${documentIdentificationRules}

${nameExtractionRules}

${handwritingRules}

=== OCR RULES FOR UZBEK DOCUMENTS ===
1. Birth certificates often have HANDWRITTEN entries - read them very carefully
2. Cyrillic letters unique to Uzbek:
   - Ў/ў (O' with hook) → O' 
   - Қ/қ (Q with descender) → Q
   - Ғ/ғ (G with hook) → G'
   - Ҳ/ҳ (H with descender) → H
3. Common Cyrillic → Latin:
   - Ш→Sh, Ч→Ch, Ё→Yo, Ю→Yu, Я→Ya, Ж→J, Х→X
4. Dates: typically DD.MM.YYYY format
5. Registry numbers: preserve exactly as written

=== TRANSLATION QUALITY RULES ===
1. Use formal legal English appropriate for official documents
2. Keep registry numbers, stamps, and official references intact
3. Translate place names but keep them recognizable
4. For unclear handwriting, use [UNCLEAR: best guess] notation

${trainingExamples ? `
=== TRAINING EXAMPLES (Learn from these AND USE EXACT FORMAT) ===
${trainingExamples}

CRITICAL: The English translations above show the EXACT FORMAT you must use.
Copy the structure, line order, field labels, and layout PRECISELY.
` : ''}

${primaryTemplateText ? `
=== REQUIRED OUTPUT FORMAT (COPY THIS EXACTLY) ===
Your translation MUST follow this EXACT structure and format:

${primaryTemplateText}

Use the SAME:
- Line breaks and spacing
- Field labels (e.g., "Full Name:", "Date of Birth:", etc.)
- Section order
- Capitalization patterns
- Signature/seal placeholders
` : ''}

${studentName ? `STUDENT NAME (verified from passport): ${studentName}` : ''}
${parentNames ? `PARENT NAMES (verified from passports/IDs): ${parentNames}` : ''}
${additionalContext ? `ADDITIONAL CONTEXT: ${additionalContext}` : ''}

=== OUTPUT FORMAT ===
FIRST, analyze supporting documents and output:
--- DOCUMENT IDENTIFICATION ---
[List each supporting document you identified]

THEN, if OCR was performed (image provided):
--- EXTRACTED TEXT (Uzbek) ---
[The OCR'd Uzbek text]

FINALLY:
--- ENGLISH TRANSLATION ---
[Your translation in the EXACT format shown in training templates above]

CRITICAL: The English translation MUST match the template format EXACTLY - same fields, same order, same layout.
Names MUST be written EXACTLY as extracted from passports/IDs, NOT from the document being translated.`;

    // Build user message
    const userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
    
    if (imageContents.length > 0) {
      userContent.push(...imageContents);
      
      const imageCount = imageContents.length;
      const hasSupporting = supportingFilePaths && supportingFilePaths.length > 0;
      
      userContent.push({
        type: 'text',
        text: `I am providing ${imageCount} image(s).

Image 1: The ${docType.name_en || docType.name_uz} document to translate (main document)
${hasSupporting ? `Images 2-${imageCount}: Supporting documents (passports, ID cards) - IDENTIFY each one (student/father/mother) and extract names correctly` : ''}

IMPORTANT INSTRUCTIONS:
1. First, identify EACH supporting document - determine if it belongs to the student, father, or mother
2. Extract names from each identified document according to the rules (passport MRZ vs top section, ID card full name)
3. OCR and translate the main document
4. Use names from passports/IDs (NOT from the birth certificate itself)
5. Output the translation in the EXACT format from the training templates provided

Follow the template format EXACTLY - same field labels, same order, same structure.`
      });
    } else if (sourceText) {
      userContent.push({
        type: 'text',
        text: `Translate this ${docType.name_en || docType.name_uz} from Uzbek to English, following the EXACT format from training templates:\n\n${sourceText}`
      });
    }

    console.log('Sending to AI with', imageContents.length, 'images...');

    const aiResponse = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.1,
        max_tokens: 10000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Tizim band. Keyinroq urinib ko\'ring.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI xizmati uchun kredit tugagan.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI xizmatida xatolik' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const fullResponse = aiData.choices?.[0]?.message?.content;

    if (!fullResponse) {
      console.error('No AI response:', aiData);
      return new Response(
        JSON.stringify({ error: 'Tarjima olinmadi' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response received, length:', fullResponse.length);

    // Parse response - extract document identification, OCR text, and translation
    let documentIdentification = null;
    let extractedText = null;
    let translatedText = fullResponse;

    // Extract document identification
    const docIdMatch = fullResponse.match(/--- DOCUMENT IDENTIFICATION ---\s*([\s\S]*?)(?=--- EXTRACTED TEXT|--- ENGLISH|$)/i);
    if (docIdMatch) {
      documentIdentification = docIdMatch[1].trim();
      console.log('Document identification:', documentIdentification.substring(0, 200));
    }

    // Extract OCR text
    if (sourceFilePath && fullResponse.includes('--- EXTRACTED TEXT')) {
      const extractedMatch = fullResponse.match(/--- EXTRACTED TEXT.*?---\s*([\s\S]*?)(?=--- ENGLISH|$)/i);
      const translatedMatch = fullResponse.match(/--- ENGLISH TRANSLATION ---\s*([\s\S]*?)$/i);
      
      if (extractedMatch) {
        extractedText = extractedMatch[1].trim();
      }
      if (translatedMatch) {
        translatedText = translatedMatch[1].trim();
      }
    } else {
      // Try to extract just the translation
      const translatedMatch = fullResponse.match(/--- ENGLISH TRANSLATION ---\s*([\s\S]*?)$/i);
      if (translatedMatch) {
        translatedText = translatedMatch[1].trim();
      }
    }

    // Generate DOCX file with template formatting
    let docxFilePath = null;
    if (shouldGenerateDocx && translatedText) {
      try {
        const docxData = generateDocxFromTemplate(translatedText, templateElements, `${docType.name_en || docType.code}_translation`);
        const docxFileName = `translated/${Date.now()}_${docType.code}_translation.docx`;
        
        const { error: uploadError } = await supabase.storage
          .from('translation-documents')
          .upload(docxFileName, docxData, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });
        
        if (!uploadError) {
          docxFilePath = docxFileName;
          console.log('DOCX file uploaded:', docxFilePath);
        } else {
          console.error('DOCX upload failed:', uploadError);
        }
      } catch (docxError) {
        console.error('DOCX generation failed:', docxError);
      }
    }

    console.log('Translation completed', {
      hasDocumentId: !!documentIdentification,
      hasExtractedText: !!extractedText,
      translatedLength: translatedText.length,
      hasDocx: !!docxFilePath,
      templateElementsUsed: templateElements.length
    });

    return new Response(
      JSON.stringify({ 
        translatedText,
        extractedText,
        documentIdentification,
        documentType: {
          code: docType.code,
          name: docType.name_uz,
          nameEn: docType.name_en
        },
        templatesUsed: templates?.length || 0,
        wasOCR: !!sourceFilePath,
        docxFilePath
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
