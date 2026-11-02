import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';

import { columnIndex, readXlsx } from '../xlsxReader';
import {
  contractFromNote,
  DARAJALAR,
  GUIDELINE_SHEETS,
  parseGuidelineWorkbook,
  SEMESTRLAR,
  SUPPORTED_FORMAT_VERSION,
  TEMPLATE_COLUMNS,
} from '../universityGuidelineExcel';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/**
 * Haqiqiy, xodim to'ldirgan guideline fayli (JBNU 2027 bahor, bakalavr) —
 * eski v2 formatda, grantlar varag'isiz.
 *
 * Baytlar jsdom realm'ida yangi ArrayBuffer'ga ko'chiriladi: Node'ning
 * Buffer'i ortidagi ArrayBuffer jszip'ning `instanceof ArrayBuffer`
 * tekshiruvidan o'tmaydi. Brauzerda File.arrayBuffer() shundoq ham
 * bir realm'da bo'ladi.
 */
function jbnuV2Workbook(): ArrayBuffer {
  const buf = readFileSync(join(fixtureDir, 'jbnu_2027_bahor_bakalavr.xlsx'));
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** inlineStr kataklardan iborat varaq (A, B, C ... ustunlar). */
function inlineSheetXml(rows: string[][]): string {
  const cell = (value: string, col: number, row: number) =>
    `<c r="${String.fromCharCode(65 + col)}${row}" t="inlineStr"><is><t>${value}</t></is></c>`;
  const body = rows
    .map((values, i) => `<row r="${i + 1}">${values.map((v, col) => cell(v, col, i + 1)).join('')}</row>`)
    .join('');
  return `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

/** Zip ichidagi XML'ni almashtiradi; almashtirish ishlamasa — test o'zi yiqiladi. */
async function replaceIn(zip: JSZip, path: string, from: string | RegExp, to: string): Promise<void> {
  const xml = await zip.file(path)!.async('string');
  const next = xml.replace(from, to);
  if (next === xml) throw new Error(`${path}: "${from}" topilmadi`);
  zip.file(path, next);
}

/**
 * JBNU fayli v4 shablonga o'tkazilgan — xodim qiladigandek: format_versiya = 4
 * va grantlar varag'i ("Guideline'da yo'q." qatori bilan). Sayt faqat v4 ni
 * qabul qiladi, shuning uchun to'g'ri fayl testlari shu nusxada.
 */
async function jbnuWorkbook(): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(jbnuV2Workbook());
  await replaceIn(zip, 'xl/worksheets/sheet1.xml', '<c r="AO2" s="6" t="n"><v>2</v></c>', '<c r="AO2" s="6" t="n"><v>4</v></c>');
  zip.file(
    'xl/worksheets/sheet6.xml',
    inlineSheetXml([[...TEMPLATE_COLUMNS.grantlar], ['jbnu_2027_bahor_bakalavr', '1', "Guideline'da yo'q."]]),
  );
  await replaceIn(
    zip,
    'xl/workbook.xml',
    /(<sheet [^>]*name="qollanma")/,
    `<sheet xmlns:r="${REL_NS}" name="grantlar" sheetId="6" state="visible" r:id="rId8"/>$1`,
  );
  await replaceIn(
    zip,
    'xl/_rels/workbook.xml.rels',
    '</Relationships>',
    `<Relationship Type="${REL_NS}/worksheet" Target="/xl/worksheets/sheet6.xml" Id="rId8"/></Relationships>`,
  );
  return zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * Fixture'ni ochib, bitta katakni almashtirib, qaytadan zipga yig'adi.
 * Shu bilan xato yo'llarini haqiqiy fayl ustida sinaymiz.
 */
async function patchedWorkbook(
  patch: (xml: string, path: string) => string,
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(await jbnuWorkbook());
  for (const path of Object.keys(zip.files)) {
    if (!path.endsWith('.xml')) continue;
    const xml = await zip.file(path)!.async('string');
    zip.file(path, patch(xml, path));
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('columnIndex', () => {
  it('ustun harfini 0 dan boshlanadigan indeksga o‘giradi', () => {
    expect(columnIndex('A1')).toBe(0);
    expect(columnIndex('B2')).toBe(1);
    expect(columnIndex('Z100')).toBe(25);
    expect(columnIndex('AA1')).toBe(26);
    expect(columnIndex('AO2')).toBe(40);
  });
});

describe('readXlsx', () => {
  it('barcha 5 varaqni nomi bo‘yicha o‘qiydi', async () => {
    const sheets = await readXlsx(jbnuV2Workbook());
    expect([...sheets.keys()]).toEqual([
      'universitet',
      'muddatlar',
      'fakultetlar',
      'hujjatlar',
      'qollanma',
    ]);
  });

  it('inlineStr kataklarni va koreyscha matnni saqlaydi', async () => {
    const sheets = await readXlsx(jbnuV2Workbook());
    const universitet = sheets.get('universitet')!;
    expect(universitet[0][0]).toBe('guideline_id');
    expect(universitet[1][2]).toBe('Jeonbuk National University');
    expect(universitet[1][3]).toBe('전북대학교');
  });

  it('.xlsx bo‘lmagan faylni aniq xato bilan rad etadi', async () => {
    const notXlsx = await new JSZip().file('salom.txt', 'salom').generateAsync({
      type: 'arraybuffer',
    });
    await expect(readXlsx(notXlsx)).rejects.toThrow(/xl\/workbook\.xml/);
  });
});

describe('parseGuidelineWorkbook — haqiqiy fayl', () => {
  it('beshala varaqni to‘liq o‘qiydi', async () => {
    const result = await parseGuidelineWorkbook(await jbnuWorkbook(), 'jbnu_2027_bahor_bakalavr.xlsx');

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);

    const p = result.payload!;
    expect(p.fayl_nomi).toBe('jbnu_2027_bahor_bakalavr.xlsx');
    expect(p.muddatlar).toHaveLength(22); // 2 bosqich x 11 etap
    expect(p.fakultetlar).toHaveLength(64);
    expect(p.hujjatlar).toHaveLength(16);
    // "Guideline'da yo'q." — grant yo'q, qoidalar bo'sh
    expect(p.grantlar?.qoidalar).toEqual([]);
  });

  it('universitet qatorini tiplari bilan o‘giradi', async () => {
    const { payload } = await parseGuidelineWorkbook(await jbnuWorkbook(), 'f.xlsx');
    const u = payload!.universitet;

    expect(u.guideline_id).toBe('jbnu_2027_bahor_bakalavr');
    expect(u.univ_kod).toBe('jbnu');
    expect(u.univ_nomi_en).toBe('Jeonbuk National University');
    expect(u.univ_nomi_kr).toBe('전북대학교');
    expect(u.shahar).toBe('Jeonju');
    expect(u.qabul_yili).toBe(2027);
    expect(u.semestr).toBe('bahor');
    expect(u.daraja).toBe('bakalavr');
    // "ha"/"yoq" -> boolean, ballar va pullar -> raqam
    expect(u.english_track).toBe(true);
    expect(u.korean_track).toBe(true);
    expect(u.topik_min).toBe(2);
    expect(u.ielts_min).toBe(5.5);
    expect(u.ariza_tolovi).toBe(80000);
    expect(u.bank_summa).toBe(16000000);
    expect(u.tahlil_sanasi).toBe('2026-09-21');
    expect(u.format_versiya).toBe(4);
    expect(SUPPORTED_FORMAT_VERSION).toBe(4);
  });

  it('bo‘sh kataklarni kalitsiz qoldiradi (NULL bo‘lib tushsin)', async () => {
    const { payload } = await parseGuidelineWorkbook(await jbnuWorkbook(), 'f.xlsx');
    // kampus va kirish_tolovi faylda bo'sh — bo'sh matn sifatida ketsa
    // ''::numeric import'ni yiqitardi.
    expect(payload!.universitet).not.toHaveProperty('kampus');
    expect(payload!.universitet).not.toHaveProperty('kirish_tolovi');
  });

  it('fakultet nomlarini ikkala tilda va narxi bilan beradi', async () => {
    const { payload } = await parseGuidelineWorkbook(await jbnuWorkbook(), 'f.xlsx');
    const first = payload!.fakultetlar[0];

    expect(first.track).toBe('english');
    expect(first.kollej_en).toBe('University Headquarters');
    expect(first.kollej_kr).toBe('대학본부');
    expect(first.fakultet_kr).toBe('국제이공학부 (엔지니어링사이언스)');
    expect(first.kontrakt_summa).toBe(2704000);
    expect(first.kontrakt_davri).toBe('semestr');
  });

  it('sana va vaqtlarni saqlaydi, bo‘shini tashlab ketadi', async () => {
    const { payload } = await parseGuidelineWorkbook(await jbnuWorkbook(), 'f.xlsx');
    const birinchi = payload!.muddatlar[0];

    expect(birinchi.bosqich).toBe(1);
    expect(birinchi.etap_raqam).toBe(1);
    expect(birinchi.etap_nomi).toBe('Online hujjat topshirish');
    expect(birinchi.boshlanish_sana).toBe('2026-09-21');
    expect(birinchi.boshlanish_vaqt).toBe('09:00');

    const sanasiz = payload!.muddatlar.find((r) => r.etap_raqam === 4)!;
    expect(sanasiz.holat).toBe('nisbiy');
    expect(sanasiz).not.toHaveProperty('boshlanish_sana');
  });

  it('to‘g‘ri faylda ogohlantirish chiqarmaydi', async () => {
    const { warnings } = await parseGuidelineWorkbook(await jbnuWorkbook(), 'f.xlsx');
    expect(warnings).toEqual([]);
  });
});

describe("parseGuidelineWorkbook — kasbiy ta'lim", () => {
  it('daraja = kasbiy bo‘lgan faylni qabul qiladi', async () => {
    const buf = await patchedWorkbook((xml, path) =>
      path === 'xl/worksheets/sheet1.xml' ? xml.replace('<t>bakalavr</t>', '<t>kasbiy</t>') : xml,
    );

    const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.payload!.universitet.daraja).toBe('kasbiy');
  });

  it('daraja "kollej" deb yozilgan faylni ham kasbiy deb o‘qiydi', async () => {
    for (const written of ['kollej', 'Kollej', "kasbiy ta'lim", '전문대학']) {
      const buf = await patchedWorkbook((xml, path) =>
        path === 'xl/worksheets/sheet1.xml' ? xml.replace('<t>bakalavr</t>', `<t>${written}</t>`) : xml,
      );
      const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
      expect(result.errors).toEqual([]);
      expect(result.payload!.universitet.daraja).toBe('kasbiy');
    }
  });

  it('shablondagi daraja va semestr ro‘yxatlari sayt qabul qiladigan qiymatlar bilan bir xil', async () => {
    const buf = readFileSync(join(fixtureDir, '../../../../public/templates/universitet-guideline-shablon.xlsx'));
    const bytes = new ArrayBuffer(buf.byteLength);
    new Uint8Array(bytes).set(buf);
    const zip = await JSZip.loadAsync(bytes);
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    const list = (cell: string) =>
      sheet.match(new RegExp(`<dataValidation sqref="${cell}"[^>]*><formula1>"([^"]*)"</formula1>`))?.[1]?.split(',');
    expect(list('I2')).toEqual([...DARAJALAR]);
    expect(list('H2')).toEqual([...SEMESTRLAR]);
  });
});

