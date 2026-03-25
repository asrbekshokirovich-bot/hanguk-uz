import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle,
  Eye,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  FileCheck,
  Info,
  Loader2,
  ShieldCheck,
  ShieldX,
  Camera,
  Trash2,
  Languages
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { checkAutoTranslation } from '@/hooks/useAutoTranslation';

interface DocumentUploadProps {
  documents: Tables<'documents'>[];
  applicationId?: string;
  onUploadComplete?: () => void;
  enableAutoTranslation?: boolean;
  showTranslations?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  isCorrectType: boolean;
  isProperScan: boolean;
  isGoodQuality: boolean;
  isComplete: boolean;
  issues: string[];
  suggestions: string[];
  confidence: number;
}

interface DocumentType {
  id: string;
  nameUz: string;
  nameEn: string;
  nameRu: string;
  required?: boolean;
  note?: { uz: string; en: string; ru: string };
}

// Required documents at contract signing
const requiredDocuments: DocumentType[] = [
  { 
    id: 'applicant_id_card',
    nameUz: "Topshiruvchining ID karta (pasport) nusxasi",
    nameEn: "Applicant's ID card (passport) copy",
    nameRu: "Копия ID-карты (паспорта) заявителя",
    required: true
  },
  { 
    id: 'foreign_passport',
    nameUz: "Topshiruvchining zagran pasporti nusxasi",
    nameEn: "Applicant's foreign passport copy",
    nameRu: "Копия загранпаспорта заявителя",
    required: true
  },
  { 
    id: 'father_id_card',
    nameUz: "Otaning ID karta (pasport) nusxasi",
    nameEn: "Father's ID card (passport) copy",
    nameRu: "Копия ID-карты (паспорта) отца",
    required: true
  },
  { 
    id: 'mother_id_card',
    nameUz: "Onaning ID karta (pasport) nusxasi",
    nameEn: "Mother's ID card (passport) copy",
    nameRu: "Копия ID-карты (паспорта) матери",
    required: true
  },
  { 
    id: 'birth_certificate',
    nameUz: "Tug'ilganlik haqida guvohnoma nusxasi (Metrka)",
    nameEn: "Birth certificate copy",
    nameRu: "Копия свидетельства о рождении (Метрика)",
    required: true
  },
  { 
    id: 'language_certificate',
    nameUz: "Til sertifikat nusxasi (kamida IELTS 5.5 yoki TOPIK 2)",
    nameEn: "Language certificate copy (min. IELTS 5.5 or TOPIK 2)",
    nameRu: "Копия языкового сертификата (мин. IELTS 5.5 или TOPIK 2)",
    required: true
  },
  { 
    id: 'photo',
    nameUz: "Rasm (3.5x4.5)",
    nameEn: "Photo (3.5x4.5 cm)",
    nameRu: "Фото (3.5x4.5 см)",
    required: true
  },
  { 
    id: 'diploma',
    nameUz: "Diplom yoki attestat nusxasi",
    nameEn: "Diploma or certificate copy",
    nameRu: "Копия диплома или аттестата",
    required: true
  },
  { 
    id: 'marriage_certificate',
    nameUz: "Nikoh guvohnomasi nusxasi",
    nameEn: "Marriage certificate copy",
    nameRu: "Копия свидетельства о браке",
    required: true
  },
];

// Translation slots — one for each of the 13 required documents
const translationSlots: Record<string, DocumentType> = {
  applicant_id_card: { id: 'applicant_id_card_translation', nameUz: "ID karta tarjimasi", nameEn: "ID card translation", nameRu: "Перевод ID-карты" },
  foreign_passport: { id: 'foreign_passport_translation', nameUz: "Zagran pasport tarjimasi", nameEn: "Foreign passport translation", nameRu: "Перевод загранпаспорта" },
  father_id_card: { id: 'father_id_card_translation', nameUz: "Ota ID karta tarjimasi", nameEn: "Father's ID card translation", nameRu: "Перевод ID-карты отца" },
  
  mother_id_card: { id: 'mother_id_card_translation', nameUz: "Ona ID karta tarjimasi", nameEn: "Mother's ID card translation", nameRu: "Перевод ID-карты матери" },
  
  birth_certificate: { id: 'birth_certificate_translation', nameUz: "Tug'ilganlik guvohnomasi tarjimasi", nameEn: "Birth certificate translation", nameRu: "Перевод свидетельства о рождении" },
  language_certificate: { id: 'language_certificate_translation', nameUz: "Til sertifikat tarjimasi", nameEn: "Language certificate translation", nameRu: "Перевод языкового сертификата" },
  photo: { id: 'photo_translation', nameUz: "Rasm tarjimasi", nameEn: "Photo translation", nameRu: "Перевод фото" },
  diploma: { id: 'diploma_translation', nameUz: "Diplom tarjimasi", nameEn: "Diploma translation", nameRu: "Перевод диплома" },
  marriage_certificate: { id: 'marriage_certificate_translation', nameUz: "Nikoh guvohnomasi tarjimasi", nameEn: "Marriage certificate translation", nameRu: "Перевод свидетельства о браке" },
};

