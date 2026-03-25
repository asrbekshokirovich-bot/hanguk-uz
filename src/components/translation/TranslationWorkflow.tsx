import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTranslation } from '@/hooks/useDocumentTranslation';
import { useTranslationTraining, TranslationDocumentType } from '@/hooks/useTranslationTraining';
import { checkAutoTranslation } from '@/hooks/useAutoTranslation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  FileText, 
  Check, 
  X, 
  Trash2, 
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  RefreshCw,
  User,
  Users,
  Sparkles,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TranslationWorkflowProps {
  studentId?: string;
  studentName?: string;
  onJobCreated?: () => void;
}

interface TranslationJobWithDetails {
  id: string;
  student_id: string;
  document_type_id: string;
  source_file_path: string;
  translated_file_path: string | null;
  translated_text: string | null;
  status: string;
  error_message: string | null;
  supporting_documents: any[];
  auto_triggered: boolean;
  created_at: string;
  completed_at: string | null;
  document_type?: TranslationDocumentType;
  student?: { full_name: string };
}

export function TranslationWorkflow({ studentId, studentName, onJobCreated }: TranslationWorkflowProps) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const currentLang = i18n.language;
  const { 
    translateText, 
    translateFromFile,
    translating, 
    createTranslationJob, 
    updateJobStatus,
    deleteJob 
  } = useDocumentTranslation();
  const { documentTypes, requirements, loading: loadingTypes } = useTranslationTraining();

  const [jobs, setJobs] = useState<TranslationJobWithDetails[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<Record<string, File>>({});
  const [uploading, setUploading] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<TranslationJobWithDetails | null>(null);
  const [checkingAuto, setCheckingAuto] = useState(false);

  const getLocalizedName = (item: TranslationDocumentType) => {
    if (currentLang === 'uz') return item.name_uz;
    if (currentLang === 'ru') return item.name_ru || item.name_uz;
    if (currentLang === 'ko') return item.name_ko || item.name_en || item.name_uz;
    return item.name_en || item.name_uz;
  };

  const selectedTypeRequirements = requirements.filter(
    r => r.document_type_id === selectedTypeId
  );

  const fetchJobs = async () => {
    setLoadingJobs(true);
    
    let query = supabase
      .from('translation_jobs')
      .select('*, document_type:translation_document_types(*)')
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query.limit(50);

    if (!error && data) {
      // Fetch student names for each job
      const jobsWithStudents = await Promise.all(
        data.map(async (job) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', job.student_id)
            .maybeSingle();
          
          return {
            ...job,
            student: profile ? { full_name: profile.full_name } : undefined
          };
        })
      );
      setJobs(jobsWithStudents as TranslationJobWithDetails[]);
    }
    
    setLoadingJobs(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [studentId]);

  const handleCreateJob = async () => {
    if (!selectedTypeId || !sourceFile || !studentId) {
      toast.error('Barcha maydonlarni to\'ldiring');
      return;
    }

    setUploading(true);

    try {
      // Upload source file
      const sourcePath = `jobs/${studentId}/${Date.now()}_${sourceFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('translation-documents')
        .upload(sourcePath, sourceFile);

      if (uploadError) throw uploadError;

      // Upload supporting files
      const supportingDocs: { code: string; path: string }[] = [];
      for (const [code, file] of Object.entries(supportingFiles)) {
        const supportPath = `jobs/${studentId}/supporting_${Date.now()}_${file.name}`;
        const { error } = await supabase.storage
          .from('translation-documents')
          .upload(supportPath, file);
        
        if (!error) {
          supportingDocs.push({ code, path: supportPath });
        }
      }

      // Create job record
      const job = await createTranslationJob(
        studentId,
        selectedTypeId,
        sourcePath,
        undefined,
        false
      );

      if (job) {
        // Update with supporting documents
        await supabase
          .from('translation_jobs')
          .update({ supporting_documents: supportingDocs })
          .eq('id', job.id);

        // Reset form
        setSourceFile(null);
        setSupportingFiles({});
        setSelectedTypeId('');
        
        onJobCreated?.();
        fetchJobs();
      }
    } catch (error: any) {
      console.error('Failed to create job:', error);
      toast.error(error.message || 'So\'rov yaratishda xatolik');
    } finally {
      setUploading(false);
    }
  };

  const handleProcessJob = async (job: TranslationJobWithDetails) => {
    setProcessingJobId(job.id);

    try {
      // Update status to processing
      await updateJobStatus(job.id, 'processing');

      // Collect supporting document paths if available
      const supportingPaths: string[] = [];
      if (job.supporting_documents && Array.isArray(job.supporting_documents)) {
        for (const doc of job.supporting_documents) {
          if (doc.path) {
            supportingPaths.push(doc.path);
          }
        }
      }

      console.log('Processing job with OCR:', {
        sourceFile: job.source_file_path,
        supportingDocs: supportingPaths.length
      });

      // Use OCR + Translation
      const result = await translateFromFile(
        job.document_type_id,
        job.source_file_path,
        supportingPaths.length > 0 ? supportingPaths : undefined,
        studentName,
        undefined,  // parentNames
        undefined   // additionalContext
      );

      if (result) {
        // Update job with translated text
        await updateJobStatus(
          job.id, 
          'completed', 
          result.translatedText,
          undefined,  // translatedFilePath - could generate PDF here
          undefined   // errorMessage
        );

        // Show extracted text if OCR was performed
        if (result.extractedText) {
          console.log('OCR extracted text:', result.extractedText.substring(0, 200) + '...');
        }

        toast.success(
          result.wasOCR 
            ? 'Hujjat avtomatik o\'qildi va tarjima qilindi!' 
            : 'Tarjima muvaffaqiyatli bajarildi!'
        );
      } else {
        await updateJobStatus(job.id, 'failed', undefined, undefined, 'Tarjima amalga oshmadi');
      }
      
    } catch (error: any) {
      console.error('Processing error:', error);
      await updateJobStatus(job.id, 'failed', undefined, undefined, error.message);
      toast.error(error.message || 'Xatolik yuz berdi');
    } finally {
      setProcessingJobId(null);
      fetchJobs();
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    await deleteJob(jobId);
    fetchJobs();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: 'outline', label: 'Kutilmoqda' },
      processing: { variant: 'secondary', label: 'Jarayonda' },
      completed: { variant: 'default', label: 'Tayyor' },
      failed: { variant: 'destructive', label: 'Xatolik' },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getFileUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from('translation-documents')
      .createSignedUrl(path, 3600);
    return data?.signedUrl;
  };

  const handlePreviewFile = async (path: string) => {
    const url = await getFileUrl(path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (loadingTypes) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs" className="gap-2">
            <FileText className="h-4 w-4" />
            So'rovlar ({jobs.length})
          </TabsTrigger>
          {studentId && (
            <TabsTrigger value="new" className="gap-2">
              <Upload className="h-4 w-4" />
              Yangi So'rov
            </TabsTrigger>
          )}
        </TabsList>

        {/* Jobs List */}
        <TabsContent value="jobs" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-medium">Tarjima So'rovlari</h3>
            <div className="flex items-center gap-2">
              {studentId && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={async () => {
                    if (!studentId || !user) return;
                    setCheckingAuto(true);
                    const { triggered, skipped } = await checkAutoTranslation(studentId, user.id);
                    if (triggered.length === 0 && skipped.length === 0) {
                      toast.info('Avtomatik tarjima uchun hujjatlar topilmadi');
                    }
                    await fetchJobs();
                    setCheckingAuto(false);
                  }}
                  disabled={checkingAuto}
                >
                  {checkingAuto ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Avtomatik Tekshirish
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={fetchJobs}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Yangilash
              </Button>
            </div>
          </div>

          {loadingJobs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Hozircha tarjima so'rovlari yo'q</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {jobs.map((job) => (
                  <Card key={job.id} className={cn(
                    "transition-colors",
                    job.status === 'completed' && "border-green-200 bg-green-50/30",
                    job.status === 'failed' && "border-red-200 bg-red-50/30"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(job.status)}
                            {job.document_type && (
                              <span className="font-medium">
                                {getLocalizedName(job.document_type)}
                              </span>
                            )}
                            {getStatusBadge(job.status)}
                            {job.auto_triggered && (
                              <Badge variant="outline" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Avtomatik
                              </Badge>
                            )}
                          </div>
                          
                          {!studentId && job.student && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                              <User className="h-3 w-3" />
                              {job.student.full_name}
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground">
                            Yaratilgan: {new Date(job.created_at).toLocaleString()}
                            {job.completed_at && (
                              <> • Tugallangan: {new Date(job.completed_at).toLocaleString()}</>
                            )}
                          </p>

                          {job.error_message && (
                            <p className="text-xs text-red-600 mt-1">{job.error_message}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePreviewFile(job.source_file_path)}
                            title="Original hujjatni ko'rish"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {job.translated_file_path && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePreviewFile(job.translated_file_path!)}
                              title="Tarjimani ko'rish"
                            >
                              <Download className="h-4 w-4 text-green-600" />
                            </Button>
                          )}

                          {job.translated_text && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPreviewJob(job)}
                              title="Tarjima matnini ko'rish"
                            >
                              <FileText className="h-4 w-4 text-primary" />
                            </Button>
                          )}

                          {job.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleProcessJob(job)}
                              disabled={processingJobId === job.id}
                              title="Tarjima qilish"
                            >
                              {processingJobId === job.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4 text-primary" />
                              )}
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteJob(job.id)}
                            title="O'chirish"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* New Job Form */}
        {studentId && (
          <TabsContent value="new" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Yangi Tarjima So'rovi</CardTitle>
                <CardDescription>
                  {studentName && `Talaba: ${studentName}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Document Type */}
                <div className="space-y-2">
                  <Label>Hujjat Turi *</Label>
                  <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Hujjat turini tanlang..." />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {getLocalizedName(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Source Document */}
                <div className="space-y-2">
                  <Label>Original Hujjat *</Label>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                      sourceFile ? "border-green-500 bg-green-50" : "border-muted-foreground/25 hover:border-primary"
                    )}
                    onClick={() => document.getElementById('source-doc')?.click()}
                  >
                    <input
                      id="source-doc"
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => setSourceFile(e.target.files?.[0] || null)}
                    />
                    {sourceFile ? (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <Check className="h-5 w-5" />
                        <span className="font-medium">{sourceFile.name}</span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <Upload className="h-8 w-8 mx-auto mb-2" />
                        <p>Hujjatni yuklang</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Required Supporting Documents */}
                {selectedTypeRequirements.length > 0 && (
                  <div className="space-y-3">
                    <Label>Qo'shimcha Hujjatlar</Label>
                    {selectedTypeRequirements.map((req) => (
                      <div key={req.id} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {req.is_student_document && <User className="h-3 w-3" />}
                            {req.is_parent_document && <Users className="h-3 w-3" />}
                            <span className="text-sm">{req.required_document_name_uz}</span>
                            {req.is_required && (
                              <Badge variant="destructive" className="text-xs">Majburiy</Badge>
                            )}
                          </div>
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSupportingFiles(prev => ({
                                  ...prev,
                                  [req.required_document_code]: file
                                }));
                              }
                            }}
                          />
                        </div>
                        {supportingFiles[req.required_document_code] && (
                          <Check className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Submit */}
                <Button
                  onClick={handleCreateJob}
                  disabled={!selectedTypeId || !sourceFile || uploading}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Yuklanmoqda...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      So'rov Yaratish
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Translation Preview Dialog */}
      <Dialog open={!!previewJob} onOpenChange={() => setPreviewJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tarjima Natijasi</DialogTitle>
          </DialogHeader>
          {previewJob && (
            <div className="space-y-4">
              {previewJob.document_type && (
                <Badge>{getLocalizedName(previewJob.document_type)}</Badge>
              )}
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {previewJob.translated_text}
                </pre>
              </ScrollArea>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(previewJob.translated_text || '');
                    toast.success('Nusxalandi');
                  }}
                >
                  Nusxalash
                </Button>
                <Button onClick={() => setPreviewJob(null)}>
                  Yopish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
