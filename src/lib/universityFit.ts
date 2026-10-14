/**
 * Does a student's language score meet a university's minimum? A university
 * accepts either track, so meeting the IELTS or the TOPIK minimum is enough.
 */
export type FitState = 'ok' | 'gap' | 'unknown';

export interface Fit {
  state: FitState;
  label: string;
}

export interface FitRequirement {
  ielts_min: number | null;
  topik_min: number | null;
}

export interface FitScores {
  ielts_score?: number | null;
  topik_level?: number | null;
}

const trim = (n: number) => String(Math.round(n * 10) / 10);

export function languageFit(scores: FitScores, req: FitRequirement | null): Fit {
  const ielts = scores.ielts_score ?? null;
  const topik = scores.topik_level ?? null;
  if (!req || (req.ielts_min === null && req.topik_min === null)) {
    return { state: 'unknown', label: "Talab ko'rsatilmagan" };
  }
  if (ielts === null && topik === null) return { state: 'unknown', label: "Talabaning bali yo'q" };

  if (req.ielts_min !== null && ielts !== null && ielts >= req.ielts_min) {
    return { state: 'ok', label: `IELTS ${trim(req.ielts_min)} mos` };
  }
  if (req.topik_min !== null && topik !== null && topik >= req.topik_min) {
    return { state: 'ok', label: `TOPIK ${trim(req.topik_min)} mos` };
  }

  // Not met on any track the student has a score for: show the smallest gap.
  const gaps: string[] = [];
  if (req.ielts_min !== null && ielts !== null) gaps.push(`IELTS +${trim(req.ielts_min - ielts)} kerak`);
  if (req.topik_min !== null && topik !== null) gaps.push(`TOPIK +${trim(req.topik_min - topik)} kerak`);
  if (gaps.length === 0) {
    // The student's track isn't one this university lists a minimum for.
    const need = req.ielts_min !== null ? `IELTS ${trim(req.ielts_min)}` : `TOPIK ${trim(req.topik_min!)}`;
    return { state: 'gap', label: `${need} kerak` };
  }
  return { state: 'gap', label: gaps[0] };
}
