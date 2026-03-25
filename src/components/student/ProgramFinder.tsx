import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProgramFilterBar } from './ProgramFilterBar';
import { ProgramCard } from './ProgramCard';
import { ScholarshipCard } from './ScholarshipCard';
import { type ProgramFilters, defaultFilters, useProgramSearch } from '@/hooks/useProgramSearch';
import { useScholarships, type ScholarshipFilters } from '@/hooks/useScholarships';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, Award, Search, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ProgramFinder() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Search className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">
        {t('finder.comingSoon', 'Coming Soon')}
      </h2>
      <p className="text-muted-foreground max-w-md">
        {t('finder.comingSoonDesc', 'The Program Finder is being prepared with the latest university data. Stay tuned!')}
      </p>
    </div>
  );
}
