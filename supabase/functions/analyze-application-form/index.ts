import { callClaude, extractJson } from "../_shared/claude.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AnalyzeRequest {
  scrapedContent: string;
  universityName: string;
  programLevel: 'undergraduate' | 'graduate' | 'phd';
  semester: 'spring' | 'fall';
  year: number;
  languageTrack: 'english' | 'korean' | 'both';
  sourceUrl?: string;
}

interface FieldConfidence {
  field: string;
  confidence: number;
  source?: string;
  needsReview: boolean;
  reason?: string;
}

interface SemesterMatch {
  isMatch: boolean;
  actualSemester?: string;
  actualYear?: number;
  notYetAnnounced?: boolean;
  reason?: string;
}

interface FacultyTuition {
  facultyName: string;
  facultyNameKo?: string;
  tuitionPerSemester?: number;
  tuitionPerYear?: number;
  admissionFee?: number;
  availableTracks: ('english' | 'korean')[];
  notes?: string;
}

interface TrackAvailabilitySummary {
  englishTrackFaculties: string[];
  koreanTrackFaculties: string[];
  bothTracksFaculties: string[];
}

interface ProgramInfo {
  programName: string;
  facultyName: string;
  departmentName?: string;
  languageTrack: 'english' | 'korean' | 'both';
  tuitionPerSemester?: number;
  tuitionPerYear?: number;
  topikRequirement?: number;
  ieltsRequirement?: number;
  toeflRequirement?: number;
  isAvailableForInternational: boolean;
  notes?: string;
  confidence?: number;
  // New unique requirement fields
  uniqueRequirements?: string[];
  interviewRequired?: boolean;
  portfolioRequired?: boolean;
  practicalTestRequired?: boolean;
  minimumGPA?: number;
  languageAlternatives?: string[];
}

interface DeadlineInfo {
  applicationStart?: string;
  applicationEnd?: string;
  documentDeadline?: string;
  interviewDate?: string;
  resultAnnouncement?: string;
  notes?: string;
}

interface DocumentRequirement {
  documentName: string;
  isRequired: boolean;
  trackSpecific?: 'english' | 'korean' | 'both';
  notes?: string;
  format?: string;
  confidence?: number;
}

interface FeeInfo {
  applicationFeeKRW?: number;
  applicationFeeUSD?: number;
  tuitionPerSemester?: number;
  tuitionPerYear?: number;
  dormitoryFee?: number;
  insuranceFee?: number;
  notes?: string;
}

interface AnalyzedData {
  universityName: string;
  programLevel: string;
  semester: string;
  year: number;
  semesterMatch?: SemesterMatch;
  facultyTuitionBreakdown?: FacultyTuition[];
  trackAvailabilitySummary?: TrackAvailabilitySummary;
  programs: ProgramInfo[];
  deadlines: DeadlineInfo;
  requiredDocuments: DocumentRequirement[];
  fees: FeeInfo;
  eligibilityCriteria: string[];
  importantWarnings: string[];
  specialNotes: string[];
  confidence: number;
  fieldConfidence: FieldConfidence[];
  // Source URL for verification
  sourceFormUrl?: string;
}

