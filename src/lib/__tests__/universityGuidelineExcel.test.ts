import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';

import { columnIndex, readXlsx } from '../xlsxReader';
import {
  contractFromNote,
  parseGuidelineWorkbook,
  SUPPORTED_FORMAT_VERSION,
} from '../universityGuidelineExcel';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/**
 * Haqiqiy, xodim to'ldirgan guideline fayli (JBNU 2027 bahor, bakalavr).
 *
 * Baytlar jsdom realm'ida yangi ArrayBuffer'ga ko'chiriladi: Node'ning
 * Buffer'i ortidagi ArrayBuffer jszip'ning `instanceof ArrayBuffer`
 * tekshiruvidan o'tmaydi. Brauzerda File.arrayBuffer() shundoq ham
 * bir realm'da bo'ladi.
 */
function jbnuWorkbook(): ArrayBuffer {
  const buf = readFileSync(join(fixtureDir, 'jbnu_2027_bahor_bakalavr.xlsx'));
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

/**
 * Fixture'ni ochib, bitta katakni almashtirib, qaytadan zipga yig'adi.
 * Shu bilan xato yo'llarini haqiqiy fayl ustida sinaymiz.
 */
async function patchedWorkbook(
  patch: (xml: string, path: string) => string,
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(jbnuWorkbook());
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
    const sheets = await readXlsx(jbnuWorkbook());
    expect([...sheets.keys()]).toEqual([
      'universitet',
      'muddatlar',
      'fakultetlar',
      'hujjatlar',
      'qollanma',
    ]);
  });

  it('inlineStr kataklarni va koreyscha matnni saqlaydi', async () => {
    const sheets = await readXlsx(jbnuWorkbook());
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
  it('to‘rtala varaqni to‘liq o‘qiydi', async () => {
    const result = await parseGuidelineWorkbook(jbnuWorkbook(), 'jbnu_2027_bahor_bakalavr.xlsx');

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);

    const p = result.payload!;
    expect(p.fayl_nomi).toBe('jbnu_2027_bahor_bakalavr.xlsx');
    expect(p.muddatlar).toHaveLength(22); // 2 bosqich x 11 etap
    expect(p.fakultetlar).toHaveLength(64);
    expect(p.hujjatlar).toHaveLength(16);
  });

  it('universitet qatorini tiplari bilan o‘giradi', async () => {
    const { payload } = await parseGuidelineWorkbook(jbnuWorkbook(), 'f.xlsx');
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
    expect(u.format_versiya).toBe(SUPPORTED_FORMAT_VERSION);
  });

  it('bo‘sh kataklarni kalitsiz qoldiradi (NULL bo‘lib tushsin)', async () => {
    const { payload } = await parseGuidelineWorkbook(jbnuWorkbook(), 'f.xlsx');
    // kampus va kirish_tolovi faylda bo'sh — bo'sh matn sifatida ketsa
    // ''::numeric import'ni yiqitardi.
    expect(payload!.universitet).not.toHaveProperty('kampus');
    expect(payload!.universitet).not.toHaveProperty('kirish_tolovi');
  });

  it('fakultet nomlarini ikkala tilda va narxi bilan beradi', async () => {
    const { payload } = await parseGuidelineWorkbook(jbnuWorkbook(), 'f.xlsx');
    const first = payload!.fakultetlar[0];

    expect(first.track).toBe('english');
    expect(first.kollej_en).toBe('University Headquarters');
    expect(first.kollej_kr).toBe('대학본부');
    expect(first.fakultet_kr).toBe('국제이공학부 (엔지니어링사이언스)');
    expect(first.kontrakt_summa).toBe(2704000);
    expect(first.kontrakt_davri).toBe('semestr');
  });

  it('sana va vaqtlarni saqlaydi, bo‘shini tashlab ketadi', async () => {
    const { payload } = await parseGuidelineWorkbook(jbnuWorkbook(), 'f.xlsx');
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
    const { warnings } = await parseGuidelineWorkbook(jbnuWorkbook(), 'f.xlsx');
    expect(warnings).toEqual([]);
  });
});

describe('parseGuidelineWorkbook — xatolar', () => {
  it('varaq yetishmasa aytadi', async () => {
    const zip = await JSZip.loadAsync(jbnuWorkbook());
    const workbookXml = await zip.file('xl/workbook.xml')!.async('string');
    zip.file('xl/workbook.xml', workbookXml.replace('name="fakultetlar"', 'name="boshqa"'));
    const buf = await zip.generateAsync({ type: 'arraybuffer' });

    const result = await parseGuidelineWorkbook(buf, 'f.xlsx');
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('fakultetlar');
  });

  it('noto‘g‘ri tanlov qiymatini qator raqami bilan qaytaradi', async () => {
    const buf = await patchedWorkbook((xml, path) =>
      path === 'xl/worksheets/sheet1.xml' ? xml.replace('<t>bahor</t>', '<t>yoz</t>') : xml,
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
