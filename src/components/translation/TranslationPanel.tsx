import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslationTraining, TranslationDocumentType } from '@/hooks/useTranslationTraining';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Languages, 
  Sparkles, 
  FileText,
  AlertCircle,
  Loader2,
  Upload,
  Check,
  X,
  Eye,
  Download,
  FileUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TranslationPanelProps {
  studentName?: string;
  parentNames?: string;
  onTranslationComplete?: (translatedText: string, documentTypeId: string) => void;
}

export function TranslationPanel({ 
  studentName, 
  parentNames,
  onTranslationComplete 
}: TranslationPanelProps) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const currentLang = i18n.language;
  const { documentTypes, templates, requirements, loading: loadingTypes } = useTranslationTraining();
  
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [translatedFile, setTranslatedFile] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [templatesCount, setTemplatesCount] = useState(0);

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

  const handleUploadTranslation = async () => {
    if (!selectedTypeId || !originalFile || !translatedFile || !user) {
      toast.error('Barcha maydonlarni to\'ldiring');
      return;
    }

    setUploading(true);

    try {
      // Upload original file
      const originalPath = `translations/${Date.now()}_original_${originalFile.name}`;
      const { error: origError } = await supabase.storage
        .from('translation-documents')
        .upload(originalPath, originalFile);

      if (origError) throw origError;

      // Upload translated file
      const translatedPath = `translations/${Date.now()}_translated_${translatedFile.name}`;
      const { error: transError } = await supabase.storage
        .from('translation-documents')
        .upload(translatedPath, translatedFile);

      if (transError) throw transError;

      // Upload supporting files
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

      // Create translation template record
      const { error: dbError } = await supabase
        .from('translation_templates')
        .insert({
          document_type_id: selectedTypeId,
          original_file_path: originalPath,
          translated_file_path: translatedPath,
          notes: notes || `Qo'shimcha hujjatlar: ${supportingPaths.length} ta`,
          uploaded_by: user.id,
          is_approved: false, // Needs approval
        });

      if (dbError) throw dbError;

      toast.success('Tarjima muvaffaqiyatli yuklandi! Tasdiqlashni kutmoqda.');
      
      // Reset form
      setOriginalFile(null);
      setTranslatedFile(null);
      setSupportingFiles([]);
      setNotes('');
      setSelectedTypeId('');

      onTranslationComplete?.(translatedPath, selectedTypeId);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Yuklashda xatolik');
    } finally {
      setUploading(false);
    }
  };

  const selectedType = documentTypes.find(t => t.id === selectedTypeId);

  if (loadingTypes) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Languages className="h-5 w-5 text-primary" />
          Hujjat Tarjimasi
        </CardTitle>
        <CardDescription>
          Original va tarjima qilingan PDF hujjatlarni yuklang
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
                  {templatesCount} ta namuna mavjud
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-300">
                  <AlertCircle className="h-3 w-3" />
                  Birinchi namuna
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* File Upload Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Original File */}
          <div className="space-y-2">
            <Label>Original Hujjat (O'zbekcha) *</Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                originalFile ? "border-green-500 bg-green-50" : "border-muted-foreground/25 hover:border-primary"
              )}
              onClick={() => document.getElementById('panel-original-file')?.click()}
            >
              <input
                id="panel-original-file"
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={(e) => setOriginalFile(e.target.files?.[0] || null)}
              />
              {originalFile ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium text-sm">{originalFile.name}</span>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <FileUp className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Original PDF yuklang</p>
                  <p className="text-xs">Faqat PDF</p>
                </div>
              )}
            </div>
          </div>

          {/* Translated File */}
          <div className="space-y-2">
            <Label>Tarjima Qilingan Hujjat (Inglizcha) *</Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                translatedFile ? "border-green-500 bg-green-50" : "border-muted-foreground/25 hover:border-primary"
              )}
              onClick={() => document.getElementById('panel-translated-file')?.click()}
            >
              <input
                id="panel-translated-file"
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={(e) => setTranslatedFile(e.target.files?.[0] || null)}
              />
              {translatedFile ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium text-sm">{translatedFile.name}</span>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <FileUp className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Tarjima PDF yuklang</p>
                  <p className="text-xs">Faqat PDF</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Supporting Documents */}
        <div className="space-y-2">
          <Label>Qo'shimcha Hujjatlar (Pasportlar, ID kartalar)</Label>
          <p className="text-xs text-muted-foreground">
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
              supportingFiles.length > 0 ? "border-blue-500 bg-blue-50" : "border-muted-foreground/25 hover:border-primary"
            )}
            onClick={() => document.getElementById('panel-supporting-files')?.click()}
          >
            <input
              id="panel-supporting-files"
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

        {/* Upload Button */}
        <Button
          onClick={handleUploadTranslation}
          disabled={!selectedTypeId || !originalFile || !translatedFile || uploading}
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
              Tarjimani Yuklash
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Yuklangan tarjimalar tasdiqlangandan so'ng AI o'rganish uchun ishlatiladi
        </p>
      </CardContent>
    </Card>
  );
}
