import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lightbulb, Loader2, MapPin, Check } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Suggestion = Tables<'student_suggestions'> & {
  university?: Tables<'universities'>;
};

interface SuggestedUniversitiesProps {
  suggestions: Suggestion[];
  onRefresh: () => void;
  onShowOnMap?: (universityId: string) => void;
}

export function SuggestedUniversities({ suggestions, onRefresh, onShowOnMap }: SuggestedUniversitiesProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as 'uz' | 'ko' | 'ru' | 'en';
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState<string | null>(null);

  const getUniversityName = (university?: Tables<'universities'>) => {
    if (!university) return 'Unknown';
    const nameKey = `name_${currentLang}` as keyof Tables<'universities'>;
    return (university[nameKey] as string) || university.name_uz || 'Unknown';
  };

  const handleApply = async (suggestion: Suggestion) => {
    setSubmitting(suggestion.id);
    try {
      // 1. Insert into applications
      const { error: insertError } = await supabase.from('applications').insert({
        student_id: suggestion.student_id,
        institution_id: suggestion.institution_id,
        status: 'pending_approval'
      });
      
      if (insertError) throw insertError;

      // 2. Delete suggestion permanently
      await supabase.from('student_suggestions').delete().eq('id', suggestion.id);
      
      toast({ title: t('student.applicationSubmitted', 'Application submitted to CRM') });
      onRefresh();
    } catch (err: any) {
      toast({
        title: 'Failed to submit',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(null);
    }
  };

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      <h2 className="text-lg font-semibold flex items-center gap-2 text-info dark:text-info">
        <Lightbulb className="h-5 w-5" />
        {t('student.suggestedForYou', 'Suggested For You')}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suggestions.map((suggestion) => (
          <Card key={suggestion.id} className="relative overflow-hidden border-info/30 dark:border-info/50 bg-info/10/30 dark:bg-info/10">
            <CardContent className="p-4 flex items-center gap-4">
              {suggestion.university?.logo_url ? (
                <img
                  src={suggestion.university.logo_url}
                  alt=""
                  className="h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <div className="h-12 w-12 bg-info/10 dark:bg-info/30 rounded-xl flex items-center justify-center">
                  <Lightbulb className="h-6 w-6 text-info dark:text-info" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">
                  {getUniversityName(suggestion.university)}
                </h3>
                {suggestion.university?.is_partner && (
                  <p className="text-xs text-muted-foreground mt-0.5">Partner University</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onShowOnMap && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onShowOnMap(suggestion.institution_id)}
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  size="sm" 
                  onClick={() => handleApply(suggestion)}
                  disabled={submitting === suggestion.id}
                  className="h-8"
                >
                  {submitting === suggestion.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" /> Apply
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
