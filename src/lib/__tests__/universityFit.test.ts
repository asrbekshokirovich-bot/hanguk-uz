import { describe, it, expect } from 'vitest';
import { languageFit } from '../universityFit';

describe('languageFit', () => {
  it('is ok when either track minimum is met', () => {
    expect(languageFit({ ielts_score: 6 }, { ielts_min: 5.5, topik_min: 3 })).toEqual({ state: 'ok', label: 'IELTS 5.5 mos' });
    expect(languageFit({ topik_level: 4 }, { ielts_min: 6.5, topik_min: 3 })).toEqual({ state: 'ok', label: 'TOPIK 3 mos' });
  });

  it('shows how much is missing', () => {
    expect(languageFit({ ielts_score: 6 }, { ielts_min: 6.5, topik_min: null })).toEqual({ state: 'gap', label: 'IELTS +0.5 kerak' });
    expect(languageFit({ topik_level: 2 }, { ielts_min: null, topik_min: 3 })).toEqual({ state: 'gap', label: 'TOPIK +1 kerak' });
  });

  it('names the requirement when the student has the other track only', () => {
    expect(languageFit({ ielts_score: 7 }, { ielts_min: null, topik_min: 3 })).toEqual({ state: 'gap', label: 'TOPIK 3 kerak' });
  });

  it('is unknown without a requirement or without a score', () => {
    expect(languageFit({ ielts_score: 6 }, null).state).toBe('unknown');
    expect(languageFit({ ielts_score: 6 }, { ielts_min: null, topik_min: null }).state).toBe('unknown');
    expect(languageFit({}, { ielts_min: 5.5, topik_min: null })).toEqual({ state: 'unknown', label: "Talabaning bali yo'q" });
  });
});