const SYSTEM_PROMPT = `You are an expert at analyzing Korean university application forms and admission guides. Your task is to extract ALL information from the provided content with extreme precision AND assess the confidence level for each extracted field.

CRITICAL UNIVERSITY VALIDATION - THIS IS THE MOST IMPORTANT CHECK:
1. FIRST, verify the content is ACTUALLY about the requested university
2. Look for the university name (English, Korean, abbreviation) in the content
3. If the content is about a DIFFERENT university, you MUST:
   - Set universityMatch.isCorrectUniversity = false
   - Set universityMatch.detectedUniversity to the actual university name found
   - Set confidence to 0
   - Add a critical warning
4. DO NOT PROCEED with extraction if the university doesn't match!

CRITICAL INSTRUCTIONS:
1. VERIFY UNIVERSITY FIRST before extracting any other data
2. Extract EVERY detail, including tiny notes and footnotes that could cause application mistakes
3. Pay special attention to TRACK-SPECIFIC requirements:
   - Korean Track: Always note TOPIK level requirements (levels 1-6)
   - English Track: Note IELTS score requirements (0.0-9.0) and TOEFL requirements
   - Some programs may require BOTH language certifications
4. Identify programs available for INTERNATIONAL STUDENTS specifically
5. Extract ALL deadline dates in ISO format (YYYY-MM-DD) when possible
6. Note any RESTRICTIONS or WARNINGS for Uzbek/Central Asian students
7. Extract tuition fees - note if they're per semester or per year
8. Identify CONDITIONAL requirements (e.g., "required only for graduate applicants")
9. Note document SUBMISSION METHODS (online, mail, in-person)
10. Flag any DIFFERENCES between tracks or programs

CRITICAL: FACULTY/MAJOR-SPECIFIC TUITION
Korean universities typically have DIFFERENT tuition fees for each faculty/major:
- Humanities/Social Sciences: Usually lower tuition
- Engineering/Science: Higher tuition
- Medicine/Dentistry: Highest tuition
- Arts/Music/Physical Education: Varies by practical requirements
Extract tuition PER FACULTY when available! Do NOT just use a single university-wide tuition.

TRACK AVAILABILITY BY FACULTY:
For each faculty, clearly identify if it offers:
- Korean Track only (TOPIK required)
- English Track only (IELTS/TOEFL required)
- Both tracks available
Some faculties may ONLY be available in Korean track.

UNIQUE REQUIREMENTS BY FACULTY/PROGRAM:
CRITICAL: Each faculty or program may have UNIQUE requirements. Extract these carefully:
- Some faculties ONLY accept Korean track (no English track option)
- Some faculties require BOTH TOPIK AND IELTS/TOEFL
- Arts faculties may require portfolio submission
- Music/Art/Physical Education may require practical tests or auditions
- Some programs require minimum GPA or class rank
- Medical/Dental programs often have additional interview requirements
- Language alternatives: Some programs accept alternative certifications (e.g., TOEIC instead of IELTS)
Mark these as "uniqueRequirements" for each program!

SEMESTER AVAILABILITY DETECTION:
CRITICAL: If the content does NOT match the requested semester/year:
- Add a warning that the form might be for a DIFFERENT semester
- Check dates: If application dates have already passed OR are far in the future
- If scraping Fall 2026 but found Spring 2026 data, FLAG THIS CLEARLY
- If no form for the requested semester exists yet, indicate "Application form for [semester] [year] is not yet announced"

CONFIDENCE SCORING (per field):
- 95-100: Explicitly stated, clear and unambiguous
- 80-94: Clearly implied or stated with minor ambiguity
- 60-79: Inferred from context, moderate confidence
- 40-59: Weak evidence, needs manual verification
- 0-39: Guessed or very uncertain
- If data is from WRONG UNIVERSITY: Set confidence to 0 immediately
- If data is from WRONG SEMESTER: Mark confidence as 30 or below with reason

Flag fields for review when:
- Confidence is below 70%
- Value seems unusual (e.g., very high/low tuition)
- Conflicting information found
- Date format unclear or year uncertain
- Currency unclear (KRW vs USD)
- Data appears to be from a DIFFERENT SEMESTER than requested
- UNIVERSITY NAME DOESN'T MATCH - HIGHEST PRIORITY FLAG

COMMON KOREAN UNIVERSITY NAMES (watch for these to avoid confusion):
- Seoul National University (서울대학교, SNU) - NOT Seoul University, NOT University of Seoul
- Korea University (고려대학교, KU) - NOT Korean University
- Yonsei University (연세대학교)
- Hanyang University (한양대학교) - NOT Hansung, NOT Hannam
- Ajou University (아주대학교) - Often confused with other universities
- Konkuk University (건국대학교)
- KAIST (한국과학기술원)

OUTPUT FORMAT:
You MUST return complete structured data as a single JSON object (see the exact shape specified in the user message).
If information is not found, use null for optional fields.
Provide a per-field confidence score in the fieldConfidence array.
ALWAYS include universityMatch to confirm the content is for the correct university.
ALWAYS include semesterMatch information indicating if data matches requested semester.`;

