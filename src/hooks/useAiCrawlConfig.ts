import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AiCrawlConfig {
  id: string;
  enabled: boolean;
  interval_hours: number;
  batch_size: number;
  model: string;
  auto_approve_threshold: number;
  require_approval: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_run_status: string | null;
  updated_at: string;
}

export interface CrawlRun {
  id: string;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  http_status_code: number | null;
  records_seen: number | null;
  records_new: number | null;
  error_text: string | null;
}

export function useAiCrawlConfig() {
  return useQuery({
    queryKey: ['ai-crawl-config'],
    queryFn: async (): Promise<AiCrawlConfig | null> => {
      const { data, error } = await (supabase.from('ai_crawl_config') as any)
        .select('*')
        .eq('id', 'singleton')
        .maybeSingle();
      if (error) throw error;
      return data as AiCrawlConfig | null;
    },
    staleTime: 30_000,
  });
}

export function useUpdateAiCrawlConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<AiCrawlConfig, 'id' | 'updated_at'>>) => {
      const { data, error } = await (supabase.from('ai_crawl_config') as any)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', 'singleton')
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-crawl-config'] }),
  });
}

export function useRecentCrawlRuns(limit = 10) {
  return useQuery({
    queryKey: ['crawl-runs', limit],
    queryFn: async (): Promise<CrawlRun[]> => {
      const { data, error } = await (supabase.from('crawl_runs') as any)
        .select('id, status, started_at, ended_at, http_status_code, records_seen, records_new, error_text')
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as CrawlRun[];
    },
    staleTime: 30_000,
  });
}
