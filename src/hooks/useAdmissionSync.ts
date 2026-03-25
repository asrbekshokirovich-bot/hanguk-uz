import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const FUNCTION_BASE_URL = `${SUPABASE_URL}/functions/v1`;

export interface AdmissionSyncJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  semester: string;
  year: number;
  program_level: string;
  total: number;
  processed: number;
  found: number;
  failed: number;
  started_at: string;
  completed_at: string | null;
  triggered_by: string;
  created_at: string;
}

export interface AdmissionChange {
  id: string;
  university_id: string;
  cache_id: string;
  change_type: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  severity: string;
  detected_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  notes: string | null;
  university_name?: string;
}

export function useAdmissionSync() {
  const { toast } = useToast();

  const [lastJob, setLastJob] = useState<AdmissionSyncJob | null>(null);
  const [activeJob, setActiveJob] = useState<AdmissionSyncJob | null>(null);
  const [changes, setChanges] = useState<AdmissionChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load most recent sync job ────────────────────────────────────────────
  const loadLastJob = useCallback(async () => {
    const { data } = await supabase
      .from('admission_sync_jobs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const job = data as unknown as AdmissionSyncJob;
      setLastJob(job);
      if (job.status === 'running' || job.status === 'pending') {
        setActiveJob(job);
      }
    }
    setLoading(false);
  }, []);

  // ── Load unacknowledged changes ──────────────────────────────────────────
  const loadChanges = useCallback(async () => {
    const { data, error } = await supabase
      .from('application_form_changes')
      .select(`
        *,
        universities!application_form_changes_university_id_fkey(name)
      `)
      .is('acknowledged_at', null)
      .order('detected_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setChanges(
        data.map((row: any) => ({
          ...row,
          university_name: row.universities?.name_en ?? row.universities?.name_ko ?? 'Unknown University',
        }))
      );
    }
  }, []);

  // ── Poll active job progress ─────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollJob = useCallback((jobId: string) => {
    stopPolling();

    const poll = async () => {
      const { data } = await supabase
        .from('admission_sync_jobs' as any)
        .select('*')
        .eq('id', jobId)
        .single();

      if (!data) {
        stopPolling();
        return;
      }

      const job = data as unknown as AdmissionSyncJob;
      setActiveJob(job);
      setLastJob(job);

      if (job.status === 'completed') {
        stopPolling();
        setActiveJob(null);
        toast({
          title: 'Sync complete!',
          description: `Scanned ${job.processed} universities, found forms for ${job.found}.`,
        });
        await loadChanges();
      } else if (job.status === 'failed' || job.status === 'cancelled') {
        stopPolling();
        setActiveJob(null);
      } else {
        // Still running — poll every 5s
        pollingRef.current = setTimeout(poll, 5000);
      }
    };

    pollingRef.current = setTimeout(poll, 3000);
  }, [stopPolling, toast, loadChanges]);

  // ── Start a new sync ─────────────────────────────────────────────────────
  const startSync = useCallback(async (options?: {
    semester?: 'spring' | 'fall';
    year?: number;
    programLevel?: 'undergraduate' | 'graduate' | 'phd';
  }) => {
    setStarting(true);

    const semester = options?.semester ?? 'fall';
    const year = options?.year ?? (new Date().getFullYear() + 1);
    const programLevel = options?.programLevel ?? 'undergraduate';

    try {
      const resp = await fetch(`${FUNCTION_BASE_URL}/sync-admission-forms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          batchIndex: 0,
          semester,
          year,
          programLevel,
          triggeredBy: 'manual',
        }),
      });

      if (!resp.ok) {
        throw new Error(`Failed to start sync: ${resp.status}`);
      }

      const data = await resp.json();
      const syncJobId = data.syncJobId;

      toast({
        title: 'Auto-sync started!',
        description: `Scanning all universities for ${semester} ${year} ${programLevel} admission forms.`,
      });

      // Reload job and start polling
      await loadLastJob();
      if (syncJobId) {
        pollJob(syncJobId);
      } else {
        // Fallback: find the running job
        const { data: jobRow } = await supabase
          .from('admission_sync_jobs' as any)
          .select('*')
          .eq('status', 'running')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (jobRow) {
          pollJob((jobRow as unknown as AdmissionSyncJob).id);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Failed to start sync', description: message, variant: 'destructive' });
    } finally {
      setStarting(false);
    }
  }, [loadLastJob, pollJob, toast]);

  // ── Acknowledge a change ─────────────────────────────────────────────────
  const acknowledgeChange = useCallback(async (changeId: string) => {
    const { error } = await supabase
      .from('application_form_changes')
      .update({
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', changeId);

    if (!error) {
      setChanges(prev => prev.filter(c => c.id !== changeId));
      toast({ title: 'Change acknowledged' });
    }
  }, [toast]);

  // ── Mount effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadLastJob();
    loadChanges();
    return () => stopPolling();
  }, [loadLastJob, loadChanges, stopPolling]);

  // ── Resume polling if active job exists ──────────────────────────────────
  useEffect(() => {
    if (lastJob && (lastJob.status === 'running' || lastJob.status === 'pending')) {
      pollJob(lastJob.id);
    }
  }, [lastJob?.id, lastJob?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const progressPct = activeJob && activeJob.total > 0
    ? Math.round((activeJob.processed / activeJob.total) * 100)
    : 0;

  return {
    lastJob,
    activeJob,
    changes,
    loading,
    starting,
    progressPct,
    startSync,
    acknowledgeChange,
    reloadChanges: loadChanges,
  };
}
