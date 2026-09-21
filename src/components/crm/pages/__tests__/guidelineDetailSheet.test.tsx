import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type {
  CatalogEntry,
  GuidelineDetail,
  GuidelineSummary,
} from '@/hooks/useUniversityCatalog';
import { GuidelineDetailSheet } from '../university-catalog/GuidelineDetailSheet';

/**
 * "Umumiy" bo'limi JBNU faylidan keyin bir ekranga sig'may ketgandi: hamma
 * narsa bitta uzun ustunda, uzun izohlar butun bo'limni bosib turardi. Bu
 * test qayta joylashtirilgan ko'rinishni ushlab turadi — pul raqamlari
 * yuqorida, uzun izoh yig'ilgan, texnik "Manba" esa yopiq.
 */

const detail: GuidelineDetail = {
  guideline: {
    id: 'g1',
    guideline_id: 'jbnu_2027_bahor_bakalavr',
    institution_id: 'i1',
    univ_kod: 'jbnu',
    univ_nomi_en: 'Jeonbuk National University',
    univ_nomi_kr: '전북대학교',
    kampus: null,
    shahar: 'Jeonju',
    qabul_yili: 2027,
    semestr: 'bahor',
    daraja: 'bakalavr',
    english_track: true,
    korean_track: true,
    topik_min: 2,
    ielts_min: 5.5,
    toefl_ibt_min: 71,
    narx_valyuta: 'KRW',
    kirish_tolovi: null,
    kontrakt_min: 2016000,
    kontrakt_max: 2779000,
    kontrakt_davri: 'semestr',
    fakultet_soni: 64,
    fayl_nomi: 'jbnu_2027_bahor_bakalavr.xlsx',
    updated_at: '2026-09-21T00:00:00Z',
    ariza_tolovi: 80000,
    ariza_tolovi_valyuta: 'KRW',
    ariza_sayti: 'https://www.uwayapply.com',
    bank_summa: 16000000,
    bank_valyuta: 'KRW',
    bank_turi: 'istalgan_bank',
    io_telefon: '+82-63-270-4653',
    io_email: 'admissionU@jbnu.ac.kr',
    // Haqiqiy fayldagi kabi uzun izoh — yig'ilishi kerak.
    izoh:
      "Talaba va ota-onasi chet el fuqarosi bo'lishi shart, ikki fuqarolik mumkin emas. " +
      "Ekstern, uy va onlayn ta'lim tan olinmaydi. Hujjatlar koreys yoki ingliz tilida; " +
      "boshqa tildagilarga tarjima majburiy. Asl nusxa berib bo'lmasa — beruvchi tashkilot " +
      "tasdiqlagan yoki notarial nusxa. Ariza topshirilgach fakultetni o'zgartirib bo'lmaydi.",
  },
  rounds: [
    {
      id: 'r1',
      bosqich: 1,
      etap_raqam: 1,
      etap_nomi: 'Online hujjat topshirish',
      boshlanish_sana: '2026-09-21',
      boshlanish_vaqt: '09:00',
      tugash_sana: '2026-10-02',
      tugash_vaqt: '17:00',
      holat: 'tasdiqlangan',
      izoh: null,
      sahifa: '1',
    },
  ],
  faculties: [
    {
      id: 'f1',
      tartib: 1,
      track: 'korean',
      kollej_en: 'College of Engineering',
      kollej_kr: '공과대학',
      fakultet_en: 'Department of Architecture',
      fakultet_kr: '건축학과',
      topik_min: 2,
      ielts_min: null,
      toefl_ibt_min: null,
      til_izoh: null,
      kontrakt_summa: 2704000,
      kontrakt_davri: 'semestr',
      kontrakt_izoh: null,
      izoh: null,
      sahifa: '7',
    },
  ],
  docs: [
    {
      id: 'd1',
      tartib: 1,
      etap_raqam: 3,
      hujjat_nomi: 'Maktab attestati',
      hujjat_nomi_asl: '고등학교 졸업증명서',
      kimlar_uchun: 'hammasi',
      majburiy: 'ha',
      shakli: 'asl nusxa',
      apostil: 'ha',
      notarial_tarjima: 'yoq',
      muddat: null,
      muddat_turi: 'yetib_borishi',
      izoh: null,
      sahifa: '4',
    },
  ],
};

