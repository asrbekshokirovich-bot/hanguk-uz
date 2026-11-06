import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface FacultySearchRequest {
  faculty: string;
  programLevel: 'undergraduate' | 'graduate' | 'phd';
  semester: 'spring' | 'fall';
  year: number;
  languageTrack: 'english' | 'korean' | 'both';
}

interface UniversityResult {
  universityName: string;
  universityNameKo?: string;
  sourceUrl: string;
  sourceIndex?: number;
  tuitionPerSemester?: number | null;
  tuitionPerYear?: number | null;
  applicationDeadline?: string | null;
  documentDeadline?: string | null;
  languageTracks: string[];
  topikRequirement?: number | null;
  ieltsRequirement?: number | null;
  toeflRequirement?: number | null;
  uniqueRequirements?: string[];
  interviewRequired?: boolean | null;
  portfolioRequired?: boolean | null;
  notes?: string | null;
  confidence: number;
  validationFlags?: string[];
  dataSource?: 'verified' | 'unverified';
  yearMismatch?: boolean;
}

interface QualitySummary {
  totalFound: number;
  verifiedCount: number;
  reviewCount: number;
  unverifiedCount: number;
  averageConfidence: number;
  sourcesUsed: number;
  officialSourceCount: number;
}

// Korean translations for common faculty names
const facultyKoreanMap: Record<string, string> = {
  'computer science': '컴퓨터공학',
  'computer engineering': '컴퓨터공학',
  'business administration': '경영학',
  'korean language': '한국어',
  'korean language and culture': '한국어문화',
  'electrical engineering': '전기공학',
  'mechanical engineering': '기계공학',
  'international studies': '국제학',
  'economics': '경제학',
  'medicine': '의학',
  'architecture': '건축학',
  'chemical engineering': '화학공학',
  'civil engineering': '토목공학',
  'biology': '생물학',
  'physics': '물리학',
  'mathematics': '수학',
  'psychology': '심리학',
  'sociology': '사회학',
  'political science': '정치학',
  'law': '법학',
  'pharmacy': '약학',
  'nursing': '간호학',
  'art and design': '미술디자인',
  'music': '음악',
  'film and media': '영화미디어',
  'data science': '데이터사이언스',
  'artificial intelligence': '인공지능',
  'environmental science': '환경과학',
  'food science': '식품과학',
  'tourism': '관광학',
};

// University abbreviation map for deduplication
const universityAbbreviations: Record<string, string> = {
  'snu': 'seoul national university',
  'kaist': 'korea advanced institute of science and technology',
  'ku': 'korea university',
  'skku': 'sungkyunkwan university',
  'yonsei': 'yonsei university',
  'hanyang': 'hanyang university',
  'sogang': 'sogang university',
  'ewha': 'ewha womans university',
  'cau': 'chung-ang university',
  'hufs': 'hankuk university of foreign studies',
  'khu': 'kyung hee university',
  'inha': 'inha university',
  'postech': 'pohang university of science and technology',
  'gist': 'gwangju institute of science and technology',
  'unist': 'ulsan national institute of science and technology',
  'konkuk': 'konkuk university',
  'dongguk': 'dongguk university',
  'sejong': 'sejong university',
  'ajou': 'ajou university',
  'kookmin': 'kookmin university',
};

// Korean name to English map for dedup cross-referencing
const koreanToEnglishMap: Record<string, string> = {
  '서울대학교': 'seoul national university',
  '연세대학교': 'yonsei university',
  '고려대학교': 'korea university',
  '성균관대학교': 'sungkyunkwan university',
  '한양대학교': 'hanyang university',
  '서강대학교': 'sogang university',
  '이화여자대학교': 'ewha womans university',
  '중앙대학교': 'chung-ang university',
  '경희대학교': 'kyung hee university',
  '한국외국어대학교': 'hankuk university of foreign studies',
  '건국대학교': 'konkuk university',
  '동국대학교': 'dongguk university',
  '세종대학교': 'sejong university',
  '아주대학교': 'ajou university',
  '국민대학교': 'kookmin university',
  '인하대학교': 'inha university',
};

function getKoreanFacultyName(faculty: string): string | undefined {
  return facultyKoreanMap[faculty.toLowerCase()];
}

// Score source relevance based on domain -- ONLY official sources allowed
function scoreSourceRelevance(url: string): number {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Official university sites (.ac.kr)
    if (hostname.endsWith('.ac.kr')) return 1.0;
    
    // Official Study in Korea portal
    if (hostname.includes('studyinkorea.go.kr')) return 1.0;
    
    // ALL other sources are rejected
    return 0.0;
  } catch {
    return 0.0;
  }
}

// Static fallback synonyms for common professions/terms
const staticFallbackSynonyms: Record<string, { english: string[]; korean: string[] }> = {
  'dentist': { english: ['Dentistry', 'Dental Medicine'], korean: ['치의학', '치과대학'] },
  'doctor': { english: ['Medicine', 'Medical Science'], korean: ['의학', '의과대학'] },
  'coder': { english: ['Computer Science', 'Software Engineering'], korean: ['컴퓨터공학', '소프트웨어공학'] },
  'programmer': { english: ['Computer Science', 'Software Engineering'], korean: ['컴퓨터공학', '소프트웨어공학'] },
  'lawyer': { english: ['Law', 'Legal Studies'], korean: ['법학', '법과대학'] },
  'nurse': { english: ['Nursing', 'Nursing Science'], korean: ['간호학', '간호대학'] },
  'teacher': { english: ['Education', 'Pedagogy'], korean: ['교육학', '사범대학'] },
  'artist': { english: ['Art', 'Fine Arts', 'Design'], korean: ['미술', '디자인', '예술대학'] },
  'accountant': { english: ['Accounting', 'Business Administration'], korean: ['회계학', '경영학'] },
  'engineer': { english: ['Engineering'], korean: ['공학'] },
  'architect': { english: ['Architecture', 'Architectural Engineering'], korean: ['건축학', '건축공학'] },
  'pharmacist': { english: ['Pharmacy', 'Pharmaceutical Science'], korean: ['약학', '약과대학'] },
  'vet': { english: ['Veterinary Medicine', 'Veterinary Science'], korean: ['수의학', '수의과대학'] },
  'veterinarian': { english: ['Veterinary Medicine', 'Veterinary Science'], korean: ['수의학', '수의과대학'] },
};

