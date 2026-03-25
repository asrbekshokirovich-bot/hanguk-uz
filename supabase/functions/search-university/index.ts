import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface UniversitySearchResult {
  name_en: string;
  name_ko: string | null;
  name_uz: string | null;
  name_ru: string | null;
  city_en: string | null;
  city_ko: string | null;
  city_uz: string | null;
  city_ru: string | null;
  website: string | null;
  description_en: string | null;
  description_ko: string | null;
  latitude: number | null;
  longitude: number | null;
  ranking: number | null;
  programs: string[];
  confidence: number;
  foundViaWebsite: boolean;
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

async function doUniversitySearch(universityName: string, websiteUrl: string | undefined, firecrawlApiKey: string, lovableApiKey: string) {
  const gatewayUrl = 'https://ai.gateway.lovable.dev/v1';
  
  let scrapedContent = '';
  let foundWebsite = websiteUrl || '';
  let searchMethod = websiteUrl ? 'direct_website' : 'search';

  // If we have a website URL, scrape it directly
  if (websiteUrl) {
    console.log(`Scraping provided website: ${websiteUrl}`);
    
    try {
      const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: websiteUrl,
          formats: ['markdown', 'links'],
          onlyMainContent: false,
        }),
      });

      if (scrapeResponse.ok) {
        const scrapeData = await scrapeResponse.json();
        scrapedContent = scrapeData.data?.markdown || scrapeData.markdown || '';
        console.log(`Scraped ${scrapedContent.length} chars from website`);
      }
    } catch (error) {
      console.error('Error scraping website:', error);
    }

    // ISSUE 3 fix: Parallelize about-page scraping instead of sequential
    try {
      const aboutPaths = ['/about', '/en/about', '/introduction'];
      const aboutPromises = aboutPaths.map(path => {
        const aboutUrl = new URL(path, websiteUrl).toString();
        return fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: aboutUrl,
            formats: ['markdown'],
            onlyMainContent: true,
          }),
        }).then(r => r.ok ? r.json() : null).catch(() => null);
      });

      const aboutResults = await Promise.allSettled(aboutPromises);
      for (const result of aboutResults) {
        if (result.status === 'fulfilled' && result.value) {
          const aboutContent = result.value.data?.markdown || result.value.markdown || '';
          if (aboutContent.length > 500) {
            scrapedContent += '\n\n--- ABOUT PAGE ---\n\n' + aboutContent;
            console.log(`Added ${aboutContent.length} chars from about page`);
            break; // Take first successful one
          }
        }
      }
    } catch (error) {
      console.error('Error scraping about pages:', error);
    }
  } else {
    // Search for the university
    console.log(`Searching for university: ${universityName}`);
    
    const searchQueries = [
      `"${universityName}" site:.ac.kr`,
      `"${universityName}" site:studyinkorea.go.kr`,
      `${universityName} 대학교 site:.ac.kr`,
    ];

    const seenSearchUrls = new Set<string>();

    for (const query of searchQueries) {
      try {
        const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            limit: 5,
            scrapeOptions: { formats: ['markdown'] },
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const results = searchData.data || [];
          
          for (const result of results) {
            const url = result.url || '';

            // URL deduplication
            if (seenSearchUrls.has(url)) continue;
            seenSearchUrls.add(url);

            const isOfficialSite = url.includes('.ac.kr') || 
                                   url.includes('studyinkorea.go.kr');
            
            const content = result.markdown || '';
            const contentLower = content.toLowerCase();
            const nameLower = universityName.toLowerCase();
            
            const nameWords = nameLower.split(/\s+/).filter((w: string) => w.length > 2);
            const matchCount = nameWords.filter((word: string) => contentLower.includes(word)).length;
            const matchRatio = matchCount / nameWords.length;
            
            if (isOfficialSite && matchRatio >= 0.7 && content.length > 500) {
              scrapedContent += content + '\n\n';
              if (!foundWebsite && url.includes('.ac.kr')) {
                foundWebsite = url;
              }
            }
          }
        }
      } catch (error) {
        console.error(`Search error for "${query}":`, error);
      }
      
      if (scrapedContent.length > 10000) break;
    }
  }

  if (!scrapedContent || scrapedContent.length < 100) {
    return { 
      success: false, 
      error: 'Could not find information about this university. Please provide the official website URL.',
      needsWebsite: true 
    };
  }

  // Use AI to extract structured university data
  console.log('Extracting university data with AI...');
  
  const systemPrompt = `You are a Korean university data extraction expert. Your task is to extract comprehensive information about a SPECIFIC university from the provided content.

CRITICAL VALIDATION RULES:
1. You MUST verify that the content is about the university named: "${universityName}"
2. If the content is about a DIFFERENT university, set confidence to 0 and return an error
3. Look for exact name matches in Korean (e.g., 서울대학교 for Seoul National University)
4. Cross-reference the URL domain with the university name

EXTRACTION REQUIREMENTS:
Extract ALL available information:
- name_en: Official English name
- name_ko: Korean name (한글)
- name_uz: Uzbek transliteration (create from English name)
- name_ru: Russian transliteration (create from Korean/English name)
- city_en: City in English
- city_ko: City in Korean
- city_uz: City in Uzbek
- city_ru: City in Russian
- website: Official website URL (prefer .ac.kr domains)
- description_en: Brief description in English (2-3 sentences about the university)
- description_ko: Brief description in Korean if available
- latitude: GPS latitude of main campus (if found or if you know it)
- longitude: GPS longitude of main campus (if found or if you know it)
- ranking: National or world ranking if mentioned
- programs: List of major faculties/departments/programs offered
- confidence: 0-100 score for how confident you are this is the correct university
- isCorrectUniversity: true if this matches the requested university, false otherwise
- error: If isCorrectUniversity is false, explain what university was found instead

Return as valid JSON object.`;

  // Smart content extraction for university pages (ISSUE 7 fix)
  function extractUniversityRelevantSections(content: string, maxLength: number = 80000): string {
    if (content.length <= maxLength) return content;

    const keywords = [
      'about', 'founded', 'established', 'campus', 'faculty', 'college',
      'department', 'program', 'ranking', 'accreditation', 'location',
      'international', 'admission', 'undergraduate', 'graduate',
      '대학교', '학과', '캠퍼스', '설립', '소개',
    ];

    const headerSection = content.substring(0, 20000);
    const remaining = content.substring(20000);
    const budget = maxLength - headerSection.length;

    const paragraphs = remaining.split(/\n{2,}/).filter(p => p.trim().length > 50);
    const scored = paragraphs.map(p => {
      const lower = p.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) score++;
      }
      return { text: p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    let collected = '';
    for (const item of scored) {
      if (collected.length + item.text.length > budget) break;
      collected += '\n\n' + item.text;
    }

    return headerSection + collected;
  }

  const aiResponse = await fetch(`${gatewayUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${lovableApiKey}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Extract information about "${universityName}" from this content. Website URL: ${foundWebsite || 'Unknown'}\n\nContent:\n${extractUniversityRelevantSections(scrapedContent, 80000)}` 
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error('AI extraction failed:', errorText);
    return { success: false, error: 'Failed to extract university information' };
  }

  const aiResult = await aiResponse.json();
  const extractedText = aiResult.choices?.[0]?.message?.content || '';
  
  let universityData: UniversitySearchResult;
  try {
    const parsed = JSON.parse(extractedText);
    
    if (parsed.isCorrectUniversity === false || parsed.confidence < 30) {
      return {
        success: false,
        error: parsed.error || `Found information about "${parsed.name_en || 'unknown university'}" instead of "${universityName}". Please provide the official website URL.`,
        needsWebsite: true,
        foundUniversity: parsed.name_en,
      };
    }

    universityData = {
      name_en: parsed.name_en || universityName,
      name_ko: parsed.name_ko || null,
      name_uz: parsed.name_uz || parsed.name_en || universityName,
      name_ru: parsed.name_ru || null,
      city_en: parsed.city_en || null,
      city_ko: parsed.city_ko || null,
      city_uz: parsed.city_uz || parsed.city_en || null,
      city_ru: parsed.city_ru || null,
      website: parsed.website || foundWebsite || null,
      description_en: parsed.description_en || null,
      description_ko: parsed.description_ko || null,
      latitude: parsed.latitude || null,
      longitude: parsed.longitude || null,
      ranking: parsed.ranking || null,
      programs: Array.isArray(parsed.programs) ? parsed.programs : [],
      confidence: parsed.confidence || 50,
      foundViaWebsite: !!websiteUrl,
    };
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
    return { success: false, error: 'Failed to parse university information' };
  }

  console.log(`Successfully extracted: ${universityData.name_en} (confidence: ${universityData.confidence}%)`);

  // Issue 9 fix: Auto-save discovered .ac.kr website to database when confidence is high
  // Issue 22 fix: Normalize to root domain before saving
  if (universityData.website && universityData.confidence >= 70) {
    try {
      const parsedUrl = new URL(universityData.website);
      const hostname = parsedUrl.hostname.toLowerCase();
      if (hostname.endsWith('.ac.kr')) {
        const normalizedWebsite = `https://${hostname}`;
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && supabaseKey) {
          const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
          // Issue 19 fix: Use separate filter calls instead of string interpolation in .or()
          const { data: existingByEn } = await supabaseAdmin
            .from('universities')
            .select('id, website')
            .ilike('name_en', `%${universityData.name_en.replace(/[%_]/g, '')}%`)
            .limit(1)
            .maybeSingle();
          
          let existing = existingByEn;
          if (!existing && universityData.name_ko) {
            const { data: existingByKo } = await supabaseAdmin
              .from('universities')
              .select('id, website')
              .eq('name_ko', universityData.name_ko)
              .limit(1)
              .maybeSingle();
            existing = existingByKo;
          }
          
          if (existing && !existing.website) {
            await supabaseAdmin.from('universities').update({ website: normalizedWebsite }).eq('id', existing.id);
            console.log(`✅ Auto-saved website for ${universityData.name_en}: ${normalizedWebsite}`);
          }
        }
      }
    } catch (err) {
      console.error('Auto-save website error:', err);
    }
  }

  return {
    success: true,
    university: universityData,
    searchMethod,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { universityName, websiteUrl, jobId } = body;

    if (!universityName && !websiteUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'University name or website URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If jobId provided, run as background job
    if (jobId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

      await supabaseAdmin.from('search_jobs').update({ status: 'processing' }).eq('id', jobId);

      const searchPromise = (async () => {
        try {
          const result = await doUniversitySearch(universityName, websiteUrl, firecrawlApiKey, lovableApiKey);
          await supabaseAdmin.from('search_jobs').update({
            status: 'completed',
            result: result as any,
          }).eq('id', jobId);
          console.log(`Background university job ${jobId} completed`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Background university job ${jobId} failed:`, errorMsg);
          await supabaseAdmin.from('search_jobs').update({
            status: 'failed',
            error: errorMsg,
          }).eq('id', jobId);
        }
      })();

      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(searchPromise);
      } else {
        searchPromise.catch(console.error);
      }

      return new Response(
        JSON.stringify({ success: true, jobId, status: 'processing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Direct mode
    const result = await doUniversitySearch(universityName, websiteUrl, firecrawlApiKey, lovableApiKey);
    
    const status = result.success === false && result.error ? 
      (result.needsWebsite ? 200 : 500) : 200;

    return new Response(
      JSON.stringify(result),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Search university error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
