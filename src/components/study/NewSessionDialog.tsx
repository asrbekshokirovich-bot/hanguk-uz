import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BookOpen, FileText, GraduationCap, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSession: (
    documentType: 'study_plan' | 'personal_statement',
    universityId?: string
  ) => Promise<void>;
  isCreating: boolean;
}

export function NewSessionDialog({
  open,
  onOpenChange,
  onCreateSession,
  isCreating,
}: NewSessionDialogProps) {
  const { t } = useTranslation();
  const [documentType, setDocumentType] = useState<'study_plan' | 'personal_statement'>('study_plan');
  const [selectedUniversity, setSelectedUniversity] = useState<string>('none');
  const [universities, setUniversities] = useState<Tables<'universities'>[]>([]);
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(true);

  useEffect(() => {
    const fetchUniversities = async () => {
      try {
        const { data, error } = await supabase
          .from('institutions')
          .select('*')
          .order('tier', { ascending: true, nullsFirst: false });

        if (!error && data) {
          setUniversities(data);
        }
      } catch (err) {
        console.error('Failed to fetch universities:', err);
      } finally {
        setIsLoadingUniversities(false);
      }
    };

    if (open) {
      fetchUniversities();
    }
  }, [open]);

  const handleCreate = async () => {
    await onCreateSession(
      documentType,
      selectedUniversity !== 'none' ? selectedUniversity : undefined
    );
    // Reset form
    setDocumentType('study_plan');
    setSelectedUniversity('none');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('study.startNewSession', 'Start New Training Session')}</DialogTitle>
          <DialogDescription>
            {t('study.chooseDocumentType', 'Choose what type of document you want to practice writing.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Document Type Selection */}
          <div className="space-y-3">
            <Label>{t('study.documentType', 'Document Type')}</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={documentType === 'study_plan' ? 'default' : 'outline'}
                className="h-auto min-h-[120px] py-4 flex-col gap-2 text-center items-center justify-start"
                onClick={() => setDocumentType('study_plan')}
              >
                <BookOpen className="h-6 w-6 shrink-0" />
                <span className="leading-tight">{t('study.plan', 'Study Plan')}</span>
                <span className="text-xs opacity-70 font-normal leading-tight text-center whitespace-normal">{t('study.academicGoals', 'Academic goals & timeline')}</span>
              </Button>
              <Button
                type="button"
                variant={documentType === 'personal_statement' ? 'default' : 'outline'}
                className="h-auto min-h-[120px] py-4 flex-col gap-2 text-center items-center justify-start"
                onClick={() => setDocumentType('personal_statement')}
              >
                <FileText className="h-6 w-6 shrink-0" />
                <span className="leading-tight">{t('study.personalStatement', 'Personal Statement')}</span>
                <span className="text-xs opacity-70 font-normal leading-tight text-center whitespace-normal">{t('study.yourStory', 'Your story & motivation')}</span>
              </Button>
            </div>
          </div>

          {/* University Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              {t('study.targetUniversityOptional', 'Target University (Optional)')}
            </Label>
            <Select value={selectedUniversity} onValueChange={setSelectedUniversity}>
              <SelectTrigger>
                <SelectValue placeholder={t('study.selectUniversity', 'Select a university...')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('study.noSpecificUniversity', 'No specific university')}</SelectItem>
                {universities.map(uni => (
                  <SelectItem key={uni.id} value={uni.id}>
                    {uni.name_en || uni.name_ko || uni.name_uz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('study.universitySelectionHint', 'Selecting a university provides personalized guidance specific to that institution.')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('study.creating', 'Creating...')}
              </>
            ) : (
              t('study.startSession', 'Start Session')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