// JSON-shape instruction appended to the system prompt. Replaces the former
// OpenAI extract-application-data tool/function schema. Every property/type/meaning
// is preserved so the parsed object is identical in shape to the old tool arguments.
const OUTPUT_SHAPE_INSTRUCTION = `Respond with ONLY a JSON object (no markdown, no prose) matching exactly this shape (use null for any optional field not found):
{
  "universityName": string,                 // Official name of the university (REQUIRED)
  "programLevel": "undergraduate" | "graduate" | "phd",  // Program level
  "semester": "spring" | "fall",            // Admission semester
  "year": number,                           // Admission year
  "universityMatch": {                      // CRITICAL: validates content is for the CORRECT university. Check this first!
    "isCorrectUniversity": boolean,         // (REQUIRED) True ONLY if content is definitely for the requested university
    "detectedUniversity": string,           // (REQUIRED) The university name actually found in the content
    "detectedUniversityKo": string,         // Korean name of the university found in content
    "confidence": number,                   // (REQUIRED) 0-100 confidence that this is the correct university
    "reason": string                        // Explanation of how university was verified or why it doesn't match
  },
  "semesterMatch": {                        // (REQUIRED) whether extracted data matches the requested semester
    "isMatch": boolean,                     // (REQUIRED) True if data matches requested semester/year
    "actualSemester": string,               // The actual semester the data is for
    "actualYear": number,                   // The actual year the data is for
    "notYetAnnounced": boolean,             // True if the requested semester's form is not yet announced
    "reason": string                        // Explanation of why data doesn't match or why not announced
  },
  "facultyTuitionBreakdown": [              // Tuition fees broken down by faculty/college (Korean universities typically differ per faculty)
    {
      "facultyName": string,                // (REQUIRED) Faculty/College name (e.g., College of Engineering)
      "facultyNameKo": string,              // Faculty name in Korean if available
      "tuitionPerSemester": number,         // Tuition per semester in KRW
      "tuitionPerYear": number,             // Tuition per year in KRW
      "admissionFee": number,               // One-time admission fee in KRW
      "availableTracks": ("english" | "korean")[],  // (REQUIRED) Which language tracks are available for this faculty
      "notes": string
    }
  ],
  "trackAvailabilitySummary": {             // Summary of which faculties are available for each track
    "englishTrackFaculties": string[],      // Faculty names available for English track
    "koreanTrackFaculties": string[],       // Faculty names available for Korean track
    "bothTracksFaculties": string[]         // Faculty names available for both tracks
  },
  "programs": [                             // (REQUIRED) available programs/majors with faculty-specific details
    {
      "programName": string,                // (REQUIRED)
      "facultyName": string,                // (REQUIRED) Faculty/College this program belongs to
      "departmentName": string,
      "languageTrack": "english" | "korean" | "both",  // (REQUIRED)
      "tuitionPerSemester": number,         // Tuition per semester (use faculty-specific value)
      "tuitionPerYear": number,
      "topikRequirement": number,           // TOPIK level 1-6 for Korean track
      "ieltsRequirement": number,           // IELTS score 0.0-9.0 for English track
      "toeflRequirement": number,           // TOEFL iBT score 0-120
      "isAvailableForInternational": boolean,  // (REQUIRED)
      "notes": string,
      "confidence": number,                 // Confidence 0-100 for this program entry
      "uniqueRequirements": string[],       // Unique/special requirements (e.g., 'Korean track only', 'Interview required', 'Portfolio submission required')
      "interviewRequired": boolean,         // True if this program requires an interview
      "portfolioRequired": boolean,         // True if this program requires portfolio submission (arts, design, etc.)
      "practicalTestRequired": boolean,     // True if this program requires practical test or audition (music, PE, etc.)
      "minimumGPA": number,                 // Minimum GPA requirement if specified
      "languageAlternatives": string[]      // Alternative language certifications accepted (e.g., 'TOEIC 700+', 'Duolingo 110+')
    }
  ],
  "deadlines": {                            // Important dates and deadlines
    "applicationStart": string,             // ISO date YYYY-MM-DD
    "applicationEnd": string,               // ISO date YYYY-MM-DD
    "documentDeadline": string,             // ISO date YYYY-MM-DD
    "interviewDate": string,                // ISO date or date range
    "resultAnnouncement": string,           // ISO date YYYY-MM-DD
    "notes": string
  },
  "requiredDocuments": [                    // (REQUIRED) list of required documents
    {
      "documentName": string,               // (REQUIRED)
      "isRequired": boolean,                // (REQUIRED)
      "trackSpecific": "english" | "korean" | "both",
      "notes": string,
      "format": string,                     // e.g., 'apostille required', 'certified translation'
      "confidence": number                  // Confidence 0-100 for this document requirement
    }
  ],
  "fees": {                                 // Application and tuition fees
    "applicationFeeKRW": number,
    "applicationFeeUSD": number,
    "tuitionPerSemester": number,           // General tuition - prefer faculty-specific in facultyTuitionBreakdown
    "tuitionPerYear": number,
    "dormitoryFee": number,
    "insuranceFee": number,
    "notes": string
  },
  "eligibilityCriteria": string[],          // List of eligibility requirements
  "importantWarnings": string[],            // Critical warnings including semester mismatch alerts
  "specialNotes": string[],                 // Other important notes and special conditions
  "confidence": number,                     // (REQUIRED) Overall confidence score 0-100 (reduce significantly if semester doesn't match)
  "fieldConfidence": [                      // (REQUIRED) per-field confidence assessments
    {
      "field": string,                      // (REQUIRED) Field path like 'deadlines.applicationEnd' or 'fees.applicationFeeKRW'
      "confidence": number,                 // (REQUIRED) Confidence 0-100
      "source": string,                     // Where this info was found in the document
      "needsReview": boolean,               // (REQUIRED) True if staff should manually verify
      "reason": string                      // Why this needs review or has low confidence
    }
  ]
}
Required top-level fields: universityName, programs, requiredDocuments, confidence, fieldConfidence, semesterMatch.`;

