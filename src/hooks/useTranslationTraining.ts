import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TranslationDocumentType {
  id: string;
  code: string;
  name_uz: string;
  name_ru: string | null;
  name_en: string | null;
  name_ko: string | null;
  description_uz: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TranslationTemplate {
  id: string;
  document_type_id: string;
  original_file_path: string;
  translated_file_path: string;
  original_text: string | null;
  translated_text: string | null;
  notes: string | null;
  uploaded_by: string;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  document_type?: TranslationDocumentType;
}

export interface TranslationRequirement {
  id: string;
  document_type_id: string;
  required_document_code: string;
  required_document_name_uz: string;
  required_document_name_ru: string | null;
  required_document_name_en: string | null;
  is_student_document: boolean;
  is_parent_document: boolean;
  is_required: boolean;
  sort_order: number;
}

export function useTranslationTraining() {
  const { user } = useAuth();
  const [documentTypes, setDocumentTypes] = useState<TranslationDocumentType[]>([]);
  const [templates, setTemplates] = useState<TranslationTemplate[]>([]);
  const [requirements, setRequirements] = useState<TranslationRequirement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocumentTypes = async () => {
    const { data, error } = await supabase
      .from('translation_document_types')
      .select('*')
      .eq('is_active', true)
      .order('name_uz');

    if (!error && data) {
      setDocumentTypes(data);
    }
    return data || [];
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('translation_templates')
      .select('*, document_type:translation_document_types(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTemplates(data as TranslationTemplate[]);
    }
    return data || [];
  };

  const fetchRequirements = async () => {
    const { data, error } = await supabase
      .from('translation_requirements')
      .select('*')
      .order('sort_order');

    if (!error && data) {
      setRequirements(data);
    }
    return data || [];
  };

  const uploadTrainingPair = async (
    documentTypeId: string,
    originalFile: File,
    translatedFile: File,
    supportingFiles: File[] = [],
    notes?: string,
    originalText?: string,
    translatedText?: string
  ) => {
    if (!user) {
      toast.error('You must be logged in');
      return { error: 'Not authenticated' };
    }

    try {
      // Upload original file
      const originalPath = `training/${documentTypeId}/original_${Date.now()}_${originalFile.name}`;
      const { error: origError } = await supabase.storage
        .from('translation-documents')
        .upload(originalPath, originalFile);

      if (origError) throw origError;

      // Upload translated file
      const translatedPath = `training/${documentTypeId}/translated_${Date.now()}_${translatedFile.name}`;
      const { error: transError } = await supabase.storage
        .from('translation-documents')
        .upload(translatedPath, translatedFile);

      if (transError) throw transError;

      // Upload supporting files (passports, ID cards, etc.)
      const supportingPaths: string[] = [];
      for (const file of supportingFiles) {
        const supportPath = `training/${documentTypeId}/supporting_${Date.now()}_${file.name}`;
        const { error } = await supabase.storage
          .from('translation-documents')
          .upload(supportPath, file);
        if (!error) {
          supportingPaths.push(supportPath);
        }
      }

      // Create template record with supporting documents and text content
      const { error: dbError } = await supabase
        .from('translation_templates')
        .insert({
          document_type_id: documentTypeId,
          original_file_path: originalPath,
          translated_file_path: translatedPath,
          original_text: originalText || null,
          translated_text: translatedText || null,
          notes: supportingPaths.length > 0 
            ? `${notes || ''}\n\nQo'shimcha hujjatlar: ${supportingPaths.length} ta`
            : notes,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

      toast.success("Training pair uploaded successfully");
      await fetchTemplates();
      return { error: null };
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload training pair');
      return { error };
    }
  };

  const updateTemplateText = async (
    templateId: string,
    originalText: string,
    translatedText: string
  ) => {
    const { error } = await supabase
      .from('translation_templates')
      .update({
        original_text: originalText,
        translated_text: translatedText,
      })
      .eq('id', templateId);

    if (error) {
      toast.error('Failed to update template text');
      return { error };
    }

    toast.success('Template text updated');
    await fetchTemplates();
    return { error: null };
  };

  const approveTemplate = async (templateId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('translation_templates')
      .update({
        is_approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', templateId);

    if (error) {
      toast.error('Failed to approve template');
      return { error };
    }

    toast.success('Template approved');
    await fetchTemplates();
    return { error: null };
  };

  const deleteTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return { error: 'Template not found' };

    // Delete files from storage
    await supabase.storage
      .from('translation-documents')
      .remove([template.original_file_path, template.translated_file_path]);

    // Delete record
    const { error } = await supabase
      .from('translation_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      toast.error('Failed to delete template');
      return { error };
    }

    toast.success('Template deleted');
    await fetchTemplates();
    return { error: null };
  };

  const addRequirement = async (
    documentTypeId: string,
    code: string,
    nameUz: string,
    nameRu?: string,
    nameEn?: string,
    isStudentDoc: boolean = true,
    isParentDoc: boolean = false
  ) => {
    const { error } = await supabase
      .from('translation_requirements')
      .insert({
        document_type_id: documentTypeId,
        required_document_code: code,
        required_document_name_uz: nameUz,
        required_document_name_ru: nameRu || null,
        required_document_name_en: nameEn || null,
        is_student_document: isStudentDoc,
        is_parent_document: isParentDoc,
        sort_order: requirements.filter(r => r.document_type_id === documentTypeId).length + 1,
      });

    if (error) {
      toast.error('Failed to add requirement');
      return { error };
    }

    toast.success('Requirement added');
    await fetchRequirements();
    return { error: null };
  };

  const deleteRequirement = async (requirementId: string) => {
    const { error } = await supabase
      .from('translation_requirements')
      .delete()
      .eq('id', requirementId);

    if (error) {
      toast.error('Failed to delete requirement');
      return { error };
    }

    toast.success('Requirement deleted');
    await fetchRequirements();
    return { error: null };
  };

  const getFileUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from('translation-documents')
      .createSignedUrl(path, 3600);
    return data?.signedUrl;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDocumentTypes(),
        fetchTemplates(),
        fetchRequirements(),
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  return {
    documentTypes,
    templates,
    requirements,
    loading,
    uploadTrainingPair,
    updateTemplateText,
    approveTemplate,
    deleteTemplate,
    addRequirement,
    deleteRequirement,
    getFileUrl,
    refetch: () => Promise.all([fetchDocumentTypes(), fetchTemplates(), fetchRequirements()]),
  };
}
