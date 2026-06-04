import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type {
  StructuredTranslation,
  TranslationFileInput,
  TranslationResult,
  VerifiedNames,
} from '@/types/translation';

interface RunTranslationArgs {
  documentTypeId: string;
  source: TranslationFileInput;
  supporting?: TranslationFileInput[];
  studentName?: string;
  verifiedNames?: VerifiedNames;
}

export function useDocumentTranslation() {
  const { user } = useAuth();
  const [translating, setTranslating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const runTranslation = async (args: RunTranslationArgs): Promise<TranslationResult | null> => {
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-document', {
        body: {
          documentTypeId: args.documentTypeId,
          source: args.source,
          supporting: args.supporting ?? [],
          studentName: args.studentName,
          verifiedNames: args.verifiedNames,
        },
      });
      if (error) { toast.error(error.message || 'Tarjima qilishda xatolik'); return null; }
      if (data?.error) { toast.error(data.error); return null; }
      return data as TranslationResult;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Tarjima qilishda xatolik');
      return null;
    } finally {
      setTranslating(false);
    }
  };

  const regenerateDocx = async (
    documentTypeId: string,
    structured: StructuredTranslation,
  ): Promise<TranslationResult | null> => {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-document', {
        body: { documentTypeId, regenerate: { structured } },
      });
      if (error) { toast.error(error.message || 'DOCX qayta yaratishda xatolik'); return null; }
      if (data?.error) { toast.error(data.error); return null; }
      return data as TranslationResult;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'DOCX qayta yaratishda xatolik');
      return null;
    } finally {
      setRegenerating(false);
    }
  };

  const createTranslationJob = async (
    studentId: string,
    documentTypeId: string,
    sourceFilePath: string,
    sourceDocumentId?: string,
    autoTriggered = false,
  ) => {
    if (!user) { toast.error('Tizimga kirishingiz kerak'); return null; }
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
    if (error) { console.error('Failed to create job:', error); toast.error("Tarjima so'rovi yaratilmadi"); return null; }
    return data;
  };

  const saveTranslationResult = async (jobId: string, result: TranslationResult, verifiedNames?: VerifiedNames) => {
    const { error } = await supabase
      .from('translation_jobs')
      .update({
        status: 'completed',
        output_docx_path: result.docxPath,
        structured_translation: result.structured as unknown as Record<string, unknown>,
        verified_names: (verifiedNames ?? result.structured.verifiedNames) as unknown as Record<string, unknown>,
        translated_text: result.plainText,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', jobId);
    if (error) { console.error('Failed to save translation result:', error); return { error }; }
    return { error: null };
  };

  const updateJobStatus = async (jobId: string, status: string, errorMessage?: string) => {
    const updates: Record<string, unknown> = { status };
    if (errorMessage) updates.error_message = errorMessage;
    const { error } = await supabase.from('translation_jobs').update(updates).eq('id', jobId);
    if (error) { console.error('Failed to update job:', error); return { error }; }
    return { error: null };
  };

  const deleteJob = async (jobId: string) => {
    const { error } = await supabase.from('translation_jobs').delete().eq('id', jobId);
    if (error) { toast.error("So'rovni o'chirib bo'lmadi"); return { error }; }
    toast.success("So'rov o'chirildi");
    return { error: null };
  };

  return {
    translating,
    regenerating,
    runTranslation,
    regenerateDocx,
    createTranslationJob,
    saveTranslationResult,
    updateJobStatus,
    deleteJob,
  };
}
