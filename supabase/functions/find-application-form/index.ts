import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SearchRequest {
  universityName: string;
  programLevel: 'undergraduate' | 'graduate' | 'phd';
  semester: 'spring' | 'fall';
  year: number;
  languageTrack: 'english' | 'korean' | 'both';
}

interface SearchResult {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
  source: 'studyinkorea' | 'official_website' | 'search';
  universityMatch: 'exact' | 'partial' | 'none';
  matchConfidence: number;
}

// Korean university name mappings for better search and validation
const universityNameVariants: Record<string, { korean: string; abbreviations: string[]; official: string; website?: string }> = {
  'seoul national': { korean: '서울대학교', abbreviations: ['SNU'], official: 'Seoul National University', website: 'snu.ac.kr' },
  'korea university': { korean: '고려대학교', abbreviations: ['KU', 'Korea Univ'], official: 'Korea University', website: 'korea.ac.kr' },
  'yonsei': { korean: '연세대학교', abbreviations: ['YU'], official: 'Yonsei University', website: 'yonsei.ac.kr' },
  'kaist': { korean: '한국과학기술원', abbreviations: ['KAIST'], official: 'KAIST', website: 'kaist.ac.kr' },
  'postech': { korean: '포항공과대학교', abbreviations: ['POSTECH'], official: 'POSTECH', website: 'postech.ac.kr' },
  'hanyang': { korean: '한양대학교', abbreviations: ['HYU'], official: 'Hanyang University', website: 'hanyang.ac.kr' },
  'sungkyunkwan': { korean: '성균관대학교', abbreviations: ['SKKU'], official: 'Sungkyunkwan University', website: 'skku.edu' },
  'kyung hee': { korean: '경희대학교', abbreviations: ['KHU'], official: 'Kyung Hee University', website: 'khu.ac.kr' },
  'sogang': { korean: '서강대학교', abbreviations: ['SU'], official: 'Sogang University', website: 'sogang.ac.kr' },
  'ewha': { korean: '이화여자대학교', abbreviations: ['EWU', 'Ewha'], official: 'Ewha Womans University', website: 'ewha.ac.kr' },
  'chung-ang': { korean: '중앙대학교', abbreviations: ['CAU'], official: 'Chung-Ang University', website: 'cau.ac.kr' },
  'hankuk': { korean: '한국외국어대학교', abbreviations: ['HUFS'], official: 'Hankuk University of Foreign Studies', website: 'hufs.ac.kr' },
  'inha': { korean: '인하대학교', abbreviations: ['Inha'], official: 'Inha University', website: 'inha.ac.kr' },
  'ajou': { korean: '아주대학교', abbreviations: ['Ajou'], official: 'Ajou University', website: 'ajou.ac.kr' },
  'konkuk': { korean: '건국대학교', abbreviations: ['KKU'], official: 'Konkuk University', website: 'konkuk.ac.kr' },
  'dongguk': { korean: '동국대학교', abbreviations: ['DGU'], official: 'Dongguk University', website: 'dongguk.edu' },
  'sejong': { korean: '세종대학교', abbreviations: ['SJU'], official: 'Sejong University', website: 'sejong.ac.kr' },
  'kookmin': { korean: '국민대학교', abbreviations: ['KMU'], official: 'Kookmin University', website: 'kookmin.ac.kr' },
  'soongsil': { korean: '숭실대학교', abbreviations: ['SSU'], official: 'Soongsil University', website: 'ssu.ac.kr' },
  'dankook': { korean: '단국대학교', abbreviations: ['DKU'], official: 'Dankook University', website: 'dankook.ac.kr' },
  'catholic': { korean: '가톨릭대학교', abbreviations: ['CUK'], official: 'Catholic University of Korea', website: 'catholic.ac.kr' },
  'hongik': { korean: '홍익대학교', abbreviations: ['HU'], official: 'Hongik University', website: 'hongik.ac.kr' },
  'sookmyung': { korean: '숙명여자대학교', abbreviations: ['SMU'], official: "Sookmyung Women's University", website: 'sookmyung.ac.kr' },
  'kwangwoon': { korean: '광운대학교', abbreviations: ['KWU'], official: 'Kwangwoon University', website: 'kw.ac.kr' },
  'myongji': { korean: '명지대학교', abbreviations: ['MJU'], official: 'Myongji University', website: 'mju.ac.kr' },
  'sangmyung': { korean: '상명대학교', abbreviations: ['SMU'], official: 'Sangmyung University', website: 'smu.ac.kr' },
  'gachon': { korean: '가천대학교', abbreviations: ['GU'], official: 'Gachon University', website: 'gachon.ac.kr' },
  'hallym': { korean: '한림대학교', abbreviations: ['HU'], official: 'Hallym University', website: 'hallym.ac.kr' },
  'pusan': { korean: '부산대학교', abbreviations: ['PNU'], official: 'Pusan National University', website: 'pusan.ac.kr' },
  'kyungpook': { korean: '경북대학교', abbreviations: ['KNU'], official: 'Kyungpook National University', website: 'knu.ac.kr' },
  'chonnam': { korean: '전남대학교', abbreviations: ['CNU'], official: 'Chonnam National University', website: 'jnu.ac.kr' },
  'chungnam': { korean: '충남대학교', abbreviations: ['CNU'], official: 'Chungnam National University', website: 'cnu.ac.kr' },
  'jeonbuk': { korean: '전북대학교', abbreviations: ['JBNU'], official: 'Jeonbuk National University', website: 'jbnu.ac.kr' },
  'kangwon': { korean: '강원대학교', abbreviations: ['KNU'], official: 'Kangwon National University', website: 'kangwon.ac.kr' },
  'jeju': { korean: '제주대학교', abbreviations: ['JNU'], official: 'Jeju National University', website: 'jejunu.ac.kr' },
  'gyeongsang': { korean: '경상국립대학교', abbreviations: ['GNU'], official: 'Gyeongsang National University', website: 'gnu.ac.kr' },
  'chungbuk': { korean: '충북대학교', abbreviations: ['CBNU'], official: 'Chungbuk National University', website: 'chungbuk.ac.kr' },
};

