import { describe, expect, it } from 'vitest';
import { NO_FILTER, filterJobs, jobText, koreanE164, splitName, wonText } from '../publicJobs';
import type { IshMonthlyJob } from '../types';

const job = (over: Partial<IshMonthlyJob>): IshMonthlyJob => ({
  id: 'j',
  title: '카페 바리스타',
  company: '달빛카페',
  area: '서울 마포구',
  address: '',
  lat: null,
  lng: null,
  monthly_wage: 2300000,
  days_per_week: 5,
  hours_per_day: 8,
  description: '',
  translations: {},
  status: 'open',
  category: 'cafe',
  work_time: 'day',
  created_at: '2026-11-18T01:00:00Z',
  ...over,
});

const cafe = job({ id: 'cafe', translations: { uz: { title: 'Kafe baristasi', company: 'Dalbit Kafe' } } });
const logistics = job({ id: 'log', title: '물류 상하차', company: '상암물류', category: 'logistics', monthly_wage: 2600000, work_time: 'night' });
const anytime = job({ id: 'any', title: '사무 보조', company: '한국상사', category: 'office', monthly_wage: 2100000, work_time: null });
const all = [cafe, logistics, anytime];

describe('public monthly jobs', () => {
  it('shows a translation when there is one, else the Korean original', () => {
    expect(jobText(cafe, 'uz', 'title')).toBe('Kafe baristasi');
    expect(jobText(cafe, 'ru', 'title')).toBe('카페 바리스타');
    expect(jobText(cafe, 'uz', 'area')).toBe('서울 마포구');
  });

  it('no filter lets everything through', () => {
    expect(filterJobs(all, NO_FILTER)).toHaveLength(3);
  });

  it('minimum monthly pay', () => {
    expect(filterJobs(all, { ...NO_FILTER, minWage: 2300000 }).map((j) => j.id)).toEqual(['cafe', 'log']);
  });

  it('the field', () => {
    expect(filterJobs(all, { ...NO_FILTER, category: 'logistics' }).map((j) => j.id)).toEqual(['log']);
  });

  it('day or night: a job that does not say matches both', () => {
    expect(filterJobs(all, { ...NO_FILTER, workTime: 'day' }).map((j) => j.id)).toEqual(['cafe', 'any']);
    expect(filterJobs(all, { ...NO_FILTER, workTime: 'night' }).map((j) => j.id)).toEqual(['log', 'any']);
  });

  it('the search finds the Korean text and any translation', () => {
    expect(filterJobs(all, { ...NO_FILTER, query: '상암' }).map((j) => j.id)).toEqual(['log']);
    expect(filterJobs(all, { ...NO_FILTER, query: 'dalbit' }).map((j) => j.id)).toEqual(['cafe']);
    expect(filterJobs(all, { ...NO_FILTER, query: 'nothing here' })).toEqual([]);
  });

  it('filters combine', () => {
    expect(filterJobs(all, { minWage: 2300000, category: 'cafe', workTime: 'day', query: '' }).map((j) => j.id)).toEqual(['cafe']);
  });

  it('a Korean number becomes +82…; anything else is refused', () => {
    expect(koreanE164('010-1234-5678')).toBe('+821012345678');
    expect(koreanE164('01012345678')).toBe('+821012345678');
    expect(koreanE164('+998901234567')).toBeNull();
    expect(koreanE164('123')).toBeNull();
  });

  it('splits a name and prints won', () => {
    expect(splitName('  Aziz   Karimov Jr ')).toEqual({ first: 'Aziz', last: 'Karimov Jr' });
    expect(splitName('')).toEqual({ first: '', last: '' });
    expect(wonText(2300000)).toBe('2 300 000 ₩');
  });
});
