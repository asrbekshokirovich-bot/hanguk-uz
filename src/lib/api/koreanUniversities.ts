/**
 * Phase 3R-B (2026-05-10) — neutered.
 *
 * The legacy bulk-import flow wrote into `public.universities`, which has
 * been dropped. Re-implementation against `public.institutions` +
 * recruitment_units is deferred to Phase 3R-C. Until then, every entry
 * point throws a controlled error so a stray button click surfaces a
 * toast instead of a 500.
 */

const DISABLED_MESSAGE =
  'The legacy bulk-import API was retired on 2026-05-10. Add institutions one at a time via the CRM Add button, or wait for the Phase 3R-C re-implementation against public.institutions.';

function disabled(): never {
  throw new Error(DISABLED_MESSAGE);
}

export interface ImportResult {
  success: boolean;
  totalFound?: number;
  totalUnique?: number;
  totalInserted?: number;
  totalUpdated?: number;
  errors?: string[];
  error?: string;
}

export interface ImportProgress {
  phase: 'discovery' | 'websites' | 'done';
  imported: number;
  total: number;
  websiteProcessed: number;
  websiteTotal: number;
  websitesFound: number;
}

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: ImportProgress;
  result?: ImportResult;
  error?: string;
}

export const koreanUniversitiesApi = {
  startBackgroundImport(): Promise<{ job_id: string }> {
    disabled();
  },
  getJobStatus(_jobId: string): Promise<JobStatus> {
    disabled();
  },
  startBackgroundEnrichment(): Promise<{ job_id: string }> {
    disabled();
  },
  getEnrichmentJobStatus(_jobId: string): Promise<JobStatus> {
    disabled();
  },
  importKoreanUniversities(): Promise<ImportResult> {
    disabled();
  },
  enrichUniversityWebsites(): Promise<ImportResult> {
    disabled();
  },
};
