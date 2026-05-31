import { createClient } from 'npm:@supabase/supabase-js@2';
import { extractAndInsertUniversities } from './extract-universities.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BATCH_SIZE = 1;

// ── Firecrawl search ──────────────────────────────────────────────
async function searchFirecrawl(query: string, apiKey: string): Promise<any> {
  const response = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, limit: 10, lang: 'ko', scrapeOptions: { formats: ['markdown'] } }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl search failed: ${response.status} ${errorText}`);
  }
  return response.json();
}

async function searchWithRetry(query: string, apiKey: string, maxRetries = 2): Promise<any> {
  let lastWas429 = false;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await searchFirecrawl(query, apiKey);
      await new Promise(r => setTimeout(r, 500));
      return result;
    } catch (err: any) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('402');
      lastWas429 = is429;
      const delay = is429 ? 8000 * (attempt + 1) : 2000 * (attempt + 1);
      console.error(`Search attempt ${attempt + 1} failed${is429 ? ' (rate limited)' : ''}:`, err);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return { success: false, data: [], hitRateLimit: is429 };
    }
  }
  return { success: false, data: [], hitRateLimit: lastWas429 };
}

// ── Firecrawl map (fast domain validation) ────────────────────────
async function firecrawlMap(domain: string, apiKey: string): Promise<{ success: boolean; links: string[] }> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: `https://${domain}`, limit: 5 }),
    });
    if (!response.ok) return { success: false, links: [] };
    const data = await response.json();
    const links = data?.links || data?.data?.links || [];
    return { success: Array.isArray(links) && links.length > 0, links };
  } catch {
    return { success: false, links: [] };
  }
}

// ── Domain validation ─────────────────────────────────────────────
const GENERIC_PORTALS = [
  'studyinkorea.go.kr', 'naver.com', 'google.com', 'wikipedia.org',
  'namu.wiki', 'daum.net', 'tistory.com', 'blog.naver.com',
  'youtube.com', 'facebook.com', 'instagram.com', 'twitter.com',
  'topik.go.kr', 'academyinfo.go.kr', 'kcue.or.kr',
];

function isValidAcKrDomain(domain: string): boolean {
  if (!domain.endsWith('.ac.kr')) return false;
  for (const portal of GENERIC_PORTALS) {
    if (domain === portal || domain.endsWith('.' + portal)) return false;
  }
  return true;
}

function normalizeDomain(hostname: string): string | null {
  if (!isValidAcKrDomain(hostname)) return null;
  const parts = hostname.split('.');
  const acKrIdx = parts.findIndex((p: string, i: number) => p === 'ac' && parts[i + 1] === 'kr');
  return acKrIdx >= 1 ? parts.slice(acKrIdx - 1).join('.') : hostname.replace(/^www\./, '');
}

// ── Build candidate domain from university name ───────────────────
// Tries common abbreviation patterns before falling back to search
function buildCandidateDomains(nameEn: string, nameKo: string | null): string[] {
  const candidates: string[] = [];

  // Extract first meaningful word(s) from English name
  const stopWords = new Set(['national', 'university', 'college', 'institute', 'school', 'the', 'of', 'and', 'for', 'at', 'in', 'korea', 'korean']);
  const words = nameEn.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));

  if (words.length > 0) {
    // Single keyword: e.g. "hanyang" → hanyang.ac.kr
    candidates.push(`${words[0]}.ac.kr`);

    // Abbreviation from initials: "Korea Advanced Institute of Science and Technology" → kaist.ac.kr
    const abbrev = nameEn.split(/\s+/)
      .filter(w => /^[A-Z]/.test(w) && !stopWords.has(w.toLowerCase()))
      .map(w => w[0].toLowerCase())
      .join('');
    if (abbrev.length >= 2 && abbrev.length <= 6) {
      candidates.push(`${abbrev}.ac.kr`);
      candidates.push(`www.${abbrev}.ac.kr`);
    }

    // Two keywords: "chung ang" → chungang.ac.kr, "chung-ang" → cau.ac.kr
    if (words.length >= 2) {
      candidates.push(`${words[0]}${words[1]}.ac.kr`);
    }
  }

  return [...new Set(candidates)]; // deduplicate
}

