import { useState, useEffect, useRef } from 'react';
import { ContractUpload } from './ContractUpload';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Phone,
  Check,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  MessageSquare,
  Pencil,
  Trash2,
  User,
  Calendar,
  MapPin,
  CreditCard,
  StickyNote,
  PhoneCall,
  Plus,
  Upload,
  Send,
  Download,
  KeyRound,
  Copy,
  Languages,
  Crown,
  Eye,
  FileText,
  Circle,
  Loader2,
  ImageIcon,
  File,
  RefreshCw,
  Lightbulb
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { applyIntake } from '@/lib/intakeQuery';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { EditStudentDialog } from './EditStudentDialog';
import { DeleteStudentDialog } from './DeleteStudentDialog';
import { AddPaymentDialog } from './AddPaymentDialog';
import { EditPaymentDialog } from './EditPaymentDialog';
import { SuggestUniversityDialog } from './SuggestUniversityDialog';
import AITranslationPage from '@/components/crm/pages/AITranslationPage';
import { ClickToCall } from '@/components/calls/ClickToCall';

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & {
    university?: Tables<'universities'>;
  })[];
  documents?: Tables<'documents'>[];
};

interface StudentDetailProps {
  student: StudentProfile;
  onBack: () => void;
  onUpdateApplicationStatus: (appId: string, status: string) => Promise<{ error: any }>;
  onUpdateDocumentStatus: (docId: string, status: string) => Promise<{ error: any }>;
  currentLang: string;
  isDocumentHandler: boolean;
  onRefresh: () => void;
}

// Status categories for the Status tab
const statusCategories = {
  documents: {
    title: 'Documents',
    steps: [
      { key: 'documents_collection', label: 'Documents Collected' },
      { key: 'documents_translation', label: 'Documents Translated' },
      { key: 'apostille', label: 'Apostille Ready' },
    ]
  },
  application: {
    title: 'Application',
    steps: [
      { key: 'application_submitted', label: 'Application Submitted' },
      { key: 'university_response', label: 'Admission Letter Received' },
    ]
  },
  visa: {
    title: 'Visa',
    steps: [
      { key: 'visa_documents', label: 'Visa Documents Ready' },
      { key: 'completed', label: 'Visa Applied' },
    ]
  }
};

const allStatusSteps = [
  'documents_collection',
  'documents_translation',
  'apostille',
  'application_submitted',
  'university_response',
  'visa_documents',
  'completed'
];

const paymentPlans = [
  { value: 'free', label: 'FREE', priceOneTime: '0 UZS', priceInstallment: '0 UZS', currency: 'UZS', isVIP: false },
  { value: 'standart', label: 'STANDART', priceOneTime: '5,000,000 UZS', priceInstallment: '6,000,000 UZS', currency: 'UZS', isVIP: false },
  { value: 'premium', label: 'PREMIUM', priceOneTime: '10,000,000 UZS', priceInstallment: '13,000,000 UZS', currency: 'UZS', isVIP: true, extra: 'VIP Access' },
  { value: 'no_risk', label: 'NO RISK', priceOneTime: '$5,000 USD', priceInstallment: '$5,500 USD', currency: 'USD', isVIP: true, extra: 'VIP Access + Flight & Apartment' },
];

interface StudentNote {
  id: string;
  content: string;
  created_by: string;
  created_at: string;
}

interface StudentComment {
  id: string;
  content: string;
  created_by: string;
  created_at: string;
  author?: { full_name: string | null };
}

interface PaymentRecord {
  id: string;
  amount: number;
  paid_amount: number;
  payment_type: string;
  status: string;
  currency: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  transactions?: {
    id: string;
    amount: number;
    gateway_fee: number;
    payment_method: string | null;
    created_at: string;
  }[];
}

interface CallRecord {
  id: string;
  phone_number: string;
  direction: string;
  duration: number | null;
  status: string;
  started_at: string;
  notes: string | null;
}