// Translation slots for additional/conditional documents
const conditionalTranslationSlots: Record<string, DocumentType> = {
  bank_statement: {
    id: 'bank_statement_translation',
    nameUz: "Bank ma'lumotnomasi tarjimasi",
    nameEn: "Bank statement translation",
    nameRu: "Перевод банковской справки",
  },
  recommendation: {
    id: 'recommendation_translation',
    nameUz: "Tavsiyanoma tarjimasi",
    nameEn: "Recommendation letter translation",
    nameRu: "Перевод рекомендательного письма",
  },
  autobiography: {
    id: 'autobiography_translation',
    nameUz: "Avtobiografiya tarjimasi",
    nameEn: "Autobiography translation",
    nameRu: "Перевод avtobiografiyasi",
  },
  father_foreign_passport: { id: 'father_foreign_passport_translation', nameUz: "Ota zagran pasport tarjimasi", nameEn: "Father's foreign passport translation", nameRu: "Перевод загранпаспорта отца" },
  mother_foreign_passport: { id: 'mother_foreign_passport_translation', nameUz: "Ona zagran pasport tarjimasi", nameEn: "Mother's foreign passport translation", nameRu: "Перевод загранпаспорта матери" },
  death_certificate: { id: 'death_certificate_translation', nameUz: "O'lim guvohnomasi tarjimasi", nameEn: "Death certificate translation", nameRu: "Перевод свидетельства о смерти" },
  diploma_supplement: { id: 'diploma_supplement_translation', nameUz: "Diplom ilovasi tarjimasi", nameEn: "Diploma supplement translation", nameRu: "Перевод приложения к диплому" },
};

// Documents that may be required later (during university application)
const conditionalDocuments: DocumentType[] = [
  { 
    id: 'bank_statement',
    nameUz: "Bank ma'lumotnomasi asl nusxasi",
    nameEn: "Original bank statement",
    nameRu: "Оригинал банковской справки",
    note: { uz: "Universitetga hujjat topshirish bosqichida", en: "During university application", ru: "На этапе подачи документов в университет" }
  },
  { 
    id: 'recommendation',
    nameUz: "Tavsiyanoma (Magistratura va PhD uchun)",
    nameEn: "Recommendation letter (for Master's and PhD)",
    nameRu: "Рекомендательное письмо (для магистратуры и PhD)",
    note: { uz: "Magistratura va PhD uchun", en: "For Master's and PhD", ru: "Для магистратуры и PhD" }
  },
  { 
    id: 'autobiography',
    nameUz: "Avtobiografiya va o'qish reja (insho)",
    nameEn: "Autobiography and study plan (essay)",
    nameRu: "Автобиография и план обучения (эссе)",
    note: { uz: "So'ralsa topshirish kerak", en: "If requested", ru: "При необходимости" }
  },
  { 
    id: 'father_foreign_passport',
    nameUz: "Otaning zagran pasporti nusxasi",
    nameEn: "Father's foreign passport copy",
    nameRu: "Копия загранпаспорта отца",
    note: { uz: "Agar mavjud bo'lsa", en: "If available", ru: "При наличии" }
  },
  { 
    id: 'mother_foreign_passport',
    nameUz: "Onaning zagran pasporti nusxasi",
    nameEn: "Mother's foreign passport copy",
    nameRu: "Копия загранпаспорта матери",
    note: { uz: "Agar mavjud bo'lsa", en: "If available", ru: "При наличии" }
  },
  { 
    id: 'death_certificate',
    nameUz: "O'lim guvohnomasi nusxasi",
    nameEn: "Death certificate copy",
    nameRu: "Копия свидетельства о смерти",
    note: { uz: "Agar tegishli bo'lsa", en: "If applicable", ru: "При необходимости" }
  },
  { 
    id: 'diploma_supplement',
    nameUz: "Diplom ilovasi nusxasi",
    nameEn: "Diploma supplement copy",
    nameRu: "Копия приложения к диплому",
    note: { uz: "Agar mavjud bo'lsa", en: "If available", ru: "При наличии" }
  },
];