// AI-powered faculty term expansion using tool calling
async function expandFacultyTerms(
  faculty: string,
  apiKey: string
): Promise<{ englishTerms: string[]; koreanTerms: string[]; primaryTerm: string }> {
  const defaultResult = { englishTerms: [faculty], koreanTerms: [], primaryTerm: faculty };
  
  // Check static map first
  const staticKorean = getKoreanFacultyName(faculty);
  
  // Check static fallback synonyms
  const fallback = staticFallbackSynonyms[faculty.toLowerCase()];

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'You map informal/colloquial terms to official Korean university faculty/department names. Use the expand_faculty_terms tool to return your answer.',
          },
          {
            role: 'user',
            content: `The user typed "${faculty}" as a faculty/field search term for Korean universities.
Return the official academic department/faculty names this could refer to, in both English and Korean.
Return at most 3 English terms and 3 Korean terms. The primaryTerm should be the most common official department name.

Examples:
- "dentist" → englishTerms: ["Dentistry", "Dental Medicine"], koreanTerms: ["치의학", "치과대학"], primaryTerm: "Dentistry"
- "coder" → englishTerms: ["Computer Science", "Computer Engineering", "Software Engineering"], koreanTerms: ["컴퓨터공학", "소프트웨어공학"], primaryTerm: "Computer Science"`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'expand_faculty_terms',
              description: 'Return expanded faculty/department names in English and Korean',
              parameters: {
                type: 'object',
                properties: {
                  englishTerms: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Official English department/faculty names (max 3)',
                  },
                  koreanTerms: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Korean department/faculty names (max 3)',
                  },
                  primaryTerm: {
                    type: 'string',
                    description: 'The most common official department name in English',
                  },
                },
                required: ['englishTerms', 'koreanTerms', 'primaryTerm'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'expand_faculty_terms' } },
      }),
    });

    if (!response.ok) {
      console.error('Faculty expansion AI error:', response.status);
      // Use static fallback
      if (fallback) {
        return { englishTerms: fallback.english, koreanTerms: fallback.korean, primaryTerm: fallback.english[0] };
      }
      return { ...defaultResult, koreanTerms: staticKorean ? [staticKorean] : [] };
    }

    const data = await response.json();
    
    // Extract from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      const result = {
        englishTerms: (parsed.englishTerms?.length ? parsed.englishTerms : [faculty]).slice(0, 3),
        koreanTerms: (parsed.koreanTerms || (staticKorean ? [staticKorean] : [])).slice(0, 3),
        primaryTerm: parsed.primaryTerm || faculty,
      };
      console.log(`Faculty expansion (tool): "${faculty}" → EN: [${result.englishTerms.join(', ')}], KO: [${result.koreanTerms.join(', ')}]`);
      return result;
    }

    // Fallback: try parsing from content (in case tool calling wasn't used)
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*?"englishTerms"[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        englishTerms: (parsed.englishTerms?.length ? parsed.englishTerms : [faculty]).slice(0, 3),
        koreanTerms: (parsed.koreanTerms || (staticKorean ? [staticKorean] : [])).slice(0, 3),
        primaryTerm: parsed.primaryTerm || faculty,
      };
    }

    console.error('No structured response from faculty expansion');
    if (fallback) {
      return { englishTerms: fallback.english, koreanTerms: fallback.korean, primaryTerm: fallback.english[0] };
    }
    return { ...defaultResult, koreanTerms: staticKorean ? [staticKorean] : [] };
  } catch (err) {
    console.error('Faculty expansion error:', err);
    if (fallback) {
      return { englishTerms: fallback.english, koreanTerms: fallback.korean, primaryTerm: fallback.english[0] };
    }
    return { ...defaultResult, koreanTerms: staticKorean ? [staticKorean] : [] };
  }
}

function buildFacultySearchQueries(
  request: FacultySearchRequest,
  expandedTerms?: { englishTerms: string[]; koreanTerms: string[]; primaryTerm: string }
): string[] {
  const semesterTerm = request.semester === 'spring' ? 'spring March' : 'fall September';
  const trackTerm = request.languageTrack === 'english' 
    ? 'English track' 
    : request.languageTrack === 'korean' 
      ? 'Korean track TOPIK' 
      : '';

  const levelTerms: Record<string, string> = {
    undergraduate: 'bachelor undergraduate',
    graduate: 'master graduate',
    phd: 'PhD doctoral',
  };
  const levelTerm = levelTerms[request.programLevel] || '';

  const queries: string[] = [];

  const langTrackKorean = request.languageTrack === 'english' ? '영어트랙 외국인' 
    : request.languageTrack === 'korean' ? '한국어트랙' : '외국인';
  const levelKorean = request.programLevel === 'undergraduate' ? '학부' 
    : request.programLevel === 'graduate' ? '대학원' : '박사';

  if (expandedTerms && expandedTerms.englishTerms.length > 0) {
    // Query 1: Primary term on official university sites
    queries.push(
      `${expandedTerms.primaryTerm} ${request.year} ${semesterTerm} international admission ${levelTerm} site:.ac.kr`.trim()
    );
    // Query 2: Primary term on Study in Korea
    queries.push(
      `${expandedTerms.primaryTerm} ${request.year} international site:studyinkorea.go.kr`.trim()
    );
    // Query 3: Korean terms on official university sites
    if (expandedTerms.koreanTerms.length > 0) {
      const koreanTermsStr = expandedTerms.koreanTerms.slice(0, 2).join(' ');
      queries.push(
        `${koreanTermsStr} ${request.year} ${langTrackKorean} 외국인 입학 ${levelKorean} site:.ac.kr`
      );
    }
    // Query 4: Korean terms on Study in Korea
    if (expandedTerms.koreanTerms.length > 0) {
      const koreanTermsStr = expandedTerms.koreanTerms.slice(0, 2).join(' ');
      queries.push(
        `${koreanTermsStr} ${request.year} site:studyinkorea.go.kr`
      );
    }

    // Query 5: Secondary English terms (e.g. "Dental Medicine", "Oral Health")
    const secondaryTerms = expandedTerms.englishTerms.filter(t => t !== expandedTerms.primaryTerm);
    if (secondaryTerms.length > 0) {
      queries.push(
        `${secondaryTerms.join(' ')} ${request.year} international admission site:.ac.kr`
      );
    }

    // Query 6: All English terms combined for broad coverage
    if (expandedTerms.englishTerms.length > 1) {
      queries.push(
        `${expandedTerms.englishTerms.slice(0, 2).join(' ')} ${request.year} application deadline tuition site:.ac.kr`
      );
    }

    // Query 7: Korean terms with recruitment/deadline keywords
    if (expandedTerms.koreanTerms.length > 0) {
      queries.push(
        `${expandedTerms.koreanTerms[0]} ${request.year} 모집요강 외국인 전형 site:.ac.kr`
      );
    }

    // Query 8: Tuition-focused search (replaces generic department query)
    if (expandedTerms.koreanTerms.length > 0) {
      queries.push(
        `${expandedTerms.koreanTerms[0]} ${request.year} 등록금 수업료 외국인 site:.ac.kr`
      );
    } else {
      queries.push(
        `${expandedTerms.primaryTerm} ${request.year} tuition fee schedule international student site:.ac.kr`
      );
    }
  } else {
    // Fallback: search official sources only
    const koreanName = getKoreanFacultyName(request.faculty);
    queries.push(
      `${request.faculty} ${request.year} ${semesterTerm} international admission ${levelTerm} ${trackTerm} site:.ac.kr`.trim()
    );
    queries.push(
      `${request.faculty} ${request.year} international site:studyinkorea.go.kr`.trim()
    );
    if (koreanName) {
      queries.push(
        `${koreanName} ${request.year} ${langTrackKorean} 입학 ${levelKorean} site:.ac.kr`
      );
    }
  }

  return queries;
}

async function searchFirecrawl(query: string, apiKey: string): Promise<any> {
  console.log('Faculty search query:', query);
  
  const response = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit: 7,
      lang: 'en',
      scrapeOptions: {
        formats: ['markdown'],
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

// Retry wrapper for Firecrawl searches with rate limit handling
async function searchWithRetry(query: string, apiKey: string, maxRetries: number = 2): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await searchFirecrawl(query, apiKey);
      // Small delay between calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
      return result;
    } catch (err: any) {
      const is429 = err?.message?.includes('429');
      const delay = is429 ? 5000 * (attempt + 1) : 2000 * (attempt + 1);
      console.error(`Faculty search attempt ${attempt + 1} failed${is429 ? ' (rate limited)' : ''}:`, err);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return { success: false, data: [] };
    }
  }
  return { success: false, data: [] };
}

