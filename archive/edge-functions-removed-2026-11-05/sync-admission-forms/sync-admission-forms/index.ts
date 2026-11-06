import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const FUNCTION_BASE_URL = `${SUPABASE_URL}/functions/v1`;

interface SyncRequest {
  batchIndex: number;
  semester: 'spring' | 'fall';
  year: number;
  programLevel: 'undergraduate' | 'graduate' | 'phd';
  syncJobId: string;
  triggeredBy?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body: Partial<SyncRequest> = await req.json().catch(() => ({}));

    const batchIndex = body.batchIndex ?? 0;
    const semester = body.semester ?? 'fall';
    const year = body.year ?? (new Date().getFullYear() + 1);
    const programLevel = body.programLevel ?? 'undergraduate';
    const triggeredBy = body.triggeredBy ?? 'manual';

    console.log(`[sync-admission-forms] batchIndex=${batchIndex}, semester=${semester}, year=${year}, level=${programLevel}`);

    // ── Step 1: Get or create the sync job ──────────────────────────────────
    let syncJobId = body.syncJobId;

    if (!syncJobId) {
      // Count ALL universities (not just those with websites)
      const { count: totalCount } = await supabase
        .from('universities')
        .select('*', { count: 'exact', head: true });

      const { data: jobRow, error: jobErr } = await supabase
        .from('admission_sync_jobs')
        .insert({
          status: 'running',
          semester,
          year,
          program_level: programLevel,
          total: totalCount ?? 0,
          processed: 0,
          found: 0,
          failed: 0,
          triggered_by: triggeredBy,
        })
        .select('id')
        .single();

      if (jobErr || !jobRow) {
        console.error('Failed to create sync job:', jobErr);
        return new Response(
          JSON.stringify({ error: 'Failed to create sync job', details: jobErr }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      syncJobId = jobRow.id;
      console.log(`[sync-admission-forms] Created new sync job: ${syncJobId}`);
    }

    // ── Step 2: Load the current job state ────────────────────────────────
    const { data: job } = await supabase
      .from('admission_sync_jobs')
      .select('*')
      .eq('id', syncJobId)
      .single();

    if (!job) {
      return new Response(
        JSON.stringify({ error: 'Sync job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.status === 'cancelled') {
      console.log(`[sync-admission-forms] Job ${syncJobId} was cancelled, stopping.`);
      return new Response(
        JSON.stringify({ message: 'Job cancelled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 3: Fetch the university at this batch position ───────────────
    const { data: universities, error: uniErr } = await supabase
      .from('universities')
      .select('id, name_ko, name_en, website')
      .order('id', { ascending: true })
      .range(batchIndex, batchIndex);

    if (uniErr) {
      console.error('Error fetching universities:', uniErr);
      await supabase.from('admission_sync_jobs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', syncJobId);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch universities' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No more universities — job complete!
    if (!universities || universities.length === 0) {
      await supabase
        .from('admission_sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          processed: batchIndex,
        })
        .eq('id', syncJobId);

      console.log(`[sync-admission-forms] Job ${syncJobId} completed! Processed ${batchIndex} universities.`);
      return new Response(
        JSON.stringify({ message: 'Sync complete', processed: batchIndex }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const university = universities[0];
    const universityDisplayName = university.name_en || university.name_ko || 'Unknown';
    console.log(`[sync-admission-forms] Processing ${batchIndex + 1}: ${universityDisplayName} (${university.website})`);

    // ── Step 4: Fire the self-chain for the NEXT university BEFORE processing ─
    // This ensures the chain continues even if this invocation times out
    const nextBatchIndex = batchIndex + 1;

    // Check if there's a next university
    const { count: remainingCount } = await supabase
      .from('universities')
      .select('*', { count: 'exact', head: true })
      .order('id', { ascending: true })
      .range(nextBatchIndex, nextBatchIndex);

    const hasMore = (remainingCount ?? 0) > 0;

    if (hasMore) {
      // Self-chain: invoke next batch after 2s delay (prevents Firecrawl rate limiting)
      setTimeout(async () => {
        try {
          await fetch(`${FUNCTION_BASE_URL}/sync-admission-forms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              batchIndex: nextBatchIndex,
              semester,
              year,
              programLevel,
              syncJobId,
              triggeredBy,
            }),
          });
        } catch (err) {
          console.error('[sync-admission-forms] Failed to chain next batch:', err);
        }
      }, 2000);
    }

    // ── Step 5: Search for application form for this university ──────────────
    let foundForm = false;
    let cacheId: string | null = null;

    try {
      // Check if we already have a recent cache entry (< 6 hours old)
      const { data: existingCache } = await supabase
        .from('application_form_cache')
        .select('id, analyzed_data, scraped_at')
        .eq('university_id', university.id)
        .eq('semester', semester)
        .eq('year', year)
        .eq('program_level', programLevel)
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();

      const cacheAge = existingCache?.scraped_at
        ? (Date.now() - new Date(existingCache.scraped_at).getTime()) / (1000 * 60 * 60)
        : Infinity;

      if (existingCache && cacheAge < 6) {
        console.log(`[sync-admission-forms] Skipping ${universityDisplayName} — cache is fresh (${cacheAge.toFixed(1)}h old)`);
        foundForm = true;
        cacheId = existingCache.id;
      } else {
        // Call find-application-form edge function
        const searchResp = await fetch(`${FUNCTION_BASE_URL}/find-application-form`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            universityName: universityDisplayName,
            programLevel,
            semester,
            year,
            languageTrack: 'both',
          }),
        });

        if (!searchResp.ok) {
          throw new Error(`find-application-form returned ${searchResp.status}`);
        }

        const searchData = await searchResp.json();

        if (searchData.success && searchData.results?.length > 0) {
          // Find best result with markdown content
          const resultsWithContent = searchData.results.filter((r: any) => r.markdown && r.markdown.length > 200);
          const bestResult = resultsWithContent[0] || searchData.results[0];

          if (bestResult?.markdown) {
            // Call analyze-application-form
            const analyzeResp = await fetch(`${FUNCTION_BASE_URL}/analyze-application-form`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                markdown: bestResult.markdown,
                universityName: universityDisplayName,
                programLevel,
                semester,
                year,
                languageTrack: 'both',
                sourceUrl: bestResult.url,
              }),
            });

            if (analyzeResp.ok) {
              const analyzeData = await analyzeResp.json();

              if (analyzeData.success && analyzeData.analyzed && analyzeData.data) {
                const analyzedData = analyzeData.data;

                // Save / upsert to application_form_cache
                const { data: cacheRow, error: cacheErr } = await supabase
                  .from('application_form_cache')
                  .upsert({
                    university_id: university.id,
                    semester,
                    year,
                    program_level: programLevel,
                    form_url: bestResult.url,
                    scraped_content: bestResult.markdown?.substring(0, 50000),
                    analyzed_data: analyzedData,
                    source: 'auto_sync',
                    is_valid: true,
                    scraped_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  }, {
                    onConflict: 'university_id,semester,year,program_level',
                  })
                  .select('id')
                  .single();

                if (!cacheErr && cacheRow) {
                  cacheId = cacheRow.id;
                  foundForm = true;

                  // ── Step 6: Detect changes vs. previous cache ────────────────
                  if (existingCache?.analyzed_data && cacheId) {
                    await detectAndRecordChanges(
                      supabase,
                      university.id,
                      cacheId,
                      existingCache.analyzed_data as any,
                      analyzedData
                    );
                  }

                  console.log(`[sync-admission-forms] ✓ Cached form for ${universityDisplayName}`);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(`[sync-admission-forms] Error processing ${universityDisplayName}:`, err);
    }

    // ── Step 7: Update job progress ─────────────────────────────────────────
    const newProcessed = (job.processed ?? 0) + 1;
    const newFound = (job.found ?? 0) + (foundForm ? 1 : 0);
    const newFailed = (job.failed ?? 0) + (foundForm ? 0 : 1);

    await supabase
      .from('admission_sync_jobs')
      .update({
        processed: newProcessed,
        found: newFound,
        failed: newFailed,
        status: hasMore ? 'running' : 'completed',
        completed_at: hasMore ? null : new Date().toISOString(),
      })
      .eq('id', syncJobId);

    return new Response(
      JSON.stringify({
        message: hasMore ? 'Processing next...' : 'Sync complete',
        university: universityDisplayName,
        found: foundForm,
        processed: newProcessed,
        hasMore,
        syncJobId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[sync-admission-forms] Fatal error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ── Detect changes between old and new analyzed data ──────────────────────────
async function detectAndRecordChanges(
  supabase: ReturnType<typeof createClient>,
  universityId: string,
  cacheId: string,
  oldData: any,
  newData: any
) {
  const changes: Array<{
    university_id: string;
    cache_id: string;
    change_type: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    severity: string;
  }> = [];

  // Check application deadline changes
  const oldDeadline = oldData?.applicationDeadline || oldData?.deadline;
  const newDeadline = newData?.applicationDeadline || newData?.deadline;
  if (oldDeadline && newDeadline && oldDeadline !== newDeadline) {
    changes.push({
      university_id: universityId,
      cache_id: cacheId,
      change_type: 'deadline_changed',
      field_name: 'applicationDeadline',
      old_value: String(oldDeadline),
      new_value: String(newDeadline),
      severity: 'high',
    });
  }

  // Check TOPIK requirement changes
  const oldTopik = oldData?.languageRequirements?.topik || oldData?.topikRequired;
  const newTopik = newData?.languageRequirements?.topik || newData?.topikRequired;
  if (JSON.stringify(oldTopik) !== JSON.stringify(newTopik)) {
    if (oldTopik || newTopik) {
      changes.push({
        university_id: universityId,
        cache_id: cacheId,
        change_type: 'requirement_changed',
        field_name: 'topikRequirement',
        old_value: oldTopik ? JSON.stringify(oldTopik) : null,
        new_value: newTopik ? JSON.stringify(newTopik) : null,
        severity: 'medium',
      });
    }
  }

  // Check tuition fee changes
  const oldTuition = oldData?.tuitionFee || oldData?.annualTuition;
  const newTuition = newData?.tuitionFee || newData?.annualTuition;
  if (oldTuition && newTuition && oldTuition !== newTuition) {
    changes.push({
      university_id: universityId,
      cache_id: cacheId,
      change_type: 'fee_changed',
      field_name: 'tuitionFee',
      old_value: String(oldTuition),
      new_value: String(newTuition),
      severity: 'high',
    });
  }

  // Check required documents changes
  const oldDocs = (oldData?.requiredDocuments || []).map((d: any) => d.name || d).sort();
  const newDocs = (newData?.requiredDocuments || []).map((d: any) => d.name || d).sort();
  const addedDocs = newDocs.filter((d: string) => !oldDocs.includes(d));
  const removedDocs = oldDocs.filter((d: string) => !newDocs.includes(d));

  if (addedDocs.length > 0) {
    changes.push({
      university_id: universityId,
      cache_id: cacheId,
      change_type: 'document_added',
      field_name: 'requiredDocuments',
      old_value: null,
      new_value: addedDocs.join(', '),
      severity: 'medium',
    });
  }

  if (removedDocs.length > 0) {
    changes.push({
      university_id: universityId,
      cache_id: cacheId,
      change_type: 'document_removed',
      field_name: 'requiredDocuments',
      old_value: removedDocs.join(', '),
      new_value: null,
      severity: 'low',
    });
  }

  // Check scholarship changes
  const oldScholarship = oldData?.scholarshipInfo || oldData?.scholarship;
  const newScholarship = newData?.scholarshipInfo || newData?.scholarship;
  if (JSON.stringify(oldScholarship) !== JSON.stringify(newScholarship)) {
    if (oldScholarship || newScholarship) {
      changes.push({
        university_id: universityId,
        cache_id: cacheId,
        change_type: 'scholarship_changed',
        field_name: 'scholarshipInfo',
        old_value: oldScholarship ? JSON.stringify(oldScholarship).substring(0, 500) : null,
        new_value: newScholarship ? JSON.stringify(newScholarship).substring(0, 500) : null,
        severity: 'low',
      });
    }
  }

  if (changes.length > 0) {
    console.log(`[sync-admission-forms] Detected ${changes.length} changes for university ${universityId}`);
    await supabase.from('application_form_changes').insert(changes);
  }
}
