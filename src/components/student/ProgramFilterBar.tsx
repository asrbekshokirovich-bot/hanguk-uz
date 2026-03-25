import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { type ProgramFilters, defaultFilters, useAvailableRegions, useAvailableFaculties } from '@/hooks/useProgramSearch';
import { Search, RotateCcw } from 'lucide-react';

interface ProgramFilterBarProps {
  filters: ProgramFilters;
  onFiltersChange: (filters: ProgramFilters) => void;
  lang: string;
}

export function ProgramFilterBar({ filters, onFiltersChange, lang }: ProgramFilterBarProps) {
  const { t } = useTranslation();
  const { data: regions } = useAvailableRegions();
  const { data: faculties } = useAvailableFaculties();

  // Debounced search
  const [localSearch, setLocalSearch] = useState(filters.searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.searchQuery) {
        onFiltersChange({ ...filters, searchQuery: localSearch });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  // Sync external changes back to local
  useEffect(() => {
    setLocalSearch(filters.searchQuery);
  }, [filters.searchQuery]);

  const update = (partial: Partial<ProgramFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const getRegionLabel = (r: { en: string; uz: string; ru: string; ko: string }) => {
    if (lang === 'ko') return r.ko;
    if (lang === 'ru') return r.ru;
    if (lang === 'en') return r.en;
    return r.uz;
  };

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(defaultFilters);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('finder.searchPlaceholder', 'Search programs, universities...')}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-2">
        {/* Degree Level */}
        <Select value={filters.programLevel} onValueChange={(v) => update({ programLevel: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder={t('finder.degreeLevel', 'Degree Level')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="bachelor">{t('finder.bachelor', 'Bachelor')}</SelectItem>
            <SelectItem value="master">{t('finder.master', 'Master')}</SelectItem>
            <SelectItem value="phd">{t('finder.phd', 'PhD')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Language Track */}
        <Select value={filters.languageTrack} onValueChange={(v) => update({ languageTrack: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder={t('finder.languageTrack', 'Language')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="english">English Track</SelectItem>
            <SelectItem value="korean">Korean Track</SelectItem>
            <SelectItem value="both">{t('universities.bothTracks')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Faculty */}
        <Select value={filters.faculty} onValueChange={(v) => update({ faculty: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder={t('finder.faculty', 'Faculty')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {(faculties || []).map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Region */}
        <Select value={filters.region} onValueChange={(v) => update({ region: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder={t('finder.region', 'Region')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {(regions || []).map((r) => (
              <SelectItem key={r.en} value={r.en}>{getRegionLabel(r)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* TOPIK Filter */}
        <Select value={filters.maxTopik?.toString() || ''} onValueChange={(v) => update({ maxTopik: v === 'all' ? null : Number(v) })}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder={t('finder.topikLevel', 'TOPIK Level')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {[1, 2, 3, 4, 5, 6].map(level => (
              <SelectItem key={level} value={level.toString()}>
                TOPIK ≤ {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tuition Filter */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <Label className="text-xs whitespace-nowrap">
            {t('finder.maxTuition', 'Max Tuition')}
          </Label>
          <Slider
            value={[filters.maxTuition || 10000000]}
            onValueChange={([v]) => update({ maxTuition: v >= 10000000 ? null : v })}
            min={1000000}
            max={10000000}
            step={500000}
            className="w-[100px]"
          />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {filters.maxTuition ? `≤ ${(filters.maxTuition / 1000000).toFixed(1)}M ₩` : t('common.all')}
          </span>
        </div>

        {/* Partner Only */}
        <div className="flex items-center gap-2 px-2">
          <Switch
            id="partner-only"
            checked={filters.partnerOnly}
            onCheckedChange={(v) => update({ partnerOnly: v })}
          />
          <Label htmlFor="partner-only" className="text-xs cursor-pointer">
            {t('finder.partnerOnly', 'Partner Only')}
          </Label>
        </div>

        {/* Reset */}
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { onFiltersChange(defaultFilters); setLocalSearch(''); }}>
            <RotateCcw className="h-3 w-3 mr-1" />
            {t('finder.resetFilters', 'Reset')}
          </Button>
        )}
      </div>
    </div>
  );
}
