import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TranslationResult {
  translatedText: string;
  extractedText?: string;  // OCR'd text from image/PDF
  documentIdentification?: string;  // AI's identification of supporting documents
  documentType: {
    code: string;
    name: string;
    nameEn: string;
  };
  templatesUsed: number;
  wasOCR?: boolean;
  docxFilePath?: string;  // Path to generated Word document
}

interface PassportData {
  type: 'international' | 'local';
  firstName?: string;
  lastName?: string;
  middleName?: string;
  fullName?: string;
}

interface IdCardData {
  fullName: string;
}

interface TranslationJob {
  id: string;
  student_id: string;
  document_type_id: string;
  source_file_path: string;
  translated_file_path: string | null;
  translated_text: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useDocumentTranslation() {
  const { user } = useAuth();
  const [translating, setTranslating] = useState(false);
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Translate from text (manual paste)
  const translateText = async (
    documentTypeId: string,
    sourceText: string,
    studentName?: string,
    parentNames?: string,
    additionalContext?: string,
    passportData?: PassportData | PassportData[],
    idCardData?: IdCardData | IdCardData[]
  ): Promise<TranslationResult | null> => {
    setTranslating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('translate-document', {
        body: {
          documentTypeId,
          sourceText,
          studentName,
          parentNames,
          additionalContext,
          passportData,
          idCardData,
        },
      });

      if (error) {
        console.error('Translation error:', error);
        toast.error(error.message || 'Tarjima qilishda xatolik');
        return null;
      }

      if (data.error) {
        toast.error(data.error);
        return null;
      }

      toast.success('Tarjima muvaffaqiyatli bajarildi!');
      return data as TranslationResult;
    } catch (error: any) {
      console.error('Translation failed:', error);
      toast.error(error.message || 'Tarjima qilishda xatolik');
      return null;
    } finally {
      setTranslating(false);
    }
  };

  // OCR + Translate from file (scanned PDF or image)
  const translateFromFile = async (
    documentTypeId: string,
    sourceFilePath: string,
    supportingFilePaths?: string[],
    studentName?: string,
    parentNames?: string,
    additionalContext?: string
  ): Promise<TranslationResult | null> => {
    setTranslating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('translate-document', {
        body: {
          documentTypeId,
          sourceFilePath,
          supportingFilePaths,
          studentName,
          parentNames,
          additionalContext,
        },
      });

      if (error) {
        console.error('OCR Translation error:', error);
        toast.error(error.message || 'OCR tarjima qilishda xatolik');
        return null;
      }

      if (data.error) {
        toast.error(data.error);
        return null;
      }

      toast.success(data.wasOCR 
        ? 'Hujjat o\'qildi va tarjima qilindi!' 
        : 'Tarjima muvaffaqiyatli bajarildi!'
      );
      return data as TranslationResult;
    } catch (error: any) {
      console.error('OCR Translation failed:', error);
      toast.error(error.message || 'OCR tarjima qilishda xatolik');
      return null;
    } finally {
      setTranslating(false);
    }
  };

  const createTranslationJob = async (
    studentId: string,
    documentTypeId: string,
    sourceFilePath: string,
    sourceDocumentId?: string,
    autoTriggered: boolean = false
  ) => {
    if (!user) {
      toast.error('Tizimga kirishingiz kerak');
      return null;
    }

    const { data, error } = await supabase
      .from('translation_jobs')
      .insert({
        student_id: studentId,
        document_type_id: documentTypeId,
        source_file_path: sourceFilePath,
        source_document_id: sourceDocumentId || null,
        auto_triggered: autoTriggered,
        requested_by: user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create job:', error);
      toast.error('Tarjima so\'rovi yaratilmadi');
      return null;
    }

    toast.success('Tarjima so\'rovi yaratildi');
    return data;
  };

  const updateJobStatus = async (
    jobId: string,
    status: string,
    translatedText?: string,
    translatedFilePath?: string,
    errorMessage?: string
  ) => {
    const updates: Partial<TranslationJob> = { status };
    
    if (translatedText) updates.translated_text = translatedText;
    if (translatedFilePath) updates.translated_file_path = translatedFilePath;
    if (errorMessage) updates.error_message = errorMessage;
    if (status === 'completed') {
      (updates as any).completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('translation_jobs')
      .update(updates)
      .eq('id', jobId);

    if (error) {
      console.error('Failed to update job:', error);
      return { error };
    }

    return { error: null };
  };

  const fetchJobs = async (studentId?: string) => {
    setLoadingJobs(true);
    
    let query = supabase
      .from('translation_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;

    if (!error && data) {
      setJobs(data);
    }
    
    setLoadingJobs(false);
    return data || [];
  };

  const deleteJob = async (jobId: string) => {
    const { error } = await supabase
      .from('translation_jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      toast.error('So\'rovni o\'chirib bo\'lmadi');
      return { error };
    }

    toast.success('So\'rov o\'chirildi');
    setJobs(prev => prev.filter(j => j.id !== jobId));
    return { error: null };
  };

  return {
    translateText,
    translateFromFile,
    translating,
    createTranslationJob,
    updateJobStatus,
    fetchJobs,
    deleteJob,
    jobs,
    loadingJobs,
  };
}
