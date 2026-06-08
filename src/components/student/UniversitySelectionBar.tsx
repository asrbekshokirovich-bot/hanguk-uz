import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles, Star } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface UniversitySelectionBarProps {
  selectedUniversities: Tables<'universities'>[];
  onRemove: (id: string) => void;
  onCompare: () => void;
  maxSelections?: number;
}

export const UniversitySelectionBar = forwardRef<HTMLDivElement, UniversitySelectionBarProps>(function UniversitySelectionBar({ 
  selectedUniversities, 
  onRemove, 
  onCompare,
  maxSelections = 4
}, ref) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as 'uz' | 'ko' | 'ru' | 'en';
  const isMobile = useIsMobile();

  const getUniversityName = (university: Tables<'universities'>) => {
    const nameKey = `name_${currentLang}` as keyof Tables<'universities'>;
    return (university[nameKey] as string) || university.name_en || university.name_ko || university.name_uz;
  };

  if (selectedUniversities.length === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="fixed left-0 right-0 z-50 bg-background/95 backdrop-blur border-t shadow-lg animate-in slide-in-from-bottom-4"
      style={{ bottom: isMobile ? '60px' : '0px' }}
    >
      <div className="container max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Selected Universities */}
          <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {t('universities.selected')} ({selectedUniversities.length}/{maxSelections}):
            </span>
            <div className="flex gap-2">
              {selectedUniversities.map(uni => (
                <Badge 
                  key={uni.id} 
                  variant="secondary" 
                  className="flex items-center gap-1 px-3 py-1.5 text-sm whitespace-nowrap"
                >
                  {uni.is_partner && <Star className="h-3 w-3 text-warning" />}
                  <span className="max-w-[150px] truncate">{getUniversityName(uni)}</span>
                  <button 
                    onClick={() => onRemove(uni.id)}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Compare Button */}
          <Button 
            onClick={onCompare}
            disabled={selectedUniversities.length < 2}
            className="flex-shrink-0 gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {t('universities.aiCompare')}
          </Button>
        </div>
        
        {selectedUniversities.length < 2 && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('universities.selectMoreToCompare')}
          </p>
        )}
      </div>
    </div>
  );
});