describe('parseGuidelineWorkbook — til kursi', () => {
  /** universitet varag'idagi daraja va semestrni almashtiradi. */
  function tilKursiWorkbook(daraja: string, semestr = 'bahor') {
    return patchedWorkbook((xml, path) =>
      path === 'xl/worksheets/sheet1.xml'
        ? xml.replace('<t>bakalavr</t>', `<t>${daraja}</t>`).replace('<t>bahor</t>', `<t>${semestr}</t>`)
        : xml,
    );
  }

  it('daraja = til_kursi bo‘lgan faylni qabul qiladi', async () => {
    const result = await parseGuidelineWorkbook(await tilKursiWorkbook('til_kursi'), 'f.xlsx');
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.payload!.universitet.daraja).toBe('til_kursi');
  });

  it('"Til kursi", "어학당" kabi yozuvlarni ham til_kursi deb o‘qiydi', async () => {
    for (const written of ['Til kursi', 'til-kursi', 'Korean Language Program', '어학당', '한국어연수']) {
      const result = await parseGuidelineWorkbook(await tilKursiWorkbook(written), 'f.xlsx');
      expect(result.errors).toEqual([]);
      expect(result.payload!.universitet.daraja).toBe('til_kursi');
    }
  });

  it('til kursida yoz va qish termlari ham bo‘ladi', async () => {
    for (const semestr of ['yoz', 'qish']) {
      const result = await parseGuidelineWorkbook(await tilKursiWorkbook('til_kursi', semestr), 'f.xlsx');
      expect(result.errors).toEqual([]);
      expect(result.payload!.universitet.semestr).toBe(semestr);
    }
  });

  it('yoz yoki qish boshqa darajada yozilsa — xato', async () => {
    const result = await parseGuidelineWorkbook(await tilKursiWorkbook('magistratura', 'qish'), 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      expect.stringContaining('semestr: "qish" faqat til kursi uchun'),
    ]);
  });
});

