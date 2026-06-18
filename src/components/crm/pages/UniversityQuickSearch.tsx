import { useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, MapPin, Clock } from 'lucide-react';

const RECENT_KEY = 'crm-uni-recent';

interface QuickInstitution {
  id: string;
  name_ko: string;
  name_en: string | null;
  city_ko: string | null;
}

function useQuickInstitutions() {
  return useQuery({
    queryKey: ['crm-quick-institutions'],
    queryFn: async (): Promise<QuickInstitution[]> => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, name_ko, name_en, city_ko')
        .order('name_ko');
      if (error) throw error;
      return (data || []) as QuickInstitution[];
    },
    staleTime: 5 * 60_000,
  });
}

export function getRecentUniversityIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function pushRecentUniversity(id: string) {
  try {
    const current = getRecentUniversityIds().filter(x => x !== id);
    current.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, 6)));
  } catch {
    /* ignore */
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (inst: QuickInstitution) => void;
}

export type { QuickInstitution };

export function UniversityQuickSearch({ open, onOpenChange, onSelect }: Props) {
  const { data: institutions } = useQuickInstitutions();
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) setRecentIds(getRecentUniversityIds());
  }, [open]);

  const byId = new Map((institutions || []).map(i => [i.id, i]));
  const recent = recentIds.map(id => byId.get(id)).filter(Boolean) as QuickInstitution[];

  const handleSelect = (inst: QuickInstitution) => {
    pushRecentUniversity(inst.id);
    onOpenChange(false);
    onSelect(inst);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Universitet nomi (한국어 yoki English)..." />
      <CommandList>
        <CommandEmpty>Universitet topilmadi.</CommandEmpty>

        {recent.length > 0 && (
          <CommandGroup heading="Oxirgi ko'rilganlar">
            {recent.map((inst) => (
              <CommandItem
                key={`recent-${inst.id}`}
                value={`recent ${inst.name_ko} ${inst.name_en ?? ''}`}
                onSelect={() => handleSelect(inst)}
              >
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">{inst.name_ko}</span>
                {inst.name_en && <span className="ml-2 text-xs text-muted-foreground">{inst.name_en}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Barcha universitetlar">
          {(institutions || []).map((inst) => (
            <CommandItem
              key={inst.id}
              value={`${inst.name_ko} ${inst.name_en ?? ''} ${inst.city_ko ?? ''}`}
              onSelect={() => handleSelect(inst)}
            >
              <GraduationCap className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="font-medium">{inst.name_ko}</span>
              {inst.name_en && <span className="ml-2 text-xs text-muted-foreground">{inst.name_en}</span>}
              {inst.city_ko && (
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />{inst.city_ko}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
