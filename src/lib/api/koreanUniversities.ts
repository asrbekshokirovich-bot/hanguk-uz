import { supabase } from '@/integrations/supabase/client';

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

export interface ImportJobStatus {
  success: boolean;
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: ImportProgress | null;
  result: any;
  error: string | null;
}

export const koreanUniversitiesApi = {
  /**
   * Start background university import and website discovery
   */
  async startBackgroundImport(): Promise<{ jobId: string; error?: string }> {
    // S1: Get authenticated user ID (required by NOT NULL constraint)
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return { jobId: '', error: 'You must be logged in to start an import' };
    }

    // Check for any already-running import job to prevent duplicates
    const { data: existingJobs } = await supabase
      .from('search_jobs')
      .select('id, status')
      .eq('type', 'university_import' as any)
      .in('status', ['pending', 'processing'])
      .limit(1);

    if (existingJobs && existingJobs.length > 0) {
      // Resume polling the existing job instead of creating a new one
      return { jobId: existingJobs[0].id };
    }

    // Create the search job with user_id
    const { data: job, error: jobError } = await supabase
      .from('search_jobs')
      .insert([{
        type: 'university_import',
        status: 'pending',
        user_id: userId,
        progress: { phase: 'discovery', imported: 0, total: 0, websiteProcessed: 0, websiteTotal: 0, websitesFound: 0 },
      } as any])
      .select('id')
      .single();

    if (jobError || !job) {
      return { jobId: '', error: jobError?.message || 'Failed to create job' };
    }

    // Trigger the edge function (fire and forget)
    supabase.functions.invoke('discover-university-websites', {
      body: { jobId: job.id, batchIndex: 0 },
    }).catch(err => console.error('Failed to invoke discover-university-websites:', err));

    return { jobId: job.id };
  },

  /**
   * Check import job progress
   */
  async checkImportProgress(jobId: string): Promise<ImportJobStatus> {
    const { data, error } = await supabase.functions.invoke('check-search-job', {
      body: { jobId },
    });

    if (error) {
      return {
        success: false,
        jobId,
        status: 'failed',
        progress: null,
        result: null,
        error: error.message,
      };
    }

    return {
      success: data.success,
      jobId: data.jobId,
      status: data.status,
      progress: data.progress,
      result: data.result,
      error: data.error,
    };
  },

  /**
   * Cancel an import job
   */
  async cancelImport(jobId: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('search_jobs')
      .update({ status: 'failed', error: 'Cancelled by user' })
      .eq('id', jobId);

    return { error };
  },

  /**
   * Import all Korean universities using AI-powered discovery (legacy)
   */
  async importAll(): Promise<ImportResult> {
    const { data, error } = await supabase.functions.invoke('import-korean-universities', {
      body: {},
    });

    if (error) {
      return { success: false, error: error.message };
    }
    
    return data;
  },

  /**
   * Toggle university visibility on the student map
   */
  async toggleVisibility(universityId: string, isVisible: boolean): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('universities')
      .update({ is_visible_on_map: isVisible })
      .eq('id', universityId);

    return { error };
  },

  /**
   * Bulk update visibility for multiple universities
   */
  async bulkToggleVisibility(universityIds: string[], isVisible: boolean): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('universities')
      .update({ is_visible_on_map: isVisible })
      .in('id', universityIds);

    return { error };
  },
};