// ── Discover official .ac.kr website ──────────────────────────────
async function discoverOfficialWebsite(
  nameEn: string,
  nameKo: string | null,
  firecrawlApiKey: string,
): Promise<{ domain: string | null; hitRateLimit: boolean }> {
  let hitRateLimit = false;

  // Step 1: Try direct domain construction FIRST (fastest, no search credits used)
  const candidates = buildCandidateDomains(nameEn, nameKo);
  for (const candidate of candidates) {
    try {
      const mapResult = await firecrawlMap(candidate, firecrawlApiKey);
      if (mapResult.success) {
        const normalized = normalizeDomain(candidate) || candidate;
        console.log(`✅ Direct domain hit: ${nameEn} → ${normalized}`);
        return { domain: normalized, hitRateLimit: false };
      }
    } catch { /* skip */ }
    await new Promise(r => setTimeout(r, 300));
  }

  // Step 2: Search with improved 3-query strategy
  const domainCounts = new Map<string, number>();

  const queries: string[] = [];
  // Query 1: Korean name + 홈페이지 (no .ac.kr noise — lets Korean sources surface)
  if (nameKo) queries.push(`${nameKo} 공식 홈페이지`);
  // Query 2: English name + Korean homepage keyword
  queries.push(`"${nameEn}" 대학교 홈페이지`);
  // Query 3: site: operator for proper domain filter (Firecrawl supports this)
  queries.push(`"${nameEn}" site:ac.kr`);

  for (const query of queries) {
    try {
      const searchResult = await searchWithRetry(query, firecrawlApiKey);
      if (searchResult.hitRateLimit) hitRateLimit = true;
      if (searchResult.success !== false && searchResult.data?.length) {
        for (const item of searchResult.data) {
          if (!item.url) continue;
          try {
            const hostname = new URL(item.url).hostname;
            const normalized = normalizeDomain(hostname);
            if (normalized) {
              domainCounts.set(normalized, (domainCounts.get(normalized) || 0) + 1);
            }
          } catch { /* skip invalid URLs */ }
        }
      }
    } catch (err) {
      console.error(`Website discovery search error for ${nameEn}:`, err);
    }
    // Small delay between queries to avoid bursting
    await new Promise(r => setTimeout(r, 600));
  }

  if (domainCounts.size === 0) return { domain: null, hitRateLimit };

  // Find best and second-best domains
  let bestDomain = '';
  let bestCount = 0;
  let secondBestCount = 0;
  for (const [domain, count] of domainCounts) {
    if (count > bestCount) {
      secondBestCount = bestCount;
      bestDomain = domain;
      bestCount = count;
    } else if (count > secondBestCount) {
      secondBestCount = count;
    }
  }

  // IMPROVED confidence logic:
  // Accept if: sole domain found, OR appears more than once, OR clearly beats second place
  const isSoleDomain = domainCounts.size === 1;
  const clearsSecondPlace = bestCount > secondBestCount;
  const multipleHits = bestCount >= 2;

  if (multipleHits || isSoleDomain || (bestCount >= 1 && clearsSecondPlace)) {
    console.log(`✅ Discovered: ${nameEn} → ${bestDomain} (${bestCount} hits, ${domainCounts.size} candidates)`);
    return { domain: bestDomain, hitRateLimit };
  }

  console.log(`⚠️ Low confidence for ${nameEn}: ${bestDomain} tied with others (${bestCount} hit each among ${domainCounts.size})`);
  return { domain: null, hitRateLimit };
}

