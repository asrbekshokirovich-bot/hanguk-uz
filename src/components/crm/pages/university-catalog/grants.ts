/**
 * Grantlar — guideline'dagi TOPIK / IELTS stipendiyalari. Sof funksiyalar,
 * shuning uchun sinaladi.
 *
 * Ma'lumot 2027 qabul guideline'laridan o'qib chiqilgan (egasi, 2026-10-21):
 * har bir qoida — jadvaldagi bitta daraja (talab, grant, muddat, sahifa va
 * asl matn). Guideline qatorida esa xulosa turadi — grant holati va kirishdagi
 * foizlar oralig'i; katalog kartasi va saralash shundan o'qiydi.
 */

import type { CatalogEntry, GuidelineGrant, GuidelineSummary } from '@/hooks/useUniversityCatalog';
import { formatMoney, guidelinesForLevel, type LevelFilter } from './format';

/** 100 -> "100", 6.5 -> "6.5", 33.333 -> "33.33" */
function num(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** "30–100%" yoki bitta foiz bo'lsa "100% gacha"; foiz yo'q bo'lsa — null. */
function rangeText(g: GuidelineSummary): string | null {
  const min = g.grant_min ?? null;
  const max = g.grant_max ?? null;
  if (max === null) return null;
  return min !== null && min < max ? `${num(min)}–${num(max)}%` : `${num(max)}% gacha`;
}

// ---------------------------------------------------------------------------
// Katalog kartasi va "Grantlar" bo'limi tepasidagi xulosa
// ---------------------------------------------------------------------------

export interface CardGrant {
  label: string;
  /** Sichqoncha ustida — nimaning foizi ekanini tushuntiradi. */
  title: string;
}

/**
 * Kartadagi belgi. Oraliqqa faqat kontraktdan foizlar kiradi: kontraktning
 * bir qismiga tegishli yoki qat'iy summali darajalar bilan solishtirib
 * bo'lmaydi — shuning uchun bitta foiz qolsa "100% gacha" deyiladi.
 */
export function cardGrant(g: GuidelineSummary | null): CardGrant | null {
  if (!g) return null;
  switch (g.grant_holat) {
    case 'kirishda': {
      const range = rangeText(g);
      return range
        ? { label: `Grant: ${range}`, title: 'TOPIK / IELTS darajasiga qarab kirishda — kontraktdan chegirma' }
        : { label: 'Grant bor', title: "TOPIK / IELTS darajasiga qarab kirishda — qat'iy summa yoki kontraktning bir qismi" };
    }
    case 'oqish_davomida':
      return { label: "Grant: o'qish davomida", title: "TOPIK / IELTS granti faqat o'qish davomida beriladi" };
    case 'aniq_emas':
    case 'tilga_bogliq_emas':
      return { label: 'Grant bor', title: "Grantlar bor, lekin TOPIK / IELTS darajasiga bog'liq jadval yo'q" };
    default:
      return null;
  }
}

export type GrantTone = 'success' | 'info' | 'warning' | 'neutral';

export interface GrantStatus {
  label: string;
  hint: string | null;
  tone: GrantTone;
}

/** "Grantlar" bo'limi tepasidagi xulosa. Grant o'rganilmagan guideline'da — null. */
export function grantStatus(g: GuidelineSummary): GrantStatus | null {
  switch (g.grant_holat) {
    case 'kirishda': {
      const range = rangeText(g);
      return {
        label: range ? `Kirishda TOPIK / IELTS granti: ${range}` : "Kirishda TOPIK / IELTS bo'yicha grant bor",
        hint: 'Qaysi darajaga qancha — pastdagi jadvalda. Foiz — kontraktdan chegirma.',
        tone: 'success',
      };
    }
    case 'oqish_davomida':
      return {
        label: "TOPIK / IELTS granti faqat o'qish davomida",
        hint: "Kirishda til darajasi uchun grant yo'q.",
        tone: 'info',
      };
    case 'aniq_emas':
      return {
        label: "Tilga oid grant bor, lekin aniq TOPIK / IELTS jadvali yo'q",
        hint: 'Shartlari pastda.',
        tone: 'warning',
      };
    case 'tilga_bogliq_emas':
      return {
        label: "TOPIK / IELTS darajasiga qarab grant yo'q",
        hint: "Tilga bog'liq bo'lmagan grantlar pastda.",
        tone: 'neutral',
      };
    case 'malumot_yoq':
      return { label: "Guideline'da grant haqida ma'lumot yo'q", hint: null, tone: 'neutral' };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Bitta qoida: talab va grant
// ---------------------------------------------------------------------------

/** "TOPIK 미소지", "without TOPIK" — sertifikatsiz daraja. */
const NO_CERTIFICATE_RE = /미소지|미취득|미보유|무소지|없는|without|no topik|not have|yo'q|sertifikatsiz/i;

function topikLabel(r: GuidelineGrant): string | null {
  const { topik_min: min, topik_max: max } = r;
  if (min !== null && max !== null) return min === max ? `TOPIK ${num(min)}` : `TOPIK ${num(min)}–${num(max)}`;
  if (min !== null) return `TOPIK ${num(min)}+`;
  if (max !== null) return `TOPIK ${num(max)} va past`;
  if ((r.mezon ?? '').includes('TOPIK') && NO_CERTIFICATE_RE.test(r.talab ?? '')) return "TOPIK yo'q";
  return null;
}

export interface RequirementLabel {
  /** Qisqa: "TOPIK 5+ yoki IELTS 6.5+". */
  main: string;
  /** Boshqa test yoki izoh: "yoki 세종학당 중급2+", "Duolingo 110+". */
  note: string | null;
}

/**
 * Talab qisqa ko'rinishda. TOPIK / IELTS / TOEFL soni bo'lmasa (til kursi,
 * universitetning o'z imtihoni) — boshqa test yoki hujjatdagi matn.
 */
export function requirementLabel(r: GuidelineGrant): RequirementLabel {
  const parts = [
    topikLabel(r),
    r.ielts_min !== null ? `IELTS ${num(r.ielts_min)}+` : null,
    r.toefl_ibt_min !== null ? `TOEFL iBT ${num(r.toefl_ibt_min)}+` : null,
  ].filter((p): p is string => p !== null);
  const other = r.boshqa_test?.trim() || null;
  if (parts.length > 0) {
    return { main: parts.join(r.mezon === 'TOPIK va IELTS' ? ' va ' : ' yoki '), note: other };
  }
  if (other) return { main: other, note: null };
  return { main: r.talab?.trim() || '—', note: null };
}

export interface AwardLabel {
  /** Katta raqam: "100%", "~40%", "₩1,000,000". Foiz ham, summa ham yo'q bo'lsa — null. */
  value: string | null;
  /**
   * Foiz butun kontraktdan bo'lmasa — raqam ostidagi qisqa ogohlantirish:
   * "100%" faqat 수업료1 ga bo'lsa, umumiy kontraktning ~15–19% i xolos.
   */
  caveat: string | null;
  /** Nimadan va qo'shimcha: "kontrakt (수업료)", "kirish to'lovidan ham ozod". */
  details: string[];
}

const FULL_TUITION_RE = /to.liq kontrakt|kontrakt to.liq|등록금 to.liq|전액/i;
/** Kontraktning bir qismi: 수업료1/2, 수업Ⅰ/Ⅱ, Tuition fee 1/2 / I/II. */
const PART_OF_TUITION_RE = /qism|수업료\s*[12ⅠⅡ]|수업\s*[ⅠⅡ]|tuition\s*(fee\s*)?(1|2|i{1,2}|Ⅰ|Ⅱ)(?![0-9a-z])/i;
const TUITION_RE = /kontrakt|수업료|등록금|tuition/i;

function pctCaveat(basis: string | null, approx: boolean): string | null {
  if (!basis || approx || FULL_TUITION_RE.test(basis)) return null;
  if (PART_OF_TUITION_RE.test(basis)) return 'kontraktning bir qismi';
  if (TUITION_RE.test(basis)) return null;
  if (/kirish to.lovi|입학금|admission fee/i.test(basis)) return "kirish to'lovidan";
  if (/yotoqxona|기숙사|dorm/i.test(basis)) return 'yotoqxonadan';
  return null;
}

export function awardLabel(r: GuidelineGrant): AwardLabel {
  const basis = r.grant_asosi?.trim() || null;
  const extra = r.grant_qoshimcha?.trim() || null;
  const details = [basis, extra].filter((t): t is string => !!t);
  if (r.grant_foiz !== null) {
    const pct = num(r.grant_foiz);
    // "등록금ning taxminan 50% (약 50%)" — umumiy kontraktdan taxminiy foiz
    const approx = !!basis && new RegExp(`(taxminan|약)\\s*~?\\s*${pct.replace('.', '\\.')}\\s*%`).test(basis);
    return { value: `${approx ? '~' : ''}${pct}%`, caveat: pctCaveat(basis, approx), details };
  }
  if (r.grant_summa !== null) {
    return { value: formatMoney(r.grant_summa, r.grant_valyuta ?? 'KRW'), caveat: null, details };
  }
  // Foizsiz grant (masalan, yotoqxona chegirmasi) — tafsiloti avval
  return { value: null, caveat: null, details: [extra, basis].filter((t): t is string => !!t) };
}

// ---------------------------------------------------------------------------
// Guruhlash: kirishda / o'qish davomida, ichida — kimlar uchun
// ---------------------------------------------------------------------------

export interface GrantGroup {
  /** "yangi qabul — Korean track" */
  audience: string | null;
  /** Grant nomlari, takrorlanmasdan. */
  names: string[];
  rules: GuidelineGrant[];
}

function groupByAudience(rules: GuidelineGrant[]): GrantGroup[] {
  const groups: GrantGroup[] = [];
  const byAudience = new Map<string, GrantGroup>();
  for (const r of [...rules].sort((a, b) => a.tartib - b.tartib)) {
    const key = r.kimlar_uchun?.trim() ?? '';
    let group = byAudience.get(key);
    if (!group) {
      group = { audience: key || null, names: [], rules: [] };
      byAudience.set(key, group);
      groups.push(group);
    }
    group.rules.push(r);
    const name = r.nomi?.trim();
    if (name && !group.names.includes(name)) group.names.push(name);
  }
  return groups;
}

/** Hujjatdagi tartib saqlanadi: guruhlar birinchi uchragan joyida. */
export function groupGrants(rules: GuidelineGrant[]): { kirishda: GrantGroup[]; oqishDavomida: GrantGroup[] } {
  return {
    kirishda: groupByAudience(rules.filter((r) => r.qachon !== 'oqish_davomida')),
    oqishDavomida: groupByAudience(rules.filter((r) => r.qachon === 'oqish_davomida')),
  };
}

// ---------------------------------------------------------------------------
// Saralash paneli
// ---------------------------------------------------------------------------

/**
 * Tanlangan darajadagi eng yaxshi grant — "Granti borlar" va "Granti kattasi
 * birinchi" uchun. Kirishdagi foiz eng og'ir, keyin foizsiz kirish granti,
 * o'qish davomidagi va tilga bog'liq bo'lmagan grantlar. Grant yo'q yoki
 * o'rganilmagan — null.
 */
export function grantRank(entry: CatalogEntry, level: LevelFilter): number | null {
  let best: number | null = null;
  for (const g of guidelinesForLevel(entry, level)) {
    let rank: number | null = null;
    if (g.grant_holat === 'kirishda') rank = 1000 + (g.grant_max ?? 0);
    else if (g.grant_holat === 'oqish_davomida') rank = 500;
    else if (g.grant_holat === 'aniq_emas' || g.grant_holat === 'tilga_bogliq_emas') rank = 100;
    if (rank !== null && (best === null || rank > best)) best = rank;
  }
  return best;
}
