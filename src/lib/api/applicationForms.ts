import { supabase } from '@/integrations/supabase/client';

export interface ApplicationFormSearchRequest {
  universityName: string;
  programLevel: 'undergraduate' | 'graduate' | 'phd';
  semester: 'spring' | 'fall';
  year: number;
  languageTrack: 'english' | 'korean' | 'both';
}

export interface ApplicationFormSearchResult {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
  source: 'studyinkorea' | 'official_website' | 'search';
  score?: number;
}

export interface ApplicationFormSearchResponse {
  success: boolean;
  error?: string;
  university?: string;
  programLevel?: string;
  semester?: string;
  year?: number;
  languageTrack?: string;
  results?: ApplicationFormSearchResult[];
  totalFound?: number;
}

// Analyzed data types
export interface FieldConfidence {
  field: string;
  confidence: number;
  source?: string;
  needsReview: boolean;
  reason?: string;
}

export interface SemesterMatch {
  isMatch: boolean;
  actualSemester?: string;
  actualYear?: number;
  notYetAnnounced?: boolean;
  reason?: string;
}

export interface FacultyTuition {
  facultyName: string;
  facultyNameKo?: string;
  tuitionPerSemester?: number;
  tuitionPerYear?: number;
  admissionFee?: number;
  availableTracks: ('english' | 'korean')[];
  notes?: string;
}

export interface TrackAvailabilitySummary {
  englishTrackFaculties: string[];
  koreanTrackFaculties: string[];
  bothTracksFaculties: string[];
}

export interface ProgramInfo {
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
  // Unique requirements
  uniqueRequirements?: string[];
  interviewRequired?: boolean;
  portfolioRequired?: boolean;
  practicalTestRequired?: boolean;
  minimumGPA?: number;
  languageAlternatives?: string[];
}

export interface DeadlineInfo {
  applicationStart?: string;
  applicationEnd?: string;
  documentDeadline?: string;
  interviewDate?: string;
  resultAnnouncement?: string;
  notes?: string;
}

export interface DocumentRequirement {
  documentName: string;
  isRequired: boolean;
  trackSpecific?: 'english' | 'korean' | 'both';
  notes?: string;
  format?: string;
  confidence?: number;
}

export interface FeeInfo {
  applicationFeeKRW?: number;
  applicationFeeUSD?: number;
  tuitionPerSemester?: number;
  tuitionPerYear?: number;
  dormitoryFee?: number;
  insuranceFee?: number;
  notes?: string;
}

export interface AnalyzedApplicationData {
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
  fieldConfidence?: FieldConfidence[];
  // Source URL for verification
  sourceFormUrl?: string;
}

export interface QualityMetrics {
  overallConfidence: number;
  fieldsNeedingReview: number;
  totalFieldsAssessed: number;
}

export interface AnalyzeResponse {
  success: boolean;
  error?: string;
  analyzed?: boolean;
  data?: AnalyzedApplicationData;
  rawContent?: string;
  sourceUrl?: string;
  message?: string;
  qualityMetrics?: QualityMetrics;
}