// ── Phase 2: Website Discovery ────────────────────────────────────
async function processWebsiteBatch(
  supabase: ReturnType<typeof createClient>,
  firecrawlApiKey: string,
  jobId: string,
): Promise<{ processed: number; websitesFound: number; hasMore: boolean }> {
  const { data: needWebsite } = await supabase
    .from('universities')
    .select('id, name_en, name_ko, website')
    .is('website', null)
    .order('name_en')
    .limit(BATCH_SIZE + 1);

  if (!needWebsite || needWebsite.length === 0) {
    console.log('All universities have websites');
    return { processed: 0, websitesFound: 0, hasMore: false };
  }

  const batch = needWebsite.slice(0, BATCH_SIZE);
  console.log(`Processing: ${batch.length} universities, ${needWebsite.length} remaining`);

  let websitesFound = 0;

  for (let i = 0; i < batch.length; i++) {
    const uni = batch[i];
    let foundWebsite = false;

    const { data: jobCheck } = await supabase.from('search_jobs').select('status').eq('id', jobId).single();
    if (jobCheck?.status === 'failed') {
      console.log(`Job ${jobId} cancelled`);
      return { processed: i, websitesFound, hasMore: false };
    }

    console.log(`  Researching: ${uni.name_en}`);

    let batchHitRateLimit = false;
    try {
      const { domain, hitRateLimit } = await discoverOfficialWebsite(uni.name_en, uni.name_ko, firecrawlApiKey);
      if (hitRateLimit) batchHitRateLimit = true;
      if (domain) {
        const websiteUrl = `https://${domain}`;
        const { error } = await supabase.from('universities').update({ website: websiteUrl }).eq('id', uni.id);
        if (!error) {
          websitesFound++;
          foundWebsite = true;
          console.log(`  ✅ Saved: ${uni.name_en} → ${websiteUrl}`);
        }
      } else {
        console.log(`  ❌ No match for ${uni.name_en}, marking searched`);
        await supabase.from('universities').update({ website: '' }).eq('id', uni.id);
      }
    } catch (err) {
      console.error(`  Error researching ${uni.name_en}:`, err);
      // FIX: always mark as searched even on error — prevents infinite retry loop
      await supabase.from('universities').update({ website: '' }).eq('id', uni.id);
    }

    // Update progress using authoritative DB counts (race-safe — parallel invocations all read ground truth)
    const [{ count: processedCount }, { count: foundCount }, { data: currentJob }] = await Promise.all([
      supabase.from('universities').select('id', { count: 'exact', head: true }).not('website', 'is', null),
      supabase.from('universities').select('id', { count: 'exact', head: true }).not('website', 'is', null).neq('website', ''),
      supabase.from('search_jobs').select('progress').eq('id', jobId).single(),
    ]);
    const prevProgress = (currentJob as any)?.progress || {};

    await supabase.from('search_jobs').update({
      progress: {
        ...prevProgress,
        phase: 'websites',
        websiteProcessed: processedCount ?? 0,
        websiteTotal: prevProgress.websiteTotal || needWebsite.length,
        websitesFound: foundCount ?? 0,
      },
    }).eq('id', jobId);

    // If rate-limited, wait 60s before completing this batch to let Firecrawl's window fully reset
    if (batchHitRateLimit) {
      console.log('  ⏳ Rate limit hit — waiting 60s before completing batch...');
      await new Promise(r => setTimeout(r, 60000));
    } else {
      // 2s delay between universities to stay well within Firecrawl rate limits
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const hasMore = needWebsite.length > batch.length;
  return { processed: batch.length, websitesFound, hasMore };
}

// ── Self-chain with retry ─────────────────────────────────────────
async function selfChainWithRetry(
  supabaseUrl: string,
  supabaseKey: string,
  jobId: string,
  nextBatchIndex: number,
  supabaseClient: ReturnType<typeof createClient>,
  maxRetries = 3,
  enrichOnly = false,
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/discover-university-websites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, batchIndex: nextBatchIndex, enrichOnly }),
      });
      if (resp.ok) {
        console.log(`Self-chain to batch ${nextBatchIndex} succeeded`);
        return;
      }
      console.error(`Self-chain attempt ${attempt + 1} got ${resp.status}`);
    } catch (err) {
      console.error(`Self-chain attempt ${attempt + 1} failed:`, err);
    }
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  console.error(`Self-chain to batch ${nextBatchIndex} failed after ${maxRetries} retries`);
  await supabaseClient.from('search_jobs').update({
    status: 'failed',
    error: 'Chain continuation failed after retries.',
  }).eq('id', jobId);
}