describe('parseGuidelineWorkbook — xatolar', () => {
  it('varaq yetishmasa aytadi', async () => {
    const zip = await JSZip.loadAsync(await jbnuWorkbook());
    const workbookXml = await zip.file('xl/workbook.xml')!.async('string');
    zip.file('xl/workbook.xml', workbookXml.replace('name="fakultetlar"', 'name="boshqa"'));
    const buf = await zip.generateAsync({ type: 'arraybuffer' });

    const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('fakultetlar');
  });

  it('noto‘g‘ri tanlov qiymatini qator raqami bilan qaytaradi', async () => {
    const buf = await patchedWorkbook((xml, path) =>
      path === 'xl/worksheets/sheet1.xml' ? xml.replace('<t>bahor</t>', '<t>yanvar</t>') : xml,
    );

    const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.errors).toContainEqual(
      expect.stringContaining('universitet 2-qator, semestr:'),
    );
  });

  it('raqam o‘rniga matn bo‘lsa xato beradi', async () => {
    const buf = await patchedWorkbook((xml, path) =>
      path === 'xl/worksheets/sheet1.xml'
        ? xml.replace(
            '<c r="M2" s="7" t="n"><v>80000</v></c>',
            '<c r="M2" t="inlineStr"><is><t>tekin</t></is></c>',
          )
        : xml,
    );

    const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('ariza_tolovi'));
  });

  it('bolalar varaqlaridagi boshqa guideline_id ni ushlaydi', async () => {
    const buf = await patchedWorkbook((xml, path) =>
      path === 'xl/worksheets/sheet3.xml'
        ? xml.replace(/jbnu_2027_bahor_bakalavr/g, 'boshqa_2027_kuz_bakalavr')
        : xml,
    );

    const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('fakultetlar');
  });

  it('universitet varag‘i bo‘sh bo‘lsa import to‘xtaydi', async () => {
    const buf = await patchedWorkbook((xml, path) =>
      // 2-qatorni butunlay olib tashlaymiz
      path === 'xl/worksheets/sheet1.xml' ? xml.replace(/<row r="2".*?<\/row>/s, '') : xml,
    );

    const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain("universitet varag'i bo'sh");
  });
});

