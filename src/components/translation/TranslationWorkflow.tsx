import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTranslation } from '@/hooks/useDocumentTranslation';
import { useTranslationTraining, TranslationDocumentType } from '@/hooks/useTranslationTraining';
import { resolveTranslationInputs, findStudentDoc, STUDENT_DOC_SLOTS } from '@/lib/translationDocuments';
import type { StructuredTranslation, TranslationBlock, TranslationFileInput, VerifiedNames } from '@/types/translation';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Upload, FileText, Trash2, Download, Loader2, Sparkles, RefreshCw, Users, User,
  CheckCircle, AlertCircle, Clock, X, Check, AlertTriangle, Languages, FilePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TranslationWorkflowProps {
  studentId?: string;
  studentName?: string;
  onJobCreated?: () => void;
}

type DocumentRow = Tables<'documents'>;

interface JobRow {
  id: string;
  document_type_id: string;
  source_file_path: string;
  output_pdf_path: string | null;
  translated_text: string | null;
  structured_translation: StructuredTranslation | null;
  verified_names: VerifiedNames | null;
  status: string;
  error_message: string | null;
  auto_triggered: boolean;
  created_at: string;
  completed_at: string | null;
  document_type?: TranslationDocumentType;
}

interface SupportingChoice extends TranslationFileInput {
  label: string;
  removable: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function TranslationWorkflow({ studentId, studentName, onJobCreated }: TranslationWorkflowProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language.split('-')[0] as 'uz' | 'ru' | 'en';
  const { documentTypes, loading: loadingTypes } = useTranslationTraining();
  const { translating, regenerating, runTranslation, regeneratePdf, createTranslationJob, saveTranslationResult, updateJobStatus, deleteJob } = useDocumentTranslation();

  // Standalone (no studentId) student picker
  const [students, setStudents] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [pickedStudentId, setPickedStudentId] = useState<string>('');
  const effectiveStudentId = studentId ?? (pickedStudentId || undefined);
  const effectiveStudentName = studentId
    ? studentName
    : students.find((s) => s.user_id === pickedStudentId)?.full_name ?? undefined;

  const [studentDocs, setStudentDocs] = useState<DocumentRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // New-translation form
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [sourceDocId, setSourceDocId] = useState<string>(''); // documents.id when source is a student doc
  const [uploadedSource, setUploadedSource] = useState<File | null>(null);
  const [supporting, setSupporting] = useState<SupportingChoice[]>([]);
  const [extraSupportFiles, setExtraSupportFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Result dialog
  const [activeResult, setActiveResult] = useState<{ jobId: string; documentTypeId: string; structured: StructuredTranslation; pdfPath: string } | null>(null);
  const [editNames, setEditNames] = useState<VerifiedNames>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const getLocalizedName = (item: TranslationDocumentType) => {
    if (lang === 'uz') return item.name_uz;
    if (lang === 'ru') return item.name_ru || item.name_uz;
    return item.name_en || item.name_uz;
  };

  const selectedType = documentTypes.find((t) => t.id === selectedTypeId);

  // ---- Data loading ----
  useEffect(() => {
    if (studentId) return; // picker only needed in standalone mode
    supabase
      .from('profiles')
      .select('user_id, full_name')
      .not('full_name', 'is', null)
      .order('full_name')
      .limit(300)
      .then(({ data }) => { if (data) setStudents(data); });
  }, [studentId]);

  const fetchStudentDocs = useCallback(async () => {
    if (!effectiveStudentId) { setStudentDocs([]); return; }
    const { data } = await supabase.from('documents').select('*').eq('student_id', effectiveStudentId).order('created_at', { ascending: false });
    setStudentDocs(data ?? []);
  }, [effectiveStudentId]);

  const fetchJobs = useCallback(async () => {
    if (!effectiveStudentId) { setJobs([]); return; }
    setLoadingJobs(true);
    const { data } = await supabase
      .from('translation_jobs')
      .select('*, document_type:translation_document_types(*)')
      .eq('student_id', effectiveStudentId)
      .order('created_at', { ascending: false })
      .limit(50);
    setJobs((data as unknown as JobRow[]) ?? []);
    setLoadingJobs(false);
  }, [effectiveStudentId]);

  useEffect(() => { fetchStudentDocs(); fetchJobs(); }, [fetchStudentDocs, fetchJobs]);

  // When the document type changes, auto-resolve source + supporting from student docs.
  useEffect(() => {
    if (!selectedType || studentDocs.length === 0) {
      setSourceDocId(''); setSupporting([]); return;
    }
    const resolved = resolveTranslationInputs(selectedType.code, studentDocs, lang);
    setSourceDocId(resolved.source?.documentId ?? '');
    setUploadedSource(null);
    setSupporting(resolved.supporting.map((s) => ({ path: s.path, bucket: s.bucket, role: s.role, label: s.label, removable: true })));
    setExtraSupportFiles([]);
  }, [selectedTypeId, studentDocs, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Storage helpers ----
  const uploadToTranslationBucket = async (file: File, kind: string): Promise<string> => {
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

  // ---- Translate ----
  const docLabel = (doc: DocumentRow): string => {
    const tagged = doc.name.match(/^\[(.+?)\]/);
    const slot = tagged?.[1];
    if (slot && STUDENT_DOC_SLOTS[slot]) return STUDENT_DOC_SLOTS[slot][lang] ?? STUDENT_DOC_SLOTS[slot].en;
    return doc.name.replace(/^\[.*?\]\s*/, '');
  };

  const handleTranslate = async () => {
    if (!effectiveStudentId || !selectedTypeId) { toast.error('Talaba va hujjat turini tanlang'); return; }
    if (!uploadedSource && !sourceDocId) { toast.error('Asl hujjatni tanlang yoki yuklang'); return; }

    setSubmitting(true);
    let jobId: string | null = null;
    try {
      // Resolve source
      let source: TranslationFileInput;
      let sourceDocumentId: string | undefined;
      if (uploadedSource) {
        source = { path: await uploadToTranslationBucket(uploadedSource, 'source'), bucket: 'translation-documents' };
      } else {
        const doc = studentDocs.find((d) => d.id === sourceDocId)!;
        source = { path: doc.file_path, bucket: 'student-documents' };
        sourceDocumentId = doc.id;
      }

      // Resolve supporting (auto-attached + any uploaded extras)
      const supportingInputs: TranslationFileInput[] = supporting.map((s) => ({ path: s.path, bucket: s.bucket, role: s.role }));
      for (const f of extraSupportFiles) {
        supportingInputs.push({ path: await uploadToTranslationBucket(f, 'support'), bucket: 'translation-documents', role: 'other' });
      }

      const job = await createTranslationJob(effectiveStudentId, selectedTypeId, source.path, sourceDocumentId, false);
      if (!job) throw new Error('Job yaratilmadi');
      jobId = job.id;
      await updateJobStatus(job.id, 'processing');

      const result = await runTranslation({ documentTypeId: selectedTypeId, source, supporting: supportingInputs, studentName: effectiveStudentName });
      if (!result) throw new Error('Tarjima amalga oshmadi');

      await saveTranslationResult(job.id, result);
      toast.success('Tarjima tayyor — PDF yaratildi');
      setActiveResult({ jobId: job.id, documentTypeId: selectedTypeId, structured: result.structured, pdfPath: result.pdfPath });
      setEditNames(result.structured.verifiedNames ?? {});
      onJobCreated?.();
      await fetchJobs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Xatolik yuz berdi';
      if (jobId) await updateJobStatus(jobId, 'failed', msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Result dialog: preview, edit names, regenerate, download ----
  useEffect(() => {
    if (!activeResult) { setPreviewUrl(null); return; }
    let revoked: string | null = null;
    setLoadingPreview(true);
    proxyBlobUrl(activeResult.pdfPath, 'translation-documents').then((url) => {
      revoked = url;
      setPreviewUrl(url);
      setLoadingPreview(false);
    });
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [activeResult?.pdfPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const replaceInStructured = (s: StructuredTranslation, oldStr: string, newStr: string): StructuredTranslation => {
    if (!oldStr || oldStr === newStr) return s;
    const rep = (t: string) => (t ? t.split(oldStr).join(newStr) : t);
    return {
      ...s,
      blocks: s.blocks.map((b): TranslationBlock => {
        switch (b.type) {
          case 'title': case 'heading': case 'paragraph': case 'annotation': return { ...b, text: rep(b.text) };
          case 'field': return { ...b, label: rep(b.label), value: rep(b.value) };
          case 'table': return { ...b, header: b.header?.map(rep), rows: b.rows.map((r) => r.map(rep)) };
          default: return b;
        }
      }),
    };
  };

  const handleRegenerate = async () => {
    if (!activeResult) return;
    let structured = activeResult.structured;
    const original = structured.verifiedNames ?? {};
    (['student', 'father', 'mother'] as const).forEach((k) => {
      const oldVal = original[k]; const newVal = editNames[k];
      if (oldVal && newVal && oldVal !== newVal) structured = replaceInStructured(structured, oldVal, newVal);
    });
    structured = { ...structured, verifiedNames: { ...original, ...editNames } };

    const result = await regeneratePdf(activeResult.documentTypeId, structured);
    if (!result) return;
    await saveTranslationResult(activeResult.jobId, result, structured.verifiedNames);
    setActiveResult({ jobId: activeResult.jobId, documentTypeId: activeResult.documentTypeId, structured: result.structured, pdfPath: result.pdfPath });
    toast.success('PDF yangilandi');
    await fetchJobs();
  };

  const handleDownload = async (path: string, fileName: string) => {
    const url = await proxyBlobUrl(path, 'translation-documents');
    if (!url) { toast.error('Yuklab bo\'lmadi'); return; }
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openExistingJob = (job: JobRow) => {
    if (!job.structured_translation || !job.output_pdf_path) return;
    setActiveResult({ jobId: job.id, documentTypeId: job.document_type_id, structured: job.structured_translation, pdfPath: job.output_pdf_path });
    setEditNames(job.verified_names ?? job.structured_translation.verifiedNames ?? {});
  };

  const handleDelete = async (jobId: string) => {
    await deleteJob(jobId);
    await fetchJobs();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { v: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: JSX.Element }> = {
      pending: { v: 'outline', label: 'Kutilmoqda', icon: <Clock className="h-3 w-3" /> },
      processing: { v: 'secondary', label: 'Jarayonda', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      completed: { v: 'default', label: 'Tayyor', icon: <CheckCircle className="h-3 w-3" /> },
      failed: { v: 'destructive', label: 'Xatolik', icon: <AlertCircle className="h-3 w-3" /> },
    };
    const c = map[status] ?? map.pending;
    return <Badge variant={c.v} className="gap-1">{c.icon}{c.label}</Badge>;
  };

  if (loadingTypes) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Standalone student picker */}
      {!studentId && (
        <Card>
          <CardContent className="pt-4">
            <Label>Talaba</Label>
            <Select value={pickedStudentId} onValueChange={setPickedStudentId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Talabani tanlang..." /></SelectTrigger>
              <SelectContent>
                {students.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {effectiveStudentId && (
        <>
          {/* New translation */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" />Yangi Tarjima</CardTitle>
              <CardDescription>
                Hujjat turini tanlang — tizim talaba hujjatlaridan asl nusxa va qo'shimcha hujjatlarni avtomatik biriktiradi, tarjima qiladi va PDF yaratadi.
                {effectiveStudentName && <span className="font-medium"> Talaba: {effectiveStudentName}</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Type */}
              <div className="space-y-2">
                <Label>Hujjat Turi *</Label>
                <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                  <SelectTrigger><SelectValue placeholder="Hujjat turini tanlang..." /></SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((t) => <SelectItem key={t.id} value={t.id}>{getLocalizedName(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {selectedTypeId && (
                <>
                  {/* Source */}
                  <div className="space-y-2">
                    <Label>Asl Hujjat (tarjima qilinadigan) *</Label>
                    {!uploadedSource ? (
                      <Select value={sourceDocId} onValueChange={setSourceDocId}>
                        <SelectTrigger><SelectValue placeholder="Talaba hujjatlaridan tanlang..." /></SelectTrigger>
                        <SelectContent>
                          {studentDocs.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Hujjatlar topilmadi</div>}
                          {studentDocs.map((d) => <SelectItem key={d.id} value={d.id}>{docLabel(d)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-green-500 bg-green-500/10 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2 truncate"><Check className="h-4 w-4 text-green-600" />{uploadedSource.name}</span>
                        <button onClick={() => setUploadedSource(null)} className="text-destructive"><X className="h-4 w-4" /></button>
                      </div>
                    )}
                    <label className="inline-flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
                      <FilePlus className="h-3 w-3" /> Yangi fayl yuklash
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setUploadedSource(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>

                  {/* Supporting */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Users className="h-4 w-4" />Qo'shimcha Hujjatlar (ismlarni to'g'ri yozish uchun)</Label>
                    {supporting.length === 0 && extraSupportFiles.length === 0 ? (
                      <p className="text-xs text-yellow-600">Talaba zagran pasporti topilmadi — ismlar noto'g'ri bo'lishi mumkin. Pasport yuklang.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {supporting.map((s, i) => (
                          <Badge key={`${s.path}-${i}`} variant="secondary" className="gap-1">
                            {s.role === 'student_passport' ? <User className="h-3 w-3" /> : s.role?.startsWith('father') || s.role?.startsWith('mother') ? <Users className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                            {s.label}
                            {s.removable && <button onClick={() => setSupporting((prev) => prev.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>}
                          </Badge>
                        ))}
                        {extraSupportFiles.map((f, i) => (
                          <Badge key={`extra-${i}`} variant="outline" className="gap-1">
                            <FileText className="h-3 w-3" />{f.name}
                            <button onClick={() => setExtraSupportFiles((prev) => prev.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <label className="inline-flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
                      <FilePlus className="h-3 w-3" /> Pasport / ID qo'shish
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(e) => setExtraSupportFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])} />
                    </label>
                  </div>

                  <Button onClick={handleTranslate} disabled={submitting || translating} className="w-full" size="lg">
                    {submitting || translating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />AI tarjima qilmoqda...</> : <><Sparkles className="h-4 w-4 mr-2" />Tarjima qilish va PDF yaratish</>}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Jobs */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Tarjimalar ({jobs.length})</h3>
            <Button variant="outline" size="sm" onClick={fetchJobs}><RefreshCw className="h-4 w-4 mr-2" />Yangilash</Button>
          </div>

          {loadingJobs ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : jobs.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Hozircha tarjimalar yo'q</p></CardContent></Card>
          ) : (
            <ScrollArea className="h-[420px]">
              <div className="space-y-3">
                {jobs.map((job) => (
                  <Card key={job.id} className={cn(job.status === 'completed' && 'border-green-200', job.status === 'failed' && 'border-red-200')}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {job.document_type && <span className="font-medium">{getLocalizedName(job.document_type)}</span>}
                            {statusBadge(job.status)}
                          </div>
                          <p className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleString()}</p>
                          {job.error_message && <p className="text-xs text-red-600 mt-1">{job.error_message}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          {job.status === 'completed' && job.output_pdf_path && (
                            <>
                              <Button variant="ghost" size="icon" title="Ko'rish / tahrirlash" onClick={() => openExistingJob(job)}><FileText className="h-4 w-4 text-primary" /></Button>
                              <Button variant="ghost" size="icon" title="PDF yuklab olish" onClick={() => handleDownload(job.output_pdf_path!, `${job.document_type?.code ?? 'translation'}.pdf`)}><Download className="h-4 w-4 text-green-600" /></Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" title="O'chirish" onClick={() => handleDelete(job.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </>
      )}

      {/* Result dialog */}
      <Dialog open={!!activeResult} onOpenChange={(o) => { if (!o) setActiveResult(null); }}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Languages className="h-5 w-5 text-primary" />Tarjima Natijasi — Certified Translation</DialogTitle>
          </DialogHeader>
          {activeResult && (
            <div className="grid md:grid-cols-2 gap-4 flex-1 min-h-0">
              {/* Left: verify + flags */}
              <div className="space-y-4 overflow-auto pr-1">
                <div className="space-y-3">
                  <Label className="flex items-center gap-1"><User className="h-4 w-4" />Tasdiqlangan ismlar (pasport bo'yicha)</Label>
                  {(['student', 'father', 'mother'] as const).map((k) =>
                    (editNames[k] !== undefined || activeResult.structured.verifiedNames?.[k] !== undefined) ? (
                      <div key={k} className="space-y-1">
                        <span className="text-xs text-muted-foreground capitalize">{k === 'student' ? 'Talaba' : k === 'father' ? 'Ota' : 'Ona'}</span>
                        <Input value={editNames[k] ?? ''} onChange={(e) => setEditNames((p) => ({ ...p, [k]: e.target.value }))} />
                      </div>
                    ) : null,
                  )}
                </div>

                {activeResult.structured.unclearItems?.length > 0 && (
                  <div className="rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 p-3">
                    <p className="flex items-center gap-1 text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1"><AlertTriangle className="h-4 w-4" />Tekshirish kerak</p>
                    <ul className="list-disc pl-5 text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                      {activeResult.structured.unclearItems.map((u, i) => <li key={i}>{u}</li>)}
                    </ul>
                  </div>
                )}

                {activeResult.structured.detectedSupportingDocs?.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                    <p className="font-medium mb-1">Aniqlangan hujjatlar</p>
                    {activeResult.structured.detectedSupportingDocs.map((d, i) => (
                      <p key={i} className="text-muted-foreground">{d.role}: <span className="text-foreground">{d.extractedName}</span> ({d.documentType})</p>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleRegenerate} disabled={regenerating} className="flex-1">
                    {regenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Ismlarni saqlab, PDF yangilash
                  </Button>
                </div>
              </div>

              {/* Right: PDF preview */}
              <div className="flex flex-col min-h-0">
                <div className="flex-1 min-h-[300px] border rounded-lg overflow-hidden bg-muted/30">
                  {loadingPreview ? (
                    <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : previewUrl ? (
                    <iframe src={previewUrl} title="PDF" className="w-full h-full min-h-[400px]" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Ko'rib bo'lmadi</div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveResult(null)}>Yopish</Button>
            {activeResult && <Button onClick={() => handleDownload(activeResult.pdfPath, 'certified_translation.pdf')}><Download className="h-4 w-4 mr-2" />PDF yuklab olish</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
