import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentTranslation } from '@/hooks/useDocumentTranslation';
import { useTranslationTraining } from '@/hooks/useTranslationTraining';
import { resolveTranslationInputs, STUDENT_DOC_SLOTS } from '@/lib/translationDocuments';
import type { StructuredTranslation, TranslationFileInput, VerifiedNames } from '@/types/translation';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload, FileText, Trash2, Download, Loader2, Sparkles, RefreshCw,
  CheckCircle, AlertCircle, Clock, X, Languages, FilePlus, User, Users, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { applyIntake } from '@/lib/intakeQuery';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type DocumentRow = Tables<'documents'>;

interface JobRow {
  id: string;
  document_type_id: string;
  source_file_path: string;
  output_docx_path: string | null;
  structured_translation: StructuredTranslation | null;
  verified_names: VerifiedNames | null;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  document_type?: { name_uz: string; name_en: string | null; code: string };
}

interface AITranslationPageProps {
  // When embedded in StudentDetail, pass these to skip the student picker.
  studentId?: string;
  studentName?: string;
}

export default function AITranslationPage({ studentId: propStudentId, studentName: propStudentName }: AITranslationPageProps = {}) {
  const { documentTypes, loading: loadingTypes } = useTranslationTraining();
  const { translating, regenerating, runTranslation, regenerateDocx, createTranslationJob, saveTranslationResult, updateJobStatus, deleteJob } = useDocumentTranslation();
  const { activeIntakeId } = useActiveIntake();

  // Student picker (only used when no studentId prop)
  const [students, setStudents] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [pickedStudentId, setPickedStudentId] = useState('');
  const [studentDocs, setStudentDocs] = useState<DocumentRow[]>([]);

  const effectiveStudentId = propStudentId ?? pickedStudentId;
  const effectiveStudentName = propStudentId ? propStudentName : students.find((s) => s.user_id === pickedStudentId)?.full_name ?? undefined;

  // Form
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [sourceDocId, setSourceDocId] = useState('');
  const [uploadedSource, setUploadedSource] = useState<File | null>(null);
  const [autoSupporting, setAutoSupporting] = useState<{ path: string; bucket: string; role: string; label: string }[]>([]);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Jobs list
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Result state (shown inline after completion)
  const [completedJobId, setCompletedJobId] = useState<string | null>(null);
  const [completedDocxPath, setCompletedDocxPath] = useState<string | null>(null);

  const selectedType = documentTypes.find((t) => t.id === selectedTypeId);

  // Load students (only in standalone mode)
  useEffect(() => {
    if (propStudentId) return;
    supabase.from('profiles').select('user_id, full_name').not('full_name', 'is', null).order('full_name').limit(400)
      .then(({ data }) => { if (data) setStudents(data); });
  }, [propStudentId]);

  // Load student docs when student changes
  const fetchStudentDocs = useCallback(async () => {
    if (!effectiveStudentId) { setStudentDocs([]); return; }
    const { data } = await applyIntake(
      supabase.from('documents').select('*').eq('student_id', effectiveStudentId),
      activeIntakeId,
    ).order('created_at', { ascending: false });
    setStudentDocs(data ?? []);
  }, [effectiveStudentId, activeIntakeId]);

  const fetchJobs = useCallback(async () => {
    if (!effectiveStudentId) { setJobs([]); return; }
    setLoadingJobs(true);
    const { data } = await supabase
      .from('translation_jobs')
      .select('*, document_type:translation_document_types(name_uz, name_en, code)')
      .eq('student_id', effectiveStudentId)
      .order('created_at', { ascending: false })
      .limit(30);
    setJobs((data as unknown as JobRow[]) ?? []);
    setLoadingJobs(false);
  }, [effectiveStudentId]);

  useEffect(() => { fetchStudentDocs(); fetchJobs(); }, [fetchStudentDocs, fetchJobs]);

  // Auto-resolve documents when type changes
  useEffect(() => {
    if (!selectedType || studentDocs.length === 0) { setSourceDocId(''); setAutoSupporting([]); return; }
    const resolved = resolveTranslationInputs(selectedType.code, studentDocs, 'uz');
    setSourceDocId(resolved.source?.documentId ?? '');
    setUploadedSource(null);
    setAutoSupporting(resolved.supporting.map((s) => ({ path: s.path, bucket: s.bucket, role: s.role, label: s.label })));
    setExtraFiles([]);
  }, [selectedTypeId, studentDocs]); // eslint-disable-line react-hooks/exhaustive-deps

  const docLabel = (doc: DocumentRow) => {
    const tagged = doc.name.match(/^\[(.+?)\]/);
    const slot = tagged?.[1];
    if (slot && STUDENT_DOC_SLOTS[slot]) return STUDENT_DOC_SLOTS[slot].uz;
    return doc.name.replace(/^\[.*?\]\s*/, '');
  };

  const uploadFile = async (file: File, kind: string): Promise<string> => {
    const path = `jobs/${effectiveStudentId}/${kind}_${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`;
    const { error } = await supabase.storage.from('translation-documents').upload(path, file);
    if (error) throw error;
    return path;
  };

  const proxyBlobUrl = async (path: string, bucket: string): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const url = `${SUPABASE_URL}/functions/v1/document-proxy?path=${encodeURIComponent(path)}&bucket=${encodeURIComponent(bucket)}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!resp.ok) return null;
    return URL.createObjectURL(await resp.blob());
  };

  const handleTranslate = async () => {
    if (!effectiveStudentId || !selectedTypeId) { toast.error('Talaba va hujjat turini tanlang'); return; }
    if (!uploadedSource && !sourceDocId) { toast.error('Original hujjatni tanlang yoki yuklang'); return; }

    setSubmitting(true);
    setCompletedJobId(null);
    setCompletedDocxPath(null);
    let jobId: string | null = null;
    try {
      let source: TranslationFileInput;
      let sourceDocumentId: string | undefined;
      if (uploadedSource) {
        source = { path: await uploadFile(uploadedSource, 'source'), bucket: 'translation-documents' };
      } else {
        const doc = studentDocs.find((d) => d.id === sourceDocId)!;
        source = { path: doc.file_path, bucket: 'student-documents' };
        sourceDocumentId = doc.id;
      }

      const supportingInputs: TranslationFileInput[] = autoSupporting.map((s) => ({ path: s.path, bucket: s.bucket, role: s.role }));
      for (const f of extraFiles) {
        supportingInputs.push({ path: await uploadFile(f, 'support'), bucket: 'translation-documents', role: 'other' });
      }

      const job = await createTranslationJob(effectiveStudentId, selectedTypeId, source.path, sourceDocumentId, false);
      if (!job) throw new Error('Job yaratilmadi');
      jobId = job.id;
      await updateJobStatus(job.id, 'processing');

      const result = await runTranslation({ documentTypeId: selectedTypeId, source, supporting: supportingInputs, studentName: effectiveStudentName });
      if (!result) throw new Error('Tarjima amalga oshmadi');

      await saveTranslationResult(job.id, result);
      setCompletedJobId(job.id);
      setCompletedDocxPath(result.docxPath);
      toast.success('Tarjima tayyor!');
      await fetchJobs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Xatolik yuz berdi';
      if (jobId) await updateJobStatus(jobId, 'failed', msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (path: string, filename: string) => {
    const url = await proxyBlobUrl(path, 'translation-documents');
    if (!url) { toast.error("Yuklab bo'lmadi"); return; }
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDelete = async (jobId: string) => {
    await deleteJob(jobId);
    if (completedJobId === jobId) { setCompletedJobId(null); setCompletedDocxPath(null); }
    await fetchJobs();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: React.ReactNode }> = {
      pending: { variant: 'outline', label: 'Kutilmoqda', icon: <Clock className="h-3 w-3" /> },
      processing: { variant: 'secondary', label: 'Jarayonda', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      completed: { variant: 'default', label: 'Tayyor', icon: <CheckCircle className="h-3 w-3" /> },
      failed: { variant: 'destructive', label: 'Xatolik', icon: <AlertCircle className="h-3 w-3" /> },
    };
    const c = map[status] ?? map.pending;
    return <Badge variant={c.variant} className="gap-1 text-xs">{c.icon}{c.label}</Badge>;
  };

  if (loadingTypes) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Languages className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">AI Tarjima</h1>
          <p className="text-sm text-muted-foreground">O'zbekchadan inglizchaga sertifikatlangan tarjima</p>
        </div>
      </div>

      {/* Step 1: Talaba (faqat standalone rejimda) */}
      {!propStudentId && (
        <Card>
          <CardContent className="pt-5 space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
              Talabani tanlang
            </Label>
            <Select value={pickedStudentId} onValueChange={(v) => { setPickedStudentId(v); setSelectedTypeId(''); setCompletedJobId(null); setCompletedDocxPath(null); }}>
              <SelectTrigger>
                <SelectValue placeholder="Talaba ismini qidiring..." />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Hujjatlar */}
      {effectiveStudentId && (
        <Card>
          <CardContent className="pt-5 space-y-5">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
              Hujjatlarni tanlang
            </Label>

            {/* Hujjat turi */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hujjat turi</Label>
              <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Tarjima qilinadigan hujjat turini tanlang..." />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name_uz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTypeId && (
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Original hujjat */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Original hujjat
                    <span className="text-muted-foreground font-normal">(tarjima qilinadi)</span>
                  </Label>

                  {uploadedSource ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-success bg-success/10 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 truncate text-success">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <span className="truncate">{uploadedSource.name}</span>
                      </span>
                      <button onClick={() => setUploadedSource(null)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <Select value={sourceDocId} onValueChange={setSourceDocId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tizimdan tanlang..." />
                      </SelectTrigger>
                      <SelectContent>
                        {studentDocs.length === 0
                          ? <div className="px-2 py-2 text-sm text-muted-foreground">Hujjat topilmadi</div>
                          : studentDocs.map((d) => <SelectItem key={d.id} value={d.id}>{docLabel(d)}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  )}

                  <label className="inline-flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
                    <FilePlus className="h-3 w-3" />
                    Yangi fayl yuklash
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadedSource(f); }} />
                  </label>
                </div>

                {/* Qo'shimcha hujjatlar */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    Qo'shimcha hujjatlar
                    <span className="text-muted-foreground font-normal">(ismlar uchun)</span>
                  </Label>

                  {autoSupporting.length === 0 && extraFiles.length === 0 ? (
                    <p className="text-xs text-warning bg-warning/10 dark:bg-warning/20 border border-warning/30 dark:border-warning rounded-lg px-3 py-2">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Zagran pasport topilmadi — ismlar noto'g'ri bo'lishi mumkin
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {autoSupporting.map((s, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 text-xs">
                          {s.role === 'student_passport' ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                          {s.label}
                          <button onClick={() => setAutoSupporting((p) => p.filter((_, idx) => idx !== i))} className="ml-0.5 hover:text-destructive">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                      {extraFiles.map((f, i) => (
                        <Badge key={`extra-${i}`} variant="outline" className="gap-1 text-xs">
                          <FileText className="h-3 w-3" />
                          {f.name}
                          <button onClick={() => setExtraFiles((p) => p.filter((_, idx) => idx !== i))} className="ml-0.5 hover:text-destructive">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <label className="inline-flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
                    <FilePlus className="h-3 w-3" />
                    Pasport / ID qo'shish
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" multiple
                      onChange={(e) => setExtraFiles((p) => [...p, ...Array.from(e.target.files ?? [])])} />
                  </label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Tarjima tugmasi */}
      {effectiveStudentId && selectedTypeId && (
        <Button
          onClick={handleTranslate}
          disabled={submitting || translating || (!sourceDocId && !uploadedSource)}
          className="w-full"
          size="lg"
        >
          {submitting || translating
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />AI tarjima qilmoqda...</>
            : <><Sparkles className="h-4 w-4 mr-2" />Tarjima qilish</>
          }
        </Button>
      )}

      {/* Natija */}
      {completedDocxPath && (
        <Card className="border-success/30 bg-success/10 dark:bg-success/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-success dark:text-success">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <span className="font-medium">Tarjima tayyor!</span>
                <span className="text-sm text-muted-foreground">Word fayli (.docx) yuklab olishga tayyor</span>
              </div>
              <Button
                onClick={() => handleDownload(completedDocxPath, `tarjima_${selectedType?.code ?? 'hujjat'}.docx`)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Word yuklab olish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tarix */}
      {effectiveStudentId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Tarjimalar tarixi</h2>
            <Button variant="ghost" size="sm" onClick={fetchJobs} className="h-7 text-xs gap-1">
              <RefreshCw className="h-3 w-3" />Yangilash
            </Button>
          </div>

          {loadingJobs ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : jobs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Hozircha tarjimalar yo'q</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <Card key={job.id} className={cn(
                  "transition-colors",
                  job.status === 'completed' && 'border-success/30',
                  job.status === 'failed' && 'border-destructive/30',
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {job.document_type?.name_uz ?? 'Noma\'lum hujjat'}
                          </span>
                          {statusBadge(job.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(job.created_at).toLocaleString('uz-UZ')}
                        </p>
                        {job.error_message && (
                          <p className="text-xs text-destructive mt-1">{job.error_message}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {job.status === 'completed' && job.output_docx_path && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Word yuklab olish"
                            onClick={() => handleDownload(job.output_docx_path!, `tarjima_${job.document_type?.code ?? 'hujjat'}.docx`)}>
                            <Download className="h-4 w-4 text-success" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="O'chirish" onClick={() => handleDelete(job.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
