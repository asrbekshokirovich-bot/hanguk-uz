/**
 * Minimal XLSX o'quvchi — jszip ustida.
 *
 * Nega tayyor kutubxona emas: .xlsx — bu oddiy zip, ichida XML. Bizga faqat
 * kataklarning matni kerak (universitet guideline shabloni birlashtirilgan
 * kataklarsiz, formulalarsiz, 1-qatori sarlavha). jszip loyihada allaqachon
 * bor, shuning uchun shu ~150 qator SheetJS'ni qo'shishdan arzonroq va
 * hujum yuzasi kichikroq.
 *
 * Qaytaradi: sheet nomi -> qatorlar massivi, har bir katak matn ko'rinishida.
 * Tip o'girish yuqori qatlamda (universityGuidelineExcel.ts) bo'ladi.
 */

import JSZip from 'jszip';

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** "BC12" -> 54 (0 dan boshlanadigan ustun indeksi). */
export function columnIndex(cellRef: string): number {
  let n = 0;
  for (let i = 0; i < cellRef.length; i += 1) {
    const code = cellRef.charCodeAt(i);
    if (code >= 65 && code <= 90) n = n * 26 + (code - 64); // A-Z
    else if (code >= 97 && code <= 122) n = n * 26 + (code - 96); // a-z
    else break;
  }
  return n - 1;
}

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('XML o‘qib bo‘lmadi — fayl buzilgan bo‘lishi mumkin');
  }
  return doc;
}

/** <si> ichidagi barcha <t> matnlari (rich-text bo'laklari ham) birlashadi. */
function sharedStringText(si: Element): string {
  const parts = si.getElementsByTagName('t');
  let out = '';
  for (let i = 0; i < parts.length; i += 1) out += parts[i].textContent ?? '';
  return out;
}

function readSharedStrings(doc: Document): string[] {
  const items = doc.getElementsByTagName('si');
  const out: string[] = new Array(items.length);
  for (let i = 0; i < items.length; i += 1) out[i] = sharedStringText(items[i]);
  return out;
}

function cellText(cell: Element, shared: string[]): string {
  const type = cell.getAttribute('t');

  if (type === 'inlineStr') {
    const is = cell.getElementsByTagName('is')[0];
    return is ? sharedStringText(is) : '';
  }

  const v = cell.getElementsByTagName('v')[0];
  if (!v) return '';
  const raw = v.textContent ?? '';

  if (type === 's') {
    const idx = Number.parseInt(raw, 10);
    return Number.isFinite(idx) ? (shared[idx] ?? '') : '';
  }
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE';
  // 'str' (formula natijasi), 'd' (ISO sana) va raqamlar — qanday bo'lsa shunday.
  return raw;
}

function readSheet(doc: Document, shared: string[]): string[][] {
  const rowEls = doc.getElementsByTagName('row');
  const rows: string[][] = [];

  for (let i = 0; i < rowEls.length; i += 1) {
    const rowEl = rowEls[i];
    // r atributi yo'q bo'lsa — hujjatdagi tartibga qaytamiz.
    const rowNum = Number.parseInt(rowEl.getAttribute('r') ?? '', 10);
    const rowIdx = Number.isFinite(rowNum) && rowNum > 0 ? rowNum - 1 : rows.length;

    const cells = rowEl.getElementsByTagName('c');
    const row: string[] = [];
    for (let j = 0; j < cells.length; j += 1) {
      const cell = cells[j];
      const ref = cell.getAttribute('r');
      const col = ref ? columnIndex(ref) : j;
      if (col < 0) continue;
      row[col] = cellText(cell, shared);
    }

    // Excel bo'sh kataklarni tashlab ketadi — massivdagi teshiklarni to'ldiramiz.
    for (let c = 0; c < row.length; c += 1) if (row[c] === undefined) row[c] = '';
    rows[rowIdx] = row;
  }

  for (let r = 0; r < rows.length; r += 1) if (rows[r] === undefined) rows[r] = [];
  return rows;
}

/** rId -> xl/ ichidagi yo'l. */
function readRelationships(doc: Document): Map<string, string> {
  const map = new Map<string, string>();
  const rels = doc.getElementsByTagName('Relationship');
  for (let i = 0; i < rels.length; i += 1) {
    const id = rels[i].getAttribute('Id');
    const target = rels[i].getAttribute('Target');
    if (!id || !target) continue;
    map.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }
  return map;
}

function relationshipId(sheetEl: Element): string | null {
  return sheetEl.getAttribute('r:id') ?? sheetEl.getAttributeNS(REL_NS, 'id');
}

/**
 * Butun ishchi kitobni o'qiydi: sheet nomi -> qatorlar (matn kataklar).
 * Sheet tartibi Excel'dagidek saqlanadi.
 */
export async function readXlsx(data: ArrayBuffer | Uint8Array): Promise<Map<string, string[][]>> {
  const zip = await JSZip.loadAsync(data);

  const workbookFile = zip.file('xl/workbook.xml');
  if (!workbookFile) throw new Error('Bu .xlsx fayl emas (xl/workbook.xml topilmadi)');
  const workbook = parseXml(await workbookFile.async('string'));

  const sharedFile = zip.file('xl/sharedStrings.xml');
  const shared = sharedFile ? readSharedStrings(parseXml(await sharedFile.async('string'))) : [];

  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  const rels = relsFile ? readRelationships(parseXml(await relsFile.async('string'))) : new Map();

  const out = new Map<string, string[][]>();
  const sheetEls = workbook.getElementsByTagName('sheet');

  for (let i = 0; i < sheetEls.length; i += 1) {
    const name = sheetEls[i].getAttribute('name');
    if (!name) continue;

    const relId = relationshipId(sheetEls[i]);
    // rels yo'q yoki nuqson bo'lsa — nomlash konvensiyasiga qaytamiz.
    const path = (relId && rels.get(relId)) || `xl/worksheets/sheet${i + 1}.xml`;
    const sheetFile = zip.file(path);
    if (!sheetFile) continue;

    out.set(name, readSheet(parseXml(await sheetFile.async('string')), shared));
  }

  return out;
}