// ── Main handler ──────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { jobId, batchIndex = 0, enrichOnly = false } = body;

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: 'jobId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`=== discover-university-websites: job=${jobId}, batch=${batchIndex} ===`);

    const workPromise = (async () => {
      try {
        const { data: job } = await supabase.from('search_jobs').select('status, progress').eq('id', jobId).single();
        if (!job || job.status === 'failed') {
          console.log(`Job ${jobId} already failed/cancelled, skipping`);
          return;
        }

        if (enrichOnly && batchIndex === 0) {
          // ── Enrich-only mode SETUP ──
          console.log('Enrich-only mode: skipping discovery, going straight to website enrichment');

          await supabase.from('search_jobs').update({
            status: 'failed',
            error: 'Superseded by newer enrichment job',
          }).eq('type', 'university_import').eq('status', 'processing').neq('id', jobId);

          const { count: initialNeedWebsite } = await supabase
            .from('universities')
            .select('id', { count: 'exact', head: true })
            .is('website', null);

          await supabase.from('search_jobs').update({
            status: 'processing',
            progress: {
              phase: 'websites',
              imported: 0,
              total: 0,
              websiteProcessed: 0,
              websiteTotal: initialNeedWebsite || 0,
              websitesFound: 0,
            },
          }).eq('id', jobId);

          console.log(`Enrich mode: ${initialNeedWebsite} universities need websites. Chaining to batch 1...`);
          await selfChainWithRetry(supabaseUrl, supabaseKey, jobId, 1, supabase, 3, true);

        } else if (batchIndex === 0) {
          // ── Phase 1a: Scrape sources ──
          await supabase.from('search_jobs').update({
            status: 'processing',
            progress: { phase: 'discovery', imported: 0, total: 0, websiteProcessed: 0, websiteTotal: 0, websitesFound: 0 },
          }).eq('id', jobId);

          console.log('Phase 1a: Scraping Wikipedia...');

          const wikiSources = [
            'https://en.wikipedia.org/wiki/List_of_universities_and_colleges_in_South_Korea',
            'https://ko.wikipedia.org/wiki/%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD%EC%9D%98_%EB%8C%80%ED%95%99_%EB%AA%A9%EB%A1%9D',
          ];

          let allScrapedContent = '';
          for (const url of wikiSources) {
            try {
              const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
              });
              if (resp.ok) {
                const data = await resp.json();
                const markdown = data?.data?.markdown || data?.markdown || '';
                allScrapedContent += `\n\n--- Source: ${url} ---\n${markdown}`;
                console.log(`Scraped ${url}: ${markdown.length} chars`);
              }
            } catch (err) {
              console.error(`Failed to scrape ${url}:`, err);
            }
            await new Promise(r => setTimeout(r, 1000));
          }

          const additionalSearches = ['complete list Korean universities 2024 2025', '한국 대학교 전체 목록'];
          for (const query of additionalSearches) {
            try {
              const result = await searchWithRetry(query, firecrawlApiKey);
              if (result.success !== false && result.data?.length) {
                for (const item of result.data) {
                  if (item.markdown) {
                    allScrapedContent += `\n\n--- Search: ${query} ---\n${item.markdown.substring(0, 5000)}`;
                  }
                }
              }
            } catch (err) {
              console.error(`Search failed for ${query}:`, err);
            }
          }

          await supabase.from('search_jobs').update({
            progress: {
              phase: 'discovery',
              imported: 0,
              total: 0,
              websiteProcessed: 0,
              websiteTotal: 0,
              websitesFound: 0,
              _scrapedContentLength: allScrapedContent.length,
            },
            result: { _scrapedContent: allScrapedContent },
          }).eq('id', jobId);

          console.log(`Phase 1a complete. ${allScrapedContent.length} chars. Self-chaining to Phase 1b...`);
          await selfChainWithRetry(supabaseUrl, supabaseKey, jobId, -1, supabase);

        } else if (batchIndex === -1) {
          // ── Phase 1b: AI extraction + DB insert ──
          console.log('Phase 1b: Extracting universities with AI...');

          const { data: jobData } = await supabase.from('search_jobs').select('result').eq('id', jobId).single();
          const allScrapedContent = jobData?.result?._scrapedContent || '';

          if (!allScrapedContent) {
            console.error('No scraped content found for Phase 1b');
            await supabase.from('search_jobs').update({ status: 'failed', error: 'No scraped content for extraction phase' }).eq('id', jobId);
            return;
          }

          const discoveryResult = await extractAndInsertUniversities(allScrapedContent, geminiApiKey, supabase);
          console.log(`Phase 1b complete: imported ${discoveryResult.imported}, total ${discoveryResult.total}`);

          const { count: initialNeedWebsite } = await supabase
            .from('universities')
            .select('id', { count: 'exact', head: true })
            .is('website', null);

          await supabase.from('search_jobs').update({
            progress: {
              phase: 'websites',
              imported: discoveryResult.imported,
              total: discoveryResult.total,
              websiteProcessed: 0,
              websiteTotal: initialNeedWebsite || 0,
              websitesFound: 0,
            },
            result: null,
          }).eq('id', jobId);

          await selfChainWithRetry(supabaseUrl, supabaseKey, jobId, 1, supabase);

        } else {
          // ── Phase 2: Website Discovery (batchIndex >= 1) ──
          const { data: currentJobState } = await supabase
            .from('search_jobs')
            .select('progress, status')
            .eq('id', jobId)
            .single();

          if (currentJobState?.status === 'completed' || currentJobState?.status === 'failed') {
            console.log(`Job already terminal (${currentJobState.status}), skipping batch ${batchIndex}`);
            return;
          }

          // PRE-CHAIN: peek how many remain, fire next invocation BEFORE processing
          const { data: peekData } = await supabase
            .from('universities')
            .select('id', { count: 'exact', head: false })
            .is('website', null)
            .order('name_en')
            .limit(BATCH_SIZE + 1);

          const peekedCount = peekData?.length ?? 0;
          const willHaveMore = peekedCount > BATCH_SIZE;

          if (willHaveMore) {
            // Guard: only fire if we haven't already launched this batch index
            const { data: guardJob } = await supabase.from('search_jobs').select('progress').eq('id', jobId).single();
            const guardProgress = (guardJob as any)?.progress || {};
            const lastBatchFired = guardProgress.lastBatchFired || 0;

            if (batchIndex + 1 <= lastBatchFired) {
              console.log(`Pre-chain: batch ${batchIndex + 1} already fired (lastBatchFired=${lastBatchFired}), skipping duplicate`);
            } else {
              await supabase.from('search_jobs').update({
                progress: { ...guardProgress, lastBatchFired: batchIndex + 1 },
              }).eq('id', jobId);
              console.log(`Pre-chain: ${peekedCount} remaining, firing batch ${batchIndex + 1} immediately...`);
              await selfChainWithRetry(supabaseUrl, supabaseKey, jobId, batchIndex + 1, supabase, 3, enrichOnly);
            }
          }

          // Process this batch
          const result = await processWebsiteBatch(supabase, firecrawlApiKey, jobId);

          if (!willHaveMore && !result.hasMore) {
            // Finalize
            const { data: finalJob } = await supabase.from('search_jobs').select('progress').eq('id', jobId).single();
            const finalProgress = finalJob?.progress || {};

            const { count: totalUnis } = await supabase.from('universities').select('id', { count: 'exact', head: true });
            const { count: withWebsite } = await supabase.from('universities').select('id', { count: 'exact', head: true }).not('website', 'is', null).neq('website', '');
            const { count: missingWebsite } = await supabase.from('universities').select('id', { count: 'exact', head: true }).is('website', null);

            await supabase.from('search_jobs').update({
              status: 'completed',
              progress: { ...finalProgress, phase: 'done' },
              result: {
                success: true,
                totalUniversities: totalUnis,
                withWebsite,
                missingWebsite: missingWebsite || 0,
                imported: finalProgress.imported || 0,
                websitesFound: finalProgress.websitesFound || 0,
              },
            }).eq('id', jobId);

            console.log(`✅ Job ${jobId} COMPLETE: ${totalUnis} universities, ${withWebsite} with websites`);
          } else if (!willHaveMore && result.hasMore) {
            // Race condition fallback
            console.log(`Post-chain fallback: chaining batch ${batchIndex + 1}`);
            await selfChainWithRetry(supabaseUrl, supabaseKey, jobId, batchIndex + 1, supabase, 3, enrichOnly);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Job ${jobId} batch ${batchIndex} failed:`, errorMsg);
        await supabase.from('search_jobs').update({ status: 'failed', error: errorMsg }).eq('id', jobId);
      }
    })();

    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(workPromise);
    } else {
      workPromise.catch(console.error);
    }

    return new Response(
      JSON.stringify({ success: true, jobId, batchIndex, status: 'processing' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('discover-university-websites error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
