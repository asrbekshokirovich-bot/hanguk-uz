import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude, extractJson } from "../_shared/claude.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Known comprehensive sources for Korean universities
const UNIVERSITY_SOURCES = [
  'https://en.wikipedia.org/wiki/List_of_universities_and_colleges_in_South_Korea',
  'https://ko.wikipedia.org/wiki/%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD%EC%9D%98_%EB%8C%80%ED%95%99_%EB%AA%A9%EB%A1%9D',
];

interface UniversityData {
  name_en: string;
  name_ko: string | null;
  city_en: string | null;
  city_ko: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  is_partner: boolean;
  is_visible_on_map: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting Korean university import...');

    // Track progress
    let totalFound = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    const allUniversities: UniversityData[] = [];
    const errors: string[] = [];

    // Scrape each source
    for (const sourceUrl of UNIVERSITY_SOURCES) {
      console.log(`Scraping source: ${sourceUrl}`);
      
      try {
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: sourceUrl,
            formats: ['markdown', 'links'],
            onlyMainContent: true,
          }),
        });

        if (!scrapeResponse.ok) {
          const errorData = await scrapeResponse.json();
          console.error(`Failed to scrape ${sourceUrl}:`, errorData);
          errors.push(`Failed to scrape ${sourceUrl}: ${errorData.error || 'Unknown error'}`);
          continue;
        }

        const scrapeData = await scrapeResponse.json();
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
        const links = scrapeData.data?.links || scrapeData.links || [];

        console.log(`Got ${markdown.length} chars of content and ${links.length} links`);

        // Use AI to extract university data from the scraped content
        const extractedUniversities = await extractUniversitiesWithAI(markdown, links);
        
        if (extractedUniversities.length > 0) {
          console.log(`Extracted ${extractedUniversities.length} universities from ${sourceUrl}`);
          allUniversities.push(...extractedUniversities);
          totalFound += extractedUniversities.length;
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error scraping ${sourceUrl}:`, error);
        errors.push(`Error scraping ${sourceUrl}: ${errMsg}`);
      }
    }

    // Also search for additional universities using Firecrawl search
    console.log('Searching for additional Korean universities...');
    
    const searchQueries = [
      'list of all universities in South Korea official',
      '한국 대학교 전체 목록',
      'Korean universities complete list 2024',
    ];

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
            if (result.markdown) {
              const extracted = await extractUniversitiesWithAI(result.markdown, []);
              if (extracted.length > 0) {
                console.log(`Found ${extracted.length} more universities from search`);
                allUniversities.push(...extracted);
                totalFound += extracted.length;
              }
            }
          }
        }
      } catch (error) {
        console.error(`Search error for "${query}":`, error);
      }
    }

    // Deduplicate universities by name
    const uniqueUniversities = deduplicateUniversities(allUniversities);
    console.log(`After deduplication: ${uniqueUniversities.length} unique universities`);

    // Insert or update universities in the database
    for (const uni of uniqueUniversities) {
      try {
        // Check if university already exists
        const { data: existing } = await supabase
          .from('universities')
          .select('id, name_en, name_ko, website, city_en, city_ko, latitude, longitude')
          .or(`name_en.ilike.%${uni.name_en}%,name_ko.eq.${uni.name_ko}`)
          .maybeSingle();

        if (existing) {
          // Update if we have more information
          const updates: Record<string, unknown> = {};
          if (uni.website && !existing.website) updates.website = uni.website;
          if (uni.city_en && !existing.city_en) updates.city_en = uni.city_en;
          if (uni.city_ko && !existing.city_ko) updates.city_ko = uni.city_ko;
          if (uni.latitude && !existing.latitude) updates.latitude = uni.latitude;
          if (uni.longitude && !existing.longitude) updates.longitude = uni.longitude;
          
          if (Object.keys(updates).length > 0) {
            await supabase.from('universities').update(updates).eq('id', existing.id);
            totalUpdated++;
          }
        } else {
          // Insert new university
          const { error: insertError } = await supabase.from('universities').insert({
            name_uz: uni.name_en, // Use English as fallback for required field
            name_en: uni.name_en,
            name_ko: uni.name_ko,
            city_en: uni.city_en,
            city_ko: uni.city_ko,
            website: uni.website,
            latitude: uni.latitude,
            longitude: uni.longitude,
            is_partner: false,
            is_visible_on_map: true,
          });

          if (!insertError) {
            totalInserted++;
          } else {
            console.error(`Failed to insert ${uni.name_en}:`, insertError);
          }
        }
      } catch (error) {
        console.error(`Error processing ${uni.name_en}:`, error);
      }
    }

    console.log(`Import complete. Found: ${totalFound}, Inserted: ${totalInserted}, Updated: ${totalUpdated}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalFound,
        totalUnique: uniqueUniversities.length,
        totalInserted,
        totalUpdated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractUniversitiesWithAI(content: string, links: string[]): Promise<UniversityData[]> {
  const systemPrompt = `You are a Korean university data extractor. Extract ALL universities mentioned in the content.
For each university, extract:
- name_en: English name (required)
- name_ko: Korean name (한글) if available
- city_en: City in English
- city_ko: City in Korean
- website: Official website URL

CRITICAL RULES:
1. Extract EVERY university mentioned - aim for maximum coverage
2. Only include actual universities in South Korea (NOT North Korea)
3. Include all types: national, private, women's universities, polytechnics, etc.
4. Use official English names when available
5. Return as JSON array

Example output:
[
  {"name_en": "Seoul National University", "name_ko": "서울대학교", "city_en": "Seoul", "city_ko": "서울", "website": "https://www.snu.ac.kr"},
  {"name_en": "Korea University", "name_ko": "고려대학교", "city_en": "Seoul", "city_ko": "서울", "website": "https://www.korea.ac.kr"}
]`;

  try {
    const text = await callClaude(
      systemPrompt,
      `Extract all Korean universities from this content:\n\n${content.substring(0, 50000)}\n\nLinks found: ${links.slice(0, 100).join('\n')}`,
      { temperature: 0.1 },
    );

    try {
      const parsed = extractJson<any>(text);
      const universities = Array.isArray(parsed) ? parsed : (parsed.universities || []);
      
      return universities.map((u: Record<string, unknown>) => ({
        name_en: (u.name_en || u.name) as string,
        name_ko: (u.name_ko || null) as string | null,
        city_en: (u.city_en || u.city || null) as string | null,
        city_ko: (u.city_ko || null) as string | null,
        website: (u.website || null) as string | null,
        latitude: null,
        longitude: null,
        is_partner: false,
        is_visible_on_map: true,
      })).filter((u: UniversityData) => u.name_en);
    } catch {
      console.error('Failed to parse AI response as JSON');
      return [];
    }
  } catch (error) {
    console.error('AI extraction error:', error);
    return [];
  }
}

function deduplicateUniversities(universities: UniversityData[]): UniversityData[] {
  const seen = new Map<string, UniversityData>();
  
  for (const uni of universities) {
    // Normalize name for comparison
    const normalizedName = uni.name_en.toLowerCase()
      .replace(/university/gi, '')
      .replace(/college/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const key = normalizedName;
    
    if (!seen.has(key)) {
      seen.set(key, uni);
    } else {
      // Merge data - keep the one with more info
      const existing = seen.get(key)!;
      if (!existing.name_ko && uni.name_ko) existing.name_ko = uni.name_ko;
      if (!existing.website && uni.website) existing.website = uni.website;
      if (!existing.city_en && uni.city_en) existing.city_en = uni.city_en;
      if (!existing.city_ko && uni.city_ko) existing.city_ko = uni.city_ko;
    }
  }
  
  return Array.from(seen.values());
}
