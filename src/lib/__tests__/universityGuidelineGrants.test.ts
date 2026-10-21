import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';

import { readXlsx } from '../xlsxReader';
import { parseGuidelineWorkbook, type GuidelineRow } from '../universityGuidelineExcel';
import { buildGrantImport } from '../universityGuidelineGrants';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** Fixture baytlari jsdom realm'idagi ArrayBuffer'da (universityGuidelineExcel.test.ts'dagi kabi). */
function fixture(name: string): ArrayBuffer {
  const buf = readFileSync(join(fixtureDir, name));
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

/** Haqiqiy v4 fayl (UST 2027 bahor, magistratura) — grantlar varag'i bilan. */
const UST = 'ust_2027_bahor_magistratura.xlsx';

describe('grantlar varag‘i (v4) — haqiqiy fayl', () => {
  it('grantlarni o‘qiydi, ogohlantirishsiz', async () => {
    const r = await parseGuidelineWorkbook(fixture(UST), UST);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
    const g = r.payload!.grantlar!;
    expect(g.qoidalar).toHaveLength(2);
    expect(g.xulosa).toEqual({
      grant_holat: 'tilga_bogliq_emas',
      grant_min: null,
      grant_max: null,
      grant_boshqa: "Oylik tadqiqotchi stipendiyasi; RCARO qo'shimcha stipendiyasi",
      grant_manba: `Excel: ${UST}`,
    });
  });

  it('qatorni bazadagi jadval shakliga keltiradi', async () => {
    const r = await parseGuidelineWorkbook(fixture(UST), UST);
    const [stipend, rcaro] = r.payload!.grantlar!.qoidalar;
    expect(stipend).toMatchObject({
      tartib: 1,
      qachon: 'kirishda',
      mezon: 'boshqa',
      mezon_turi: 'hammaga',
      grant_asosi: 'naqd stipendiya',
      nimaga: 'naqd',
      muddat: 'har oy',
      kimlar_uchun: null, // "hammasi (barcha treklar)" — hamma uchun
      iqtibos: 'Monthly Student Scientist Stipend (research stipends as scholarships)',
      sahifa: '4, 20, 24',
    });
    expect(rcaro).toMatchObject({
      grant_summa: 2000000,
      grant_valyuta: 'KRW',
      kimlar_uchun: "IAEA-RCA trekidagi KAERI, KIRAMS, KRISS yo'nalishlari",
    });
  });

  it('grantlar varag‘i bo‘lmagan (v2/v3) faylda grantlar yuborilmaydi — bazadagilar saqlanadi', async () => {
    const r = await parseGuidelineWorkbook(fixture('jbnu_2027_bahor_bakalavr.xlsx'), 'jbnu.xlsx');
    expect(r.ok).toBe(true);
    expect(r.payload).not.toHaveProperty('grantlar');
    expect(r.warnings.some((w) => w.includes('format'))).toBe(false);
  });

  it('v4 faylda grantlar varag‘i o‘chirilgan bo‘lsa — ogohlantiradi', async () => {
    const zip = await JSZip.loadAsync(fixture(UST));
    const wb = await zip.file('xl/workbook.xml')!.async('string');
    zip.file('xl/workbook.xml', wb.replace(/<sheet [^>]*name="grantlar"[^>]*\/>/, ''));
    const r = await parseGuidelineWorkbook(await zip.generateAsync({ type: 'arraybuffer' }), UST);
    expect(r.ok).toBe(true);
    expect(r.payload).not.toHaveProperty('grantlar');
    expect(r.warnings).toContain('Fayl formati v4, lekin "grantlar" varag\'i yo\'q — bazadagi grantlar o\'zgarmadi');
  });
});

describe('saytdagi shablon', () => {
  it('v4: grantlar varag‘i sayt o‘qiydigan ustunlar bilan', async () => {
    const sheets = await readXlsx(fixture('../../../../public/templates/universitet-guideline-shablon.xlsx'));
    expect([...sheets.keys()]).toEqual(['universitet', 'muddatlar', 'fakultetlar', 'hujjatlar', 'grantlar', 'qollanma']);
    expect(sheets.get('grantlar')![0]).toEqual([
      'guideline_id', 'tartib', 'grant_nomi', 'grant_nomi_asl', 'track', 'qamrov', 'mezon_turi', 'mezon_min',
      'mezon_max', 'mezon_matn', 'grant_foiz', 'grant_summa', 'grant_valyuta', 'nimaga', 'davr', 'davom_sharti',
      'qoshiladi', 'izoh', 'sahifa',
    ]);
  });
});

/** grantlar varag'ining bitta qatori — readSheetRows natijasi kabi. */
const row = (over: GuidelineRow): GuidelineRow => ({ guideline_id: 'x_2027_bahor_bakalavr', ...over });

function build(rows: GuidelineRow[]) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const result = buildGrantImport(rows, 'x.xlsx', errors, warnings);
  return { result, errors, warnings };
}

describe('buildGrantImport — TOPIK / IELTS darajalari', () => {
  const topikTable = [
    row({ tartib: 1, grant_nomi: 'Til granti', track: 'korean', mezon_turi: 'topik', mezon_min: 3, grant_foiz: 30, nimaga: 'kontrakt', davr: 'birinchi_semestr' }),
    row({ tartib: 2, grant_nomi: 'Til granti', track: 'korean', mezon_turi: 'topik', mezon_min: 4, grant_foiz: 50, nimaga: 'kontrakt', davr: 'birinchi_semestr' }),
    row({ tartib: 3, grant_nomi: 'Til granti', track: 'korean', mezon_turi: 'topik', mezon_min: 5, mezon_max: 6, grant_foiz: 100, nimaga: 'kontrakt' }),
    row({ tartib: 4, grant_nomi: 'Til granti', track: 'english', mezon_turi: 'ielts', mezon_min: 6.5, grant_foiz: 50, nimaga: 'kontrakt' }),
    row({ tartib: 5, grant_nomi: 'Kirish to‘lovidan ozod', mezon_turi: 'topik', mezon_min: 4, grant_foiz: 100, nimaga: 'kirish_tolovi' }),
  ];

  it('har bir daraja — ilova o‘qiydigan mezon va ballar bilan', () => {
    const { result, errors } = build(topikTable);
    expect(errors).toEqual([]);
    const [t3, t4, t56, ielts] = result!.qoidalar;
    expect(t3).toMatchObject({ mezon: 'TOPIK', topik_min: 3, topik_max: null, grant_foiz: 30, muddat: '1-semestr', kimlar_uchun: 'Korean track', talab: 'TOPIK 3+' });
    expect(t4).toMatchObject({ mezon: 'TOPIK', topik_min: 4, grant_foiz: 50 });
    expect(t56).toMatchObject({ topik_min: 5, topik_max: 6, talab: 'TOPIK 5–6' });
    expect(ielts).toMatchObject({ mezon: 'IELTS', ielts_min: 6.5, topik_min: null, kimlar_uchun: 'English track' });
  });

  it('xulosa: kirishda, oraliq faqat kontraktdan foizlar (kirish to‘lovi kirmaydi)', () => {
    const { result } = build(topikTable);
    expect(result!.xulosa).toMatchObject({ grant_holat: 'kirishda', grant_min: 30, grant_max: 100, grant_boshqa: null });
    const { result: noTuition } = build([topikTable[4]]);
    expect(noTuition!.xulosa).toMatchObject({ grant_holat: 'kirishda', grant_min: null, grant_max: null });
  });

  it('GPA granti — o‘qish davomida, ilova hisobiga kirmaydi', () => {
    const { result, errors } = build([
      row({ tartib: 1, grant_nomi: 'Keyingi semestr', mezon_turi: 'gpa', mezon_min: 3.5, mezon_max: 3.99, grant_foiz: 30, davr: 'har_semestr' }),
    ]);
    expect(errors).toEqual([]);
    expect(result!.qoidalar[0]).toMatchObject({ qachon: 'oqish_davomida', mezon: 'boshqa', boshqa_test: 'GPA 3.5–3.99', muddat: 'har semestr' });
    expect(result!.xulosa.grant_holat).toBe('tilga_bogliq_emas');
  });

  it('boshqa til sertifikati — "aniq_emas"', () => {
    const { result } = build([row({ tartib: 1, grant_nomi: 'CEFR', mezon_turi: 'cefr', mezon_matn: 'CEFR B2', grant_foiz: 20 })]);
    expect(result!.qoidalar[0]).toMatchObject({ mezon: 'boshqa', boshqa_test: 'CEFR B2' });
    expect(result!.xulosa.grant_holat).toBe('aniq_emas');
  });

  it('"Guideline‘da yo‘q." — grant haqida ma‘lumot yo‘q, qoida yozilmaydi', () => {
    const { result, warnings } = build([row({ tartib: 1, grant_nomi: "Guideline'da yo'q." })]);
    expect(warnings).toEqual([]);
    expect(result!.qoidalar).toEqual([]);
    expect(result!.xulosa.grant_holat).toBe('malumot_yoq');
  });
});

describe('buildGrantImport — xatolar', () => {
  it('ball talab qilinadigan mezonda mezon_min yo‘q yoki chegaradan tashqari', () => {
    const { errors } = build([
      row({ tartib: 1, grant_nomi: 'A', mezon_turi: 'topik', grant_foiz: 50 }),
      row({ tartib: 2, grant_nomi: 'B', mezon_turi: 'topik', mezon_min: 7, grant_foiz: 50 }),
      row({ tartib: 3, grant_nomi: 'C', mezon_turi: 'ielts', mezon_min: 6, mezon_max: 5, grant_foiz: 50 }),
    ]);
    expect(errors).toEqual([
      'grantlar, tartib 1 ("A"): topik uchun "mezon_min" (ball) majburiy',
      'grantlar, tartib 2 ("B"), mezon_min: 7 — topik uchun 1–6',
      'grantlar, tartib 3 ("C"): mezon_max (5) mezon_min (6) dan kichik',
    ]);
  });

  it('mezon_turi yo‘q, summa valyutasiz, matnli mezonda matn yo‘q', () => {
    const { errors } = build([
      row({ tartib: 1, grant_nomi: 'A', grant_foiz: 50 }),
      row({ tartib: 2, grant_nomi: 'B', mezon_turi: 'hammaga', grant_summa: 1000000 }),
      row({ tartib: 3, grant_nomi: 'C', mezon_turi: 'reyting', grant_foiz: 100 }),
    ]);
    expect(errors).toEqual([
      'grantlar, tartib 1 ("A"): "mezon_turi" to\'ldirilmagan',
      'grantlar, tartib 2 ("B"): grant_summa bor, lekin "grant_valyuta" to\'ldirilmagan',
      'grantlar, tartib 3 ("C"): reyting uchun "mezon_matn" majburiy',
    ]);
  });

  it('foiz ham, summa ham yo‘q — izohsiz bo‘lsa ogohlantiradi', () => {
    const plain = build([row({ tartib: 1, grant_nomi: 'A', mezon_turi: 'hammaga' })]);
    expect(plain.warnings).toHaveLength(1);
    const marked = build([row({ tartib: 1, grant_nomi: 'A', mezon_turi: 'hammaga', izoh: "Guideline'da summa yo'q." })]);
    expect(marked.warnings).toEqual([]);
  });

  it('bo‘sh varaq — bazadagi grantlarga tegilmaydi', () => {
    const { result, warnings } = build([]);
    expect(result).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });
});