// Score source relevance -- ONLY official sources allowed (ported from find-faculty-forms)
function scoreSourceRelevance(url: string): number {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.endsWith('.ac.kr')) return 1.0;
    if (hostname.includes('studyinkorea.go.kr')) return 1.0;
    return 0.0;
  } catch {
    return 0.0;
  }
}

// Get university info with all variants for matching
function getUniversityInfo(name: string, variants?: Record<string, { korean: string; abbreviations: string[]; official: string; website?: string }>): {
  searchTerms: string[]; 
  matchTerms: string[];
  officialName: string;
  website?: string;
} {
  const lowerName = name.toLowerCase().trim();
  const lookupMap = variants || universityNameVariants;
  
  for (const [key, info] of Object.entries(lookupMap)) {
    if (lowerName.includes(key) || 
        lowerName.includes(info.korean) || 
        info.abbreviations.some(abbr => lowerName.includes(abbr.toLowerCase())) ||
        lowerName.includes(info.official.toLowerCase())) {
      return {
        searchTerms: [info.official, info.korean, ...info.abbreviations],
        matchTerms: [
          info.official.toLowerCase(), 
          info.korean, 
          ...info.abbreviations.map(a => a.toLowerCase()),
          key
        ],
        officialName: info.official,
        website: info.website,
      };
    }
  }
  
  // Unknown university - use the name as-is
  return {
    searchTerms: [name],
    matchTerms: [lowerName],
    officialName: name,
  };
}

