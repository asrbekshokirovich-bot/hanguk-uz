import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ValidateRequest {
  cacheId: string;
  universityId: string;
  analyzedData: any;
  previousData?: any;
  validationType: 'cross_reference' | 'change_detection' | 'manual_review';
}

interface Discrepancy {
  field: string;
  currentValue: any;
  expectedValue?: any;
  source: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

interface ChangeDetection {
  changeType: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  severity: 'info' | 'warning' | 'critical';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: ValidateRequest = await req.json();
    console.log('Validation request for cache:', request.cacheId, 'type:', request.validationType);

    const discrepancies: Discrepancy[] = [];
    const changes: ChangeDetection[] = [];

    // 1. Cross-reference validation with existing database data
    if (request.validationType === 'cross_reference' || request.validationType === 'change_detection') {
      // Fetch existing university data
      const { data: university } = await supabase
        .from('universities')
        .select('*')
        .eq('id', request.universityId)
        .single();

      if (university) {
        const data = request.analyzedData;

        // Validate tuition ranges
        if (data.fees?.tuitionPerSemester && university.tuition_min && university.tuition_max) {
          const extractedTuition = data.fees.tuitionPerSemester;
          if (extractedTuition < university.tuition_min * 0.5 || extractedTuition > university.tuition_max * 2) {
            discrepancies.push({
              field: 'fees.tuitionPerSemester',
              currentValue: extractedTuition,
              expectedValue: `${university.tuition_min} - ${university.tuition_max}`,
              source: 'universities table',
              severity: 'warning',
              message: `Extracted tuition (${extractedTuition}) differs significantly from database range (${university.tuition_min}-${university.tuition_max})`,
            });
          }
        }

        // Validate program count seems reasonable
        if (data.programs?.length > 100) {
          discrepancies.push({
            field: 'programs',
            currentValue: data.programs.length,
            source: 'heuristic',
            severity: 'info',
            message: `Unusually high number of programs (${data.programs.length}). Please verify this is correct.`,
          });
        }
      }

      // Fetch existing admission periods for comparison
      const { data: existingPeriods } = await supabase
        .from('university_admission_periods')
        .select('*')
        .eq('university_id', request.universityId)
        .eq('semester', request.analyzedData.semester)
        .eq('year', request.analyzedData.year);

      if (existingPeriods && existingPeriods.length > 0) {
        const existingPeriod = existingPeriods[0];
        const newDeadlines = request.analyzedData.deadlines;

        // Check for deadline changes
        if (existingPeriod.application_end && newDeadlines?.applicationEnd) {
          if (existingPeriod.application_end !== newDeadlines.applicationEnd) {
            changes.push({
              changeType: 'deadline_changed',
              fieldName: 'application_end',
              oldValue: existingPeriod.application_end,
              newValue: newDeadlines.applicationEnd,
              severity: 'critical',
            });
          }
        }

        // Check for fee changes
        if (existingPeriod.application_fee_krw && request.analyzedData.fees?.applicationFeeKRW) {
          if (existingPeriod.application_fee_krw !== request.analyzedData.fees.applicationFeeKRW) {
            changes.push({
              changeType: 'fee_changed',
              fieldName: 'application_fee_krw',
              oldValue: String(existingPeriod.application_fee_krw),
              newValue: String(request.analyzedData.fees.applicationFeeKRW),
              severity: 'warning',
            });
          }
        }
      }

      // Fetch existing requirements for comparison
      const { data: existingReqs } = await supabase
        .from('university_requirements')
        .select('*')
        .eq('university_id', request.universityId)
        .eq('semester', request.analyzedData.semester)
        .eq('year', request.analyzedData.year);

      if (existingReqs && existingReqs.length > 0) {
        const existingDocs = (existingReqs[0].required_documents as any[]) || [];
        const newDocs = request.analyzedData.requiredDocuments || [];

        // Detect added documents
        for (const newDoc of newDocs) {
          const exists = existingDocs.find(d => d.documentName === newDoc.documentName);
          if (!exists) {
            changes.push({
              changeType: 'document_added',
              fieldName: newDoc.documentName,
              oldValue: null,
              newValue: newDoc.isRequired ? 'required' : 'optional',
              severity: 'warning',
            });
          }
        }

        // Detect removed documents
        for (const existingDoc of existingDocs) {
          const stillExists = newDocs.find((d: any) => d.documentName === existingDoc.documentName);
          if (!stillExists) {
            changes.push({
              changeType: 'document_removed',
              fieldName: existingDoc.documentName,
              oldValue: existingDoc.isRequired ? 'required' : 'optional',
              newValue: null,
              severity: 'warning',
            });
          }
        }
      }
    }