export interface ValidationDiscrepancy {
  field: string;
  currentValue: any;
  expectedValue?: any;
  source: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface ValidationChange {
  changeType: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  severity: 'info' | 'warning' | 'critical';
}

export interface ValidationResponse {
  success: boolean;
  error?: string;
  validationId?: string;
  status: 'passed' | 'failed' | 'needs_review';
  summary: {
    discrepancies: number;
    changes: number;
    lowConfidenceFields: number;
    criticalIssues: number;
    warningIssues: number;
  };
  discrepancies: ValidationDiscrepancy[];
  changes: ValidationChange[];
  fieldConfidence: FieldConfidence[];
}

// Faculty search types
export interface FacultySearchRequest {
  faculty: string;
  programLevel: 'undergraduate' | 'graduate' | 'phd';
  semester: 'spring' | 'fall';
  year: number;
  languageTrack: 'english' | 'korean' | 'both';
}

export interface FacultyUniversityResult {
  universityName: string;
  universityNameKo?: string;
  sourceUrl: string;
  tuitionPerSemester?: number;
  tuitionPerYear?: number;
  applicationDeadline?: string;
  documentDeadline?: string;
  languageTracks: string[];
  topikRequirement?: number;
  ieltsRequirement?: number;
  toeflRequirement?: number;
  uniqueRequirements?: string[];
  interviewRequired?: boolean;
  portfolioRequired?: boolean;
  notes?: string;
  confidence: number;
  validationFlags?: string[];
  dataSource?: 'verified' | 'unverified';
  yearMismatch?: boolean;
}

export interface FacultyQualitySummary {
  totalFound: number;
  verifiedCount: number;
  reviewCount: number;
  unverifiedCount: number;
  averageConfidence: number;
  sourcesUsed: number;
  officialSourceCount: number;
}

export interface FacultyExpandedTerms {
  englishTerms: string[];
  koreanTerms: string[];
  primaryTerm: string;
  originalQuery: string;
}

export interface FacultySearchResponse {
  success: boolean;
  error?: string;
  faculty?: string;
  programLevel?: string;
  semester?: string;
  year?: number;
  languageTrack?: string;
  universities?: FacultyUniversityResult[];
  totalFound?: number;
  message?: string;
  qualitySummary?: FacultyQualitySummary;
  expandedTerms?: FacultyExpandedTerms;
}

export const applicationFormsApi = {
  /**
   * Start a background faculty search job and return jobId
   */
  async startFacultySearch(request: FacultySearchRequest): Promise<{ jobId: string } | { error: string }> {
    // Create a job record first
    const jobId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('search_jobs')
      .insert({
        id: jobId,
        type: 'faculty',
        status: 'pending',
        request: request as any,
        user_id: (await supabase.auth.getUser()).data.user?.id || '00000000-0000-0000-0000-000000000000',
      });

    if (insertError) {
      console.error('Error creating search job:', insertError);
      return { error: insertError.message };
    }

    // Trigger the edge function with jobId (fire-and-forget from browser perspective)
    supabase.functions.invoke('find-faculty-forms', {
      body: { jobId, request },
    }).catch(err => console.error('Edge function trigger error (expected if tab switches):', err));

    return { jobId };
  },

  /**
   * Start a comprehensive faculty search across ALL universities in the database
   */
  async startComprehensiveFacultySearch(request: FacultySearchRequest): Promise<{ jobId: string } | { error: string }> {
    const jobId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('search_jobs')
      .insert({
        id: jobId,
        type: 'faculty_comprehensive',
        status: 'pending',
        request: request as any,
        user_id: (await supabase.auth.getUser()).data.user?.id || '00000000-0000-0000-0000-000000000000',
      });

    if (insertError) {
      console.error('Error creating comprehensive search job:', insertError);
      return { error: insertError.message };
    }

    // Mark as processing immediately
    await supabase.from('search_jobs').update({ status: 'processing' }).eq('id', jobId);

    // Trigger the edge function in comprehensive mode
    supabase.functions.invoke('find-faculty-forms', {
      body: { jobId, request, mode: 'comprehensive', batchIndex: 0 },
    }).catch(err => console.error('Edge function trigger error (expected if tab switches):', err));

    return { jobId };
  },

  /**
   * Start a background university search job and return jobId
   */
  async startUniversitySearch(universityName: string, websiteUrl?: string): Promise<{ jobId: string } | { error: string }> {
    const jobId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('search_jobs')
      .insert({
        id: jobId,
        type: 'university',
        status: 'pending',
        request: { universityName, websiteUrl } as any,
        user_id: (await supabase.auth.getUser()).data.user?.id || '00000000-0000-0000-0000-000000000000',
      });

    if (insertError) {
      console.error('Error creating search job:', insertError);
      return { error: insertError.message };
    }

    supabase.functions.invoke('search-university', {
      body: { universityName, websiteUrl, jobId },
    }).catch(err => console.error('Edge function trigger error (expected if tab switches):', err));

    return { jobId };
  },

  /**
   * Check a background search job status (with progress for comprehensive)
   */
  async checkSearchJob(jobId: string): Promise<{ status: string; result?: any; error?: string; progress?: any }> {
    const { data, error } = await supabase.functions.invoke('check-search-job', {
      body: { jobId },
    });

    if (error) {
      // Treat "Job not found" (404) as a terminal failure so polling stops cleanly
      const msg = error.message || '';
      if (msg.includes('Job not found') || msg.includes('404') || msg.includes('not found')) {
        return { status: 'failed', error: 'Job no longer exists — it may have expired or been cleaned up.' };
      }
      return { status: 'error', error: msg };
    }

    // Also handle the case where the edge function returns success:false with an error
    if (data && data.success === false) {
      const errMsg = data.error || 'Job not found';
      if (errMsg.includes('Job not found') || errMsg.includes('not found')) {
        return { status: 'failed', error: 'Job no longer exists — it may have expired or been cleaned up.' };
      }
    }

    return { status: data.status, result: data.result, error: data.error, progress: data.progress };
  },

  /**
   * Search for application forms by faculty across all universities (direct, legacy)
   */
  async findByFaculty(request: FacultySearchRequest): Promise<FacultySearchResponse> {
    const { data, error } = await supabase.functions.invoke('find-faculty-forms', {
      body: request,
    });

    if (error) {
      console.error('Error searching by faculty:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'No response from server' };
    }

    return data;
  },

  /**
   * Search for university application forms using AI-powered web scraping
   */
  async findApplicationForm(request: ApplicationFormSearchRequest): Promise<ApplicationFormSearchResponse> {
    const { data, error } = await supabase.functions.invoke('find-application-form', {
      body: request,
    });

    if (error) {
      console.error('Error finding application form:', error);
      return { success: false, error: error.message };
    }

    return data;
  },

  /**
   * Analyze scraped content using AI to extract structured data
   */
  async analyzeApplicationForm(
    scrapedContent: string,
    universityName: string,
    programLevel: 'undergraduate' | 'graduate' | 'phd',
    semester: 'spring' | 'fall',
    year: number,
    languageTrack: 'english' | 'korean' | 'both',
    sourceUrl?: string
  ): Promise<AnalyzeResponse> {
    const { data, error } = await supabase.functions.invoke('analyze-application-form', {
      body: {
        scrapedContent,
        universityName,
        programLevel,
        semester,
        year,
        languageTrack,
        sourceUrl,
      },
    });

    if (error) {
      console.error('Error analyzing application form:', error);
      return { success: false, error: error.message };
    }

    return data;
  },

  /**
   * Combined: Find and analyze application form in one call
   */
  async findAndAnalyzeApplicationForm(
    request: ApplicationFormSearchRequest
  ): Promise<{ searchResponse: ApplicationFormSearchResponse; analyzeResponse?: AnalyzeResponse }> {
    // First, find the application form
    const searchResponse = await this.findApplicationForm(request);
    
    if (!searchResponse.success || !searchResponse.results?.length) {
      return { searchResponse };
    }

    // ISSUE 7 (Round 4) fix: Use multi-source analysis (top 3 results) instead of single best
    const topResults = searchResponse.results.filter(r => r.markdown).slice(0, 3);
    const bestResult = topResults[0] || searchResponse.results[0];
    
    if (!bestResult?.markdown) {
      return { 
        searchResponse, 
        analyzeResponse: { 
          success: false, 
          error: 'No content available for analysis. Try selecting a specific result.' 
        } 
      };
    }

    const combinedMarkdown = topResults.length > 1
      ? topResults.map((r, i) => `--- Source ${i + 1}: ${r.url} ---\n${r.markdown}`).join('\n\n')
      : bestResult.markdown;

    // Analyze the combined content
    const analyzeResponse = await this.analyzeApplicationForm(
      combinedMarkdown,
      request.universityName,
      request.programLevel,
      request.semester,
      request.year,
      request.languageTrack,
      bestResult.url
    );

    return { searchResponse, analyzeResponse };
  },

  /**
   * Cache a found application form in the database
   */
  async cacheApplicationForm(
    universityId: string,
    semester: 'spring' | 'fall',
    year: number,
    programLevel: string,
    formUrl: string,
    scrapedContent: string,
    analyzedData: AnalyzedApplicationData | null,
    source: 'studyinkorea' | 'official_website' | 'manual',
    languageTrack?: string
  ) {
    // ISSUE 7 fix: Inject languageTrack into analyzed_data JSONB for cache validation
    const enrichedData = analyzedData ? { ...analyzedData, languageTrack: languageTrack || (analyzedData as any).languageTrack || 'both' } : null;

    const { data, error } = await supabase
      .from('application_form_cache')
      .upsert({
        university_id: universityId,
        semester,
        year,
        program_level: programLevel,
        form_url: formUrl,
        scraped_content: scrapedContent,
        analyzed_data: enrichedData as any,
        source,
        scraped_at: new Date().toISOString(),
        is_valid: true,
      }, {
        onConflict: 'university_id,semester,year,program_level',
      })
      .select()
      .single();

    if (error) {
      console.error('Error caching application form:', error);
      return { error, data: null };
    }

    return { error: null, data };
  },

  /**
   * Get cached application form if available
   */
  async getCachedForm(
    universityId: string,
    semester: 'spring' | 'fall',
    year: number,
    programLevel: string
  ) {
    const { data, error } = await supabase
      .from('application_form_cache')
      .select('*')
      .eq('university_id', universityId)
      .eq('semester', semester)
      .eq('year', year)
      .eq('program_level', programLevel)
      .eq('is_valid', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error getting cached form:', error);
    }

    return { error: null, data };
  },

  /**
   * Invalidate cached form (e.g., when staff knows info changed)
   */
  async invalidateCachedForm(cacheId: string) {
    const { error } = await supabase
      .from('application_form_cache')
      .update({ is_valid: false })
      .eq('id', cacheId);

    return { error };
  },

  /**
   * Save analyzed data to university tables and update university info
   */
  async saveAnalyzedDataToDatabase(
    universityId: string,
    data: AnalyzedApplicationData
  ): Promise<{ 
    success: boolean; 
    errors?: string[];
    imported: {
      programs: number;
      admissionPeriods: number;
      requirements: number;
      universityUpdated: boolean;
    };
  }> {
    const errors: string[] = [];
    const imported = {
      programs: 0,
      admissionPeriods: 0,
      requirements: 0,
      universityUpdated: false,
    };

    // 1. Update universities table with tuition range from programs
    if (data.programs?.length > 0 || data.fees) {
      const tuitionValues: number[] = [];
      
      // Collect tuition values from programs
      for (const program of data.programs || []) {
        if (program.tuitionPerSemester) tuitionValues.push(program.tuitionPerSemester);
        if (program.tuitionPerYear) tuitionValues.push(program.tuitionPerYear / 2); // Normalize to semester
      }
      
      // Include fee info tuition if available
      if (data.fees?.tuitionPerSemester) tuitionValues.push(data.fees.tuitionPerSemester);
      if (data.fees?.tuitionPerYear) tuitionValues.push(data.fees.tuitionPerYear / 2);
      
      if (tuitionValues.length > 0) {
        const tuitionMin = Math.min(...tuitionValues);
        const tuitionMax = Math.max(...tuitionValues);
        
        // Only update if we have meaningful values (in thousands, likely in USD)
        if (tuitionMin > 0 && tuitionMax > 0) {
          const { error } = await supabase
            .from('universities')
            .update({
              tuition_min: tuitionMin,
              tuition_max: tuitionMax,
              updated_at: new Date().toISOString(),
            })
            .eq('id', universityId);
          
          if (error) {
            console.error('Error updating university tuition:', error);
            errors.push('Failed to update university tuition range');
          } else {
            imported.universityUpdated = true;
          }
        }
      }
    }

    // 2. Save programs (BUG 5 FIX: skip low-confidence programs)
    const validPrograms = (data.programs || []).filter(p => (p.confidence || 100) >= 50);
    const skippedLowConfidence = (data.programs?.length || 0) - validPrograms.length;
    if (skippedLowConfidence > 0) {
      console.warn(`Skipped ${skippedLowConfidence} low-confidence programs (confidence < 50)`);
    }
    if (validPrograms.length > 0) {
      for (const program of validPrograms) {
        const { error } = await supabase
          .from('university_programs')
          .upsert({
            university_id: universityId,
            program_name: program.programName,
            program_level: data.programLevel as any,
            faculty_name: program.facultyName,
            department_name: program.departmentName,
            language_track: program.languageTrack,
            tuition_per_semester: program.tuitionPerSemester,
            tuition_per_year: program.tuitionPerYear,
            topik_requirement: program.topikRequirement,
            ielts_requirement: program.ieltsRequirement,
            toefl_requirement: program.toeflRequirement,
            is_available_for_international: program.isAvailableForInternational,
            notes: program.notes,
          }, {
            onConflict: 'university_id,program_name,program_level,language_track',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error('Error saving program:', error);
          errors.push(`Failed to save program: ${program.programName}`);
        } else {
          imported.programs++;
        }
      }
    }

    // 3. Save admission period with fees
    if (data.deadlines) {
      const { error } = await supabase
        .from('university_admission_periods')
        .upsert({
          university_id: universityId,
          semester: data.semester as any,
          year: data.year,
          program_level: data.programLevel as any,
          language_track: 'all',
          application_start: data.deadlines.applicationStart,
          application_end: data.deadlines.applicationEnd,
          document_deadline: data.deadlines.documentDeadline,
          result_announcement: data.deadlines.resultAnnouncement,
          application_fee_krw: data.fees?.applicationFeeKRW,
          application_fee_usd: data.fees?.applicationFeeUSD,
        }, {
          onConflict: 'university_id,semester,year,program_level,language_track',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('Error saving admission period:', error);
        errors.push('Failed to save admission period');
      } else {
        imported.admissionPeriods++;
      }
    }

    // 4. Save requirements
    if (data.requiredDocuments?.length > 0) {
      const { error } = await supabase
        .from('university_requirements')
        .upsert({
          university_id: universityId,
          semester: data.semester as any,
          year: data.year,
          program_level: data.programLevel as any,
          language_track: 'all',
          required_documents: data.requiredDocuments as any,
          special_notes: data.specialNotes?.join('\n'),
          eligibility_criteria: data.eligibilityCriteria?.join('\n'),
        }, {
          onConflict: 'university_id,semester,year,program_level,language_track',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('Error saving requirements:', error);
        errors.push('Failed to save requirements');
      } else {
        imported.requirements++;
      }
    }

    return { 
      success: errors.length === 0, 
      errors: errors.length > 0 ? errors : undefined,
      imported,
    };
  },

  /**
   * Get all cached forms for a university
   */
  async getCachedFormsForUniversity(universityId: string) {
    const { data, error } = await supabase
      .from('application_form_cache')
      .select('*')
      .eq('university_id', universityId)
      .eq('is_valid', true)
      .order('year', { ascending: false })
      .order('semester', { ascending: false });

    if (error) {
      console.error('Error getting cached forms:', error);
      return { error, data: [] };
    }

    return { error: null, data: data || [] };
  },

  /**
   * Check if form was recently scraped (within days threshold)
   */
  async checkRecentCache(
    universityId: string,
    semester: 'spring' | 'fall',
    year: number,
    programLevel: string,
    daysThreshold: number = 7,
    languageTrack?: string
  ) {
    const { data, error } = await supabase
      .from('application_form_cache')
      .select('*')
      .eq('university_id', universityId)
      .eq('semester', semester)
      .eq('year', year)
      .eq('program_level', programLevel)
      .eq('is_valid', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking recent cache:', error);
      return { hasRecent: false, data: null, isStale: false };
    }

    if (!data) {
      return { hasRecent: false, data: null, isStale: false };
    }

    // ISSUE 1 fix: Check language track in cached JSONB data
    if (languageTrack && languageTrack !== 'both' && data.analyzed_data) {
      const analyzedData = data.analyzed_data as any;
      const cachedTrack = analyzedData?.languageTrack || analyzedData?.language_track;
      if (cachedTrack && cachedTrack !== 'both' && cachedTrack !== languageTrack) {
        console.log(`Cache track mismatch: requested ${languageTrack}, cached ${cachedTrack} - treating as miss`);
        return { hasRecent: false, data: null, isStale: false };
      }
    }

    // Check if the cache is stale (older than threshold)
    const scrapedDate = new Date(data.scraped_at);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - scrapedDate.getTime()) / (1000 * 60 * 60 * 24));
    const isStale = daysDiff > daysThreshold;

    return { 
      hasRecent: true, 
      data, 
      isStale,
      daysSinceScraped: daysDiff,
    };
  },

  /**
   * Validate analyzed data against existing database records
   */
  async validateApplicationData(
    cacheId: string,
    universityId: string,
    analyzedData: AnalyzedApplicationData,
    validationType: 'cross_reference' | 'change_detection' | 'manual_review' = 'cross_reference'
  ): Promise<ValidationResponse> {
    const { data, error } = await supabase.functions.invoke('validate-application-data', {
      body: {
        cacheId,
        universityId,
        analyzedData,
        validationType,
      },
    });

    if (error) {
      console.error('Error validating application data:', error);
      return { 
        success: false, 
        error: error.message,
        status: 'failed',
        summary: { discrepancies: 0, changes: 0, lowConfidenceFields: 0, criticalIssues: 0, warningIssues: 0 },
        discrepancies: [],
        changes: [],
        fieldConfidence: [],
      };
    }

    return data;
  },

  /**
   * Get pending changes for a university that need staff acknowledgment
   */
  async getPendingChanges(universityId?: string) {
    let query = supabase
      .from('application_form_changes')
      .select(`
        *,
        universities!inner(name_en, name_uz, name_ko)
      `)
      .is('acknowledged_at', null)
      .order('detected_at', { ascending: false });

    if (universityId) {
      query = query.eq('university_id', universityId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting pending changes:', error);
      return { error, data: [] };
    }

    return { error: null, data: data || [] };
  },

  /**
   * Acknowledge a detected change
   */
  async acknowledgeChange(changeId: string, notes?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('application_form_changes')
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user?.id,
        notes,
      })
      .eq('id', changeId);

    return { error };
  },

  /**
   * Get validations needing review
   */
  async getValidationsNeedingReview(universityId?: string) {
    let query = supabase
      .from('application_form_validations')
      .select(`
        *,
        universities!inner(name_en, name_uz, name_ko)
      `)
      .eq('status', 'needs_review')
      .is('reviewed_at', null)
      .order('validated_at', { ascending: false });

    if (universityId) {
      query = query.eq('university_id', universityId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting validations needing review:', error);
      return { error, data: [] };
    }

    return { error: null, data: data || [] };
  },

  /**
   * Mark a validation as reviewed
   */
  async markValidationReviewed(validationId: string, notes?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('application_form_validations')
      .update({
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
        review_notes: notes,
        status: 'passed',
      })
      .eq('id', validationId);

    return { error };
  },

  /**
   * Get saved (completed) faculty searches
   */
  async getSavedFacultySearches(): Promise<Array<{
    id: string;
    request: any;
    result: any;
    created_at: string;
  }>> {
    // ISSUE 10 FIX: Include both faculty and faculty_comprehensive types
    const { data, error } = await supabase
      .from('search_jobs')
      .select('id, request, result, created_at')
      .in('type', ['faculty', 'faculty_comprehensive'])
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error getting saved faculty searches:', error);
      return [];
    }

    return (data || []).filter(d => d.result);
  },

  /**
   * Delete a saved faculty search
   */
  async deleteFacultySearch(jobId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('search_jobs')
      .delete()
      .eq('id', jobId);

    return { error };
  },
};