// CRITICAL: Strict university matching function
function calculateUniversityMatch(
  text: string, 
  url: string, 
  requestedUniversity: string,
  variants?: Record<string, { korean: string; abbreviations: string[]; official: string; website?: string }>
): { match: 'exact' | 'partial' | 'none'; confidence: number; detectedUniversity?: string } {
  const textLower = (text || '').toLowerCase();
  const urlLower = (url || '').toLowerCase();
  const requestedInfo = getUniversityInfo(requestedUniversity, variants);
  const lookupMap = variants || universityNameVariants;
  
  // Check if the requested university is mentioned
  let requestedFound = false;
  let requestedConfidence = 0;
  
  for (const term of requestedInfo.matchTerms) {
    if (textLower.includes(term) || urlLower.includes(term)) {
      requestedFound = true;
      requestedConfidence = Math.max(requestedConfidence, 90);
    }
  }
  
  // Check for official website match
  if (requestedInfo.website && urlLower.includes(requestedInfo.website)) {
    requestedFound = true;
    requestedConfidence = 100;
  }
  
  // CRITICAL: Check if ANY OTHER university is mentioned more prominently
  let otherUniversityFound = false;
  let detectedOtherUniversity: string | undefined;
  let otherConfidence = 0;
  
  for (const [key, info] of Object.entries(lookupMap)) {
    // Skip the requested university
    if (requestedInfo.matchTerms.includes(key)) continue;
    
    const otherTerms = [info.official.toLowerCase(), info.korean, ...info.abbreviations.map(a => a.toLowerCase())];
    
    for (const term of otherTerms) {
      // Check URL first - strongest indicator
      if (info.website && urlLower.includes(info.website)) {
        otherUniversityFound = true;
        detectedOtherUniversity = info.official;
        otherConfidence = Math.max(otherConfidence, 100);
      }
      // Check if the university name is in the title or URL
      else if (urlLower.includes(term.replace(/\s/g, '')) || urlLower.includes(term.replace(/\s/g, '-'))) {
        otherUniversityFound = true;
        detectedOtherUniversity = info.official;
        otherConfidence = Math.max(otherConfidence, 85);
      }
      // Check content
      else if (textLower.includes(term)) {
        // Count occurrences - if another university is mentioned MORE than requested, flag it
        const otherCount = (textLower.match(new RegExp(term, 'g')) || []).length;
        if (otherCount > 0) {
          otherUniversityFound = true;
          detectedOtherUniversity = info.official;
          otherConfidence = Math.max(otherConfidence, Math.min(50 + otherCount * 10, 80));
        }
      }
    }
  }
  
  // Decision logic:
  // 1. If requested university found in URL with official website - EXACT match
  // 2. If other university's website found in URL - REJECT (none)
  // 3. If requested found but other also found - check relative prominence
  // 4. If only requested found - EXACT or PARTIAL based on confidence
  
  if (requestedInfo.website && urlLower.includes(requestedInfo.website)) {
    return { match: 'exact', confidence: 100 };
  }
  
  if (otherUniversityFound && otherConfidence >= 85) {
    console.log(`REJECTED: Content appears to be for ${detectedOtherUniversity}, not ${requestedUniversity}`);
    return { match: 'none', confidence: 0, detectedUniversity: detectedOtherUniversity };
  }
  
  if (requestedFound && otherUniversityFound) {
    if (requestedConfidence > otherConfidence) {
      return { match: 'partial', confidence: requestedConfidence - 20 };
    } else {
      console.log(`REJECTED: ${detectedOtherUniversity} appears more prominent than ${requestedUniversity}`);
      return { match: 'none', confidence: 0, detectedUniversity: detectedOtherUniversity };
    }
  }
  
  if (requestedFound) {
    return { match: requestedConfidence >= 80 ? 'exact' : 'partial', confidence: requestedConfidence };
  }
  
  // Domain-based mismatch detection (broadened for unknown universities)
  if (urlLower.includes('.ac.kr')) {
    const urlDomain = urlLower.match(/([a-z0-9-]+\.ac\.kr)/)?.[1];
    if (urlDomain) {
      // Check if any part of the requested university name appears in the domain
      const requestedWords = requestedUniversity.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3 && w !== 'university' && w !== 'national');
      const domainMatchesRequested = requestedWords.some(w => urlDomain.includes(w));
      
      if (!domainMatchesRequested && !requestedFound) {
        return { match: 'none', confidence: 0, detectedUniversity: `Unknown (${urlDomain})` };
      }
      
      // Known website mismatch
      if (requestedInfo.website && !urlDomain.includes(requestedInfo.website) 
          && !requestedInfo.website.includes(urlDomain) && !requestedFound) {
        return { match: 'none', confidence: 0, detectedUniversity: `Unknown (${urlDomain})` };
      }
    }
  }
  
  // Not found at all
  return { match: 'none', confidence: 0 };
}

async function searchFirecrawl(query: string, apiKey: string): Promise<any> {
  console.log('Searching with Firecrawl:', query);
  
  const response = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit: 10,
      lang: 'en',
      scrapeOptions: {
        formats: ['markdown', 'links'],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Firecrawl search error:', response.status, errorText);
    throw new Error(`Firecrawl search failed: ${response.status}`);
  }

  return response.json();
}

// Retry wrapper for Firecrawl searches (ISSUE 6 fix)
async function searchWithRetry(query: string, apiKey: string, maxRetries: number = 1): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await searchFirecrawl(query, apiKey);
    } catch (err) {
      console.error(`Search attempt ${attempt + 1} failed:`, err);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return { success: false, data: [] };
    }
  }
  return { success: false, data: [] };
}

