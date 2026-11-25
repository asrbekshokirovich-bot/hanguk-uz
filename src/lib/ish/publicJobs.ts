import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/keys';
import { ISH_SCHEMA } from './api';
import type { IshMonthlyJob } from './types';

/**
 * The public job page (hanguk.uz/ish): its own Supabase client — it keeps its
 * own session ('ish-web-worker'), so a staff member signed in to the CRM in
 * the same browser is never signed out by a worker's phone sign-in.
 */
export function publicIshClient(): SupabaseClient {
  return createClient(import.meta.env.VITE_SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ish-web-worker' },
  });
}

export type PublicLang = 'uz' | 'ru' | 'en' | 'ko';

/** The open monthly jobs, newest first (`public_monthly_jobs`, anyone may call it). */
export async function openMonthlyJobs(client: SupabaseClient): Promise<IshMonthlyJob[]> {
  // The table is closed to direct reads; this function leaves out the
  // company, address and phone (paid for in the app).
  const { data, error } = await client.schema(ISH_SCHEMA).rpc('public_monthly_jobs');
  if (error) throw new Error(error.message);
  return (data ?? []) as IshMonthlyJob[];
}

/** The job's text in [lang]: its translation, else the Korean original. */
export function jobText(job: IshMonthlyJob, lang: PublicLang, key: 'title' | 'company' | 'description' | 'area'): string {
  const translated = job.translations?.[lang]?.[key];
  return translated && translated.trim() !== '' ? translated : job[key];
}

export interface JobFilter {
  /** At least this much a month (won); null = any. */
  minWage: number | null;
  category: string | null;
  /** 'day' / 'night'; a job that does not say matches both. */
  workTime: 'day' | 'night' | null;
  query: string;
}

export const NO_FILTER: JobFilter = { minWage: null, category: null, workTime: null, query: '' };

export const WAGE_OPTIONS = [2000000, 2300000, 2600000, 3000000] as const;

/** The jobs that pass [filter]; the search looks in every language of a job. */
export function filterJobs(jobs: IshMonthlyJob[], filter: JobFilter): IshMonthlyJob[] {
  const q = filter.query.trim().toLowerCase();
  return jobs.filter((j) => {
    if (filter.minWage !== null && j.monthly_wage < filter.minWage) return false;
    if (filter.category !== null && j.category !== filter.category) return false;
    if (filter.workTime !== null && j.work_time !== null && j.work_time !== filter.workTime) return false;
    if (q !== '') {
      const haystack = [
        j.title, j.company, j.area, j.description,
        ...Object.values(j.translations ?? {}).flatMap((t) => [t.title, t.company, t.area, t.description]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** 010-1234-5678 → +821012345678 (the apps' rule, hanguk_ish/lib/core/format/phone.dart). */
export function koreanE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (!/^(010\d{8}|01[16789]\d{7,8})$/.test(digits)) return null;
  return `+82${digits.slice(1)}`;
}

/** «Aziz Karimov» → first and last name (the first word, the rest). */
export function splitName(full: string): { first: string; last: string } {
  const words = full.trim().split(/\s+/).filter(Boolean);
  return { first: words[0] ?? '', last: words.slice(1).join(' ') };
}

/** «2 300 000 ₩». */
export function wonText(amount: number): string {
  return `${amount.toLocaleString('en-US').replace(/,/g, ' ')} ₩`;
}
