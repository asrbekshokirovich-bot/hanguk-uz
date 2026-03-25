import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslationTraining, TranslationDocumentType, TranslationTemplate } from '@/hooks/useTranslationTraining';
import { AITranslationPanel } from '@/components/translation/AITranslationPanel';
import { TranslationWorkflow } from '@/components/translation/TranslationWorkflow';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { 
  Upload, 
  FileText, 
  Check, 
  X, 
  Trash2, 
  Eye, 
  Plus,
  BookOpen,
  Settings2,
  Sparkles,
  FileCheck,
  Languages,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TranslationTrainingContent() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;
  const {
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
  } = useTranslationTraining();

  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [translatedFile, setTranslatedFile] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showAddRequirement, setShowAddRequirement] = useState(false);
  const [newReqCode, setNewReqCode] = useState('');
  const [newReqNameUz, setNewReqNameUz] = useState('');
  const [newReqNameRu, setNewReqNameRu] = useState('');
  const [newReqNameEn, setNewReqNameEn] = useState('');
  const [newReqIsStudent, setNewReqIsStudent] = useState(true);
  const [newReqIsParent, setNewReqIsParent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Template text editing state
  const [editingTemplate, setEditingTemplate] = useState<TranslationTemplate | null>(null);
  const [editOriginalText, setEditOriginalText] = useState('');
  const [editTranslatedText, setEditTranslatedText] = useState('');
  const [savingText, setSavingText] = useState(false);

  const getLocalizedName = (item: TranslationDocumentType) => {
    if (currentLang === 'uz') return item.name_uz;
    if (currentLang === 'ru') return item.name_ru || item.name_uz;
    if (currentLang === 'ko') return item.name_ko || item.name_en || item.name_uz;
    return item.name_en || item.name_uz;
  };

  const handleUpload = async () => {
    if (!selectedTypeId || !originalFile || !translatedFile) return;

    setUploading(true);
    await uploadTrainingPair(
      selectedTypeId, 
      originalFile, 
      translatedFile, 
      supportingFiles, 
      notes || undefined,
      originalText || undefined,
      translatedText || undefined
    );
    setUploading(false);
    setOriginalFile(null);
    setTranslatedFile(null);
    setSupportingFiles([]);
    setNotes('');
    setOriginalText('');
    setTranslatedText('');
  };
  
  const handleEditTemplate = (template: TranslationTemplate) => {
    setEditingTemplate(template);
    setEditOriginalText(template.original_text || '');
    setEditTranslatedText(template.translated_text || '');
  };
  
  const handleSaveTemplateText = async () => {
    if (!editingTemplate) return;
    
    setSavingText(true);
    await updateTemplateText(editingTemplate.id, editOriginalText, editTranslatedText);
    setSavingText(false);
    setEditingTemplate(null);
    setEditOriginalText('');
    setEditTranslatedText('');
  };

  const handleAddRequirement = async () => {
    if (!selectedTypeId || !newReqCode || !newReqNameUz) return;

    await addRequirement(
      selectedTypeId,
      newReqCode,
      newReqNameUz,
      newReqNameRu || undefined,
      newReqNameEn || undefined,
      newReqIsStudent,
      newReqIsParent
    );

    setShowAddRequirement(false);
    setNewReqCode('');
    setNewReqNameUz('');
    setNewReqNameRu('');
    setNewReqNameEn('');
    setNewReqIsStudent(true);
    setNewReqIsParent(false);
  };

  const handlePreview = async (path: string) => {
    const url = await getFileUrl(path);
    if (url) {
      setPreviewUrl(url);
    }
  };

  const selectedTypeTemplates = templates.filter(t => 
    !selectedTypeId || t.document_type_id === selectedTypeId
  );

  const selectedTypeRequirements = requirements.filter(r =>
    selectedTypeId && r.document_type_id === selectedTypeId
  );

  const approvedCount = templates.filter(t => t.is_approved).length;
  const pendingCount = templates.filter(t => !t.is_approved).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Tarjima Tizimi
          </h1>
          <p className="text-muted-foreground">
            AI ni o'rgatish uchun original va tarjima qilingan hujjatlarni yuklang
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1">
            <FileCheck className="h-3 w-3" />
            {approvedCount} tasdiqlangan
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <FileText className="h-3 w-3" />
            {pendingCount} kutilmoqda
          </Badge>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="translate" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="translate" className="gap-2">
            <Languages className="h-4 w-4" />
            Tarjima
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            So'rovlar
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            O'rgatish
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Shablonlar ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="requirements" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Talablar
          </TabsTrigger>
        </TabsList>

        {/* Translate Tab - AI Translation */}
        <TabsContent value="translate" className="space-y-4">
          <AITranslationPanel />
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-4">
          <TranslationWorkflow />
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Yangi O'rgatish Juftligini Yuklash</CardTitle>
              <CardDescription>
                Original hujjat va uning tarjimasi bir xil formatda bo'lishi kerak
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
                    onClick={() => document.getElementById('original-file')?.click()}
                  >
                    <input
                      id="original-file"
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => setOriginalFile(e.target.files?.[0] || null)}
                    />
                    {originalFile ? (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <Check className="h-5 w-5" />
                        <span className="font-medium">{originalFile.name}</span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <Upload className="h-8 w-8 mx-auto mb-2" />
                        <p>Original hujjatni yuklang</p>
                        <p className="text-xs">PDF, DOC, DOCX, JPG, PNG</p>
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
                    onClick={() => document.getElementById('translated-file')?.click()}
                  >
                    <input
                      id="translated-file"
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => setTranslatedFile(e.target.files?.[0] || null)}
                    />
                    {translatedFile ? (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <Check className="h-5 w-5" />
                        <span className="font-medium">{translatedFile.name}</span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <Upload className="h-8 w-8 mx-auto mb-2" />
                        <p>Tarjimani yuklang</p>
                        <p className="text-xs">PDF, DOC, DOCX, JPG, PNG</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Supporting Documents */}
              <div className="space-y-2">
                <Label>Qo'shimcha Hujjatlar (Pasportlar, ID kartalar)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Ismlarni to'g'ri yozish uchun pasport yoki ID karta skanlarini yuklang
                </p>
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                    supportingFiles.length > 0 ? "border-blue-500 bg-blue-50" : "border-muted-foreground/25 hover:border-primary"
                  )}
                  onClick={() => document.getElementById('supporting-files')?.click()}
                >
                  <input
                    id="supporting-files"
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
                        <span className="font-medium">{supportingFiles.length} ta fayl yuklandi</span>
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
                      <p className="text-sm">Pasport, ID karta yoki boshqa qo'shimcha hujjatlar</p>
                      <p className="text-xs">PDF, JPG, PNG (bir nechta fayl yuklash mumkin)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Text Content Section */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <Label className="text-base font-semibold">Matn Kontenti (AI o'rganishi uchun muhim!)</Label>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  AI tarjimani o'rganishi uchun hujjat matnini qo'lda kiriting. Fayllarni yuklashning o'zi yetarli emas.
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Original Text */}
                  <div className="space-y-2">
                    <Label>Original Matn (O'zbekcha)</Label>
                    <Textarea
                      value={originalText}
                      onChange={(e) => setOriginalText(e.target.value)}
                      placeholder="Hujjatning o'zbekcha matnini shu yerga yozing yoki joylashtiring..."
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {originalText.length} belgi
                    </p>
                  </div>
                  
                  {/* Translated Text */}
                  <div className="space-y-2">
                    <Label>Tarjima Qilingan Matn (Inglizcha)</Label>
                    <Textarea
                      value={translatedText}
                      onChange={(e) => setTranslatedText(e.target.value)}
                      placeholder="Hujjatning inglizcha tarjimasini shu yerga yozing yoki joylashtiring..."
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {translatedText.length} belgi
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Izohlar (Ixtiyoriy)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bu hujjat haqida qo'shimcha ma'lumot..."
                  rows={3}
                />
              </div>

              {/* Upload Button */}
              <Button
                onClick={handleUpload}
                disabled={!selectedTypeId || !originalFile || !translatedFile || uploading}
                className="w-full"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Yuklash
                  </>
                )}
              </Button>
              
              {(!originalText || !translatedText) && (originalFile || translatedFile) && (
                <p className="text-sm text-yellow-600 text-center">
                  ⚠️ Matn kontenti kiritilmadi. AI bu shablondan o'rgana olmaydi.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O'rgatish Shablonlari</CardTitle>
              <CardDescription>
                Yuklangan hujjat juftliklari - AI bu namunalardan o'rganadi
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filter by type */}
              <div className="mb-4">
                <Select value={selectedTypeId || "all"} onValueChange={(v) => setSelectedTypeId(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Barcha turlar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha turlar</SelectItem>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {getLocalizedName(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {selectedTypeTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Hozircha shablonlar yo'q</p>
                    </div>
                  ) : (
                    selectedTypeTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onApprove={() => approveTemplate(template.id)}
                        onDelete={() => deleteTemplate(template.id)}
                        onPreview={handlePreview}
                        onEditText={() => handleEditTemplate(template)}
                        getLocalizedName={getLocalizedName}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requirements Tab */}
        <TabsContent value="requirements" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Tarjima Talablari</CardTitle>
                <CardDescription>
                  Har bir hujjat turi uchun qaysi qo'shimcha hujjatlar kerakligini belgilang
                </CardDescription>
              </div>
              <Dialog open={showAddRequirement} onOpenChange={setShowAddRequirement}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!selectedTypeId}>
                    <Plus className="h-4 w-4 mr-2" />
                    Talab Qo'shish
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Yangi Talab Qo'shish</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Hujjat Kodi *</Label>
                      <Input
                        value={newReqCode}
                        onChange={(e) => setNewReqCode(e.target.value)}
                        placeholder="masalan: student_id_card"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nomi (O'zbekcha) *</Label>
                      <Input
                        value={newReqNameUz}
                        onChange={(e) => setNewReqNameUz(e.target.value)}
                        placeholder="masalan: Talaba ID kartasi"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nomi (Ruscha)</Label>
                      <Input
                        value={newReqNameRu}
                        onChange={(e) => setNewReqNameRu(e.target.value)}
                        placeholder="Студенческое удостоверение"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nomi (Inglizcha)</Label>
                      <Input
                        value={newReqNameEn}
                        onChange={(e) => setNewReqNameEn(e.target.value)}
                        placeholder="Student ID Card"
                      />
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newReqIsStudent}
                          onChange={(e) => setNewReqIsStudent(e.target.checked)}
                        />
                        Talaba hujjati
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newReqIsParent}
                          onChange={(e) => setNewReqIsParent(e.target.checked)}
                        />
                        Ota-ona hujjati
                      </label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddRequirement(false)}>
                      Bekor qilish
                    </Button>
                    <Button onClick={handleAddRequirement} disabled={!newReqCode || !newReqNameUz}>
                      Qo'shish
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {/* Type selector */}
              <div className="mb-4">
                <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Hujjat turini tanlang" />
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

              {!selectedTypeId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Hujjat turini tanlang</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedTypeRequirements.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Bu tur uchun talablar yo'q</p>
                    </div>
                  ) : (
                    selectedTypeRequirements.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{req.required_document_name_uz}</p>
                            <div className="flex gap-2 mt-1">
                              {req.is_student_document && (
                                <Badge variant="outline" className="text-xs">Talaba</Badge>
                              )}
                              {req.is_parent_document && (
                                <Badge variant="outline" className="text-xs">Ota-ona</Badge>
                              )}
                              {req.is_required && (
                                <Badge variant="destructive" className="text-xs">Majburiy</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRequirement(req.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Hujjat Ko'rinishi</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe
              src={previewUrl}
              className="w-full h-[70vh] border rounded"
              title="Document Preview"
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Edit Template Text Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Shablon Matnini Tahrirlash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              AI tarjimani o'rganishi uchun original matn va uning tarjimasini kiriting.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Original Matn (O'zbekcha)</Label>
                <Textarea
                  value={editOriginalText}
                  onChange={(e) => setEditOriginalText(e.target.value)}
                  placeholder="Hujjatning o'zbekcha matnini shu yerga yozing..."
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {editOriginalText.length} belgi
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Tarjima Qilingan Matn (Inglizcha)</Label>
                <Textarea
                  value={editTranslatedText}
                  onChange={(e) => setEditTranslatedText(e.target.value)}
                  placeholder="Hujjatning inglizcha tarjimasini shu yerga yozing..."
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {editTranslatedText.length} belgi
                </p>
              </div>
            </div>
            
            {editingTemplate && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handlePreview(editingTemplate.original_file_path)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Originalni ko'rish
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handlePreview(editingTemplate.translated_file_path)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Tarjimani ko'rish
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Bekor qilish
            </Button>
            <Button 
              onClick={handleSaveTemplateText} 
              disabled={savingText || (!editOriginalText && !editTranslatedText)}
            >
              {savingText ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                'Saqlash'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Template Card Component
interface TemplateCardProps {
  template: TranslationTemplate;
  onApprove: () => void;
  onDelete: () => void;
  onPreview: (path: string) => void;
  onEditText: () => void;
  getLocalizedName: (type: TranslationDocumentType) => string;
}

function TemplateCard({ template, onApprove, onDelete, onPreview, onEditText, getLocalizedName }: TemplateCardProps) {
  const hasText = Boolean(template.original_text && template.translated_text);
  
  return (
    <div className={cn(
      "p-4 border rounded-lg",
      template.is_approved ? "border-green-200 bg-green-50/50" : "border-yellow-200 bg-yellow-50/50"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {template.document_type && (
              <Badge variant="secondary">
                {getLocalizedName(template.document_type)}
              </Badge>
            )}
            {template.is_approved ? (
              <Badge className="bg-green-100 text-green-800">
                <Check className="h-3 w-3 mr-1" />
                Tasdiqlangan
              </Badge>
            ) : (
              <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                Kutilmoqda
              </Badge>
            )}
            {hasText ? (
              <Badge className="bg-blue-100 text-blue-800">
                <FileText className="h-3 w-3 mr-1" />
                Matn mavjud
              </Badge>
            ) : (
              <Badge variant="outline" className="border-orange-500 text-orange-700">
                ⚠️ Matn yo'q
              </Badge>
            )}
          </div>
          {template.notes && (
            <p className="text-sm text-muted-foreground mb-2">{template.notes}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Yuklangan: {new Date(template.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => onPreview(template.original_file_path)} title="Originalni ko'rish">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onPreview(template.translated_file_path)} title="Tarjimani ko'rish">
            <FileText className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEditText} title="Matnni tahrirlash">
            <Settings2 className="h-4 w-4 text-primary" />
          </Button>
          {!template.is_approved && (
            <Button variant="ghost" size="icon" onClick={onApprove} title="Tasdiqlash">
              <Check className="h-4 w-4 text-green-600" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onDelete} title="O'chirish">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