describe('parseGuidelineWorkbook — faqat HANGUK shabloni (v4)', () => {
  /** Zip ichida o'zgartirib, qayta yig'adi (v4 nusxa ustida). */
  async function edited(edit: (zip: JSZip) => Promise<void>): Promise<ArrayBuffer> {
    const zip = await JSZip.loadAsync(await jbnuWorkbook());
    await edit(zip);
    return zip.generateAsync({ type: 'arraybuffer' });
  }

  it('sayt beradigan shablon aynan shu format: 5 varaq + qollanma, ustunlari tartibi bilan', async () => {
    const buf = readFileSync(join(fixtureDir, '../../../../public/templates/universitet-guideline-shablon.xlsx'));
    const bytes = new ArrayBuffer(buf.byteLength);
    new Uint8Array(bytes).set(buf);
    const sheets = await readXlsx(bytes);
    expect([...sheets.keys()]).toEqual([...GUIDELINE_SHEETS, 'qollanma']);
    for (const sheet of GUIDELINE_SHEETS) {
      expect(sheets.get(sheet)![0].filter((name) => name !== '')).toEqual([...TEMPLATE_COLUMNS[sheet]]);
    }
    // Bo'sh shablon — faqat "universitet bo'sh" xatosi, format xatosi emas
    const result = await parseGuidelineWorkbook(bytes, 'shablon.xlsx');
    expect(result.notTemplate).toBeFalsy();
    expect(result.errors).toEqual([expect.stringContaining("universitet varag'i bo'sh")]);
  });

  it('eski (v2) fayl — grantlar varag‘isiz — qabul qilinmaydi', async () => {
    const result = await parseGuidelineWorkbook(jbnuV2Workbook(), 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.notTemplate).toBe(true);
    expect(result.errors).toEqual(['Faylda varaq yetishmaydi: grantlar']);
  });

  it('format_versiya 4 bo‘lmasa yoki bo‘sh bo‘lsa — qabul qilinmaydi', async () => {
    const v3 = await edited((zip) =>
      replaceIn(zip, 'xl/worksheets/sheet1.xml', '<c r="AO2" s="6" t="n"><v>4</v></c>', '<c r="AO2" s="6" t="n"><v>3</v></c>'),
    );
    const r3 = await parseGuidelineWorkbook(v3, 'f.xlsx');
    expect(r3.ok).toBe(false);
    expect(r3.notTemplate).toBe(true);
    expect(r3.errors).toEqual(['universitet 2-qator, format_versiya: 3 — sayt faqat 4-versiyani qabul qiladi']);

    const empty = await edited((zip) =>
      replaceIn(zip, 'xl/worksheets/sheet1.xml', '<c r="AO2" s="6" t="n"><v>4</v></c>', ''),
    );
    const r0 = await parseGuidelineWorkbook(empty, 'f.xlsx');
    expect(r0.ok).toBe(false);
    expect(r0.notTemplate).toBe(true);
    expect(r0.errors).toEqual(['universitet 2-qator: "format_versiya" to\'ldirilmagan']);
  });

  it('shablonda yo‘q ustun qo‘shilsa — qabul qilinmaydi', async () => {
    const buf = await edited((zip) =>
      replaceIn(
        zip,
        'xl/worksheets/sheet3.xml',
        /(<row r="1"[^>]*>.*?)(<\/row>)/s,
        '$1<c r="P1" t="inlineStr"><is><t>reyting</t></is></c>$2',
      ),
    );
    const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.notTemplate).toBe(true);
    expect(result.errors).toEqual(['"fakultetlar" varag\'ida shablonda yo\'q ustun: reyting']);
  });

  it('ustun nomi o‘zgartirilsa — yetishmaydigan va ortiqcha ustun aytiladi', async () => {
    const buf = await edited((zip) => replaceIn(zip, 'xl/worksheets/sheet1.xml', '<t>shahar</t>', '<t>city</t>'));
    const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      '"universitet" varag\'ida ustun yetishmaydi: shahar',
      '"universitet" varag\'ida shablonda yo\'q ustun: city',
    ]);
  });

  it('ustunlar tartibi o‘zgarsa — qabul qilinmaydi', async () => {
    const buf = await edited((zip) =>
      replaceIn(zip, 'xl/worksheets/sheet1.xml', /<t>univ_nomi_en<\/t>(.*?)<t>univ_nomi_kr<\/t>/s, '<t>univ_nomi_kr</t>$1<t>univ_nomi_en</t>'),
    );
    const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.notTemplate).toBe(true);
    expect(result.errors).toEqual([
      '"universitet" varag\'ida ustunlar tartibi shablondagidek emas: 3-ustun "univ_nomi_en" bo\'lishi kerak, faylda "univ_nomi_kr"',
    ]);
  });

  it('shablonda yo‘q varaq bo‘lsa — qabul qilinmaydi; qollanma varag‘isiz esa bo‘ladi', async () => {
    const extra = await edited((zip) => replaceIn(zip, 'xl/workbook.xml', 'name="qollanma"', 'name="Sheet1"'));
    const r1 = await parseGuidelineWorkbook(extra, 'f.xlsx');
    expect(r1.ok).toBe(false);
    expect(r1.errors).toEqual(["Shablonda yo'q varaq: Sheet1 — o'chirib, qayta yuklang"]);

    const noGuide = await edited((zip) => replaceIn(zip, 'xl/workbook.xml', /<sheet [^>]*name="qollanma"[^>]*\/>/, ''));
    const r2 = await parseGuidelineWorkbook(noGuide, 'f.xlsx');
    expect(r2.errors).toEqual([]);
    expect(r2.ok).toBe(true);
  });

  it('muddatlarda etap nomi shablondagidek bo‘lmasa — xato', async () => {
    const buf = await edited((zip) => replaceIn(zip, 'xl/worksheets/sheet2.xml', '<t>Intervyu</t>', '<t>Suhbat</t>'));
    const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['muddatlar: 1-bosqich 5-etap nomi "Suhbat" — shablonda "Intervyu"']);
  });
});

describe('contractFromNote', () => {
  it('izohdagi birinchi summani oladi (Ewha holati)', () => {
    expect(
      contractFromNote("1-kurs: taxminan 5,090,000–5,530,000 KRW, kirish to'lovi bilan; 2-kursdan: taxminan 4,640,000–5,560,000 KRW."),
    ).toBe(5090000);
    expect(contractFromNote('Klinik yo‘nalishlar — 5 789 000; fundamental — 5 363 000')).toBe(5789000);
  });

  it('stipendiya summasini kontrakt deb olmaydi', () => {
    expect(
      contractFromNote("Barcha xorijiy talabalar to'liq stipendiya oladi; yillik KAIST stipendiyasi taxminan 11,786,000 KRW."),
    ).toBeNull();
  });

  it('summa bo‘lmasa yoki juda kichik bo‘lsa null', () => {
    expect(contractFromNote("Guideline'da kontrakt summasi yo'q.")).toBeNull();
    expect(contractFromNote('2026-yil narxi, + talaba to‘lovi 12,000')).toBeNull();
  });
});