    // 2. Validate field confidence scores
    const fieldConfidence = request.analyzedData.fieldConfidence || [];
    const lowConfidenceFields = fieldConfidence.filter((f: any) => f.confidence < 70 || f.needsReview);

    // Add low confidence items as discrepancies
    for (const field of lowConfidenceFields) {
      discrepancies.push({
        field: field.field,
        currentValue: field.confidence,
        source: 'AI confidence scoring',
        severity: field.confidence < 50 ? 'warning' : 'info',
        message: field.reason || `Low confidence (${field.confidence}%) - needs manual verification`,
      });
    }

    // 3. Determine overall validation status
    const criticalIssues = discrepancies.filter(d => d.severity === 'critical').length + 
                          changes.filter(c => c.severity === 'critical').length;
    const warningIssues = discrepancies.filter(d => d.severity === 'warning').length + 
                         changes.filter(c => c.severity === 'warning').length;

    let status: 'passed' | 'failed' | 'needs_review' = 'passed';
    if (criticalIssues > 0) {
      status = 'failed';
    } else if (warningIssues > 0 || lowConfidenceFields.length > 3) {
      status = 'needs_review';
    }

    // 4. Save validation result
    const { data: validation, error: validationError } = await supabase
      .from('application_form_validations')
      .insert({
        cache_id: request.cacheId,
        university_id: request.universityId,
        validation_type: request.validationType,
        status,
        discrepancies,
        field_confidence_scores: fieldConfidence.reduce((acc: any, f: any) => {
          acc[f.field] = { confidence: f.confidence, needsReview: f.needsReview };
          return acc;
        }, {}),
        overall_confidence: request.analyzedData.confidence || 0,
      })
      .select()
      .single();

    if (validationError) {
      console.error('Error saving validation:', validationError);
    }

    // 5. Save detected changes
    if (changes.length > 0) {
      const changeRecords = changes.map(c => ({
        cache_id: request.cacheId,
        university_id: request.universityId,
        change_type: c.changeType,
        field_name: c.fieldName,
        old_value: c.oldValue,
        new_value: c.newValue,
        severity: c.severity,
      }));

      const { error: changesError } = await supabase
        .from('application_form_changes')
        .insert(changeRecords);

      if (changesError) {
        console.error('Error saving changes:', changesError);
      }
    }

    // 6. Update cache validation status
    await supabase
      .from('application_form_cache')
      .update({
        validation_status: status === 'passed' ? 'validated' : 'needs_review',
        last_validated_at: new Date().toISOString(),
        field_confidence: fieldConfidence.reduce((acc: any, f: any) => {
          acc[f.field] = f.confidence;
          return acc;
        }, {}),
      })
      .eq('id', request.cacheId);

    console.log(`Validation complete: status=${status}, discrepancies=${discrepancies.length}, changes=${changes.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        validationId: validation?.id,
        status,
        summary: {
          discrepancies: discrepancies.length,
          changes: changes.length,
          lowConfidenceFields: lowConfidenceFields.length,
          criticalIssues,
          warningIssues,
        },
        discrepancies,
        changes,
        fieldConfidence: lowConfidenceFields,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in validate-application-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