export function DocumentUpload({ 
  documents, 
  applicationId, 
  onUploadComplete,
  enableAutoTranslation = true,
  showTranslations = false 
}: DocumentUploadProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  // uploadProgress state removed (Bug #8 fix) — spinner is the visual indicator now
  const [autoTranslationTriggered, setAutoTranslationTriggered] = useState<string[]>([]);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // AI Validation / upload dialog state
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Preview state for already-uploaded docs
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocName, setPreviewDocName] = useState<string>('');
  const [previewDocIsImage, setPreviewDocIsImage] = useState(false);
  

  // Detect current language from i18n directly (Bug #10 fix - no more translation hack)
  const currentLang = i18n.language.split('-')[0] as 'uz' | 'ru' | 'en';

  const getDocumentName = (doc: DocumentType, lang: string) => {
    if (lang === 'ru') return doc.nameRu;
    if (lang === 'en') return doc.nameEn;
    return doc.nameUz;
  };

  const getConditionalNote = (doc: DocumentType, lang: string) => {
    if (!doc.note) return '';
    if (lang === 'ru') return doc.note.ru;
    if (lang === 'en') return doc.note.en;
    return doc.note.uz;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const validateDocument = async (file: File, docType: DocumentType): Promise<ValidationResult | null> => {
    try {
      const base64 = await fileToBase64(file);
      
      const { data, error } = await supabase.functions.invoke('validate-document', {
        body: {
          imageBase64: base64,
          expectedDocumentType: docType.id,
          language: currentLang
        }
      });

      if (error) throw error;
      return data as ValidationResult;
    } catch (error) {
      console.error('Validation error:', error);
      return null;
    }
  };

  const uploadFile = async (file: File, docType?: DocumentType) => {
    if (!user) {
      toast({ title: t('errors.unauthorized'), variant: 'destructive' });
      return;
    }

    setUploading(true);
    let uploadedFileName: string | null = null;

    try {
      // Bug #4 Fix: If a document already exists for this slot, delete it first
      // to avoid unique constraint conflicts (documents_student_doc_type_unique)
      if (docType) {
        const existing = getUploadedDocument(docType.id);
        if (existing) {
          // Delete old storage file (non-fatal if it fails)
          await supabase.storage.from('student-documents').remove([existing.file_path]);
          // Delete old DB record
          const { error: deleteDbError } = await supabase
            .from('documents')
            .delete()
            .eq('id', existing.id);
          if (deleteDbError) {
            console.warn('Could not delete old document record:', deleteDbError);
          }
        }
      }

      const fileExt = file.name.split('.').pop();
      const docPrefix = docType ? `${docType.id}-` : '';
      const fileName = `${user.id}/${docPrefix}${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      // Track uploaded filename for cleanup on DB failure (Bug #4 fix)
      uploadedFileName = fileName;

      const docName = docType ? `[${docType.id}] ${file.name}` : file.name;
      const { error: dbError } = await supabase.from('documents').insert({
        student_id: user.id,
        application_id: applicationId || null,
        name: docName,
        file_path: fileName,
        file_type: file.type,
        file_size: file.size,
        status: 'uploaded',
      });

      if (dbError) throw dbError;

      // DB insert succeeded — no cleanup needed
      uploadedFileName = null;

      toast({
        title: t('common.success'),
        description: `${file.name} ${currentLang === 'ru' ? 'загружен' : currentLang === 'en' ? 'uploaded' : 'yuklandi'}`,
      });

      onUploadComplete?.();

      if (enableAutoTranslation && user) {
        setTimeout(async () => {
          const { triggered } = await checkAutoTranslation(user.id, user.id);
          if (triggered.length > 0) {
            setAutoTranslationTriggered(prev => [...prev, ...triggered]);
          }
        }, 1000);
      }
    } catch (error: any) {
      // Bug #4 fix: If storage upload succeeded but DB insert failed, remove the orphaned file
      if (uploadedFileName) {
        await supabase.storage.from('student-documents').remove([uploadedFileName]);
      }
      console.error('Upload error:', error);
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // Open upload dialog for a specific doc slot
  const handleDocumentClick = (doc: DocumentType) => {
    setSelectedDocType(doc);
    setValidationResult(null);
    setPreviewUrl(null);
    setPendingFile(null);
    setUploadDialogOpen(true);
  };

  // Preview an already-uploaded document
  const handlePreviewUploadedDoc = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    const uploadedDoc = getUploadedDocument(docId);
    if (!uploadedDoc) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-proxy`
        + `?path=${encodeURIComponent(uploadedDoc.file_path)}&bucket=student-documents`;

      const resp = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (!resp.ok) throw new Error(`Failed to load document: ${resp.statusText}`);

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);

      const isImage = uploadedDoc.file_type?.startsWith('image/') ?? false;

      if (isImage) {
        setPreviewDocUrl(blobUrl);
        setPreviewDocName(uploadedDoc.name);
        setPreviewDocIsImage(true);
        setPreviewDialogOpen(true);
      } else {
        // Force download — never blocked by Chrome, extensions, or popup blockers
        const fileName = uploadedDoc.name.replace(/^\[.*?\]\s*/, '') || 'document.pdf';
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    const uploadedDoc = getUploadedDocument(docId);
    if (!uploadedDoc) return;

    setDeletingDocId(docId);
    try {
      await supabase.storage.from('student-documents').remove([uploadedDoc.file_path]);
      const { error } = await supabase.from('documents').delete().eq('id', uploadedDoc.id);
      if (error) throw error;

      toast({
        title: currentLang === 'uz' ? "O'chirildi" : currentLang === 'ru' ? 'Удалён' : 'Deleted',
        description: currentLang === 'uz' ? "Hujjat o'chirildi" : currentLang === 'ru' ? 'Документ удалён' : 'Document removed',
      });

      onUploadComplete?.();
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } finally {
      setDeletingDocId(null);
      setDeleteConfirmId(null);
    }
  };

  const handleDialogFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDocType) return;

    // For PDFs, don't create an image blob URL — show PDF placeholder
    if (file.type === 'application/pdf') {
      setPreviewUrl('__pdf__');
      setPendingFile(file);
      // Skip AI validation for PDFs — Gemini vision cannot process PDF binary data.
      // Set a synthetic valid result so the student can proceed directly to upload.
      setValidating(false);
      setValidationResult({
        isValid: true,
        isCorrectType: true,
        isProperScan: true,
        isGoodQuality: true,
        isComplete: true,
        issues: [],
        suggestions: [],
        confidence: 100,
      });
      return;
    }

    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    setPendingFile(file);

    setValidating(true);
    setValidationResult(null);

    const result = await validateDocument(file, selectedDocType);
    setValidationResult(result);
    setValidating(false);
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile || !selectedDocType) return;
    
    await uploadFile(pendingFile, selectedDocType);
    
    if (previewUrl && previewUrl !== '__pdf__') URL.revokeObjectURL(previewUrl);
    setUploadDialogOpen(false);
    setSelectedDocType(null);
    setValidationResult(null);
    setPreviewUrl(null);
    setPendingFile(null);
  };

  const handleCancelUpload = () => {
    if (previewUrl && previewUrl !== '__pdf__') URL.revokeObjectURL(previewUrl);
    setUploadDialogOpen(false);
    setSelectedDocType(null);
    setValidationResult(null);
    setPreviewUrl(null);
    setPendingFile(null);
  };

  const handleRetryUpload = () => {
    if (previewUrl && previewUrl !== '__pdf__') URL.revokeObjectURL(previewUrl);
    setValidationResult(null);
    setPreviewUrl(null);
    setPendingFile(null);
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Legacy alias map — handles documents uploaded before slot renames
  // e.g. applicant_passport was renamed to foreign_passport
  const docIdAliases: Record<string, string> = {
    'applicant_passport': 'foreign_passport',
    'parent_passport': 'father_id_card',
  };

  // Robust slot matcher — same logic as CRM StudentDetail.matchesDocType
  // 1) Check for bracket tag [docId] in name
  // 2) Check filename starts with docId- or docId. (exact prefix, not substring)
  // 3) Check legacy aliases in both directions
  const matchesDocSlot = (d: Tables<'documents'>, docId: string): boolean => {
    const checkId = (id: string): boolean => {
      const nameLower = d.name.toLowerCase();
      const parts = (d.file_path || '').split('/');
      const filename = parts[parts.length - 1].toLowerCase();
      const normalId = id.toLowerCase();
      return (
        nameLower.includes(`[${normalId}]`) ||
        filename.startsWith(`${normalId}-`) ||
        filename.startsWith(`${normalId}.`)
      );
    };

    // Direct match
    if (checkId(docId)) return true;

    // Check if this docId has an alias (e.g. foreign_passport → also check applicant_passport)
    for (const [alias, target] of Object.entries(docIdAliases)) {
      if (target === docId && checkId(alias)) return true;
      if (alias === docId && checkId(target)) return true;
    }

    return false;
  };

  const isDocumentUploaded = (docId: string) => {
    return documents.some(d => matchesDocSlot(d, docId));
  };

  const isDocumentApproved = (docId: string) => {
    return documents.some(d => matchesDocSlot(d, docId) && d.status === 'approved');
  };

  // Returns the most recently uploaded document for the slot
  const getUploadedDocument = (docId: string) => {
    const matches = documents.filter(d => matchesDocSlot(d, docId));
    if (matches.length === 0) return undefined;
    return matches.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  };

  const texts = {
    uploadTitle: { uz: "Hujjat yuklash", en: "Upload Document", ru: "Загрузка документа" },
    selectFile: { uz: "Fayl tanlang", en: "Select file", ru: "Выберите файл" },
    analyzing: { uz: "AI tahlil qilmoqda...", en: "AI analyzing...", ru: "AI анализирует..." },
    approved: { uz: "Hujjat qabul qilindi", en: "Document approved", ru: "Документ принят" },
    rejected: { uz: "Hujjat rad etildi", en: "Document rejected", ru: "Документ отклонён" },
    issues: { uz: "Muammolar", en: "Issues", ru: "Проблемы" },
    suggestions: { uz: "Tavsiyalar", en: "Suggestions", ru: "Рекомендации" },
    uploadAnyway: { uz: "Baribir yuklash", en: "Upload anyway", ru: "Загрузить всё равно" },
    tryAgain: { uz: "Qayta urinish", en: "Try again", ru: "Попробовать снова" },
    confirmUpload: { uz: "Yuklashni tasdiqlash", en: "Confirm upload", ru: "Подтвердить загрузку" },
    cancel: { uz: "Bekor qilish", en: "Cancel", ru: "Отмена" },
    scanRequired: { uz: "Faqat skanerlangan hujjatlar qabul qilinadi", en: "Only scanned documents are accepted", ru: "Принимаются только отсканированные документы" },
    clickToUpload: { uz: "Yuklash uchun bosing", en: "Click to upload", ru: "Нажмите для загрузки" },
    confidence: { uz: "Ishonch darajasi", en: "Confidence", ru: "Уверенность" },
    upload: { uz: "Yuklash", en: "Upload", ru: "Загрузить" },
    preview: { uz: "Ko'rish", en: "Preview", ru: "Просмотр" },
    pending: { uz: "Kutilmoqda", en: "Pending review", ru: "На проверке" },
    uploadedLabel: { uz: "Yuklandi", en: "Uploaded", ru: "Загружен" },
    approvedLabel: { uz: "Qabul qilindi", en: "Approved", ru: "Принят" },
  };

  const getText = (key: keyof typeof texts) => texts[key][currentLang as 'uz' | 'en' | 'ru'];

  const renderTranslationSlot = (translationDoc: DocumentType) => {
    return (
      <div key={translationDoc.id} className="ml-6 pl-3 border-l-2 border-dashed border-muted-foreground/30">
        <div className="flex items-center gap-1 mb-1 mt-1">
          <Languages className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
            {currentLang === 'ru' ? 'Перевод' : currentLang === 'en' ? 'Translation' : 'Tarjima'}
          </span>
        </div>
        {renderDocumentSlot(translationDoc, 0, false)}
      </div>
    );
  };

  const renderDocumentSlot = (doc: DocumentType, index: number, isConditional = false) => {
    const isUploaded = isDocumentUploaded(doc.id);
    const isApproved = isDocumentApproved(doc.id);

    return (
      <div
        key={doc.id}
        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
          isApproved
            ? 'bg-success/10 border-success/30'
            : isUploaded
            ? 'bg-primary/5 border-primary/30'
            : 'bg-muted/30 border-border'
        }`}
      >
        {/* Index / status icon */}
        <div className="flex-shrink-0">
          {isApproved ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : isUploaded ? (
            <CheckCircle className="h-5 w-5 text-primary" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground">{index + 1}</span>
            </div>
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isApproved ? 'text-success' : isUploaded ? 'text-foreground' : 'text-foreground'}`}>
            {getDocumentName(doc, currentLang)}
          </p>
          {isConditional && doc.note && (
            <p className="text-xs text-muted-foreground mt-0.5">{getConditionalNote(doc, currentLang)}</p>
          )}
          {isApproved && (
            <p className="text-xs text-success mt-0.5">{getText('approvedLabel')}</p>
          )}
          {isUploaded && !isApproved && (
            <p className="text-xs text-primary mt-0.5">{getText('pending')}</p>
          )}
        </div>

        {/* Action button */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {isUploaded || isApproved ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-primary hover:text-primary"
                onClick={(e) => handlePreviewUploadedDoc(e, doc.id)}
                title={getText('preview')}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {/* Bug #6 Fix: Allow students to replace already-uploaded documents */}
              {!isApproved && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => handleDocumentClick(doc)}
                    title={currentLang === 'ru' ? 'Заменить' : currentLang === 'en' ? 'Replace' : 'Almashtirish'}
                    disabled={uploading || deleteConfirmId === doc.id}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  {deleteConfirmId === doc.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {currentLang === 'uz' ? "O'chirilsinmi?" : currentLang === 'ru' ? 'Удалить?' : 'Delete?'}
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={deletingDocId === doc.id}
                      >
                        {deletingDocId === doc.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : (currentLang === 'uz' ? 'Ha' : currentLang === 'ru' ? 'Да' : 'Yes')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        {currentLang === 'uz' ? 'Bekor' : currentLang === 'ru' ? 'Отмена' : 'Cancel'}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteConfirmId(doc.id)}
                      title={currentLang === 'uz' ? "O'chirish" : currentLang === 'ru' ? 'Удалить' : 'Delete'}
                      disabled={uploading}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => handleDocumentClick(doc)}
              disabled={uploading}
            >
              <Upload className="h-3 w-3" />
              {getText('upload')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Upload Dialog with AI Validation */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {getText('uploadTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedDocType && getDocumentName(selectedDocType, currentLang)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!previewUrl && (
              <div className="space-y-3">
                <div 
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">{getText('selectFile')}</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleDialogFileSelect}
                />
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {getText('scanRequired')}
                  </p>
                </div>
              </div>
            )}

            {previewUrl && (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border bg-muted/30">
                  {previewUrl === '__pdf__' ? (
                    <div className="w-full h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <FileText className="h-12 w-12 opacity-60" />
                      <p className="text-sm font-medium">PDF document selected</p>
                      <p className="text-xs text-muted-foreground/70">Staff will review this document</p>
                    </div>
                  ) : (
                    <img 
                      src={previewUrl} 
                      alt="Document preview" 
                      className="w-full h-48 object-contain"
                    />
                  )}
                  {validating && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">{getText('analyzing')}</p>
                      </div>
                    </div>
                  )}
                </div>

                {validationResult && (
                  <div className={`p-4 rounded-lg border ${
                    validationResult.isValid 
                      ? 'bg-success/10 border-success/30' 
                      : 'bg-destructive/10 border-destructive/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      {validationResult.isValid ? (
                        <>
                          <ShieldCheck className="h-5 w-5 text-success" />
                          <span className="font-medium text-success">{getText('approved')}</span>
                        </>
                      ) : (
                        <>
                          <ShieldX className="h-5 w-5 text-destructive" />
                          <span className="font-medium text-destructive">{getText('rejected')}</span>
                        </>
                      )}
                      <Badge variant="outline" className="ml-auto">
                        {getText('confidence')}: {validationResult.confidence}%
                      </Badge>
                    </div>

                    {validationResult.issues.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium mb-1 text-muted-foreground">{getText('issues')}:</p>
                        <ul className="text-sm space-y-1">
                          {validationResult.issues.map((issue, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {validationResult.suggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1 text-muted-foreground">{getText('suggestions')}:</p>
                        <ul className="text-sm space-y-1">
                          {validationResult.suggestions.map((suggestion, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {validationResult && (
                  <div className="flex gap-2">
                    {validationResult.isValid ? (
                      <>
                        <Button variant="outline" onClick={handleCancelUpload} className="flex-1">
                          {getText('cancel')}
                        </Button>
                        <Button onClick={handleConfirmUpload} disabled={uploading} className="flex-1">
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : getText('confirmUpload')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={handleRetryUpload} className="flex-1">
                          {getText('tryAgain')}
                        </Button>
                        <Button variant="secondary" onClick={handleConfirmUpload} disabled={uploading} className="flex-1">
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : getText('uploadAnyway')}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog for uploaded images */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {previewDocName}
            </DialogTitle>
          </DialogHeader>
          {previewDocIsImage && previewDocUrl && (
            <div className="rounded-lg overflow-hidden border">
              <img src={previewDocUrl} alt={previewDocName} className="w-full object-contain max-h-[60vh]" />
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Auto-translation notification */}
      {autoTranslationTriggered.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">
                Avtomatik tarjima boshlandi: {autoTranslationTriggered.join(', ')}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress — indeterminate spinner instead of fake percentage */}
      {uploading && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
              <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Required Documents Checklist */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileCheck className="h-5 w-5 text-primary" />
            {currentLang === 'ru' ? 'Обязательные документы' : currentLang === 'en' ? 'Required Documents' : "Shartnoma tuzish vaqtida kerakli hujjatlar"}
          </CardTitle>
          <CardDescription>
            {currentLang === 'ru' ? '2026 Весенний семестр' : currentLang === 'en' ? '2026 Spring Semester' : "2026-yil bahorgi semestr"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {requiredDocuments.every(doc => isDocumentApproved(doc.id)) && (
            <div className="text-center py-4 text-success">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="font-medium">{currentLang === 'ru' ? 'Все документы приняты!' : currentLang === 'en' ? 'All documents accepted!' : 'Barcha hujjatlar qabul qilindi!'}</p>
            </div>
          )}
          {requiredDocuments.flatMap((doc, index) => {
            const rows: React.ReactNode[] = [renderDocumentSlot(doc, index, false)];
            if (showTranslations) {
              const translationDef = translationSlots[doc.id];
              if (translationDef) {
                rows.push(renderTranslationSlot(translationDef));
              }
            }
            return rows;
          })}
        </CardContent>
      </Card>

      {/* Conditional Documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-muted-foreground" />
            {currentLang === 'ru' ? 'Дополнительные документы' : currentLang === 'en' ? 'Additional Documents' : "So'ralsa topshirish kerak bo'lgan hujjatlar"}
          </CardTitle>
          <CardDescription>
            {currentLang === 'ru' ? 'Могут потребоваться на этапе подачи в университет' : currentLang === 'en' ? 'May be required during university application' : "Universitetga hujjat topshirish bosqichida talab qilinadi"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {conditionalDocuments.flatMap((doc, index) => {
            const rows: React.ReactNode[] = [renderDocumentSlot(doc, index, true)];
            if (showTranslations) {
              const translationDef = conditionalTranslationSlots[doc.id];
              if (translationDef) {
                rows.push(renderTranslationSlot(translationDef));
              }
            }
            return rows;
          })}
        </CardContent>
      </Card>

      {/* Important Note */}
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <p className="text-sm text-warning">
              {currentLang === 'ru' 
                ? 'В зависимости от университета или специальности могут потребоваться дополнительные документы.' 
                : currentLang === 'en' 
                ? 'Additional documents may be required depending on the university or field of study.'
                : "Topshiriladigan universitet yoki sohaga qarab qo'shimcha hujjatlar talab etilishi mumkin."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
