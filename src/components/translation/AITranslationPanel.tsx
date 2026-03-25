import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslationTraining, TranslationDocumentType } from '@/hooks/useTranslationTraining';
import { useDocumentTranslation } from '@/hooks/useDocumentTranslation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Languages, 
  Sparkles, 
  FileText,
  AlertCircle,
  Loader2,
  Upload,
  Check,
  X,
  Download,
  FileUp,
  Copy,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AITranslationPanelProps {
  studentName?: string;
  parentNames?: string;
  onTranslationComplete?: (translatedText: string, documentTypeId: string) => void;
}

export function AITranslationPanel({ 
  studentName, 
  parentNames,
  onTranslationComplete 
}: AITranslationPanelProps) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const currentLang = i18n.language;
  const { documentTypes, templates, requirements, loading: loadingTypes } = useTranslationTraining();
  const { translateFromFile, translating } = useDocumentTranslation();
  
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [templatesCount, setTemplatesCount] = useState(0);
  
  // Translation result state
  const [translationResult, setTranslationResult] = useState<{
    translatedText: string;
    extractedText?: string;
    documentIdentification?: string;
    documentType: { code: string; name: string; nameEn: string };
    templatesUsed: number;
    wasOCR?: boolean;
    docxFilePath?: string;
  } | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const getLocalizedName = (item: TranslationDocumentType) => {
    if (currentLang === 'uz') return item.name_uz;
    if (currentLang === 'ru') return item.name_ru || item.name_uz;
    if (currentLang === 'ko') return item.name_ko || item.name_en || item.name_uz;
    return item.name_en || item.name_uz;
  };

  // Get requirements for selected type
  const selectedTypeRequirements = requirements.filter(
    r => r.document_type_id === selectedTypeId
  );

  // Count approved templates for selected type
  useEffect(() => {
    if (selectedTypeId) {
      const count = templates.filter(t => 
        t.document_type_id === selectedTypeId && 
        t.is_approved
      ).length;
      setTemplatesCount(count);
    } else {
      setTemplatesCount(0);
    }
  }, [selectedTypeId, templates]);

  const handleTranslate = async () => {
    if (!selectedTypeId || !originalFile || !user) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }

    setUploading(true);

    try {
      // Upload original file to storage
      const originalPath = `translations/${Date.now()}_original_${originalFile.name}`;
      const { error: origError } = await supabase.storage
        .from('translation-documents')
        .upload(originalPath, originalFile);

      if (origError) throw origError;

      // Upload supporting files and collect their paths
      const supportingPaths: string[] = [];
      for (const file of supportingFiles) {
        const supportPath = `translations/${Date.now()}_supporting_${file.name}`;
        const { error } = await supabase.storage
          .from('translation-documents')
          .upload(supportPath, file);
        if (!error) {
          supportingPaths.push(supportPath);
        }
      }

      // Call AI translation
      const result = await translateFromFile(
        selectedTypeId,
        originalPath,
        supportingPaths.length > 0 ? supportingPaths : undefined,
        studentName,
        parentNames,
        notes || undefined
      );

      if (result) {
        setTranslationResult(result);
        setShowResultDialog(true);
        onTranslationComplete?.(result.translatedText, selectedTypeId);
      }
    } catch (error: any) {
      console.error('Translation error:', error);
      toast.error(error.message || 'Tarjima qilishda xatolik');
    } finally {
      setUploading(false);
    }
  };

  const handleCopyTranslation = () => {
    if (translationResult?.translatedText) {
      navigator.clipboard.writeText(translationResult.translatedText);
      toast.success('Tarjima nusxalandi!');
    }
  };

  const handleDownloadTranslation = () => {
    if (translationResult?.translatedText) {
      const blob = new Blob([translationResult.translatedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `translation_${translationResult.documentType.code}_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const resetForm = () => {
    setOriginalFile(null);
    setSupportingFiles([]);
    setNotes('');
    setSelectedTypeId('');
    setTranslationResult(null);
  };

  

  if (loadingTypes) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Hujjat Tarjimasi
          </CardTitle>
          <CardDescription>
            Original hujjatni yuklang - AI avtomatik tarjima qiladi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Document Type Selection */}
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
            {selectedTypeId && (
              <div className="flex items-center gap-2 text-xs">
                {templatesCount > 0 ? (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    {templatesCount} ta namuna mavjud (AI o'rgangan)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-300">
                    <AlertCircle className="h-3 w-3" />
                    Namunalar mavjud emas
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Original File Upload */}
          <div className="space-y-2">
            <Label>Original Hujjat (O'zbekcha) *</Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                originalFile ? "border-green-500 bg-green-500/10" : "border-muted-foreground/25 hover:border-primary"
              )}
              onClick={() => document.getElementById('ai-original-file')?.click()}
            >
              <input
                id="ai-original-file"
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setOriginalFile(e.target.files?.[0] || null)}
              />
              {originalFile ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium text-sm">{originalFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOriginalFile(null);
                    }}
                    className="ml-2 p-1 hover:bg-destructive/20 rounded"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <FileUp className="h-10 w-10 mx-auto mb-2 text-primary/50" />
                  <p className="text-sm font-medium">Original hujjatni yuklang</p>
                  <p className="text-xs mt-1">PDF, JPG, PNG (skanerdan yoki telefon rasmi)</p>
                </div>
              )}
            </div>
          </div>

          {/* Supporting Documents */}
          <div className="space-y-2">
            <Label>Qo'shimcha Hujjatlar (Pasportlar, ID kartalar)</Label>
            <p className="text-xs text-yellow-600">
              Ismlarni to'g'ri yozish uchun pasport yoki ID karta skanlarini yuklang
            </p>
            
            {/* Show required documents for selected type */}
            {selectedTypeRequirements.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedTypeRequirements.map((req) => (
                  <Badge key={req.id} variant="outline" className="text-xs">
                    {req.is_student_document && '👤 '}
                    {req.is_parent_document && '👨‍👩‍👧 '}
                    {currentLang === 'ru' ? req.required_document_name_ru || req.required_document_name_uz : 
                     currentLang === 'en' ? req.required_document_name_en || req.required_document_name_uz :
                     req.required_document_name_uz}
                  </Badge>
                ))}
              </div>
            )}

            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                supportingFiles.length > 0 ? "border-blue-500 bg-blue-500/10" : "border-muted-foreground/25 hover:border-primary"
              )}
              onClick={() => document.getElementById('ai-supporting-files')?.click()}
            >
              <input
                id="ai-supporting-files"
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setSupportingFiles(prev => [...prev, ...files]);
                }}
              />
              {supportingFiles.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">{supportingFiles.length} ta fayl</span>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {supportingFiles.map((file, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {file.name}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSupportingFiles(prev => prev.filter((_, idx) => idx !== i));
                          }}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <Upload className="h-6 w-6 mx-auto mb-1" />
                  <p className="text-sm">Pasport, ID karta</p>
                  <p className="text-xs">PDF, JPG, PNG</p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Context */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Izohlar (ixtiyoriy)
            </summary>
            <div className="mt-2 space-y-2">
              {studentName && (
                <Badge variant="outline">Talaba: {studentName}</Badge>
              )}
              {parentNames && (
                <Badge variant="outline" className="ml-2">Ota-ona: {parentNames}</Badge>
              )}
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Qo'shimcha izohlar..."
                className="text-sm"
                rows={2}
              />
            </div>
          </details>

          {/* Translate Button */}
          <Button
            onClick={handleTranslate}
            disabled={!selectedTypeId || !originalFile || uploading || translating}
            className="w-full bg-gradient-to-r from-primary to-primary/80"
            size="lg"
          >
            {uploading || translating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {translating ? 'AI tarjima qilmoqda...' : 'Yuklanmoqda...'}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                AI Tarjima Qilish
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            AI hujjatni o'qiydi va ingliz tiliga tarjima qiladi
          </p>
        </CardContent>
      </Card>

      {/* Translation Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Tarjima Tayyor!
              {translationResult?.wasOCR && (
                <Badge variant="secondary" className="ml-2">OCR + Tarjima</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-4 pb-4">
              {/* Document Identification */}
              {translationResult?.documentIdentification && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Hujjatlar aniqlandi
                  </Label>
                  <div className="border rounded-lg p-3 bg-blue-500/10 max-h-24 overflow-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono text-blue-700 dark:text-blue-300">
                      {translationResult.documentIdentification}
                    </pre>
                  </div>
                </div>
              )}

              {/* Extracted Text (if OCR was performed) */}
              {translationResult?.extractedText && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Ajratib olingan matn (O'zbekcha)
                  </Label>
                  <div className="border rounded-lg p-3 bg-muted/30 max-h-40 overflow-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {translationResult.extractedText}
                    </pre>
                  </div>
                </div>
              )}

              {/* Translated Text */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Tarjima (Inglizcha)
                </Label>
                <div className="border rounded-lg p-3 bg-background max-h-60 overflow-auto">
                  <pre className="text-sm whitespace-pre-wrap">
                    {translationResult?.translatedText}
                  </pre>
                </div>
              </div>

              {/* Info badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  <FileText className="h-3 w-3 mr-1" />
                  {translationResult?.documentType.name}
                </Badge>
                {(translationResult?.templatesUsed ?? 0) > 0 && (
                  <Badge variant="secondary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {translationResult?.templatesUsed} namunadan o'rgangan
                  </Badge>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleCopyTranslation}>
              <Copy className="h-4 w-4 mr-2" />
              Nusxalash
            </Button>
            <Button variant="outline" onClick={handleDownloadTranslation}>
              <Download className="h-4 w-4 mr-2" />
              Yuklab olish
            </Button>
            <Button onClick={() => {
              setShowResultDialog(false);
              resetForm();
            }}>
              Yangi tarjima
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
