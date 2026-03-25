import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranslationRequirement {
  id: string;
  document_type_id: string;
  required_document_code: string;
  required_document_name_uz: string;
  is_required: boolean;
}

interface DocumentTypeWithRequirements {
  id: string;
  code: string;
  name_uz: string;
  requirements: TranslationRequirement[];
}

interface StudentDocument {
  id: string;
  name: string;
  file_path: string;
  status: string;
}

// Map document names to translation requirement codes
const documentNameToCode: Record<string, string[]> = {
  passport: ['passport', 'pasport', 'паспорт', 'student_passport'],
  parent_passport: ['parent_passport', 'ota', 'ona', 'родител', 'father', 'mother'],
  diploma: ['diploma', 'diplom', 'диплом', 'bakalavr', 'magistr'],
  attestat: ['attestat', 'attestat', 'аттестат', 'maktab', 'school', '11-sinf', '9-sinf'],
  birth_certificate: ['birth', 'tug\'ilgan', 'tug\'ilish', 'рождени', 'guvohnoma'],
  transcript: ['transcript', 'baholar', 'оценк', 'grade'],
  medical: ['medical', 'tibbiy', 'медицин', 'health'],
};

// Detect document type from filename
function detectDocumentCode(fileName: string): string | null {
  const lowerName = fileName.toLowerCase();
  
  for (const [code, patterns] of Object.entries(documentNameToCode)) {
    for (const pattern of patterns) {
      if (lowerName.includes(pattern.toLowerCase())) {
        return code;
      }
    }
  }
  
  return null;
}

// Check if a student has all required documents for a translation type
async function checkRequirementsForType(
  studentId: string,
  documentTypeId: string,
  studentDocuments: StudentDocument[]
): Promise<{ met: boolean; missing: string[] }> {
  // Get requirements for this document type
  const { data: requirements, error } = await supabase
    .from('translation_requirements')
    .select('*')
    .eq('document_type_id', documentTypeId)
    .eq('is_required', true);

  if (error || !requirements) {
    return { met: false, missing: [] };
  }

  const missing: string[] = [];
  
  for (const req of requirements) {
    // Check if student has a document matching this requirement
    const hasDocument = studentDocuments.some(doc => {
      const docCode = detectDocumentCode(doc.name);
      return docCode === req.required_document_code || 
             doc.name.toLowerCase().includes(req.required_document_code.toLowerCase());
    });

    if (!hasDocument) {
      missing.push(req.required_document_name_uz);
    }
  }

  return { met: missing.length === 0, missing };
}

// Check if a translation job already exists for this student and type
async function hasExistingJob(studentId: string, documentTypeId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('translation_jobs')
    .select('id')
    .eq('student_id', studentId)
    .eq('document_type_id', documentTypeId)
    .in('status', ['pending', 'processing', 'completed'])
    .limit(1);

  return !error && data && data.length > 0;
}

// Find the source document for a translation type
function findSourceDocument(
  documents: StudentDocument[],
  documentTypeCode: string
): StudentDocument | null {
  // Map translation type codes to document patterns
  const typePatterns: Record<string, string[]> = {
    diploma: ['diploma', 'diplom', 'диплом'],
    attestat: ['attestat', 'аттестат', 'maktab'],
    birth_certificate: ['birth', 'tug\'ilgan', 'рождени', 'guvohnoma'],
    transcript: ['transcript', 'baholar', 'оценк'],
    medical_certificate: ['medical', 'tibbiy', 'медицин'],
  };

  const patterns = typePatterns[documentTypeCode] || [documentTypeCode];
  
  for (const doc of documents) {
    const lowerName = doc.name.toLowerCase();
    for (const pattern of patterns) {
      if (lowerName.includes(pattern.toLowerCase())) {
        return doc;
      }
    }
  }

  return null;
}

// Main function to check and trigger auto-translation
export async function checkAutoTranslation(
  studentId: string,
  requestedBy?: string
): Promise<{ triggered: string[]; skipped: string[] }> {
  const triggered: string[] = [];
  const skipped: string[] = [];

  try {
    // Get all active translation document types
    const { data: documentTypes, error: typesError } = await supabase
      .from('translation_document_types')
      .select('*')
      .eq('is_active', true);

    if (typesError || !documentTypes) {
      console.error('Failed to fetch document types:', typesError);
      return { triggered, skipped };
    }

    // Get student's documents
    const { data: studentDocs, error: docsError } = await supabase
      .from('documents')
      .select('id, name, file_path, status')
      .eq('student_id', studentId);

    if (docsError || !studentDocs) {
      console.error('Failed to fetch student documents:', docsError);
      return { triggered, skipped };
    }

    // Check each document type
    for (const docType of documentTypes) {
      // Skip if job already exists
      const exists = await hasExistingJob(studentId, docType.id);
      if (exists) {
        skipped.push(docType.name_uz);
        continue;
      }

      // Find source document for this type
      const sourceDoc = findSourceDocument(studentDocs, docType.code);
      if (!sourceDoc) {
        // No source document to translate
        continue;
      }

      // Check if all requirements are met
      const { met, missing } = await checkRequirementsForType(
        studentId,
        docType.id,
        studentDocs
      );

      if (met) {
        // Create auto-translation job
        const { error: jobError } = await supabase
          .from('translation_jobs')
          .insert({
            student_id: studentId,
            document_type_id: docType.id,
            source_document_id: sourceDoc.id,
            source_file_path: sourceDoc.file_path,
            auto_triggered: true,
            requested_by: requestedBy || null,
            status: 'pending',
          });

        if (!jobError) {
          triggered.push(docType.name_uz);
          console.log(`Auto-translation triggered for ${docType.name_uz}`);
        } else {
          console.error('Failed to create translation job:', jobError);
        }
      }
    }

    if (triggered.length > 0) {
      toast.success(
        `Avtomatik tarjima: ${triggered.join(', ')}`,
        { duration: 5000 }
      );
    }

    return { triggered, skipped };
  } catch (error) {
    console.error('Auto-translation check failed:', error);
    return { triggered, skipped };
  }
}

// Hook for use in components
export function useAutoTranslation() {
  const checkForStudent = async (studentId: string, requestedBy?: string) => {
    return await checkAutoTranslation(studentId, requestedBy);
  };

  return { checkForStudent };
}