async function scrapeUrl(url: string, apiKey: string): Promise<any> {
  console.log('Scraping URL:', url);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'links'],
      onlyMainContent: true,
      waitFor: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Firecrawl scrape error:', response.status, errorText);
    throw new Error(`Firecrawl scrape failed: ${response.status}`);
  }

  return response.json();
}

function buildSearchQueries(request: SearchRequest, variants?: Record<string, { korean: string; abbreviations: string[]; official: string; website?: string }>): string[] {
  const universityInfo = getUniversityInfo(request.universityName, variants);
  const primaryTerm = universityInfo.officialName;
  
  const levelTerms: Record<string, string[]> = {
    undergraduate: ['undergraduate', 'bachelor', '학부'],
    graduate: ['graduate', 'master', 'MS', '대학원', '석사'],
    phd: ['PhD', 'doctoral', 'doctorate', '박사'],
  };
  
  const semesterTerms: Record<string, string[]> = {
    spring: ['spring', 'March', '3월', '봄'],
    fall: ['fall', 'autumn', 'September', '9월', '가을'],
  };
  
  const trackTerms: Record<string, string[]> = {
    english: ['English track', 'English-taught', 'IELTS', 'TOEFL'],
    korean: ['Korean track', 'Korean-taught', 'TOPIK'],
    both: ['international admission'],
  };
  
  // More specific queries to avoid cross-university results -- all with site: filters (ISSUE 3 fix)
  const queries = [
    // Primary search - exact university name with quotes for precision + site filter
    `"${primaryTerm}" ${request.year} ${semesterTerms[request.semester][0]} international admission application site:.ac.kr`,
    
    // Study in Korea specific
    `site:studyinkorea.go.kr "${primaryTerm}" ${request.year} ${semesterTerms[request.semester][0]} admission`,
    
    // Official university website (if known)
    universityInfo.website 
      ? `site:${universityInfo.website} international admission ${request.year} ${semesterTerms[request.semester][0]} ${levelTerms[request.programLevel][0]}`
      : `"${primaryTerm}" Korea official admission ${request.year} ${levelTerms[request.programLevel][0]} site:.ac.kr`,
    
    // Track-specific with exact university name + site filter
    `"${primaryTerm}" ${trackTerms[request.languageTrack][0]} ${levelTerms[request.programLevel][0]} ${request.year} admission requirements site:.ac.kr`,
    
    // Application form specific + site filter
    `"${primaryTerm}" application form international students ${request.year} ${semesterTerms[request.semester][0]} site:.ac.kr`,
  ];
  
  // ISSUE 8 fix: Add Korean query when Korean name is available
  const koreanName = universityInfo.searchTerms.find(t => /[\uAC00-\uD7AF]/.test(t));
  if (koreanName) {
    const semesterKorean = request.semester === 'spring' ? '봄 3월' : '가을 9월';
    queries.push(
      `"${koreanName}" ${request.year} 외국인 모집요강 ${semesterKorean} site:.ac.kr`
    );
    // Also search Korean pages on government portal
    queries.push(
      `"${koreanName}" ${request.year} 외국인 모집요강 site:studyinkorea.go.kr`
    );
  }
  
  return queries;
}