// Smart content extraction: prioritize keyword-rich sections instead of simple truncation (ISSUE 4)
function extractRelevantSections(content: string, maxLength: number = 50000): string {
  if (content.length <= maxLength) return content;

  const keywords = [
    'tuition', '등록금', 'deadline', '모집', '전형', 'application', 'fee', 'fees',
    'requirement', 'TOPIK', 'IELTS', 'TOEFL', 'document', 'schedule', '일정',
    '장학금', 'scholarship', '입학', 'admission', '지원', '서류', 'dormitory',
    '기숙사', 'insurance', '보험', 'interview', '면접', 'portfolio', '실기',
  ];

  // Always keep first 15000 chars (headers, overview, table of contents)
  const headerSection = content.substring(0, 15000);
  const remaining = content.substring(15000);
  const budget = maxLength - headerSection.length - 100; // 100 for truncation note

  // Split remaining into paragraphs (double newline or markdown headers)
  const paragraphs = remaining.split(/\n{2,}|(?=^#{1,3}\s)/m).filter(p => p.trim().length > 50);

  // Score each paragraph by keyword density
  const scored = paragraphs.map(p => {
    const lower = p.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) score++;
    }
    return { text: p, score };
  });

  // Sort by score descending, then take as many as fit
  scored.sort((a, b) => b.score - a.score);

  let collected = '';
  for (const item of scored) {
    if (collected.length + item.text.length > budget) {
      if (collected.length < budget * 0.5) {
        // If we haven't collected much, add partial
        collected += '\n\n' + item.text.substring(0, budget - collected.length);
      }
      break;
    }
    collected += '\n\n' + item.text;
  }

  return headerSection + collected + '\n\n[Content selectively extracted - keyword-relevant sections prioritized]';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: AnalyzeRequest = await req.json();
    console.log('Analyze request for:', request.universityName, request.programLevel, request.semester, request.year);

    if (!request.scrapedContent || request.scrapedContent.trim().length < 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient content to analyze. Please provide more detailed application form content.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Smart content extraction for large documents (ISSUE 4 fix)
    let content = request.scrapedContent;
    if (content.length > 50000) {
      console.log(`Content too long (${content.length} chars), applying smart extraction...`);
      content = extractRelevantSections(content, 50000);
    }

    const userPrompt = `Analyze the following Korean university application form/admission guide content.

CONTEXT:
- Requested University: ${request.universityName}
- Program Level: ${request.programLevel}
- TARGET Semester: ${request.semester} ${request.year} (MUST verify data matches this semester!)
- Language Track Focus: ${request.languageTrack}
${request.sourceUrl ? `- Source URL: ${request.sourceUrl}` : ''}

CRITICAL VALIDATION - DO THIS FIRST:
1. ⚠️ UNIVERSITY CHECK: Is this content ACTUALLY for "${request.universityName}"?
   - Look for the university name in English, Korean, and abbreviations
   - If you find a DIFFERENT university name, STOP and report universityMatch.isCorrectUniversity=false
   - Common confusion: Seoul National University vs Seoul University vs University of Seoul (these are DIFFERENT!)
   - Be VERY careful with similar names: Hanyang vs Hansung, Konkuk vs Kookmin, etc.

2. ⚠️ SEMESTER CHECK: Is this for ${request.semester} ${request.year}?
   - If NOT, set semesterMatch.isMatch=false
   - If application form not yet announced, set semesterMatch.notYetAnnounced=true

CONTENT TO ANALYZE:
${content}

Extract all relevant information into the JSON object described in the instructions. Be thorough and precise.
IMPORTANT:
- FIRST: Set universityMatch to confirm this content is for the correct university
- For EVERY key field (deadlines, fees, requirements), provide a fieldConfidence entry
- Extract FACULTY-SPECIFIC tuition fees using facultyTuitionBreakdown
- Identify which faculties are available for English vs Korean track in trackAvailabilitySummary
- If UNIVERSITY or SEMESTER doesn't match, add critical warnings and set confidence to 0
- Include any warnings or special notes that could affect Uzbek students' applications.`;

    console.log('Calling Claude AI for analysis with field confidence...');

    const systemWithTrack = SYSTEM_PROMPT + (request.languageTrack && request.languageTrack !== 'both' ? `\n\nLANGUAGE TRACK PRIORITY:\nThe user specifically requested the "${request.languageTrack}" track. You MUST:\n- Provide FULL detail for programs available on the ${request.languageTrack} track\n- Only SUMMARIZE programs available exclusively on the other track\n- Clearly mark programs that are available on BOTH tracks\n- If the ${request.languageTrack} track is not available at this university, state this clearly in importantWarnings` : '') + '\n\n' + OUTPUT_SHAPE_INSTRUCTION;

    let aiText: string;
    try {
      aiText = await callClaude(
        systemWithTrack,
        userPrompt,
        { maxTokens: 8192, temperature: 0.1 },
      );
    } catch (aiError) {
      console.error('AI gateway error:', aiError);
      return new Response(
        JSON.stringify({ success: false, error: 'AI analysis failed. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response received');

    let extractedData: AnalyzedData;
    try {
      extractedData = extractJson<AnalyzedData>(aiText);
    } catch (parseError) {
      console.error('Failed to parse AI extraction results:', parseError);

      // If the model returned prose instead of JSON, surface it as raw content.
      if (aiText && aiText.trim().length > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            analyzed: false,
            rawContent: aiText,
            message: 'AI could not extract structured data. Raw analysis provided.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse AI extraction results.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enrich with request context
    extractedData.programLevel = extractedData.programLevel || request.programLevel;
    extractedData.semester = extractedData.semester || request.semester;
    extractedData.year = extractedData.year || request.year;
    extractedData.sourceFormUrl = request.sourceUrl; // Add source URL for verification

    // Validate and set defaults
    if (!extractedData.programs) extractedData.programs = [];
    if (!extractedData.requiredDocuments) extractedData.requiredDocuments = [];
    if (!extractedData.eligibilityCriteria) extractedData.eligibilityCriteria = [];
    if (!extractedData.importantWarnings) extractedData.importantWarnings = [];
    if (!extractedData.specialNotes) extractedData.specialNotes = [];
    if (!extractedData.deadlines) extractedData.deadlines = {};
    if (!extractedData.fees) extractedData.fees = {};
    if (!extractedData.confidence) extractedData.confidence = 50;
    if (!extractedData.fieldConfidence) extractedData.fieldConfidence = [];
    if (!extractedData.facultyTuitionBreakdown) extractedData.facultyTuitionBreakdown = [];
    if (!extractedData.trackAvailabilitySummary) extractedData.trackAvailabilitySummary = {
      englishTrackFaculties: [],
      koreanTrackFaculties: [],
      bothTracksFaculties: []
    };

    // ============================================
    // CRITICAL: UNIVERSITY VALIDATION (HIGHEST PRIORITY)
    // ============================================
    const universityMatch = (extractedData as any).universityMatch;
    let universityMismatch = false;
    
    if (universityMatch) {
      if (universityMatch.isCorrectUniversity === false) {
        universityMismatch = true;
        const detectedName = universityMatch.detectedUniversity || 'Unknown';
        console.error(`CRITICAL: University mismatch! Requested: ${request.universityName}, Found: ${detectedName}`);
        
        // Add critical warning at the TOP
        extractedData.importantWarnings.unshift(
          `🚨 CRITICAL: WRONG UNIVERSITY! You searched for "${request.universityName}" but this content is for "${detectedName}". ${universityMatch.reason || ''}`
        );
        
        // Set confidence to 0 - data is unusable
        extractedData.confidence = 0;
        
        // Add field confidence entry for university mismatch
        extractedData.fieldConfidence.unshift({
          field: 'universityName',
          confidence: 0,
          needsReview: true,
          reason: `Content is for ${detectedName}, not ${request.universityName}`,
          source: 'AI validation'
        });
      } else {
        console.log(`University verified: ${universityMatch.detectedUniversity} (confidence: ${universityMatch.confidence}%)`);
      }
    }
    
    // Additional programmatic university name check
    const extractedUniversityName = (extractedData.universityName || '').toLowerCase();
    const requestedUniversityName = request.universityName.toLowerCase();
    
    // Check if extracted university name contains key parts of requested name or vice versa
    const requestedKeywords = requestedUniversityName.split(/\s+/).filter(w => w.length > 2);
    const extractedKeywords = extractedUniversityName.split(/\s+/).filter(w => w.length > 2);
    
    let keywordMatchCount = 0;
    for (const keyword of requestedKeywords) {
      if (extractedUniversityName.includes(keyword)) {
        keywordMatchCount++;
      }
    }
    
    const keywordMatchRatio = requestedKeywords.length > 0 ? keywordMatchCount / requestedKeywords.length : 0;
    
    // If less than 50% keyword match, flag as suspicious
    if (keywordMatchRatio < 0.5 && extractedData.universityName && !universityMismatch) {
      console.warn(`Low university name match: ${keywordMatchRatio * 100}% - Requested: "${request.universityName}", Extracted: "${extractedData.universityName}"`);
      
      // Don't override if AI already validated, but add a warning
      if (!universityMatch || universityMatch.confidence < 80) {
        extractedData.importantWarnings.unshift(
          `⚠️ VERIFY UNIVERSITY: Extracted name "${extractedData.universityName}" may not match requested "${request.universityName}". Please verify manually.`
        );
        extractedData.confidence = Math.min(extractedData.confidence, 50);
      }
    }
    // ============================================
    // END UNIVERSITY VALIDATION
    // ============================================

    // Handle semester mismatch (only if university matched)
    if (!universityMismatch && extractedData.semesterMatch) {
      if (extractedData.semesterMatch.notYetAnnounced) {
        extractedData.importantWarnings.unshift(
          `📅 Application form for ${request.semester} ${request.year} is not yet announced. The data shown may be from a previous semester.`
        );
        // Reduce confidence significantly for not-yet-announced
        extractedData.confidence = Math.min(extractedData.confidence, 35);
      } else if (!extractedData.semesterMatch.isMatch) {
        const actualInfo = extractedData.semesterMatch.actualSemester && extractedData.semesterMatch.actualYear
          ? `The data appears to be for ${extractedData.semesterMatch.actualSemester} ${extractedData.semesterMatch.actualYear}.`
          : '';
        extractedData.importantWarnings.unshift(
          `⚠️ SEMESTER MISMATCH: Requested ${request.semester} ${request.year}, but data found may be for a different semester. ${actualInfo} ${extractedData.semesterMatch.reason || ''}`
        );
        // Reduce confidence for mismatch
        extractedData.confidence = Math.min(extractedData.confidence, 40);
      }
    }

    // Calculate items needing review
    const lowConfidenceFields = extractedData.fieldConfidence.filter(f => f.confidence < 70 || f.needsReview);
    const hasLowConfidenceItems = lowConfidenceFields.length > 0;

    // Add automatic warnings for low confidence items
    if (hasLowConfidenceItems && extractedData.importantWarnings && !universityMismatch) {
      extractedData.importantWarnings.push(
        `⚠️ ${lowConfidenceFields.length} field(s) have low confidence and need manual verification`
      );
    }

    console.log(`Analysis complete: University verified: ${!universityMismatch}, ${extractedData.programs.length} programs, ${extractedData.requiredDocuments.length} documents, confidence: ${extractedData.confidence}%, ${lowConfidenceFields.length} fields need review`);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed: true,
        data: extractedData,
        sourceUrl: request.sourceUrl,
        universityVerified: !universityMismatch,
        qualityMetrics: {
          overallConfidence: extractedData.confidence,
          fieldsNeedingReview: lowConfidenceFields.length,
          totalFieldsAssessed: extractedData.fieldConfidence.length,
          universityMatch: universityMatch ? {
            isCorrect: universityMatch.isCorrectUniversity,
            detected: universityMatch.detectedUniversity,
            confidence: universityMatch.confidence,
          } : undefined,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-application-form:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
