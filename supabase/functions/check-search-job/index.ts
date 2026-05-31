import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let jobId = url.searchParams.get('jobId');

    // Also support POST body
    if (!jobId && req.method === 'POST') {
      const body = await req.json();
      jobId = body.jobId;
    }

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: 'jobId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('search_jobs')
      .select('id, type, status, result, error, created_at, updated_at, progress')
      .eq('id', jobId)
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // H2: Use updated_at for timeout checks (a job still updating is still active)
    // University import: stale after 60 min of no updates (was 10 min — too short for 450+ universities)
    if (data.status === 'processing' && data.type === 'university_import') {
      const updatedAt = new Date(data.updated_at);
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (updatedAt < sixtyMinutesAgo) {
        await supabase
          .from('search_jobs')
          .update({ status: 'failed', error: 'University import stale (no updates for 60 minutes).' })
          .eq('id', jobId);
        return new Response(
          JSON.stringify({
            success: true, jobId: data.id, type: data.type, status: 'failed',
            result: data.result, error: 'University import stale (no updates for 60 minutes).',
            progress: data.progress, createdAt: data.created_at, updatedAt: data.updated_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Comprehensive faculty search: stale after 30 min of no updates (was 10 min — each batch updates every ~5 min)
    if (data.status === 'processing' && data.type === 'faculty_comprehensive') {
      const updatedAt = new Date(data.updated_at);
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (updatedAt < thirtyMinutesAgo) {
        await supabase
          .from('search_jobs')
          .update({ status: 'failed', error: 'Search stale (no updates for 30 minutes). Please try again.' })
          .eq('id', jobId);
        return new Response(
          JSON.stringify({
            success: true, jobId: data.id, type: data.type, status: 'failed',
            result: data.result, error: 'Search stale (no updates for 30 minutes).',
            progress: data.progress, createdAt: data.created_at, updatedAt: data.updated_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Timeout detection: mark stale processing jobs as failed (>5 minutes) - skip long-running job types
    if (data.status === 'processing' && data.type !== 'faculty_comprehensive' && data.type !== 'university_import') {
      const createdAt = new Date(data.created_at);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (createdAt < fiveMinutesAgo) {
        await supabase
          .from('search_jobs')
          .update({ status: 'failed', error: 'Search timed out after 5 minutes. Please try again.' })
          .eq('id', jobId);

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from('search_jobs')
          .delete()
          .lt('created_at', sevenDaysAgo)
          .in('status', ['completed', 'failed']);

        return new Response(
          JSON.stringify({
            success: true,
            jobId: data.id,
            type: data.type,
            status: 'failed',
            result: null,
            error: 'Search timed out after 5 minutes. Please try again.',
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Timeout detection: mark stale pending jobs as failed (>3 minutes)
    if (data.status === 'pending') {
      const createdAt = new Date(data.created_at);
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
      if (createdAt < threeMinutesAgo) {
        await supabase
          .from('search_jobs')
          .update({ status: 'failed', error: 'Job failed to start. Please try again.' })
          .eq('id', jobId);
        return new Response(
          JSON.stringify({
            success: true, jobId: data.id, type: data.type, status: 'failed',
            result: null, error: 'Job failed to start. Please try again.',
            progress: data.progress, createdAt: data.created_at, updatedAt: data.updated_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Soft cleanup on completed/failed job reads
    if ((data.status === 'completed' || data.status === 'failed') && Math.random() < 0.1) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      supabase
        .from('search_jobs')
        .delete()
        .lt('created_at', sevenDaysAgo)
        .in('status', ['completed', 'failed'])
        .then(() => {})
        .catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobId: data.id,
        type: data.type,
        status: data.status,
        result: data.result,
        error: data.error,
        progress: data.progress,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Check search job error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