// Hook'ni to'liq almashtiramiz: haqiqiy modul supabase klientini yuklaydi,
// u esa testda VITE_SUPABASE_URL yo'qligi uchun yiqiladi. vi.hoisted — chunki
// vi.mock fabrikasi fayl tepasiga ko'chiriladi va quyidagi o'zgaruvchilarni
// hali ko'rmaydi.
const mocks = vi.hoisted(() => ({ detail: null as unknown }));

vi.mock('@/hooks/useUniversityCatalog', () => ({
  useGuidelineDetail: () => ({
    data: mocks.detail,
    isLoading: false,
    error: null,
    refetch: () => {},
  }),
}));

mocks.detail = detail;

const summary = detail.guideline as GuidelineSummary;

const entry: CatalogEntry = {
  institution: {
    id: 'i1',
    name_ko: '전북대학교',
    name_en: 'Jeonbuk National University',
    name_ko_short: '전북대',
    city_ko: '전주',
    region_code: '전북',
    primary_domain: 'jbnu.ac.kr',
    institution_type: 'national',
    tier: 2,
    is_partner: false,
    logo_url: null,
    primary_admissions_url_ko: null,
  },
  guidelines: [summary],
  latest: summary,
};

function open() {
  return render(
    <GuidelineDetailSheet
      entry={entry}
      open
      onOpenChange={() => {}}
      canUpload
      onUpload={() => {}}
      uploading={false}
    />,
  );
}

describe('GuidelineDetailSheet — Umumiy', () => {
  it('pul raqamlarini eng tepada, bitta qatorda ko‘rsatadi', () => {
    open();
    expect(screen.getByText("Ariza to'lovi")).toBeInTheDocument();
    expect(screen.getByText('₩80,000')).toBeInTheDocument();
    expect(screen.getByText('₩16,000,000')).toBeInTheDocument();
    expect(screen.getByText('₩2,016,000–2,779,000')).toBeInTheDocument();
    // Kontrakt davri raqam ostida turadi, alohida ustun egallamaydi
    expect(screen.getByText('/ semestr')).toBeInTheDocument();
  });

  it('til talablarini ball bilan beradi', () => {
    open();
    expect(screen.getByText('TOPIK')).toBeInTheDocument();
    expect(screen.getByText('IELTS')).toBeInTheDocument();
    expect(screen.getByText('TOEFL iBT')).toBeInTheDocument();
    expect(screen.getByText('5.5')).toBeInTheDocument();
    expect(screen.getByText('71')).toBeInTheDocument();
    expect(screen.getByText('Korean track')).toBeInTheDocument();
    expect(screen.getByText('English track')).toBeInTheDocument();
  });

  it('uzun izohni yig‘ib qo‘yadi va so‘ralganda ochadi', () => {
    open();
    const izoh = screen.getByText(/Talaba va ota-onasi chet el fuqarosi/);
    expect(izoh.className).toContain('line-clamp-3');

    fireEvent.click(screen.getByRole('button', { name: /To‘liq o‘qish/ }));
    expect(izoh.className).not.toContain('line-clamp-3');
  });

  it('kontakt havolalarini bosiladigan qiladi', () => {
    open();
    expect(screen.getByRole('link', { name: /admissionU@jbnu\.ac\.kr/ })).toHaveAttribute(
      'href',
      'mailto:admissionU@jbnu.ac.kr',
    );
    expect(screen.getByRole('link', { name: /\+82-63-270-4653/ })).toHaveAttribute(
      'href',
      'tel:+82-63-270-4653',
    );
  });

  it('texnik "Manba" ni yopiq holda saqlaydi', () => {
    open();
    // guideline_id faqat Manba ichida bor — yopiq ekan, ko'rinmasligi kerak
    expect(screen.queryByText('jbnu_2027_bahor_bakalavr')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Manba/ }));
    expect(screen.getByText('jbnu_2027_bahor_bakalavr')).toBeInTheDocument();
  });
});

describe('GuidelineDetailSheet — yorliqlar', () => {
  it('har bir yorliqda nechta yozuv borligi ko‘rinadi', () => {
    open();
    expect(screen.getByRole('tab', { name: /Umumiy/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Muddatlar\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Fakultetlar\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Hujjatlar\s*1/ })).toBeInTheDocument();
  });

  it('boshlanishida Umumiy ochiq turadi', () => {
    open();
    expect(screen.getByRole('tab', { name: /Umumiy/ })).toHaveAttribute('data-state', 'active');
  });
});
