// Simple DOCX generator for translated documents
// Creates proper .docx files that can be edited by staff

interface DocxSection {
  type: 'heading' | 'paragraph' | 'table' | 'signature';
  content: string;
  level?: number; // for headings
  style?: 'bold' | 'italic' | 'normal';
}

// Create DOCX XML structure
function createDocxXml(content: string, title: string): string {
  // Parse the translated text into proper sections
  const lines = content.split('\n').filter(line => line.trim());
  
  let bodyContent = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // Detect headers (lines in ALL CAPS or with specific markers)
    if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 5 && trimmedLine.length < 100) {
      bodyContent += createHeadingParagraph(trimmedLine, 1);
    }
    // Detect section titles (e.g., "I. GENERAL INFORMATION")
    else if (/^[IVX]+\.\s/.test(trimmedLine) || /^[0-9]+\.\s[A-Z]/.test(trimmedLine)) {
      bodyContent += createHeadingParagraph(trimmedLine, 2);
    }
    // Detect labeled fields (e.g., "Name: John Doe")
    else if (/^[A-Za-z\s]+:\s/.test(trimmedLine)) {
      const [label, ...rest] = trimmedLine.split(':');
      const value = rest.join(':').trim();
      bodyContent += createLabelValueParagraph(label.trim(), value);
    }
    // Detect signature lines
    else if (trimmedLine.includes('Signature') || trimmedLine.includes('___') || trimmedLine.includes('Seal')) {
      bodyContent += createSignatureParagraph(trimmedLine);
    }
    // Regular paragraphs
    else {
      bodyContent += createParagraph(trimmedLine);
    }
  }
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function createHeadingParagraph(text: string, level: number): string {
  const fontSize = level === 1 ? 28 : 24;
  return `
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="${fontSize}"/>
          <w:szCs w:val="${fontSize}"/>
        </w:rPr>
        <w:t>${escapeXml(text)}</w:t>
      </w:r>
    </w:p>`;
}

function createLabelValueParagraph(label: string, value: string): string {
  return `
    <w:p>
      <w:pPr>
        <w:spacing w:before="60" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
        <w:t>${escapeXml(label)}:</w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
        <w:t xml:space="preserve"> ${escapeXml(value)}</w:t>
      </w:r>
    </w:p>`;
}

function createSignatureParagraph(text: string): string {
  return `
    <w:p>
      <w:pPr>
        <w:spacing w:before="360" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
        <w:t>${escapeXml(text)}</w:t>
      </w:r>
    </w:p>`;
}