export function StudentDetail({
  student,
  onBack,
  onUpdateApplicationStatus,
  onUpdateDocumentStatus,
  currentLang,
  isDocumentHandler,
  onRefresh
}: StudentDetailProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeIntakeId } = useActiveIntake();
  const { toast } = useToast();


  const [updating, setUpdating] = useState<string | null>(null);
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [comments, setComments] = useState<StudentComment[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [documents, setDocuments] = useState<Tables<'documents'>[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newComment, setNewComment] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; type: string } | null>(null);

  const [slotUploadDocType, setSlotUploadDocType] = useState<string | null>(null);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const slotFileInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addPaymentDialogOpen, setAddPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [degreeSaving, setDegreeSaving] = useState<string | null>(null);
  const [suggestUniversityDialogOpen, setSuggestUniversityDialogOpen] = useState(false);
  const [existingSuggestedUniversityIds, setExistingSuggestedUniversityIds] = useState<string[]>([]);
  const [suggestedUniversitiesList, setSuggestedUniversitiesList] = useState<any[]>([]);
  const [removingSuggestion, setRemovingSuggestion] = useState<string | null>(null);
  const [processingApplication, setProcessingApplication] = useState<string | null>(null);

  const [savingPaymentPlan, setSavingPaymentPlan] = useState(false);
  const [savingPaymentMode, setSavingPaymentMode] = useState(false);

  const normalizedPaymentPlan = student.payment_plan?.toLowerCase() || undefined;
  const currentPaymentPlan = paymentPlans.some((p) => p.value === normalizedPaymentPlan)
    ? normalizedPaymentPlan
    : undefined;

  const currentPaymentMode = student.payment_mode || 'one_time';

  const handlePaymentPlanChange = async (value: string) => {
    if (savingPaymentPlan) return;
    setSavingPaymentPlan(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ payment_plan: value })
        .eq('id', student.id);

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: 'Payment plan updated',
      });
      onRefresh();
    } catch (err: any) {
      toast({
        title: t('common.error'),
        description: err?.message || 'Failed to update payment plan',
        variant: 'destructive',
      });
    } finally {
      setSavingPaymentPlan(false);
    }
  };

  const handlePaymentModeChange = async (value: string) => {
    if (savingPaymentMode) return;
    setSavingPaymentMode(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ payment_mode: value })
        .eq('id', student.id);

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: 'Payment mode updated',
      });
      onRefresh();
    } catch (err: any) {
      toast({
        title: t('common.error'),
        description: err?.message || 'Failed to update payment mode',
        variant: 'destructive',
      });
    } finally {
      setSavingPaymentMode(false);
    }
  };

  // Fetch related data
  useEffect(() => {
    fetchNotes();
    fetchComments();
    fetchPayments();
    fetchCalls();
    fetchDocuments();
    fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.user_id, activeIntakeId]);

  const fetchSuggestions = async () => {
    const { data } = await supabase
      .from('student_suggestions')
      .select('institution_id, university:institutions!applications_institution_id_fkey(id, name_en, name_ko, is_partner)')
      .eq('student_id', student.user_id);
    if (data) {
      setExistingSuggestedUniversityIds(data.map(d => d.institution_id));
      setSuggestedUniversitiesList(data);
    }
  };

  const handleRemoveSuggestion = async (universityId: string) => {
    setRemovingSuggestion(universityId);
    try {
      const { error } = await supabase
        .from('student_suggestions')
        .delete()
        .eq('student_id', student.user_id)
        .eq('institution_id', universityId);

      if (error) throw error;

      toast({ title: 'Suggestion removed successfully' });
      fetchSuggestions();
    } catch (err: any) {
      toast({
        title: 'Failed to remove suggestion',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRemovingSuggestion(null);
    }
  };

  const handleApproveApplication = async (appId: string) => {
    setProcessingApplication(appId);
    try {
      const { error } = await onUpdateApplicationStatus(appId, 'documents_collection');
      if (error) throw error;
      toast({ title: 'Application approved successfully' });
      onRefresh();
    } catch (err: any) {
      toast({
        title: 'Failed to approve application',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setProcessingApplication(null);
    }
  };

  const handleRejectApplication = async (appId: string) => {
    setProcessingApplication(appId);
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', appId);

      if (error) throw error;
      toast({ title: 'Application rejected and removed' });
      onRefresh();
    } catch (err: any) {
      toast({
        title: 'Failed to reject application',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setProcessingApplication(null);
    }
  };

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('student_notes')
      .select('*')
      .eq('student_id', student.user_id)
      .order('created_at', { ascending: false });
    if (data) setNotes(data);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('student_comments')
      .select('*')
      .eq('student_id', student.user_id)
      .order('created_at', { ascending: false });
    if (data) {
      // Fetch author names
      const commentsWithAuthors = await Promise.all(
        data.map(async (comment) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', comment.created_by)
            .maybeSingle();
          return { ...comment, author: profile };
        })
      );
      setComments(commentsWithAuthors);
    }
  };

  const fetchPayments = async () => {
    const { data } = await applyIntake(
      supabase
        .from('payments')
        .select('*, transactions:payment_transactions(*)')
        .eq('student_id', student.user_id),
      activeIntakeId,
    ).order('created_at', { ascending: false });
    if (data) setPayments(data as PaymentRecord[]);
  };

  const fetchCalls = async () => {
    const { data } = await supabase
      .from('calls')
      .select('*')
      .eq('student_id', student.user_id)
      .order('started_at', { ascending: false });
    if (data) setCalls(data);
  };

  const fetchDocuments = async () => {
    const { data } = await applyIntake(
      supabase.from('documents').select('*').eq('student_id', student.user_id),
      activeIntakeId,
    ).order('created_at', { ascending: false });
    if (data) setDocuments(data);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !user) return;

    const { error } = await supabase
      .from('student_notes')
      .insert({
        student_id: student.user_id,
        content: newNote.trim(),
        created_by: user.id,
      });

    if (!error) {
      setNewNote('');
      fetchNotes();
      toast({ title: 'Note added successfully' });
    } else {
      toast({ title: 'Failed to add note', variant: 'destructive' });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase
      .from('student_notes')
      .delete()
      .eq('id', noteId);

    if (!error) {
      fetchNotes();
      toast({ title: 'Note deleted' });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;

    const { error } = await supabase
      .from('student_comments')
      .insert({
        student_id: student.user_id,
        content: newComment.trim(),
        created_by: user.id,
      });

    if (!error) {
      setNewComment('');
      fetchComments();
      toast({ title: 'Comment posted successfully' });
    } else {
      toast({ title: 'Failed to post comment', variant: 'destructive' });
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    // Delete transactions first
    await supabase
      .from('payment_transactions')
      .delete()
      .eq('payment_id', paymentId);

    // Then delete payment
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);

    if (!error) {
      fetchPayments();
      toast({ title: 'Payment deleted' });
    } else {
      toast({ title: 'Failed to delete payment', variant: 'destructive' });
    }
  };

  // Set the applicant track (bachelor/master/gks) for ALL of this student's
  // applications at once — lets staff backfill the degree on students that were
  // created before the picker existed. Saves to applications.degree_level.
  const handleSetDegree = async (value: string) => {
    setDegreeSaving(value);
    const { data, error } = await supabase
      .from('applications')
      .update({ degree_level: value })
      .eq('student_id', student.user_id)
      .select('id');
    setDegreeSaving(null);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      return;
    }
    if (!data || data.length === 0) {
      toast({
        title: t('common.error'),
        description: "Bu talabaning arizasi yo'q — avval universitetga biriktiring.",
        variant: 'destructive',
      });
      return;
    }
    toast({ title: t('common.success', { defaultValue: 'Saqlandi' }) });
    onRefresh();
  };

  // Legacy handleFileUpload removed — only slot-based upload is used now

  const handleDownloadDocument = async (doc: Tables<'documents'>) => {
    const { data, error } = await supabase.storage
      .from('student-documents')
      .download(doc.file_path);

    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      toast({ title: 'Failed to download document', variant: 'destructive' });
    }
  };

  // Document type definitions (matching student portal)
  const crmDocumentTypes = [
    { id: 'applicant_id_card', nameUz: "Topshiruvchining ID karta (pasport) nusxasi", nameEn: "Applicant's ID card copy", nameRu: "Копия ID-карты заявителя", required: true },
    { id: 'foreign_passport', nameUz: "Topshiruvchining zagran pasporti nusxasi", nameEn: "Applicant's foreign passport copy", nameRu: "Копия загранпаспорта заявителя", required: true },
    { id: 'father_id_card', nameUz: "Otaning ID karta (pasport) nusxasi", nameEn: "Father's ID card copy", nameRu: "Копия ID-карты отца", required: true },
    { id: 'father_foreign_passport', nameUz: "Otaning zagran pasporti nusxasi", nameEn: "Father's foreign passport copy", nameRu: "Копия загранпаспорта отца", required: true },
    { id: 'mother_id_card', nameUz: "Onaning ID karta (pasport) nusxasi", nameEn: "Mother's ID card copy", nameRu: "Копия ID-карты матери", required: true },
    { id: 'mother_foreign_passport', nameUz: "Onaning zagran pasporti nusxasi", nameEn: "Mother's foreign passport copy", nameRu: "Копия загранпаспорта матери", required: true },
    { id: 'birth_certificate', nameUz: "Tug'ilganlik haqida guvohnoma (Metrka)", nameEn: "Birth certificate copy", nameRu: "Копия свидетельства о рождении", required: true },
    { id: 'language_certificate', nameUz: "Til sertifikat nusxasi", nameEn: "Language certificate copy", nameRu: "Копия языкового сертификата", required: true },
    { id: 'photo', nameUz: "Rasm (3.5x4.5)", nameEn: "Photo (3.5x4.5 cm)", nameRu: "Фото (3.5x4.5 см)", required: true },
    { id: 'diploma', nameUz: "Diplom yoki attestat nusxasi", nameEn: "Diploma or certificate copy", nameRu: "Копия диплома или аттестата", required: true },
    { id: 'marriage_certificate', nameUz: "Nikoh guvohnomasi nusxasi", nameEn: "Marriage certificate copy", nameRu: "Копия свидетельства о браке", required: true },
    { id: 'death_certificate', nameUz: "O'lim guvohnomasi nusxasi", nameEn: "Death certificate copy", nameRu: "Копия свидетельства о смерти", required: true },
    { id: 'diploma_supplement', nameUz: "Diplom ilovasi nusxasi", nameEn: "Diploma supplement copy", nameRu: "Копия приложения к диплому", required: true },
  ];

  const crmConditionalDocTypes = [
    { id: 'bank_statement', nameUz: "Bank ma'lumotnomasi asl nusxasi", nameEn: "Original bank statement", nameRu: "Оригинал банковской справки", required: false },
    { id: 'recommendation', nameUz: "Tavsiyanoma (Magistratura/PhD)", nameEn: "Recommendation letter", nameRu: "Рекомендательное письмо", required: false },
    { id: 'autobiography', nameUz: "Avtobiografiya va o'qish reja", nameEn: "Autobiography and study plan", nameRu: "Автобиография и план обучения", required: false },
  ];

  const crmTranslationSlots: Record<string, { id: string; nameUz: string; nameEn: string; nameRu: string; required: boolean }> = {
    applicant_id_card: { id: 'applicant_id_card_translation', nameUz: "ID karta tarjimasi", nameEn: "ID card translation", nameRu: "Перевод ID-карты заявителя", required: false },
    foreign_passport: { id: 'foreign_passport_translation', nameUz: "Zagranpasport tarjimasi", nameEn: "Foreign passport translation", nameRu: "Перевод загранпаспорта заявителя", required: false },
    father_id_card: { id: 'father_id_card_translation', nameUz: "Ota ID karta tarjimasi", nameEn: "Father's ID card translation", nameRu: "Перевод ID-карты отца", required: false },
    father_foreign_passport: { id: 'father_foreign_passport_translation', nameUz: "Ota zagranpasport tarjimasi", nameEn: "Father's foreign passport translation", nameRu: "Перевод загранпаспорта отца", required: false },
    mother_id_card: { id: 'mother_id_card_translation', nameUz: "Ona ID karta tarjimasi", nameEn: "Mother's ID card translation", nameRu: "Перевод ID-карты матери", required: false },
    mother_foreign_passport: { id: 'mother_foreign_passport_translation', nameUz: "Ona zagranpasport tarjimasi", nameEn: "Mother's foreign passport translation", nameRu: "Перевод загранпаспорта матери", required: false },
    birth_certificate: { id: 'birth_certificate_translation', nameUz: "Tug'ilganlik guvohnomasi tarjimasi", nameEn: "Birth certificate translation", nameRu: "Перевод свидетельства о рождении", required: false },
    language_certificate: { id: 'language_certificate_translation', nameUz: "Til sertifikati tarjimasi", nameEn: "Language certificate translation", nameRu: "Перевод языкового сертификата", required: false },
    photo: { id: 'photo_translation', nameUz: "Rasm tarjimasi", nameEn: "Photo translation", nameRu: "Перевод фото", required: false },
    diploma: { id: 'diploma_translation', nameUz: "Diplom tarjimasi", nameEn: "Diploma translation", nameRu: "Перевод диплома", required: false },
    marriage_certificate: { id: 'marriage_certificate_translation', nameUz: "Nikoh guvohnomasi tarjimasi", nameEn: "Marriage certificate translation", nameRu: "Перевод свидетельства о браке", required: false },
    death_certificate: { id: 'death_certificate_translation', nameUz: "O'lim guvohnomasi tarjimasi", nameEn: "Death certificate translation", nameRu: "Перевод свидетельства о смерти", required: false },
    diploma_supplement: { id: 'diploma_supplement_translation', nameUz: "Diplom ilovasi tarjimasi", nameEn: "Diploma supplement translation", nameRu: "Перевод приложения к диплому", required: false },
  };

  const getDocTypeName = (doc: { nameUz: string; nameEn: string; nameRu: string }) => {
    if (currentLang === 'ru') return doc.nameRu;
    if (currentLang === 'en') return doc.nameEn;
    return doc.nameUz;
  };

  const crmConditionalTranslationSlots: Record<string, { id: string; nameUz: string; nameEn: string; nameRu: string; required: boolean }> = {
    bank_statement: { id: 'bank_statement_translation', nameUz: "Bank ma'lumotnomasi tarjimasi", nameEn: "Bank statement translation", nameRu: "Перевод банковской справки", required: false },
    recommendation: { id: 'recommendation_translation', nameUz: "Tavsiyanoma tarjimasi", nameEn: "Recommendation letter translation", nameRu: "Перевод рекомендательного письма", required: false },
    autobiography: { id: 'autobiography_translation', nameUz: "Avtobiografiya tarjimasi", nameEn: "Autobiography and study plan translation", nameRu: "Перевод автобиографии и плана обучения", required: false },
  };

  // Legacy doc ID aliases (old format → new format)
  const docIdAliases: Record<string, string> = {
    'applicant_passport': 'foreign_passport',
  };

  const matchesDocType = (doc: Tables<'documents'>, docId: string): boolean => {
    const nameLower = doc.name.toLowerCase();
    const pathLower = (doc.file_path || '').toLowerCase();
    const docIdLower = docId.toLowerCase();

    const checkId = (id: string): boolean => {
      const parts = pathLower.split('/');
      const filename = parts[parts.length - 1];
      return (
        nameLower.includes(`[${id}]`) ||
        nameLower.startsWith(`[${id}]`) ||
        filename.startsWith(`${id}-`) ||
        filename.startsWith(`${id}.`)
      );
    };

    if (checkId(docIdLower)) return true;

    // Also check if any alias maps to this docId
    const aliasTarget = docIdAliases[docIdLower];
    if (aliasTarget && checkId(aliasTarget)) return true;

    // Check if any key in aliases has this docId as value (reverse lookup)
    for (const [alias, target] of Object.entries(docIdAliases)) {
      if (target === docIdLower && checkId(alias)) return true;
    }

    return false;
  };

  const getDocumentForType = (docId: string) => {
    // Return the most recent document matching this slot (Bug #2 fix)
    const matches = documents.filter(d => matchesDocType(d, docId));
    if (matches.length === 0) return undefined;
    return matches.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  };

  const getUncategorizedDocuments = () => {
    const allDocTypeIds = [...crmDocumentTypes, ...crmConditionalDocTypes].map(d => d.id);
    return documents.filter(d => {
      return !allDocTypeIds.some(id => matchesDocType(d, id));
    });
  };

  const handleViewDocument = async (doc: Tables<'documents'>) => {
    setViewingDocId(doc.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-proxy`
        + `?path=${encodeURIComponent(doc.file_path)}&bucket=student-documents`;

      const resp = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (!resp.ok) throw new Error(`Failed to load document: ${resp.statusText}`);

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);

      const ext = doc.file_path.split('.').pop()?.toLowerCase() || '';
      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
      const isPdf = ext === 'pdf' || blob.type === 'application/pdf';

      if (isImage) {
        setPreviewDoc({ url: blobUrl, name: doc.name, type: 'image' });
      } else if (isPdf) {
        // Show PDFs in the same dialog instead of force-downloading them — staff
        // need to read the document, not collect files.
        setPreviewDoc({ url: blobUrl, name: doc.name, type: 'pdf' });
      } else {
        // Unknown type — fall back to a download.
        const fileName = doc.name.replace(/^\[.*?\]\s*/, '') || 'document';
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch (err: any) {
      toast({ title: 'Failed to load document', description: err.message, variant: 'destructive' });
    } finally {
      setViewingDocId(null);
    }
  };

  const handleSlotUpload = async (docTypeId: string, file: File) => {
    setUploadingFile(true);
    let uploadedFilePath: string | null = null;
    try {
      // Delete existing document record and storage file BEFORE uploading
      // This prevents unique constraint failure on documents_student_doc_type_unique
      const existingDoc = getDocumentForType(docTypeId);
      if (existingDoc) {
        await supabase.storage.from('student-documents').remove([existingDoc.file_path]);
        const { error: deleteDbError } = await supabase
          .from('documents')
          .delete()
          .eq('id', existingDoc.id);
        if (deleteDbError) {
          console.warn('Could not delete old document record:', deleteDbError);
        }
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${student.user_id}/${docTypeId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Track the uploaded path so we can clean it up if the DB insert fails
      uploadedFilePath = filePath;

      const { error: dbError } = await supabase.from('documents').insert({
        student_id: student.user_id,
        name: `[${docTypeId}] ${file.name}`,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        status: 'uploaded',
        intake_id: activeIntakeId,
      });

      if (dbError) throw dbError;

      // DB insert succeeded — no cleanup needed
      uploadedFilePath = null;

      toast({ title: 'Document uploaded successfully' });
      await fetchDocuments();
    } catch (error: any) {
      // Bug #3 fix: If storage upload succeeded but DB insert failed, remove the orphaned file
      if (uploadedFilePath) {
        await supabase.storage.from('student-documents').remove([uploadedFilePath]);
      }
      toast({ title: 'Failed to upload', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingFile(false);
      setSlotUploadDocType(null);
    }
  };

  const handleSlotFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !slotUploadDocType) return;
    handleSlotUpload(slotUploadDocType, file);
    e.target.value = '';
  };

  const triggerSlotUpload = (docTypeId: string) => {
    setSlotUploadDocType(docTypeId);
    setTimeout(() => slotFileInputRef.current?.click(), 50);
  };

  const getUniversityName = (university?: Tables<'universities'>) => {
    if (!university) return 'Unknown';
    const nameKey = `name_${currentLang}` as keyof Tables<'universities'>;
    return (university[nameKey] as string) || university.name_uz || 'Unknown';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      documents_collection: t('crm.documentsCollected'),
      documents_translation: t('crm.documentsTranslated'),
      apostille: t('crm.apostilleReady'),
      application_submitted: t('crm.applicationSubmitted'),
      university_response: t('crm.universityResponse'),
      visa_documents: t('crm.visaDocuments'),
      completed: t('common.success')
    };
    return labels[status] || status;
  };

  const handleStatusChange = async (appId: string, newStatus: string) => {
    setUpdating(appId);
    await onUpdateApplicationStatus(appId, newStatus);
    setUpdating(null);
  };

  const handleDocStatusChange = async (docId: string, newStatus: string) => {
    setUpdating(docId);
    await onUpdateDocumentStatus(docId, newStatus);
    fetchDocuments();
    setUpdating(null);
  };

  const getDocStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const getPaymentPlanLabel = (planValue: string | null) => {
    const plan = paymentPlans.find(p => p.value === planValue);
    return plan?.label || planValue?.toUpperCase() || '-';
  };

  const getPaymentPlanDescription = (planValue: string | null) => {
    const plan = paymentPlans.find(p => p.value === planValue?.toLowerCase());
    if (!plan) return '';

    const isInstallment = student.payment_mode === 'installment';
    const price = isInstallment ? plan.priceInstallment : plan.priceOneTime;
    const modeLabel = isInstallment ? '(2 payments)' : '(one-time)';
    const extra = plan.extra ? ` - ${plan.extra}` : '';

    return `${price} ${modeLabel}${extra}`;
  };

  // Get current application status
  const latestApp = student.applications?.[0];
  const currentStatusIndex = latestApp ? allStatusSteps.indexOf(latestApp.status) : -1;
  const currentDegree = student.applications?.find((a) => a.degree_level)?.degree_level ?? null;

  // 'gks' is historic — students recorded before the vocational rename keep that
  // label; only 'vocational' is offered for new applications.
  const degreeLabel = (value: string) =>
    ({
      bachelor: t('applications.degreeBachelor', { defaultValue: 'Bakalavr' }),
      master: t('applications.degreeMaster', { defaultValue: 'Magistratura' }),
      vocational: t('applications.degreeVocational', { defaultValue: "Kasbiy ta'lim" }),
      gks: t('applications.degreeGks', { defaultValue: 'GKS' }),
    })[value] ?? value;

  const isStepCompleted = (stepKey: string) => {
    const stepIndex = allStatusSteps.indexOf(stepKey);
    return stepIndex <= currentStatusIndex;
  };

  const handleMarkComplete = async (stepKey: string) => {
    if (!latestApp) return;
    await handleStatusChange(latestApp.id, stepKey);
  };

  const handleMarkAllComplete = async (categorySteps: { key: string }[]) => {
    if (!latestApp) return;
    const lastStep = categorySteps[categorySteps.length - 1];
    await handleStatusChange(latestApp.id, lastStep.key);
  };

  // Calculate payment totals
  const totalStudentPaid = payments.reduce((sum, p) => sum + Number(p.paid_amount), 0);
  const totalGatewayFees = payments.reduce((sum, p) => {
    const txFees = p.transactions?.reduce((s, tx) => s + Number(tx.gateway_fee || 0), 0) || 0;
    return sum + txFees;
  }, 0);
  const totalNetIncome = totalStudentPaid - totalGatewayFees;
  const totalPending = payments
    .filter(p => p.status === 'pending' || p.status === 'partial')
    .reduce((sum, p) => sum + (Number(p.amount) - Number(p.paid_amount)), 0);
  const totalRefunded = payments
    .filter(p => p.status === 'refunded')
    .reduce((sum, p) => sum + Number(p.paid_amount), 0);


  const handleEditSuccess = () => {
    onRefresh();
  };

  const handleDeleteSuccess = () => {
    onBack();
    onRefresh();
  };

  // renderDocRow is defined at module level below the component

  const heroInitials = (student.full_name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const heroPlanMap: Record<string, { label: string; tone: 'lime' | 'info' | 'neutral' }> = {
    premium: { label: 'Premium', tone: 'lime' },
    standart: { label: 'Standard', tone: 'info' },
    no_risk: { label: 'No-Risk', tone: 'neutral' },
    free: { label: 'Free', tone: 'neutral' },
  };
  const heroPlan = heroPlanMap[(student.payment_plan || '').toLowerCase()];
  const heroIsVip = paymentPlans.find((p) => p.value === student.payment_plan?.toLowerCase())?.isVIP;
  const trackerSteps = [
    t('crm.stepDocuments', { defaultValue: 'Documents' }),
    t('crm.stepTranslation', { defaultValue: 'Translation' }),
    t('crm.stepApostille', { defaultValue: 'Apostille' }),
    t('crm.stepSubmitted', { defaultValue: 'Submitted' }),
    t('crm.stepResponse', { defaultValue: 'Response' }),
    t('crm.stepVisa', { defaultValue: 'Visa' }),
  ];

  return (
    <>
      <Sheet open={true} onOpenChange={() => onBack()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="space-y-0 pb-4">
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              {/* Hero */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={student.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
                      {heroInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
                        {student.full_name || t('common.name')}
                      </SheetTitle>
                      {heroPlan && <Badge variant={heroPlan.tone}>{heroPlan.label}</Badge>}
                      {heroIsVip && (
                        <Badge variant="warning" className="gap-1">
                          <Crown className="h-3 w-3" />
                          VIP
                        </Badge>
                      )}
                      {currentDegree && (
                        <Badge variant="default">{degreeLabel(currentDegree)}</Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {student.office_location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {student.office_location}
                        </span>
                      )}
                      {student.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {student.phone}
                        </span>
                      )}
                      {student.birth_date && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(student.birth_date), 'yyyy-MM-dd')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditDialogOpen(true)}>
                    <Pencil className="h-4 w-4" />
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('common.delete')}
                  </Button>
                </div>
              </div>

              {/* 6-step process tracker (live application status) */}
              {latestApp && (
                <div className="mt-5 border-t border-border pt-5">
                  <div className="flex items-start">
                    {trackerSteps.map((label, i) => {
                      const done = i < currentStatusIndex;
                      const current = i === currentStatusIndex;
                      return (
                        <div key={label} className="relative flex flex-1 flex-col items-center">
                          {i < trackerSteps.length - 1 && (
                            <div
                              className={cn(
                                'absolute left-1/2 top-3.5 h-0.5 w-full',
                                done ? 'bg-accent' : 'bg-border',
                              )}
                            />
                          )}
                          <div
                            className={cn(
                              'z-10 flex h-7 w-7 items-center justify-center rounded-full',
                              done
                                ? 'bg-accent text-accent-foreground'
                                : current
                                  ? 'bg-accent/15 ring-2 ring-accent'
                                  : 'bg-muted',
                            )}
                          >
                            {done ? (
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            ) : (
                              <span
                                className={cn(
                                  'text-xs font-bold',
                                  current ? 'text-accent' : 'text-muted-foreground',
                                )}
                              >
                                {i + 1}
                              </span>
                            )}
                          </div>
                          <span
                            className={cn(
                              'mt-2 text-center text-[11px]',
                              done || current ? 'font-semibold text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </SheetHeader>

          {/* Tabs */}
          <Tabs defaultValue="profile" className="w-full">
            <div className="flex items-center gap-2 overflow-x-auto">
              <TabsList className="justify-start flex-nowrap">
                <TabsTrigger value="profile">{t('navigation.profile')}</TabsTrigger>
                <TabsTrigger value="status">{t('student.applicationStatus')}</TabsTrigger>
                <TabsTrigger value="applications">{t('navigation.applications')}</TabsTrigger>
                <TabsTrigger value="payments">{t('navigation.payments')}</TabsTrigger>
                <TabsTrigger value="notes">{t('common.notes')}</TabsTrigger>
                <TabsTrigger value="calls">{t('common.phone')}</TabsTrigger>
                <TabsTrigger value="documents">{t('navigation.documents')}</TabsTrigger>
                <TabsTrigger value="translation" className="gap-1">
                  <Languages className="h-3 w-3" />
                  Tarjima
                </TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
              </TabsList>
              <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setSuggestUniversityDialogOpen(true)}>
                <Lightbulb className="h-3.5 w-3.5" />
                Universitetga tavsiya qilish
              </Button>
            </div>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6 mt-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('crm.personalInfo')}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('auth.fullName')}</Label>
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                      <span className="text-foreground">{student.full_name || '-'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('common.phone')}</Label>
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                      {student.phone ? (
                        <ClickToCall phoneNumber={student.phone} studentId={student.user_id} />
                      ) : (
                        <>
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">-</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('crm.birthDate')}</Label>
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">
                        {student.birth_date ? format(new Date(student.birth_date), 'yyyy-MM-dd') : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('crm.officeLocation')}</Label>
                  <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{student.office_location || '-'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('applications.selectDegree', { defaultValue: 'Daraja' })}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'bachelor', label: t('applications.degreeBachelor', { defaultValue: 'Bakalavr' }) },
                      { value: 'master', label: t('applications.degreeMaster', { defaultValue: 'Magistratura' }) },
                      { value: 'vocational', label: t('applications.degreeVocational', { defaultValue: "Kasbiy ta'lim" }) },
                    ].map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={currentDegree === opt.value ? 'default' : 'outline'}
                        disabled={degreeSaving !== null}
                        onClick={() => handleSetDegree(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Magic Code / Access Code */}
                {(student as any).magic_code && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('auth.accessCode')}</Label>
                    <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-primary" />
                        <span className="font-mono font-bold tracking-widest text-primary">
                          {(student as any).magic_code}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await navigator.clipboard.writeText((student as any).magic_code);
                          toast({ title: 'Code copied!' });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Payment Plan & Contract */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('crm.paymentContract')}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('crm.selectPlan')}</Label>
                    <Select value={currentPaymentPlan} onValueChange={handlePaymentPlanChange}>
                      <SelectTrigger className="bg-muted/50">
                        <span className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder={t('crm.selectPlan')} />
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {paymentPlans.map((plan) => (
                          <SelectItem key={plan.value} value={plan.value}>
                            {plan.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {savingPaymentPlan && (
                      <p className="text-xs text-muted-foreground">Saving…</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('student.paymentMode') || 'Payment Mode'}</Label>
                    <Select value={currentPaymentMode} onValueChange={handlePaymentModeChange}>
                      <SelectTrigger className="bg-muted/50">
                        <SelectValue placeholder="Select payment mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">One-time Payment</SelectItem>
                        <SelectItem value="installment">2 Installments</SelectItem>
                      </SelectContent>
                    </Select>
                    {savingPaymentMode && (
                      <p className="text-xs text-muted-foreground">Saving…</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('crm.contractDate')}</Label>
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">
                        {student.contract_date ? format(new Date(student.contract_date), 'MMMM do, yyyy') : '-'}
                      </span>
                    </div>
                  </div>
                  <ContractUpload
                    value={(student as any).contract_url || ''}
                    onChange={async (url) => {
                      await supabase
                        .from('profiles')
                        .update({ contract_url: url })
                        .eq('user_id', student.user_id);
                      onRefresh();
                    }}
                    studentId={student.user_id}
                  />
                </div>

                {student.payment_plan && (
                  <div className="bg-primary/10 rounded-lg p-3 flex items-start gap-2">
                    <StickyNote className="h-4 w-4 text-primary mt-0.5" />
                    <span className="text-sm text-foreground">
                      {getPaymentPlanDescription(student.payment_plan)}
                    </span>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Status Tab */}
            <TabsContent value="status" className="space-y-4 mt-6">
              {!latestApp ? (
                <Card>
                  <CardContent className="py-8 text-center space-y-3">
                    <p className="text-muted-foreground">No application found.</p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(statusCategories).map(([key, category]) => (
                  <Card key={key} className="border-border/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{category.title}</CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAllComplete(category.steps)}
                          disabled={updating === latestApp.id}
                        >
                          Mark All Complete
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {category.steps.map((step) => {
                        const completed = isStepCompleted(step.key);
                        return (
                          <div
                            key={step.key}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg ${completed ? 'bg-primary/20' : 'bg-muted/50'
                              }`}
                          >
                            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                              {completed ? (
                                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
                              ) : (
                                <Clock className="h-5 w-5 text-warning shrink-0 mt-0.5 sm:mt-0" />
                              )}
                              <span className="font-medium break-words leading-tight">{step.label}</span>
                            </div>
                            <Button
                              variant={completed ? "outline" : "default"}
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => handleMarkComplete(step.key)}
                              disabled={updating === latestApp.id}
                            >
                              {completed ? 'Completed' : 'Mark Complete'}
                            </Button>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Universities & Applications Tab */}
            <TabsContent value="applications" className="space-y-6 mt-6">
              
              {/* Suggested Universities Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Suggested For Student (Pending)</h3>
                  <Button size="sm" className="gap-2" onClick={() => setSuggestUniversityDialogOpen(true)}>
                    <Lightbulb className="h-4 w-4" />
                    Suggest University
                  </Button>
                </div>
                {suggestedUniversitiesList.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No suggested universities yet. Click "Suggest University" to recommend options to the student.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {suggestedUniversitiesList.map((sug) => {
                      const uni = sug.university;
                      if (!uni) return null;
                      return (
                        <Card key={sug.institution_id} className="relative overflow-hidden group">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-start justify-between">
                              <span className="pr-8">{uni.name_en || uni.name_uz || 'Unknown University'}</span>
                              {uni.is_partner && (
                                <Badge variant="secondary" className="text-xs shrink-0 whitespace-nowrap ml-2">Partner</Badge>
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="w-full gap-2"
                              disabled={removingSuggestion === sug.institution_id}
                              onClick={() => handleRemoveSuggestion(sug.institution_id)}
                            >
                              {removingSuggestion === sug.institution_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              Remove Suggestion
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Applications Section */}
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold border-b pb-2 w-full">Pending Student Applications</h3>
                </div>
                {(!student.applications || student.applications.filter(a => a.status === 'pending_approval').length === 0) ? (
                  <Card>
                    <CardContent className="py-6 text-center text-muted-foreground text-sm">
                      No applications pending approval.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {student.applications.filter(a => a.status === 'pending_approval').map((app) => (
                      <Card key={app.id} className="border-warning bg-warning/10/50 dark:bg-warning/10 dark:border-warning/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base text-warning dark:text-warning">
                            {getUniversityName(app.university)}
                          </CardTitle>
                          <p className="text-sm text-warning/80 dark:text-warning/80">
                            Requested: {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </CardHeader>
                        <CardContent className="flex items-center gap-3">
                          <Button 
                            className="flex-1 gap-2" 
                            disabled={processingApplication === app.id}
                            onClick={() => handleApproveApplication(app.id)}
                          >
                            {processingApplication === app.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            Approve
                          </Button>
                          <Button 
                            variant="destructive" 
                            className="flex-1 gap-2" 
                            disabled={processingApplication === app.id}
                            onClick={() => handleRejectApplication(app.id)}
                          >
                            {processingApplication === app.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            Reject
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-6 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Active Applications (In Progress)</h3>
                </div>
                {(!student.applications || student.applications.filter(a => a.status !== 'pending_approval').length === 0) ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No active applications.
                    </CardContent>
                  </Card>
                ) : (
                  student.applications.filter(a => a.status !== 'pending_approval').map((app) => {
                  const currentIndex = allStatusSteps.indexOf(app.status);
                  const progressPercent = ((currentIndex + 1) / allStatusSteps.length) * 100;

                  return (
                    <Card key={app.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">
                              {getUniversityName(app.university)}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {new Date(app.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {app.university?.website && (
                            <a
                              href={app.university.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('student.progress')}</span>
                            <span className="font-medium">{Math.round(progressPercent)}%</span>
                          </div>
                          <Progress value={progressPercent} className="h-2" />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{t('common.status')}:</span>
                          <Select
                            value={app.status}
                            onValueChange={(value) => handleStatusChange(app.id, value)}
                            disabled={updating === app.id}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {allStatusSteps.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {getStatusLabel(status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {app.notes && (
                          <p className="text-sm text-muted-foreground border-t pt-2">
                            {app.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
                )}
              </div>
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="payments" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Payment Records</h3>
                <Button size="sm" className="gap-2" onClick={() => setAddPaymentDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Payment
                </Button>
              </div>

              {/* Current Plan */}
              {student.payment_plan && (
                <Card className="bg-muted/30">
                  <CardContent className="py-4">
                    <p className="font-semibold">Current Plan: {getPaymentPlanLabel(student.payment_plan)}</p>
                    <p className="text-sm text-muted-foreground">{getPaymentPlanDescription(student.payment_plan)}</p>
                  </CardContent>
                </Card>
              )}

              {/* Payment Records */}
              {payments.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No payment records yet
                  </CardContent>
                </Card>
              ) : (
                payments.map((payment) => {
                  const txFees = payment.transactions?.reduce((s, tx) => s + Number(tx.gateway_fee || 0), 0) || 0;
                  const netIncome = Number(payment.paid_amount) - txFees;

                  return (
                    <Card key={payment.id}>
                      <CardContent className="py-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                              {payment.status}
                            </Badge>
                            <Badge variant="outline">{payment.payment_type.replace('_', ' ')}</Badge>
                            {payment.transactions?.[0]?.payment_method && (
                              <Badge variant="outline">{payment.transactions[0].payment_method}</Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="icon" onClick={() => setEditingPayment(payment)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDeletePayment(payment.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Student Paid:</p>
                            <p className="font-semibold">{Number(payment.paid_amount).toLocaleString()} {payment.currency}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Gateway Fee:</p>
                            <p className="font-semibold text-destructive">-{txFees.toLocaleString()} {payment.currency}</p>
                          </div>
                        </div>

                        <div className="bg-success/20 rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">Net Income (You Received):</p>
                          <p className="text-xl font-bold text-success">{netIncome.toLocaleString()} {payment.currency}</p>
                        </div>

                        <div className="text-sm space-y-1">
                          {payment.transactions?.[0]?.payment_method && (
                            <p>Method: {payment.transactions[0].payment_method}</p>
                          )}
                          {payment.due_date && (
                            <p>Due: {format(new Date(payment.due_date), 'M/d/yyyy')}</p>
                          )}
                          {payment.paid_at && (
                            <p>Paid: {format(new Date(payment.paid_at), 'M/d/yyyy')}</p>
                          )}
                        </div>

                        <Button variant="link" className="p-0 h-auto text-primary">
                          <Download className="h-4 w-4 mr-1" />
                          View Receipt/Cheque
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}

              {/* Payment Summary */}
              {payments.length > 0 && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="py-4">
                        <p className="text-sm text-muted-foreground">Total Student Paid</p>
                        <p className="text-xl font-bold">{totalStudentPaid.toLocaleString()} UZS</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4">
                        <p className="text-sm text-muted-foreground">Total Gateway Fees</p>
                        <p className="text-xl font-bold text-destructive">-{totalGatewayFees.toLocaleString()} UZS</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-success/20">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground">Total Net Income (Actual Received)</p>
                      <p className="text-2xl font-bold text-success">{totalNetIncome.toLocaleString()} UZS</p>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="bg-muted/50">
                      <CardContent className="py-4">
                        <p className="text-sm text-muted-foreground">Pending</p>
                        <p className="text-xl font-bold text-warning">{totalPending.toLocaleString()} UZS</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="py-4">
                        <p className="text-sm text-muted-foreground">Refunded</p>
                        <p className="text-xl font-bold text-primary">{totalRefunded.toLocaleString()} UZS</p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-4 mt-6">
              <Card className="border-primary/50">
                <CardHeader>
                  <CardTitle className="text-base">Add New Note</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Write a note about this student..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-24"
                  />
                  <Button onClick={handleAddNote} disabled={!newNote.trim()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Note
                  </Button>
                </CardContent>
              </Card>

              {notes.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No notes yet
                  </CardContent>
                </Card>
              ) : (
                notes.map((note) => (
                  <Card key={note.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <p className="text-foreground flex-1">{note.content}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(note.created_at), 'PPp')}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Calls Tab */}
            <TabsContent value="calls" className="space-y-4 mt-6">
              {calls.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No call records yet
                  </CardContent>
                </Card>
              ) : (
                calls.map((call) => (
                  <Card key={call.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <PhoneCall className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{call.phone_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {call.direction} • {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={call.status === 'completed' ? 'default' : 'secondary'}>
                          {call.status}
                        </Badge>
                      </div>
                      {call.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{call.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(call.started_at), 'PPp')}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-4 mt-6">
              {/* Hidden file input for slot uploads */}
              <input
                ref={slotFileInputRef}
                type="file"
                className="hidden"
                accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleSlotFileSelect}
              />

              {/* Document Preview Dialog (images + PDFs) */}
              <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
                <DialogContent className={previewDoc?.type === 'pdf' ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}>
                  <DialogHeader>
                    <DialogTitle className="truncate pr-8">{previewDoc?.name}</DialogTitle>
                  </DialogHeader>
                  {previewDoc?.type === 'image' && (
                    <div className="flex justify-center">
                      <img src={previewDoc.url} alt={previewDoc.name} className="max-h-[70vh] object-contain rounded-lg" />
                    </div>
                  )}
                  {previewDoc?.type === 'pdf' && (
                    <div className="space-y-2">
                      <iframe
                        src={previewDoc.url}
                        title={previewDoc.name}
                        className="h-[70vh] w-full rounded-lg border border-border"
                      />
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = previewDoc.url;
                            a.download = previewDoc.name.replace(/^\[.*?\]\s*/, '') || 'document.pdf';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {currentLang === 'ru' ? 'Скачать' : currentLang === 'en' ? 'Download' : 'Yuklab olish'}
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>


              {/* Bug #6 fix: Upload progress banner — shows which slot is being uploaded */}
              {uploadingFile && slotUploadDocType && (
                <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <span className="text-sm text-foreground">
                    {currentLang === 'ru' ? 'Загрузка' : currentLang === 'en' ? 'Uploading' : 'Yuklanmoqda'}
                    {' '}
                    <span className="font-medium">
                      {(() => {
                        const primary = crmDocumentTypes.find(d => d.id === slotUploadDocType);
                        if (primary) return getDocTypeName(primary);
                        const translationEntry = Object.values(crmTranslationSlots).find(d => d.id === slotUploadDocType);
                        if (translationEntry) return getDocTypeName(translationEntry);
                        const condTranslationEntry = Object.values(crmConditionalTranslationSlots).find(d => d.id === slotUploadDocType);
                        if (condTranslationEntry) return getDocTypeName(condTranslationEntry);
                        const conditional = crmConditionalDocTypes.find(d => d.id === slotUploadDocType);
                        if (conditional) return getDocTypeName(conditional);
                        return slotUploadDocType;
                      })()}
                    </span>
                    {'...'}
                  </span>
                </div>
              )}

              {/* Progress overview */}
              {(() => {
                const uploadedCount = crmDocumentTypes.filter(dt => !!getDocumentForType(dt.id)).length;
                const total = crmDocumentTypes.length;
                const pct = Math.round((uploadedCount / total) * 100);
                return (
                  <Card className="border-border/50">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {currentLang === 'ru' ? 'Обязательные документы' : currentLang === 'en' ? 'Required documents' : 'Majburiy hujjatlar'}
                        </span>
                        <span className="text-sm font-semibold text-primary">{uploadedCount}/{total} {currentLang === 'ru' ? 'загружено' : currentLang === 'en' ? 'uploaded' : 'yuklangan'}</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">{pct}% {currentLang === 'ru' ? 'завершено' : currentLang === 'en' ? 'complete' : 'bajarildi'}</p>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Required Documents + Conditional Documents */}
              {(() => {
                const renderDocRow = (
                  docType: { id: string; nameUz: string; nameEn: string; nameRu: string; required: boolean },
                  idx: number,
                  isTranslation = false
                ) => {
                  const doc = getDocumentForType(docType.id);
                  const isViewing = viewingDocId === doc?.id;
                  const ext = doc?.file_path?.split('.').pop()?.toLowerCase() || '';
                  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
                  const displayName = doc ? doc.name.replace(/^\[.*?\]\s*/, '') : '';
                  const fileSizeKb = doc?.file_size ? (doc.file_size < 1024 * 1024 ? `${(doc.file_size / 1024).toFixed(1)} KB` : `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`) : null;
                  const uploadDate = doc ? new Date(doc.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
                  const docName = getDocTypeName(docType);
                  const wrapper = isTranslation
                    ? 'ml-6 border-l-2 border-dashed border-muted-foreground/30 bg-muted/20'
                    : 'border-b border-border/50 last:border-0';
                  return (
                    <div key={docType.id} className={wrapper}>
                      {isTranslation && (
                        <div className="flex items-center gap-1 px-4 pt-1.5">
                          <Languages className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                            {currentLang === 'ru' ? 'Перевод' : currentLang === 'en' ? 'Translation' : 'Tarjima'}
                          </span>
                        </div>
                      )}
                      {doc ? (
                        <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => handleViewDocument(doc)}>
                          {isTranslation ? <span className="w-5 shrink-0" /> : <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{idx + 1}</span>}
                          <CheckCircle className="h-5 w-5 text-success shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight truncate">{docName}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {isImage ? <ImageIcon className="h-3 w-3 text-muted-foreground shrink-0" /> : <FileText className="h-3 w-3 text-muted-foreground shrink-0" />}
                              <span className="text-xs text-muted-foreground truncate max-w-[160px]">{displayName}</span>
                              {fileSizeKb && <span className="text-xs text-muted-foreground shrink-0">• {fileSizeKb}</span>}
                              {uploadDate && <span className="text-xs text-muted-foreground shrink-0">• {uploadDate}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Badge variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px] h-5 px-1.5 shrink-0">
                              {doc.status === 'approved' ? (currentLang === 'ru' ? 'Одобрено' : currentLang === 'en' ? 'Approved' : 'Tasdiqlangan') : doc.status === 'rejected' ? (currentLang === 'ru' ? 'Отклонено' : currentLang === 'en' ? 'Rejected' : 'Rad etilgan') : (currentLang === 'ru' ? 'Загружено' : currentLang === 'en' ? 'Uploaded' : 'Yuklangan')}
                            </Badge>
                            {isViewing ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                            {isDocumentHandler && (<button className="text-muted-foreground hover:text-foreground transition-colors p-0.5" onClick={(e) => { e.stopPropagation(); triggerSlotUpload(docType.id); }} disabled={uploadingFile} title={currentLang === 'ru' ? 'Заменить' : currentLang === 'en' ? 'Replace' : 'Almashtirish'}><RefreshCw className="h-3.5 w-3.5" /></button>)}
                            {isDocumentHandler && (<Select value={doc.status} onValueChange={(value) => handleDocStatusChange(doc.id, value)} disabled={updating === doc.id}><SelectTrigger className="w-24 h-6 text-[11px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="uploaded">{t('student.pending')}</SelectItem><SelectItem value="approved">{t('student.approved')}</SelectItem><SelectItem value="rejected">{t('student.rejected')}</SelectItem></SelectContent></Select>)}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          {isTranslation ? <span className="w-5 shrink-0" /> : <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{idx + 1}</span>}
                          <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                          <p className="flex-1 text-sm text-muted-foreground truncate">{docName}</p>
                          <Button variant="outline" size="sm" className="gap-1.5 shrink-0 h-8" onClick={() => triggerSlotUpload(docType.id)} disabled={uploadingFile}>
                            {uploadingFile && slotUploadDocType === docType.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            {currentLang === 'ru' ? 'Загрузить' : currentLang === 'en' ? 'Upload' : 'Yuklash'}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          {currentLang === 'ru' ? 'Обязательные документы' : currentLang === 'en' ? 'Required Documents' : 'Shartnoma vaqtida kerakli hujjatlar'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y divide-border/50">
                          {crmDocumentTypes.flatMap((docType, idx) => {
                            const translationDef = crmTranslationSlots[docType.id];
                            return [
                              renderDocRow(docType, idx, false),
                              ...(translationDef ? [renderDocRow(translationDef, -1, true)] : []),
                            ];
                          })}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          {currentLang === 'ru' ? 'Дополнительные документы' : currentLang === 'en' ? 'Additional Documents' : "Qo'shimcha hujjatlar"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y divide-border/50">
                          {crmConditionalDocTypes.flatMap((docType, idx) => {
                            const translationDef = crmConditionalTranslationSlots[docType.id];
                            return [
                              renderDocRow(docType, idx, false),
                              ...(translationDef ? [renderDocRow(translationDef, -1, true)] : []),
                            ];
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}

              {/* Uncategorized / Legacy uploads */}
              {getUncategorizedDocuments().length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {currentLang === 'ru' ? 'Прочие загруженные файлы' : currentLang === 'en' ? 'Other Uploaded Files' : 'Boshqa yuklangan fayllar'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/50">
                      {getUncategorizedDocuments().map((doc) => {
                        const isViewing = viewingDocId === doc.id;
                        const ext = doc.file_path?.split('.').pop()?.toLowerCase() || '';
                        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
                        const fileSizeStr = doc.file_size
                          ? doc.file_size < 1024 * 1024
                            ? `${(doc.file_size / 1024).toFixed(1)} KB`
                            : `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`
                          : null;
                        return (
                          <div key={doc.id} className="px-4 py-3 bg-background hover:bg-muted/30 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="shrink-0 mt-0.5">
                                {isImage ? <ImageIcon className="h-5 w-5 text-muted-foreground" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">{doc.name}</p>
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                                    {doc.status === 'approved' ? 'Approved' : doc.status === 'rejected' ? 'Rejected' : 'Uploaded'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</span>
                                  {fileSizeStr && <span className="text-xs text-muted-foreground">• {fileSizeStr}</span>}
                                </div>
                                <div className="flex items-center gap-1.5 mt-2">
                                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleViewDocument(doc)} disabled={isViewing}>
                                    {isViewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                                    View
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleDownloadDocument(doc)}>
                                    <Download className="h-3 w-3" />
                                    Download
                                  </Button>
                                  {isDocumentHandler && (
                                    <Select value={doc.status} onValueChange={(value) => handleDocStatusChange(doc.id, value)} disabled={updating === doc.id}>
                                      <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="uploaded">{t('student.pending')}</SelectItem>
                                        <SelectItem value="approved">{t('student.approved')}</SelectItem>
                                        <SelectItem value="rejected">{t('student.rejected')}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

            </TabsContent>

            {/* Translation Tab */}
            <TabsContent value="translation" className="space-y-4 mt-6">
              <AITranslationPage
                studentId={student.user_id}
                studentName={student.full_name || undefined}
              />
            </TabsContent>

            {/* Comments Tab */}
            <TabsContent value="comments" className="space-y-4 mt-6">
              <Card className="border-primary/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Comments ({comments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Add a comment... Use @ to mention team members"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-20"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">@ Type @ to mention team members</p>
                    <Button onClick={handleAddComment} disabled={!newComment.trim()} className="gap-2">
                      <Send className="h-4 w-4" />
                      Post Comment
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {comments.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No comments yet. Be the first to comment!
                  </CardContent>
                </Card>
              ) : (
                comments.map((comment) => (
                  <Card key={comment.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{comment.author?.full_name || 'Staff'}</p>
                          <p className="text-foreground mt-1">{comment.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(comment.created_at), 'PPp')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      <EditStudentDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        student={student}
        onSuccess={handleEditSuccess}
      />

      <DeleteStudentDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        student={student}
        onSuccess={handleDeleteSuccess}
      />

      <EditPaymentDialog
        open={!!editingPayment}
        onOpenChange={(o) => !o && setEditingPayment(null)}
        payment={editingPayment}
        onSuccess={fetchPayments}
      />

      <AddPaymentDialog
        open={addPaymentDialogOpen}
        onOpenChange={setAddPaymentDialogOpen}
        studentId={student.user_id}
        studentPlan={student.payment_plan}
        studentPaymentMode={student.payment_mode || 'one_time'}
        contractDate={student.contract_date}
        existingPayments={payments.map(p => ({
          payment_type: p.payment_type,
          status: p.status
        }))}
        onSuccess={fetchPayments}
      />

      <SuggestUniversityDialog
        open={suggestUniversityDialogOpen}
        onOpenChange={setSuggestUniversityDialogOpen}
        studentId={student.user_id}
        existingSuggestedUniversityIds={existingSuggestedUniversityIds}
        existingApplicationUniversityIds={student.applications?.map(a => a.institution_id) || []}
        onSuccess={() => {
          fetchSuggestions();
          onRefresh();
        }}
      />
    </>
  );
}

