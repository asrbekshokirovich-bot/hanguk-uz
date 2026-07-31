// ---------------------------------------------------------------------------
// A very small XLSX writer.
//
// Dependency-free for the same reason as pdf.ts. Zip entries are STORED
// rather than deflated: Excel, Numbers and LibreOffice all read stored
// entries, the sheets here are a few hundred rows at most, and storing keeps
// the whole writer synchronous instead of dragging in CompressionStream.
//
// Strings are written inline (t="inlineStr") so there is no shared-string
// table to keep in sync.
// ---------------------------------------------------------------------------

export type CellValue = string | number | null | undefined;

export interface Column {
  header: string;
  width: number;
  /** Money and counts get the mono-ish number format and right alignment. */
  numeric?: boolean;
}

export interface Sheet {
  name: string;
  columns: Column[];
  rows: CellValue[][];
  /** Rendered above the header, one per line, in muted grey. */
  notes?: string[];
}

const enc = new TextEncoder();

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Excel rejects most control characters outright.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function colName(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/* ------------------------------------------------------------------ styles */
/* 0 default · 1 note · 2 header · 3 number · 4 bold number · 5 bold text     */

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>
<fonts count="4">
<font><sz val="11"/><color rgb="FF13202E"/><name val="Calibri"/></font>
<font><sz val="10"/><color rgb="FF6B7787"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF13202E"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1A3A6C"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;

function cell(ref: string, value: CellValue, style: number): string {
  if (value === null || value === undefined || value === '') {
    return style ? `<c r="${ref}" s="${style}"/>` : '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(
    String(value),
  )}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const notes = sheet.notes ?? [];
  const rows: string[] = [];
  let r = 1;

  for (const note of notes) {
    rows.push(`<row r="${r}">${cell(`A${r}`, note, 1)}</row>`);
    r++;
  }
  if (notes.length > 0) r++; // one blank spacer row

  const headerRow = r;
  rows.push(
    `<row r="${r}">${sheet.columns
      .map((c, i) => cell(`${colName(i)}${r}`, c.header, 2))
      .join('')}</row>`,
  );
  r++;

  for (const row of sheet.rows) {
    const cells = sheet.columns.map((c, i) => {
      const v = row[i];
      const isNum = c.numeric && typeof v === 'number';
      return cell(`${colName(i)}${r}`, v, isNum ? 3 : 0);
    });
    rows.push(`<row r="${r}">${cells.join('')}</row>`);
    r++;
  }

  const cols = sheet.columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`)
    .join('');

  const lastCol = colName(Math.max(0, sheet.columns.length - 1));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${
    headerRow + 1
  }" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${rows.join('')}</sheetData>
<autoFilter ref="A${headerRow}:${lastCol}${Math.max(headerRow, r - 1)}"/>
</worksheet>`;
}

/* ---------------------------------------------------------------------- zip */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Entry {
  name: string;
  bytes: Uint8Array;
}

function zip(entries: Entry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v: number) =>
    new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
  const join = (parts: Uint8Array[]) => {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  };

  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.bytes);
    const local = join([
      u32(0x04034b50),
      u16(20), // version needed
      u16(0),  // flags
      u16(0),  // method: stored
      u16(0),  // mod time
      u16(0x21), // mod date: 1980-01-01, so the archive is byte-reproducible
      u32(crc),
      u32(e.bytes.length),
      u32(e.bytes.length),
      u16(name.length),
      u16(0),
      name,
      e.bytes,
    ]);
    chunks.push(local);

    central.push(
      join([
        u32(0x02014b50),
        u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21),
        u32(crc),
        u32(e.bytes.length),
        u32(e.bytes.length),
        u16(name.length),
        u16(0), u16(0), u16(0), u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }

  const dir = join(central);
  return join([
    join(chunks),
    dir,
    join([
      u32(0x06054b50),
      u16(0), u16(0),
      u16(entries.length),
      u16(entries.length),
      u32(dir.length),
      u32(offset),
      u16(0),
    ]),
  ]);
}

/* -------------------------------------------------------------------- build */

export function buildXlsx(sheets: Sheet[]): Uint8Array {
  if (sheets.length === 0) throw new Error('xlsx: at least one sheet is required');

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets
  .map(
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join('\n')}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets
    .map(
      (s, i) =>
        `<sheet name="${xmlEscape(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join('')}</sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets
  .map(
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
        i + 1
      }.xml"/>`,
  )
  .join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const entries: Entry[] = [
    { name: '[Content_Types].xml', bytes: enc.encode(contentTypes) },
    { name: '_rels/.rels', bytes: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', bytes: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', bytes: enc.encode(workbookRels) },
    { name: 'xl/styles.xml', bytes: enc.encode(STYLES) },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      bytes: enc.encode(sheetXml(s)),
    })),
  ];

  return zip(entries);
}