function createParagraph(text: string): string {
  return `
    <w:p>
      <w:pPr>
        <w:spacing w:before="60" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
        <w:t>${escapeXml(text)}</w:t>
      </w:r>
    </w:p>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Create the content types XML
function createContentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
}

// Create relationships XML
function createRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

// Create word/_rels/document.xml.rels
function createDocRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
}

// Simple ZIP file creator for DOCX (DOCX is just a ZIP with XML files)
// Uses the fflate library which is available in Deno
async function createZipBlob(files: Map<string, string>): Promise<Uint8Array> {
  // We'll use a simple approach that creates uncompressed ZIP
  // For production, consider using a proper library
  
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;
  
  for (const [filename, content] of files) {
    const filenameBytes = encoder.encode(filename);
    const contentBytes = encoder.encode(content);
    
    // Local file header
    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const localView = new DataView(localHeader.buffer);
    
    localView.setUint32(0, 0x04034b50, true); // Local file header signature
    localView.setUint16(4, 20, true); // Version needed
    localView.setUint16(6, 0, true); // General purpose bit flag
    localView.setUint16(8, 0, true); // Compression method (0 = stored)
    localView.setUint16(10, 0, true); // Last mod time
    localView.setUint16(12, 0, true); // Last mod date
    localView.setUint32(14, crc32(contentBytes), true); // CRC-32
    localView.setUint32(18, contentBytes.length, true); // Compressed size
    localView.setUint32(22, contentBytes.length, true); // Uncompressed size
    localView.setUint16(26, filenameBytes.length, true); // Filename length
    localView.setUint16(28, 0, true); // Extra field length
    localHeader.set(filenameBytes, 30);
    
    parts.push(localHeader);
    parts.push(contentBytes);
    
    // Central directory header
    const centralHeader = new Uint8Array(46 + filenameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    
    centralView.setUint32(0, 0x02014b50, true); // Central directory signature
    centralView.setUint16(4, 20, true); // Version made by
    centralView.setUint16(6, 20, true); // Version needed
    centralView.setUint16(8, 0, true); // General purpose bit flag
    centralView.setUint16(10, 0, true); // Compression method
    centralView.setUint16(12, 0, true); // Last mod time
    centralView.setUint16(14, 0, true); // Last mod date
    centralView.setUint32(16, crc32(contentBytes), true); // CRC-32
    centralView.setUint32(20, contentBytes.length, true); // Compressed size
    centralView.setUint32(24, contentBytes.length, true); // Uncompressed size
    centralView.setUint16(28, filenameBytes.length, true); // Filename length
    centralView.setUint16(30, 0, true); // Extra field length
    centralView.setUint16(32, 0, true); // File comment length
    centralView.setUint16(34, 0, true); // Disk number start
    centralView.setUint16(36, 0, true); // Internal file attributes
    centralView.setUint32(38, 0, true); // External file attributes
    centralView.setUint32(42, offset, true); // Relative offset of local header
    centralHeader.set(filenameBytes, 46);
    
    centralDirectory.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  }
  
  const centralDirOffset = offset;
  for (const cd of centralDirectory) {
    parts.push(cd);
    offset += cd.length;
  }
  
  // End of central directory
  const endOfCentral = new Uint8Array(22);
  const endView = new DataView(endOfCentral.buffer);
  
  endView.setUint32(0, 0x06054b50, true); // End of central directory signature
  endView.setUint16(4, 0, true); // Disk number
  endView.setUint16(6, 0, true); // Disk number with central directory
  endView.setUint16(8, files.size, true); // Number of central directory records on this disk
  endView.setUint16(10, files.size, true); // Total number of central directory records
  endView.setUint32(12, offset - centralDirOffset, true); // Size of central directory
  endView.setUint32(16, centralDirOffset, true); // Offset of start of central directory
  endView.setUint16(20, 0, true); // Comment length
  
  parts.push(endOfCentral);
  
  // Combine all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }
  
  return result;
}

// CRC32 calculation for ZIP
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

// Main export function to generate DOCX
export async function generateDocx(translatedText: string, documentTitle: string): Promise<Uint8Array> {
  const files = new Map<string, string>();
  
  files.set('[Content_Types].xml', createContentTypes());
  files.set('_rels/.rels', createRels());
  files.set('word/_rels/document.xml.rels', createDocRels());
  files.set('word/document.xml', createDocxXml(translatedText, documentTitle));
  
  return await createZipBlob(files);
}

// Parse template format from approved templates
export function parseTemplateFormat(templateText: string): {
  structure: string[];
  hasSignature: boolean;
  hasSeal: boolean;
  labelValuePairs: string[];
} {
  const lines = templateText.split('\n');
  const structure: string[] = [];
  const labelValuePairs: string[] = [];
  let hasSignature = false;
  let hasSeal = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.toLowerCase().includes('signature')) hasSignature = true;
    if (trimmed.toLowerCase().includes('seal')) hasSeal = true;
    
    // Extract label patterns
    const labelMatch = trimmed.match(/^([A-Za-z\s]+):/);
    if (labelMatch) {
      labelValuePairs.push(labelMatch[1].trim());
    }
    
    structure.push(trimmed.length > 50 ? 'paragraph' : 
                   /^[IVX0-9]+\./.test(trimmed) ? 'section' :
                   trimmed === trimmed.toUpperCase() ? 'heading' : 'content');
  }
  
  return { structure, hasSignature, hasSeal, labelValuePairs };
}