function scoreResult(result: any, request: SearchRequest, universityMatch: { match: string; confidence: number }): number {
  // CRITICAL: If university doesn't match, heavily penalize
  if (universityMatch.match === 'none') {
    return -100; // Negative score - will be filtered out
  }
  
  let score = 0;
  const text = ((result.title || '') + ' ' + (result.description || '') + ' ' + (result.markdown || '')).toLowerCase();
  
  // University match is the PRIMARY factor
  if (universityMatch.match === 'exact') {
    score += 50;
  } else if (universityMatch.match === 'partial') {
    score += 20;
  }
  
  // Year match
  if (text.includes(request.year.toString())) score += 15;
  
  // Semester match
  if (text.includes(request.semester)) score += 10;
  
  // Program level match
  if (text.includes(request.programLevel)) score += 10;
  
  // Track match
  if (request.languageTrack === 'english' && (text.includes('ielts') || text.includes('english track'))) score += 10;
  if (request.languageTrack === 'korean' && (text.includes('topik') || text.includes('korean track'))) score += 10;
  
  // Application form indicators
  if (text.includes('application form')) score += 15;
  if (text.includes('admission guide')) score += 12;
  if (text.includes('international admission')) score += 10;
  if (text.includes('required documents')) score += 8;
  if (text.includes('deadline')) score += 5;
  if (text.includes('tuition')) score += 5;
  
  // Source quality
  if (result.url?.includes('studyinkorea.go.kr')) score += 20;
  if (result.url?.includes('.ac.kr')) score += 15;
  if (result.url?.includes('admission') || result.url?.includes('international')) score += 10;
  
  // Penalize non-relevant
  if (text.includes('news') || text.includes('event') || text.includes('conference')) score -= 10;
  
  // ISSUE 9 fix: Track-based scoring penalty for wrong-track-only content
  if (request.languageTrack === 'english') {
    if (text.includes('topik') && !text.includes('ielts') && !text.includes('english track') && !text.includes('toefl')) {
      score -= 15; // Korean-only content when searching English track
    }
  }
  if (request.languageTrack === 'korean') {
    if (text.includes('ielts') && !text.includes('topik') && !text.includes('korean track')) {
      score -= 15; // English-only content when searching Korean track
    }
  }
  
  return score;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const request: SearchRequest = await req.json();
    console.log('Find application form request:', request);

    // Validate request
    if (!request.universityName || !request.programLevel || !request.semester || !request.year) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: universityName, programLevel, semester, year' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ISSUE 2 (Round 4) fix: Create LOCAL copy of university map instead of mutating module-level const
    const localVariants: Record<string, { korean: string; abbreviations: string[]; official: string; website?: string }> = { ...universityNameVariants };
    
    // Dynamic university name lookup from DB
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    if (supabaseUrl && supabaseKey) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
        const { data: dbUnis } = await supabaseAdmin
          .from('universities')
          .select('name_en, name_ko, website')
          .not('name_en', 'is', null);
        
        for (const uni of dbUnis || []) {
          const key = uni.name_en.toLowerCase().replace(/\s*university\s*$/i, '').trim();
          if (key && !Object.keys(localVariants).some(k => key.includes(k) || k.includes(key))) {
            const websiteDomain = uni.website?.replace(/^https?:\/\//, '').replace(/\/$/, '') || undefined;
            localVariants[key] = {
              korean: uni.name_ko || '',
              abbreviations: [],
              official: uni.name_en,
              website: websiteDomain,
            };
          }
        }
        console.log(`Dynamic university map now has ${Object.keys(localVariants).length} entries`);
      } catch (err) {
        console.error('Error loading universities from DB:', err);
      }
    }

    const universityInfo = getUniversityInfo(request.universityName, localVariants);
    console.log(`Searching for: ${universityInfo.officialName} (website: ${universityInfo.website || 'unknown'})`);

    const results: SearchResult[] = [];
    const seenUrls = new Set<string>();
    const rejectedResults: { url: string; reason: string }[] = [];

    // Build and execute search queries
    const queries = buildSearchQueries(request, localVariants);
    console.log('Search queries:', queries);

    // Execute ALL 5 queries in 2 batches (ISSUE 2 fix) with retry logic (ISSUE 6 fix)
    const batch1Promises = queries.slice(0, 3).map(query => 
      searchWithRetry(query, firecrawlApiKey)
    );
    const batch2Promises = queries.slice(3).map(query => 
      searchWithRetry(query, firecrawlApiKey)
    );

    const [batch1Results, batch2Results] = await Promise.all([
      Promise.all(batch1Promises),
      Promise.all(batch2Promises),
    ]);
    const searchResults = [...batch1Results, ...batch2Results];
    console.log(`Executed ${queries.length} search queries in 2 batches`);

    // Content-hash deduplication set (ISSUE 9 fix)
    const seenContentHashes = new Set<string>();
    
    function hashContent(markdown: string): string {
      // Simple hash of first 500 chars for dedup
      const snippet = (markdown || '').substring(0, 500).trim().toLowerCase().replace(/\s+/g, ' ');
      let hash = 0;
      for (let i = 0; i < snippet.length; i++) {
        const char = snippet.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString();
    }

    // Process all search results with STRICT university validation
    for (const searchResult of searchResults) {
      if (searchResult.success !== false && searchResult.data) {
        for (const item of searchResult.data) {
          if (item.url && !seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            
            // Content-hash dedup (ISSUE 9)
            if (item.markdown) {
              const contentHash = hashContent(item.markdown);
              if (seenContentHashes.has(contentHash)) {
                rejectedResults.push({ url: item.url, reason: 'Duplicate content (hash match)' });
                continue;
              }
              seenContentHashes.add(contentHash);
            }
            
            // CRITICAL: Validate university match
            const fullText = (item.title || '') + ' ' + (item.description || '') + ' ' + (item.markdown || '');
            const matchResult = calculateUniversityMatch(fullText, item.url, request.universityName, localVariants);
            
            if (matchResult.match === 'none') {
              rejectedResults.push({ 
                url: item.url, 
                reason: matchResult.detectedUniversity 
                  ? `Content is for ${matchResult.detectedUniversity}, not ${universityInfo.officialName}`
                  : `Could not verify content is for ${universityInfo.officialName}`
              });
              continue;
            }
            
            // Filter non-official sources
            const sourceRelevance = scoreSourceRelevance(item.url);
            if (sourceRelevance < 0.5) {
              rejectedResults.push({ 
                url: item.url, 
                reason: `Non-official source rejected (relevance: ${sourceRelevance})`
              });
              continue;
            }

            let source: 'studyinkorea' | 'official_website' | 'search' = 'search';
            if (item.url.includes('studyinkorea.go.kr')) {
              source = 'studyinkorea';
            } else if (item.url.includes('.ac.kr')) {
              source = 'official_website';
            }
            
            results.push({
              url: item.url,
              title: item.title || 'Unknown Title',
              description: item.description,
              markdown: item.markdown,
              source,
              universityMatch: matchResult.match,
              matchConfidence: matchResult.confidence,
            });
          }
        }
      }
    }

    console.log(`Filtered results: ${results.length} matched, ${rejectedResults.length} rejected`);
    if (rejectedResults.length > 0) {
      console.log('Rejected results:', JSON.stringify(rejectedResults.slice(0, 5)));
    }

    // Score and sort results
    const scoredResults = results.map(result => {
      const matchInfo = { match: result.universityMatch, confidence: result.matchConfidence };
      return {
        ...result,
        score: scoreResult(result, request, matchInfo),
      };
    });

    // Filter out negative scores and sort
    const validResults = scoredResults.filter(r => r.score > 0);
    validResults.sort((a, b) => b.score - a.score);

    // Take top 10 results
    const topResults = validResults.slice(0, 10);

    // For the top 3 results, try to get more detailed content if we don't have markdown
    const detailedResults = await Promise.all(
      topResults.slice(0, 3).map(async (result) => {
        if (!result.markdown && result.url) {
          try {
            const scrapeResult = await scrapeUrl(result.url, firecrawlApiKey);
            if (scrapeResult.success !== false && scrapeResult.data) {
              const markdown = scrapeResult.data.markdown || scrapeResult.markdown;
              
              // Re-validate after scraping full content
              if (markdown) {
                const fullMatchResult = calculateUniversityMatch(
                  markdown, 
                  result.url, 
                  request.universityName,
                  localVariants
                );
                
                if (fullMatchResult.match === 'none') {
                  console.log(`Post-scrape validation failed for ${result.url}: ${fullMatchResult.detectedUniversity}`);
                  return null; // Mark for removal
                }
                
                return {
                  ...result,
                  markdown,
                  universityMatch: fullMatchResult.match,
                  matchConfidence: fullMatchResult.confidence,
                };
              }
            }
          } catch (err) {
            console.error('Failed to scrape URL:', result.url, err);
          }
        }
        return result;
      })
    );

    // Merge detailed results back, filtering out nulls (failed validations)
    const finalResults = topResults.map((original, i) => {
      if (i < 3) {
        const detailed = detailedResults[i];
        return detailed || null;
      }
      return original;
    }).filter(r => r !== null);

    console.log(`Final results for ${universityInfo.officialName}: ${finalResults.length}`);

    // If no results found, return helpful message
    if (finalResults.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          university: universityInfo.officialName,
          programLevel: request.programLevel,
          semester: request.semester,
          year: request.year,
          languageTrack: request.languageTrack,
          results: [],
          totalFound: 0,
          warning: `No verified results found for ${universityInfo.officialName}. The search found ${rejectedResults.length} result(s) but they were for different universities.`,
          rejectedSample: rejectedResults.slice(0, 3),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        university: universityInfo.officialName,
        programLevel: request.programLevel,
        semester: request.semester,
        year: request.year,
        languageTrack: request.languageTrack,
        results: finalResults,
        totalFound: validResults.length,
        rejectedCount: rejectedResults.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in find-application-form:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