// Normalize university name for dedup
function normalizeUniversityName(name: string): string {
  let normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Remove common suffixes
  normalized = normalized
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical content
    .replace(/\buniv\.?\b/g, 'university')
    .replace(/\bnat'?l\b/g, 'national')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Check abbreviation map
  if (universityAbbreviations[normalized]) {
    return universityAbbreviations[normalized];
  }
  
  return normalized;
}

// Check if two university names likely refer to the same institution
function isSameUniversity(a: UniversityResult, b: UniversityResult): boolean {
  const normA = normalizeUniversityName(a.universityName);
  const normB = normalizeUniversityName(b.universityName);
  
  // Exact match after normalization
  if (normA === normB) return true;
  
  // One contains the other
  if (normA.includes(normB) || normB.includes(normA)) return true;
  
  // Korean name cross-reference
  if (a.universityNameKo && b.universityNameKo && a.universityNameKo === b.universityNameKo) return true;
  
  // Korean-to-English lookup
  if (a.universityNameKo) {
    const engA = koreanToEnglishMap[a.universityNameKo.trim()];
    if (engA && engA === normB) return true;
  }
  if (b.universityNameKo) {
    const engB = koreanToEnglishMap[b.universityNameKo.trim()];
    if (engB && engB === normA) return true;
  }
  
  // Simple similarity: count matching words
  const wordsA = normA.split(' ').filter(w => w.length > 2);
  const wordsB = normB.split(' ').filter(w => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  const commonWords = wordsA.filter(w => wordsB.includes(w));
  const similarity = commonWords.length / Math.max(wordsA.length, wordsB.length);
  return similarity >= 0.7;
}

// Validate and sanitize AI results
function validateResults(
  results: UniversityResult[], 
  validSourceUrls: Set<string>,
  requestedYear: number
): UniversityResult[] {
  // Count universities per sourceIndex to detect mass-extraction from single source
  const sourceIndexCounts = new Map<number, number>();
  for (const uni of results) {
    if (uni.sourceIndex !== undefined) {
      sourceIndexCounts.set(uni.sourceIndex, (sourceIndexCounts.get(uni.sourceIndex) || 0) + 1);
    }
  }

  return results.map(uni => {
    const flags: string[] = [];
    let confidencePenalty = 0;

    // 1. Source URL validation
    if (uni.sourceIndex !== undefined && uni.sourceIndex >= 0) {
      // sourceIndex is used, sourceUrl will be overridden in caller
    } else if (uni.sourceUrl && !validSourceUrls.has(uni.sourceUrl)) {
      flags.push('fabricated_url');
      confidencePenalty += 0.2;
      uni.sourceUrl = '';
    }

    // 2. Tuition range check (KRW)
    if (uni.tuitionPerSemester !== null && uni.tuitionPerSemester !== undefined) {
      // Auto-convert likely USD values
      if (uni.tuitionPerSemester > 0 && uni.tuitionPerSemester < 100000) {
        flags.push('tuition_auto_converted_usd');
        uni.notes = (uni.notes || '') + ` [Auto-converted from likely USD: $${uni.tuitionPerSemester.toLocaleString()} → ₩${(uni.tuitionPerSemester * 1400).toLocaleString()} (Rate: 1400 KRW/USD)]`;
        uni.tuitionPerSemester = Math.round(uni.tuitionPerSemester * 1400);
      } else if (uni.tuitionPerSemester < 500000) {
        flags.push('tuition_too_low');
        confidencePenalty += 0.15;
      } else if (uni.tuitionPerSemester > 30000000) {
        flags.push('tuition_too_high');
        confidencePenalty += 0.1;
      }
    }
    if (uni.tuitionPerYear !== null && uni.tuitionPerYear !== undefined) {
      if (uni.tuitionPerYear > 0 && uni.tuitionPerYear < 200000) {
        flags.push('yearly_tuition_auto_converted_usd');
        uni.notes = (uni.notes || '') + ` [Auto-converted yearly from likely USD: $${uni.tuitionPerYear.toLocaleString()} → ₩${(uni.tuitionPerYear * 1400).toLocaleString()} (Rate: 1400 KRW/USD)]`;
        uni.tuitionPerYear = Math.round(uni.tuitionPerYear * 1400);
      } else if (uni.tuitionPerYear < 1000000) {
        flags.push('yearly_tuition_too_low');
        confidencePenalty += 0.15;
      } else if (uni.tuitionPerYear > 60000000) {
        flags.push('yearly_tuition_too_high');
        confidencePenalty += 0.1;
      }
    }

    // 3. TOPIK range check (1-6)
    if (uni.topikRequirement !== null && uni.topikRequirement !== undefined) {
      if (uni.topikRequirement < 1 || uni.topikRequirement > 6) {
        flags.push('invalid_topik');
        uni.topikRequirement = null;
      }
    }

    // 4. IELTS range check (0-9)
    if (uni.ieltsRequirement !== null && uni.ieltsRequirement !== undefined) {
      if (uni.ieltsRequirement < 0 || uni.ieltsRequirement > 9) {
        flags.push('invalid_ielts');
        uni.ieltsRequirement = null;
      }
    }

    // 5. TOEFL range check (0-120)
    if (uni.toeflRequirement !== null && uni.toeflRequirement !== undefined) {
      if (uni.toeflRequirement < 0 || uni.toeflRequirement > 120) {
        flags.push('invalid_toefl');
        uni.toeflRequirement = null;
      }
    }

    // 6. Year mismatch check
    let yearMismatch = false;
    const deadlineStr = uni.applicationDeadline || uni.documentDeadline || '';
    const yearMatch = deadlineStr.match(/20\d{2}/);
    if (yearMatch) {
      const deadlineYear = parseInt(yearMatch[0]);
      if (Math.abs(deadlineYear - requestedYear) > 1) {
        flags.push('year_mismatch');
        confidencePenalty += 0.15;
        yearMismatch = true;
        uni.notes = (uni.notes || '') + ` [Warning: deadline year ${deadlineYear} differs from requested ${requestedYear}]`;
      }
    }

    // 7. Deadline format validation + date normalization (ISSUE 3 + ISSUE 5)
    uni.applicationDeadline = normalizeDateString(uni.applicationDeadline);
    uni.documentDeadline = normalizeDateString(uni.documentDeadline);

    if (uni.applicationDeadline) {
      const dl = uni.applicationDeadline.trim();
      const vaguePatterns = /^(spring|fall|first|second|next|tba|tbd|n\/a)/i;
      if (vaguePatterns.test(dl)) {
        flags.push('vague_deadline');
        confidencePenalty += 0.1;
      }
      const dateMatch = dl.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const deadlineDate = new Date(dateMatch[0]);
        const now = new Date();
        if (deadlineDate < now) {
          flags.push('expired_deadline');
          const monthsExpired = (now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
          if (monthsExpired > 6) {
            confidencePenalty += 0.2;
          } else if (monthsExpired > 3) {
            confidencePenalty += 0.15;
          } else {
            confidencePenalty += 0.1;
          }
        }
      }
    }

    // 8. Multi-source penalty: if 5+ universities from one source, likely a list/blog
    if (uni.sourceIndex !== undefined) {
      const count = sourceIndexCounts.get(uni.sourceIndex) || 0;
      if (count >= 5) {
        flags.push('mass_source_extraction');
        confidencePenalty += 0.2;
      }
    }

    // 9. Faculty relevance check (ISSUE 1): detect results where AI indicates wrong faculty
    const negativePatterns = [
      /not\s+a\s+\w+\s+program/i,
      /does\s+not\s+offer/i,
      /not\s+explicitly\s+listed/i,
      /unrelated\s+department/i,
      /not\s+.*?the\s+requested/i,
      /no\s+specific\s+details\s+for/i,
      /only\s+(?:vaguely\s+)?mentioned/i,
      /not\s+a\s+.*?program/i,
    ];

    if (uni.notes) {
      const hasNegativeMatch = negativePatterns.some(p => p.test(uni.notes || ''));
      if (hasNegativeMatch) {
        flags.push('faculty_mismatch');
        confidencePenalty += 0.3;
        uni.notes = (uni.notes || '') + ' [Warning: May not match requested faculty]';
      }
    }

    // Apply penalty (ISSUE 6: round to 2 decimal places)
    uni.confidence = Math.round(Math.max(0.1, uni.confidence - confidencePenalty) * 100) / 100;
    uni.validationFlags = flags;
    uni.yearMismatch = yearMismatch;
    uni.dataSource = flags.length === 0 ? 'verified' : 'unverified';

    return uni;
  });
}

// Date normalization helper (ISSUE 3)
function normalizeDateString(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // Try parsing Korean date format: "2026. 3. 5.(목) 17:00 KST"
  const koreanMatch = trimmed.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(?:\([^)]*\))?\s*(\d{1,2}:\d{2})?\s*(KST)?/);
  if (koreanMatch) {
    const [, y, m, d, time] = koreanMatch;
    const timeStr = time ? ` ${time} KST` : '';
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${timeStr}`;
  }

  // Already in good format (YYYY-MM-DD...), return as-is
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed;

  // Unparseable, return as-is
  return trimmed;
}

// Cross-reference AND validate with DB (ISSUE 7: merged into single query)
async function crossReferenceAndValidateWithDB(
  results: UniversityResult[]
): Promise<UniversityResult[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) return results;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: dbUniversities } = await supabase
      .from('universities')
      .select('name_en, name_ko, tuition_min, tuition_max');

    if (!dbUniversities?.length) return results;

    const dbMap = new Map<string, { tuition_min: number; tuition_max: number }>();
    const knownNames: string[] = [];
    for (const u of dbUniversities) {
      if (u.name_en) {
        const key = u.name_en.toLowerCase().trim();
        if (u.tuition_min) dbMap.set(key, { tuition_min: u.tuition_min, tuition_max: u.tuition_max });
        knownNames.push(key);
      }
      if (u.name_ko) {
        if (u.tuition_min) dbMap.set(u.name_ko.trim(), { tuition_min: u.tuition_min, tuition_max: u.tuition_max });
        knownNames.push(u.name_ko.toLowerCase());
      }
    }

    return results.map(uni => {
      const key = uni.universityName.toLowerCase().trim();

      // Tuition cross-reference
      const dbData = dbMap.get(key) || (uni.universityNameKo ? dbMap.get(uni.universityNameKo.trim()) : undefined);
      if (dbData && uni.tuitionPerSemester) {
        const dbMinKRW = dbData.tuition_min * 1000; // DB stores in thousands KRW
        const dbMaxKRW = (dbData.tuition_max || dbData.tuition_min * 2) * 1000;
        if (uni.tuitionPerSemester < dbMinKRW / 2 || uni.tuitionPerSemester > dbMaxKRW * 2) {
          uni.validationFlags = [...(uni.validationFlags || []), 'tuition_db_mismatch'];
          uni.confidence = Math.round(Math.max(0.1, uni.confidence - 0.15) * 100) / 100;
          uni.dataSource = 'unverified';
          uni.notes = (uni.notes || '') + ` [DB tuition range: ₩${dbMinKRW?.toLocaleString()}-₩${dbMaxKRW?.toLocaleString()}]`;
        }
      }

      // Fallback: populate tuition from DB when AI returned null
      if (!uni.tuitionPerSemester && !uni.tuitionPerYear && dbData) {
        const dbMinKRW = dbData.tuition_min * 1000; // DB stores in thousands KRW
        uni.tuitionPerSemester = dbMinKRW;
        if (dbData.tuition_max) {
          const dbMaxKRW = dbData.tuition_max * 1000;
          uni.notes = (uni.notes || '') + ` [Tuition estimated from database: ₩${dbMinKRW.toLocaleString()} - ₩${dbMaxKRW.toLocaleString()} per semester. Verify with university]`;
        }
        uni.validationFlags = [...(uni.validationFlags || []), 'tuition_from_db'];
        if (uni.dataSource !== 'verified') uni.dataSource = 'unverified';
      }

      // Name cross-validation
      const isKnown = knownNames.some(k =>
        key.includes(k) || k.includes(key)
      );
      if (!isKnown) {
        uni.validationFlags = [...(uni.validationFlags || []), 'unknown_university'];
        uni.confidence = Math.round(Math.max(0.1, uni.confidence - 0.15) * 100) / 100;
        uni.notes = (uni.notes || '') + ' [University not found in database - verify manually]';
      }

      return uni;
    });
  } catch (err) {
    console.error('DB cross-reference error:', err);
    return results;
  }
}

// Advanced deduplication
function deduplicateResults(results: UniversityResult[]): UniversityResult[] {
  const groups: UniversityResult[][] = [];
  
  for (const uni of results) {
    let added = false;
    for (const group of groups) {
      if (isSameUniversity(uni, group[0])) {
        group.push(uni);
        added = true;
        break;
      }
    }
    if (!added) {
      groups.push([uni]);
    }
  }
  
  // Pick the best from each group with tuition consistency check (majority voting)
  return groups.map(group => {
    group.sort((a, b) => b.confidence - a.confidence);
    const best = { ...group[0] };
    
    // Tuition consistency check across sources (majority voting)
    if (group.length > 1) {
      const tuitionValues = group
        .map(g => g.tuitionPerSemester)
        .filter((v): v is number => v !== null && v !== undefined && v > 0);
      
      if (tuitionValues.length >= 2) {
        const avg = tuitionValues.reduce((a, b) => a + b, 0) / tuitionValues.length;
        const maxDiff = Math.max(...tuitionValues.map(v => Math.abs(v - avg) / avg));
        
        if (maxDiff <= 0.2) {
          // Values within 20% range -- average and boost confidence
          best.tuitionPerSemester = Math.round(avg);
          best.confidence = Math.min(1.0, best.confidence + 0.1);
          best.notes = (best.notes || '') + ` [Tuition confirmed by ${tuitionValues.length} sources]`;
        } else if (maxDiff > 0.5) {
          // >50% discrepancy -- keep highest confidence source value, flag it
          best.validationFlags = [...(best.validationFlags || []), 'tuition_inconsistent'];
          best.notes = (best.notes || '') + ` [Tuition varies across sources: ${tuitionValues.map(v => `₩${v.toLocaleString()}`).join(' vs ')}]`;
        }
      }
    }
    
    // Merge data from lower-confidence duplicates
    for (let i = 1; i < group.length; i++) {
      const other = group[i];
      if (!best.tuitionPerSemester && other.tuitionPerSemester) best.tuitionPerSemester = other.tuitionPerSemester;
      if (!best.tuitionPerYear && other.tuitionPerYear) best.tuitionPerYear = other.tuitionPerYear;
      if (!best.applicationDeadline && other.applicationDeadline) best.applicationDeadline = other.applicationDeadline;
      if (!best.topikRequirement && other.topikRequirement) best.topikRequirement = other.topikRequirement;
      if (!best.ieltsRequirement && other.ieltsRequirement) best.ieltsRequirement = other.ieltsRequirement;
      if (!best.toeflRequirement && other.toeflRequirement) best.toeflRequirement = other.toeflRequirement;
      if (!best.universityNameKo && other.universityNameKo) best.universityNameKo = other.universityNameKo;
      // Merge unique language tracks
      const tracks = new Set([...(best.languageTracks || []), ...(other.languageTracks || [])]);
      best.languageTracks = Array.from(tracks);
    }
    
    return best;
  });
}

// Build quality summary
function buildQualitySummary(results: UniversityResult[], sourcesUsed: number, officialSourceCount: number): QualitySummary {
  const verifiedCount = results.filter(r => r.confidence >= 0.8).length;
  const reviewCount = results.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length;
  const unverifiedCount = results.filter(r => r.confidence < 0.6).length;
  const avgConf = results.length > 0 
    ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length 
    : 0;

  return {
    totalFound: results.length,
    verifiedCount,
    reviewCount,
    unverifiedCount,
    averageConfidence: Math.round(avgConf * 100) / 100,
    sourcesUsed,
    officialSourceCount,
  };
}

async function analyzeWithGemini(
  contents: { url: string; title: string; markdown: string; relevanceScore: number }[],
  request: FacultySearchRequest,
  apiKey: string,
  expandedTerms?: { englishTerms: string[]; koreanTerms: string[]; primaryTerm: string }
): Promise<UniversityResult[]> {
  const sourceList = contents.map((c, i) => `Source ${i + 1} (relevance: ${c.relevanceScore.toFixed(1)}): ${c.url}`).join('\n');
  
  // ISSUE 6 fix: Add content budget per batch (60,000 chars max)
  const MAX_TOTAL_CHARS = 60000;
  let totalChars = 0;
  const budgetedContents = contents.filter(c => {
    const charCount = Math.min(c.markdown?.length || 0, 6000);
    if (totalChars + charCount > MAX_TOTAL_CHARS) return false;
    totalChars += charCount;
    return true;
  });

  const combinedContent = budgetedContents.map((c, i) => 
    `--- Source ${i + 1}: ${c.title} (${c.url}) [relevance: ${c.relevanceScore}] ---\n${c.markdown?.substring(0, 6000) || 'No content'}`
  ).join('\n\n');

  const languageTrackInstruction = request.languageTrack === 'english'
    ? 'IMPORTANT: Only include universities that offer this program in ENGLISH track.'
    : request.languageTrack === 'korean'
      ? 'IMPORTANT: Only include universities that offer this program in KOREAN track.'
      : 'Include universities with either English or Korean track programs.';

  // ISSUE 2+5 fix: Use expanded primaryTerm instead of raw user input, with cleanup fallback
  function titleCase(str: string): string {
    return str.trim().replace(/\b\w/g, c => c.toUpperCase());
  }
  const facultyDisplayName = expandedTerms?.primaryTerm || titleCase(request.faculty);
  const allTermsDisplay = expandedTerms 
    ? `"${expandedTerms.primaryTerm}" (also known as: ${expandedTerms.englishTerms.join(', ')}; Korean: ${expandedTerms.koreanTerms.join(', ')})`
    : `"${request.faculty}"`;

  const prompt = `You are an expert on Korean university admissions. Analyze the following web content about ${allTermsDisplay} programs at Korean universities for ${request.semester} ${request.year} intake (${request.programLevel} level).

${languageTrackInstruction}

CRITICAL TRUTHFULNESS RULES:
1. NEVER fabricate or estimate data. If information is NOT explicitly stated in the source text, return null for that field.
2. Tuition MUST be in KRW (Korean Won). Typical range: 1,000,000 - 15,000,000 per semester. If you see USD or other currency, convert to KRW using rate 1 USD = 1,400 KRW and add a note about the conversion.
3. Do NOT invent deadlines, test scores, or tuition amounts. Only extract what is clearly written.
4. If a university is only vaguely mentioned (e.g., in a blog or ranking list) without specific admission data, do NOT include it.
5. Set confidence to 0.3 or below if any data point is estimated rather than directly quoted from the source.
6. Verify the year in the source. If the source data is for a different year than ${request.year}, add a note like "Data from [year]" and lower confidence.
7. For sourceIndex, use the source number (1-based) where you found the primary information. Do NOT fabricate URLs.
8. If a source is a blog, ranking, or comparison article mentioning multiple universities WITHOUT specific admission details (tuition amount, deadline date) for each, set confidence to 0.2 or below for those entries.
9. If the deadline in the source has already passed (e.g., a 2024 deadline when searching for 2026), note it and lower confidence.
10. Only return universities that SPECIFICALLY offer the requested faculty/department: ${allTermsDisplay}. Do NOT include universities where only unrelated departments are mentioned.
11. If tuition data exists in the source but you cannot determine the exact amount, set tuitionPerSemester to null and add a note: "Tuition data found but unclear".
12. If tuition is explicitly stated as free, waived, or covered by scholarship, set tuitionPerSemester to 0 and add a note explaining why (e.g., "Full scholarship covers tuition").
13. Only include results for the ${request.programLevel} level. Do NOT mix undergraduate data with graduate/PhD data or vice versa.

Available sources:
${sourceList}

Extract information for EACH DISTINCT UNIVERSITY with actual admission data. For each university, extract:
- University name (English and Korean if available)
- sourceIndex (which source number 1-${contents.length} the data came from)
- Tuition per semester and/or per year (in KRW, null if not found)
- Application deadline (null if not found)
- Document submission deadline (null if not found)
- Available language tracks (English/Korean)
- TOPIK requirement level (1-6, null if not found)
- IELTS requirement score (0-9, null if not found)
- TOEFL requirement score (0-120, null if not found)
- Any unique requirements (portfolio, interview, practical test, etc.)
- Important notes

Content to analyze:
${combinedContent}

Respond with ONLY a JSON object in this exact format:
{
  "universities": [
    {
      "universityName": "string",
      "universityNameKo": "string or null",
      "sourceIndex": number,
      "tuitionPerSemester": number_or_null,
      "tuitionPerYear": number_or_null,
      "applicationDeadline": "string or null",
      "documentDeadline": "string or null",
      "languageTracks": ["english", "korean"],
      "topikRequirement": number_or_null,
      "ieltsRequirement": number_or_null,
      "toeflRequirement": number_or_null,
      "uniqueRequirements": ["string"],
      "interviewRequired": boolean_or_null,
      "portfolioRequired": boolean_or_null,
      "notes": "string or null",
      "confidence": 0.0_to_1.0
    }
  ]
}`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      temperature: 0.1,
      messages: [
        { role: 'system', content: `You are a Korean university admissions data extractor. Always respond with valid JSON only. NEVER fabricate data — return null for unknown fields. If a source is a blog or ranking list without specific per-university admission data, set confidence very low (0.2 or below). Only extract data for ${allTermsDisplay} faculty at ${request.programLevel} level.` },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI gateway error:', response.status, errorText);
    
    if (response.status === 429) throw new Error('Rate limit exceeded. Please try again in a moment.');
    if (response.status === 402) throw new Error('AI credits exhausted. Please add credits to continue.');
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  let extractedJson: string | undefined;
  
  const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    extractedJson = codeBlockMatch[1];
  } else {
    const jsonMatch = content.match(/\{[\s\S]*?"universities"\s*:\s*\[[\s\S]*?\]\s*\}/);
    extractedJson = jsonMatch?.[0];
  }
  
  if (!extractedJson) {
    console.error('No JSON found in AI response:', content.substring(0, 500));
    return [];
  }

  try {
    const parsed = JSON.parse(extractedJson);
    const universities: UniversityResult[] = parsed.universities || [];
    
    return universities.map(uni => {
      if (uni.sourceIndex && uni.sourceIndex >= 1 && uni.sourceIndex <= contents.length) {
        uni.sourceUrl = contents[uni.sourceIndex - 1].url;
      } else {
        // ISSUE 4 fix: Don't assign wrong source URL when sourceIndex is out of range
        uni.sourceUrl = '';
        uni.validationFlags = [...(uni.validationFlags || []), 'unverified_source'];
      }
      return uni;
    });
  } catch (e) {
    console.error('Failed to parse AI JSON response:', e);
    return [];
  }
}

// Module-level content hash for deduplication (used by both quick and comprehensive search)
function hashContent(markdown: string): string {
  const snippet = (markdown || '').substring(0, 1000).trim().toLowerCase().replace(/\s+/g, ' ');
  let hash = 0;
  for (let i = 0; i < snippet.length; i++) {
    const char = snippet.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

async function doFacultySearch(request: FacultySearchRequest, firecrawlApiKey: string, geminiApiKey: string) {
  // Step 0: Expand faculty terms using AI
  const expandedTerms = await expandFacultyTerms(request.faculty, geminiApiKey);
  const expandedEnglish = expandedTerms.englishTerms.join(', ');
  const expandedKorean = expandedTerms.koreanTerms.join(', ');
  console.log(`Using expanded terms: EN=[${expandedEnglish}] KO=[${expandedKorean}]`);

  // Step 1: Search with Firecrawl using expanded terms (2 batches of 4)
  const queries = buildFacultySearchQueries(request, expandedTerms);
  const allQueries = queries.slice(0, 8);
  
  // Batch 1: first 4 queries
  // Use retry wrapper (ISSUE 6 fix)
  const batch1 = allQueries.slice(0, 4).map(q => searchWithRetry(q, firecrawlApiKey));
  // Batch 2: remaining queries (up to 4 more)
  const batch2 = allQueries.slice(4).map(q => searchWithRetry(q, firecrawlApiKey));

  const [batch1Results, batch2Results] = await Promise.all([
    Promise.all(batch1),
    Promise.all(batch2),
  ]);
  const searchResults = [...batch1Results, ...batch2Results];
  console.log(`Executed ${allQueries.length} search queries in 2 batches`);

  // Collect unique results with markdown content, scored by relevance
  const seenUrls = new Set<string>();
  const seenContentHashes = new Set<string>();
  const contentItems: { url: string; title: string; markdown: string; relevanceScore: number }[] = [];
  let officialSourceCount = 0;

  // hashContent is defined at module level (see above doFacultySearch)

  for (const result of searchResults) {
    if (result.success !== false && result.data) {
      for (const item of result.data) {
        if (item.url && !seenUrls.has(item.url) && item.markdown) {
          const relevanceScore = scoreSourceRelevance(item.url);
          
          if (relevanceScore < 0.5) {
            console.log(`Filtered out low-quality source: ${item.url} (score: ${relevanceScore})`);
            continue;
          }

          // Content-hash deduplication
          const contentHash = hashContent(item.markdown);
          if (seenContentHashes.has(contentHash)) {
            console.log(`Content dedup: skipping duplicate content from ${item.url}`);
            continue;
          }
          seenContentHashes.add(contentHash);
          
          if (relevanceScore >= 0.7) officialSourceCount++;
          
          seenUrls.add(item.url);
          contentItems.push({
            url: item.url,
            title: item.title || item.url,
            markdown: item.markdown,
            relevanceScore,
          });
        }
      }
    }
  }

  contentItems.sort((a, b) => b.relevanceScore - a.relevanceScore);
  console.log(`Found ${contentItems.length} quality results (${officialSourceCount} official sources)`);

  if (contentItems.length === 0) {
    return {
      success: true,
      faculty: request.faculty,
      universities: [],
      totalFound: 0,
      message: 'No results found. Try a different faculty name or broader search terms.',
      qualitySummary: buildQualitySummary([], 0, 0),
    };
  }

  // Step 2: Analyze with Gemini - process in batches of 8
  const batchSize = 8;
  const allUniversities: UniversityResult[] = [];

  for (let i = 0; i < contentItems.length; i += batchSize) {
    const batch = contentItems.slice(i, i + batchSize);
    const universities = await analyzeWithGemini(batch, request, geminiApiKey, expandedTerms);
    allUniversities.push(...universities);
  }

  // Step 3: Validate results
  const validSourceUrls = new Set(contentItems.map(c => c.url));
  const validatedResults = validateResults(allUniversities, validSourceUrls, request.year);

  // Step 4: Cross-reference and validate with DB (ISSUE 7: single merged query)
  const crossRefResults = await crossReferenceAndValidateWithDB(validatedResults);

  // Step 5: Advanced deduplication
  const dedupedResults = deduplicateResults(crossRefResults);

  // ISSUE 5 fix: Raise minimum confidence from 0.1 to 0.3 to avoid misinformation
  const finalResults = dedupedResults
    .filter(u => u.confidence >= 0.3)
    .sort((a, b) => b.confidence - a.confidence);

  // ISSUE 4: Enforce language track filter in post-processing
  let trackFilteredResults = finalResults;
  if (request.languageTrack && request.languageTrack !== 'both') {
    const beforeCount = trackFilteredResults.length;
    trackFilteredResults = trackFilteredResults.filter(u =>
      u.languageTracks?.some(t => t.toLowerCase() === request.languageTrack)
    );
    const filteredCount = beforeCount - trackFilteredResults.length;
    if (filteredCount > 0) {
      console.log(`Language track filter: removed ${filteredCount} results not matching '${request.languageTrack}' track`);
    }
    // If ALL results were filtered, fall back to showing all with a note
    if (trackFilteredResults.length === 0 && finalResults.length > 0) {
      trackFilteredResults = finalResults.map(u => ({
        ...u,
        notes: (u.notes || '') + ` [Note: ${request.languageTrack} track not found - showing all available tracks]`,
      }));
    }
  }

  // Step 6: Build quality summary
  const qualitySummary = buildQualitySummary(trackFilteredResults, contentItems.length, officialSourceCount);

  console.log(`Final: ${trackFilteredResults.length} universities for "${expandedTerms?.primaryTerm || request.faculty}" (avg confidence: ${qualitySummary.averageConfidence})`);

  return {
    success: true,
    faculty: expandedTerms?.primaryTerm || request.faculty,
    programLevel: request.programLevel,
    semester: request.semester,
    year: request.year,
    languageTrack: request.languageTrack,
    universities: trackFilteredResults,
    totalFound: trackFilteredResults.length,
    qualitySummary,
    expandedTerms: {
      englishTerms: expandedTerms.englishTerms,
      koreanTerms: expandedTerms.koreanTerms,
      primaryTerm: expandedTerms.primaryTerm,
      originalQuery: request.faculty,
    },
  };
}

// Extract domain from website URL
function extractDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname;
  } catch {
    return null;
  }
}

// Generic portals that should never be stored as official websites
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

// Discover official .ac.kr website for a university using Firecrawl search
async function discoverOfficialWebsite(
  nameEn: string,
  nameKo: string | null,
  firecrawlApiKey: string
): Promise<string | null> {
  const domainCounts = new Map<string, number>();

  const queries = [
    `"${nameEn}" official site .ac.kr`,
  ];
  if (nameKo) {
    queries.push(`"${nameKo}" 공식 홈페이지 .ac.kr`);
  }

  for (const query of queries) {
    try {
      const searchResult = await searchWithRetry(query, firecrawlApiKey);
      if (searchResult.success !== false && searchResult.data?.length) {
        for (const item of searchResult.data) {
          if (!item.url) continue;
          try {
            const hostname = new URL(item.url).hostname;
            if (isValidAcKrDomain(hostname)) {
              // Normalize: strip www.
              const normalized = hostname.replace(/^www\./, '');
              domainCounts.set(normalized, (domainCounts.get(normalized) || 0) + 1);
            }
          } catch { /* skip invalid URLs */ }
        }
      }
    } catch (err) {
      console.error(`Website discovery search error for ${nameEn}:`, err);
    }
  }

  if (domainCounts.size === 0) return null;

  // Pick the most frequently appearing domain
  let bestDomain = '';
  let bestCount = 0;
  for (const [domain, count] of domainCounts) {
    if (count > bestCount) {
      bestDomain = domain;
      bestCount = count;
    }
  }

  // Confidence check: must appear in 2+ results OR be the only .ac.kr domain found
  if (bestCount >= 2 || domainCounts.size === 1) {
    console.log(`Discovered official website for ${nameEn}: ${bestDomain} (appeared ${bestCount} times across ${domainCounts.size} unique .ac.kr domains)`);
    return bestDomain;
  }

  console.log(`Low confidence for ${nameEn}: best domain ${bestDomain} appeared only ${bestCount} time(s) among ${domainCounts.size} candidates, skipping save`);
  return null;
}

// Save discovered website to database
async function saveDiscoveredWebsite(
  supabase: any,
  universityId: string,
  domain: string,
  nameEn: string
): Promise<void> {
  const websiteUrl = `https://${domain}`;
  try {
    const { error } = await supabase
      .from('universities')
      .update({ website: websiteUrl })
      .eq('id', universityId);
    if (error) {
      console.error(`Failed to save website for ${nameEn}:`, error);
    } else {
      console.log(`✅ Saved official website for ${nameEn}: ${websiteUrl}`);
    }
  } catch (err) {
    console.error(`Error saving website for ${nameEn}:`, err);
  }
}

// Self-chain with retry logic (ISSUE 3 fix)
async function selfChainWithRetry(
  supabaseUrl: string,
  supabaseKey: string,
  jobId: string,
  request: FacultySearchRequest,
  nextBatchIndex: number,
  maxRetries: number = 3
) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/find-faculty-forms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          request,
          batchIndex: nextBatchIndex,
          mode: 'comprehensive',
        }),
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
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  console.error(`Self-chain to batch ${nextBatchIndex} failed after ${maxRetries} retries`);
  await supabase.from('search_jobs').update({
    status: 'failed',
    error: 'Chain continuation failed after retries. Partial results may be available in the result field.',
  }).eq('id', jobId);
}

// Comprehensive faculty search: iterate over ALL universities in DB
async function doComprehensiveFacultySearch(
  request: FacultySearchRequest,
  firecrawlApiKey: string,
  geminiApiKey: string,
  jobId: string,
  batchIndex: number = 0
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const BATCH_SIZE = 10;

  // Step 0: Expand faculty terms and store university IDs (only on first batch)
  let expandedTerms: { englishTerms: string[]; koreanTerms: string[]; primaryTerm: string };
  let universityIds: string[];
  
  if (batchIndex === 0) {
    expandedTerms = await expandFacultyTerms(request.faculty, geminiApiKey);
    
    // ISSUE 4 FIX: Fetch all universities ONCE on batch 0 and store IDs in progress
    const { data: allUniversities } = await supabase
      .from('universities')
      .select('id, name_en, name_ko, website, tuition_min, tuition_max')
      .order('name_en')
      .limit(2000);

    if (!allUniversities?.length) {
      await supabase.from('search_jobs').update({
        status: 'completed',
        result: { success: true, faculty: expandedTerms.primaryTerm, universities: [], totalFound: 0, message: 'No universities found in database. Import universities first.' },
      }).eq('id', jobId);
      return;
    }

    // Priority 4 fix: Only process universities that HAVE a website — avoids 2000+ wasted Firecrawl calls
    const universitiesWithWebsite = allUniversities.filter(u => u.website && u.website.trim() !== '');
    const skippedCount = allUniversities.length - universitiesWithWebsite.length;
    if (skippedCount > 0) {
      console.log(`Comprehensive search: skipping ${skippedCount} universities with no website (will search ${universitiesWithWebsite.length})`);
    }

    universityIds = universitiesWithWebsite.map(u => u.id);
    // ISSUE 5 FIX: NO results array in progress - only counters and IDs
    await supabase.from('search_jobs').update({
      progress: { processed: 0, total: universityIds.length, currentBatch: 0, expandedTerms, universityIds, skippedNoWebsite: skippedCount }
    }).eq('id', jobId);
  } else {
    // Retrieve stored data from progress
    const { data: jobData } = await supabase.from('search_jobs').select('progress, status').eq('id', jobId).single();
    
    // Check if job was cancelled
    if (jobData?.status === 'failed') {
      console.log(`Job ${jobId} was cancelled or failed, stopping batch ${batchIndex}`);
      return;
    }
    
    expandedTerms = jobData?.progress?.expandedTerms || { englishTerms: [request.faculty], koreanTerms: [], primaryTerm: request.faculty };
    universityIds = jobData?.progress?.universityIds || [];
  }

  const totalUniversities = universityIds.length;
  if (totalUniversities === 0) return;

  // Fetch only this batch's universities by ID
  const batchIds = universityIds.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
  
  if (batchIds.length === 0) {
    // All batches done - finalize with language track filter
    const { data: jobData } = await supabase.from('search_jobs').select('result').eq('id', jobId).single();
    const currentResults: UniversityResult[] = jobData?.result?.universities || [];
    
    // ISSUE 6 FIX: Run dedup only once at finalization
    const dedupedResults = deduplicateResults(currentResults).filter(u => u.confidence >= 0.3).sort((a, b) => b.confidence - a.confidence);
    
    // ISSUE 7 FIX: Apply language track filter (same as doFacultySearch)
    let trackFilteredResults = dedupedResults;
    if (request.languageTrack && request.languageTrack !== 'both') {
      const beforeCount = trackFilteredResults.length;
      trackFilteredResults = trackFilteredResults.filter(u =>
        u.languageTracks?.some(t => t.toLowerCase() === request.languageTrack)
      );
      if (trackFilteredResults.length === 0 && dedupedResults.length > 0) {
        trackFilteredResults = dedupedResults.map(u => ({
          ...u,
          notes: (u.notes || '') + ` [Note: ${request.languageTrack} track not found - showing all available tracks]`,
        }));
      } else {
        const filteredCount = beforeCount - trackFilteredResults.length;
        if (filteredCount > 0) console.log(`Language track filter: removed ${filteredCount} results`);
      }
    }
    
    const qualitySummary = buildQualitySummary(trackFilteredResults, totalUniversities, trackFilteredResults.filter(r => r.dataSource === 'verified').length);
    
    await supabase.from('search_jobs').update({
      status: 'completed',
      result: {
        success: true,
        faculty: expandedTerms.primaryTerm,
        programLevel: request.programLevel,
        semester: request.semester,
        year: request.year,
        languageTrack: request.languageTrack,
        universities: trackFilteredResults,
        totalFound: trackFilteredResults.length,
        qualitySummary,
        expandedTerms: { ...expandedTerms, originalQuery: request.faculty },
      },
      progress: { processed: totalUniversities, total: totalUniversities, currentBatch: batchIndex, expandedTerms },
    }).eq('id', jobId);
    console.log(`Comprehensive search complete: ${trackFilteredResults.length} results from ${totalUniversities} universities`);
    return;
  }

  // Fetch batch universities from DB by IDs
  // Issue 23 fix: Add deterministic ordering for debugging
  const { data: batch } = await supabase
    .from('universities')
    .select('id, name_en, name_ko, website, tuition_min, tuition_max')
    .in('id', batchIds)
    .order('name_en');

  if (!batch?.length) {
    console.log(`Batch ${batchIndex}: no universities found for IDs, skipping`);
  }

  console.log(`Processing batch ${batchIndex}: ${batch?.length || 0} universities (${batchIndex * BATCH_SIZE + 1}-${batchIndex * BATCH_SIZE + (batch?.length || 0)} of ${totalUniversities})`);

  const batchResults: UniversityResult[] = [];

  for (let uniIdx = 0; uniIdx < (batch || []).length; uniIdx++) {
    const uni = batch![uniIdx];
    let domain = extractDomain(uni.website);

    try {
      // Build university-specific queries
      const queries: string[] = [];
      if (domain) {
        queries.push(`${expandedTerms.primaryTerm} ${request.year} admission international site:${domain}`);
        if (expandedTerms.koreanTerms.length > 0) {
          queries.push(`${expandedTerms.koreanTerms[0]} ${request.year} 모집요강 외국인 site:${domain}`);
        }
      }

      let hasResults = false;
      // Issue 17 fix: Content dedup within per-university search
      const seenUrlsPerUni = new Set<string>();
      const seenHashesPerUni = new Set<string>();
      const contentItems: { url: string; title: string; markdown: string; relevanceScore: number }[] = [];

      for (const query of queries) {
        try {
          const searchResult = await searchWithRetry(query, firecrawlApiKey);
          if (searchResult.success !== false && searchResult.data?.length) {
            for (const item of searchResult.data) {
              if (item.markdown && item.url && !seenUrlsPerUni.has(item.url)) {
                seenUrlsPerUni.add(item.url);
                const relevanceScore = scoreSourceRelevance(item.url);
                if (relevanceScore >= 0.5) {
                  const ch = hashContent(item.markdown);
                  if (!seenHashesPerUni.has(ch)) {
                    seenHashesPerUni.add(ch);
                    contentItems.push({ url: item.url, title: item.title || item.url, markdown: item.markdown, relevanceScore });
                    hasResults = true;
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error(`Search error for ${uni.name_en}:`, err);
        }
      }

      // If no site-specific results, try generic queries with site:.ac.kr scoping
      if (!hasResults) {
        const genericQueries = [
          `"${uni.name_en}" ${expandedTerms.primaryTerm} ${request.year} admission site:.ac.kr`,
        ];
        if (uni.name_ko) {
          // Issue 21 fix: Guard against undefined koreanTerms[0]
          const koreanTerm = (expandedTerms.koreanTerms && expandedTerms.koreanTerms[0]) || expandedTerms.primaryTerm;
          genericQueries.push(`"${uni.name_ko}" ${koreanTerm} ${request.year} 모집요강 site:.ac.kr`);
        }
        for (const gq of genericQueries) {
          try {
            const genericResult = await searchWithRetry(gq, firecrawlApiKey);
            if (genericResult.success !== false && genericResult.data?.length) {
              for (const item of genericResult.data) {
                if (item.markdown && item.url) {
                  const relevanceScore = scoreSourceRelevance(item.url);
                  if (relevanceScore >= 0.5) {
                    contentItems.push({ url: item.url, title: item.title || item.url, markdown: item.markdown, relevanceScore });
                    hasResults = true;
                  }
                }
              }
            }
          } catch (err) {
            console.error(`Generic search error for ${uni.name_en}:`, err);
          }
          if (hasResults) break;
        }
      }

      // Issue 4 fix: Only discover website if no domain AND no results from generic search
      // This avoids 698 extra Firecrawl calls upfront
      if (!domain && !hasResults) {
        const discovered = await discoverOfficialWebsite(uni.name_en, uni.name_ko, firecrawlApiKey);
        if (discovered) {
          domain = discovered;
          await saveDiscoveredWebsite(supabase, uni.id, discovered, uni.name_en);
          // Retry search with discovered domain (English + Korean)
          // Issue 18 fix: Add Korean retry query alongside English
          const retryQueries = [
            `${expandedTerms.primaryTerm} ${request.year} admission international site:${discovered}`,
          ];
          const koTerm = (expandedTerms.koreanTerms && expandedTerms.koreanTerms[0]) || null;
          if (koTerm) {
            retryQueries.push(`${koTerm} ${request.year} 모집요강 외국인 site:${discovered}`);
          }
          try {
            const retryResult = await searchWithRetry(retryQueries[0], firecrawlApiKey);
            if (retryResult.success !== false && retryResult.data?.length) {
              for (const item of retryResult.data) {
                if (item.markdown && item.url) {
                  const relevanceScore = scoreSourceRelevance(item.url);
                  if (relevanceScore >= 0.5) {
                    contentItems.push({ url: item.url, title: item.title || item.url, markdown: item.markdown, relevanceScore });
                  }
                }
              }
            }
            // Issue 18 fix: Also try Korean query on discovered domain
            if (retryQueries.length > 1) {
              const koRetryResult = await searchWithRetry(retryQueries[1], firecrawlApiKey);
              if (koRetryResult.success !== false && koRetryResult.data?.length) {
                for (const item of koRetryResult.data) {
                  if (item.markdown && item.url && !seenUrlsPerUni.has(item.url)) {
                    seenUrlsPerUni.add(item.url);
                    const relevanceScore = scoreSourceRelevance(item.url);
                    if (relevanceScore >= 0.5) {
                      const ch = hashContent(item.markdown);
                      if (!seenHashesPerUni.has(ch)) {
                        seenHashesPerUni.add(ch);
                        contentItems.push({ url: item.url, title: item.title || item.url, markdown: item.markdown, relevanceScore });
                      }
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.error(`Retry search error for ${uni.name_en}:`, err);
          }
        }
      }

      if (contentItems.length > 0) {
        const universities = await analyzeWithGemini(contentItems.slice(0, 4), request, geminiApiKey, expandedTerms);
        if (universities.length > 0) {
          const validSourceUrls = new Set(contentItems.map(c => c.url));
          const validated = validateResults(universities, validSourceUrls, request.year);
          
          for (const u of validated) {
            if (!u.tuitionPerSemester && !u.tuitionPerYear && uni.tuition_min) {
              u.tuitionPerSemester = uni.tuition_min * 1000;
              if (uni.tuition_max) {
                u.notes = (u.notes || '') + ` [Tuition estimated from database: ₩${(uni.tuition_min * 1000).toLocaleString()} - ₩${(uni.tuition_max * 1000).toLocaleString()} per semester. Verify with university]`;
              }
              u.validationFlags = [...(u.validationFlags || []), 'tuition_from_db'];
              if (u.dataSource !== 'verified') u.dataSource = 'unverified';
            }
          }
          
          batchResults.push(...validated);
          console.log(`  ${uni.name_en}: found ${validated.length} results`);
        } else {
          console.log(`  ${uni.name_en}: no relevant results from AI`);
        }
      } else {
        console.log(`  ${uni.name_en}: no search results`);
      }

      // Issue 10 fix: Update progress after each individual university
      // Issue 14 fix: Don't include universityIds in per-university updates (saves ~14KB per write)
      const perUniProcessed = batchIndex * BATCH_SIZE + uniIdx + 1;
      
      // Issue 16 fix: Check for mid-batch cancellation before updating
      const { data: midCheckJob } = await supabase.from('search_jobs').select('status').eq('id', jobId).single();
      if (midCheckJob?.status === 'failed') {
        console.log(`Job ${jobId} cancelled mid-batch at university ${uniIdx + 1}, stopping`);
        break;
      }
      
      await supabase.from('search_jobs').update({
        progress: { processed: perUniProcessed, total: totalUniversities, currentBatch: batchIndex, expandedTerms },
      }).eq('id', jobId);
    } catch (err) {
      console.error(`Error processing ${uni.name_en}:`, err);
    }
  }

  // ISSUE 5 FIX: Merge with existing results from `result` column (not progress)
  const { data: currentJob } = await supabase.from('search_jobs').select('result, progress').eq('id', jobId).single();
  const existingResults: UniversityResult[] = currentJob?.result?.universities || [];
  const mergedResults = [...existingResults, ...batchResults];
  const processed = Math.min((batchIndex + 1) * BATCH_SIZE, totalUniversities);

  // Issue 3 fix: Skip dedup on intermediate batches, just append raw results
  // Dedup runs only at finalization (batchIds.length === 0 block above)

  // Issue 14 fix: Don't include universityIds in batch-end progress updates
  await supabase.from('search_jobs').update({
    progress: { processed, total: totalUniversities, currentBatch: batchIndex, expandedTerms },
    result: {
      success: true,
      faculty: expandedTerms.primaryTerm,
      programLevel: request.programLevel,
      semester: request.semester,
      year: request.year,
      languageTrack: request.languageTrack,
      universities: mergedResults,
      totalFound: mergedResults.length,
      expandedTerms: { ...expandedTerms, originalQuery: request.faculty },
    },
  }).eq('id', jobId);

  console.log(`Batch ${batchIndex} complete: ${batchResults.length} new results, ${mergedResults.length} total, ${processed}/${totalUniversities} processed`);

  // ISSUE 3 FIX: Self-chain with retry logic
  const hasMoreBatches = (batchIndex + 1) * BATCH_SIZE < totalUniversities;
  if (hasMoreBatches) {
    await selfChainWithRetry(supabaseUrl, supabaseKey, jobId, request, batchIndex + 1);
  } else {
    // Issue 15 fix: When total is exactly divisible by BATCH_SIZE, finalize here
    // instead of relying on a next self-chain that would hit batchIds.length === 0
    console.log(`Last batch ${batchIndex} complete, triggering finalization chain`);
    await selfChainWithRetry(supabaseUrl, supabaseKey, jobId, request, batchIndex + 1);
  }
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

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const jobId = body.jobId;
    const mode = body.mode;
    const batchIndex = body.batchIndex || 0;
    const request: FacultySearchRequest = body.jobId ? body.request : body;

    console.log('Faculty search request:', JSON.stringify({ mode, batchIndex, faculty: request.faculty }));

    if (!request.faculty || !request.programLevel || !request.semester || !request.year) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: faculty, programLevel, semester, year' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Comprehensive mode: process one batch and self-chain
    if (mode === 'comprehensive' && jobId) {
      const searchPromise = (async () => {
        try {
          await doComprehensiveFacultySearch(request, firecrawlApiKey, geminiApiKey, jobId, batchIndex);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Comprehensive search batch ${batchIndex} failed:`, errorMsg);
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase.from('search_jobs').update({ status: 'failed', error: errorMsg }).eq('id', jobId);
        }
      })();

      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(searchPromise);
      } else {
        searchPromise.catch(console.error);
      }

      return new Response(
        JSON.stringify({ success: true, jobId, status: 'processing', batchIndex }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If jobId provided, run as background job (existing behavior)
    if (jobId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

      // Mark job as processing
      await supabaseAdmin.from('search_jobs').update({ status: 'processing' }).eq('id', jobId);

      // Use EdgeRuntime.waitUntil to continue processing after response
      const searchPromise = (async () => {
        try {
          const result = await doFacultySearch(request, firecrawlApiKey, geminiApiKey);
          await supabaseAdmin.from('search_jobs').update({
            status: 'completed',
            result: result as any,
          }).eq('id', jobId);
          console.log(`Background job ${jobId} completed successfully`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Background job ${jobId} failed:`, errorMsg);
          await supabaseAdmin.from('search_jobs').update({
            status: 'failed',
            error: errorMsg,
          }).eq('id', jobId);
        }
      })();

      // @ts-ignore - EdgeRuntime.waitUntil is available in Deno Deploy / Supabase Edge Functions
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(searchPromise);
      } else {
        // Fallback: just await it (won't survive disconnect but works locally)
        searchPromise.catch(console.error);
      }

      return new Response(
        JSON.stringify({ success: true, jobId, status: 'processing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Direct mode (no jobId) - original behavior
    const result = await doFacultySearch(request, firecrawlApiKey, geminiApiKey);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Faculty search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
