import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  RotateCcw,
  GraduationCap,
  MapPin,
  ExternalLink,
  Clock,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DeadlineBadge, getDeadlineInfo, type DeadlineInfo } from './DeadlineBadge';

// ── Types ──────────────────────────────────────────────────────────

interface ProgramFilters {
  programLevel: string;
  languageTrack: string;
  region: string;
  faculty: string;
  maxTuition: number | null;
  maxTopik: number | null;
  partnerOnly: boolean;
  searchQuery: string;
  semester: string;
  admissionStatus: string;
}

const defaultFilters: ProgramFilters = {
  programLevel: '',
  languageTrack: '',
  region: '',
  faculty: '',
  maxTuition: null,
  maxTopik: null,
  partnerOnly: false,
  searchQuery: '',
  semester: '',
  admissionStatus: '',
};

interface ProgramRow {
  id: string;
  program_name: string;
  program_level: string;
  faculty_name: string | null;
  department_name: string | null;
  language_track: string;
  tuition_per_semester: number | null;
  tuition_per_year: number | null;
  topik_requirement: number | null;
  ielts_requirement: number | null;
  toefl_requirement: number | null;
  notes: string | null;
  institution_id: string | null;
}

interface InstitutionRow {
  id: string;
  name_ko: string;
  name_en: string | null;
  city_ko: string | null;
  is_partner: boolean | null;
  tier: number | null;
  logo_url: string | null;
  primary_domain: string | null;
  primary_admissions_url_ko: string | null;
  institution_type: string | null;
  ieqas_status: string | null;
}

interface AdmissionPeriodRow {
  id: string;
  institution_id: string | null;
  program_level: string | null;
  semester: string | null;
  year: number | null;
  application_start: string | null;
  application_end: string | null;
}

interface EnrichedProgram extends ProgramRow {
  institution: InstitutionRow | null;
  deadline: DeadlineInfo | null;
  admission_period: AdmissionPeriodRow | null;
}

// ── Data hooks ─────────────────────────────────────────────────────

function useCrmProgramSearch(filters: ProgramFilters) {
  return useQuery({
    queryKey: ['crm-program-search', filters],
    queryFn: async (): Promise<EnrichedProgram[]> => {
      // 1) Fetch programs
      let q = supabase
        .from('university_programs')
        .select('id, program_name, program_level, faculty_name, department_name, language_track, tuition_per_semester, tuition_per_year, topik_requirement, ielts_requirement, toefl_requirement, notes, institution_id')
        .eq('is_available_for_international', true);

      if (filters.programLevel) q = q.eq('program_level', filters.programLevel);
      if (filters.languageTrack) q = q.eq('language_track', filters.languageTrack);
      if (filters.maxTopik) q = q.or(`topik_requirement.lte.${filters.maxTopik},topik_requirement.is.null`);
      if (filters.maxTuition) q = q.lte('tuition_per_semester', filters.maxTuition);

      const { data: programs, error: pErr } = await q.order('program_name').limit(500);
      if (pErr) throw pErr;
      if (!programs || programs.length === 0) return [];

      // 2) Fetch institutions
      const instIds = [...new Set((programs as ProgramRow[]).map(p => p.institution_id).filter(Boolean))];
      const { data: institutions } = await supabase
        .from('institutions')
        .select('id, name_ko, name_en, city_ko, is_partner, tier, logo_url, primary_domain, primary_admissions_url_ko, institution_type, ieqas_status')
        .in('id', instIds);

      const instMap = new Map((institutions || []).map(i => [i.id, i as InstitutionRow]));

      // 3) Fetch admission periods
      const { data: periods } = await supabase
        .from('university_admission_periods')
        .select('id, institution_id, program_level, semester, year, application_start, application_end')
        .in('institution_id', instIds);

      const periodsByInst = new Map<string, AdmissionPeriodRow[]>();
      (periods || []).forEach(p => {
        const arr = periodsByInst.get(p.institution_id!) || [];
        arr.push(p as AdmissionPeriodRow);
        periodsByInst.set(p.institution_id!, arr);
      });

      const now = new Date();

      // 4) Enrich
      let results: EnrichedProgram[] = (programs as ProgramRow[]).map(prog => {
        const inst = instMap.get(prog.institution_id!) || null;
        const instPeriods = periodsByInst.get(prog.institution_id!) || [];

        // Find the best matching admission period
        const matchingPeriod = instPeriods
          .filter(p => !p.program_level || p.program_level === prog.program_level)
          .sort((a, b) => {
            const aEnd = a.application_end ? new Date(a.application_end).getTime() : Infinity;
            const bEnd = b.application_end ? new Date(b.application_end).getTime() : Infinity;
            return aEnd - bEnd;
          })
          .find(p => {
            if (!p.application_end) return false;
            return new Date(p.application_end) >= now || !instPeriods.some(other => other.application_end && new Date(other.application_end) >= now);
          }) || instPeriods[0] || null;

        const deadline = matchingPeriod
          ? getDeadlineInfo(matchingPeriod.application_start, matchingPeriod.application_end)
          : null;

        return { ...prog, institution: inst, deadline, admission_period: matchingPeriod };
      });

      // 5) Client-side filters
      if (filters.partnerOnly) {
        results = results.filter(p => p.institution?.is_partner === true);
      }
      if (filters.region) {
        const r = filters.region.toLowerCase();
        results = results.filter(p => p.institution?.city_ko?.toLowerCase().includes(r));
      }
      if (filters.faculty) {
        const f = filters.faculty.toLowerCase();
        results = results.filter(p => p.faculty_name?.toLowerCase().includes(f));
      }
      if (filters.searchQuery) {
        const sq = filters.searchQuery.toLowerCase();
        results = results.filter(p =>
          p.program_name.toLowerCase().includes(sq) ||
          p.faculty_name?.toLowerCase().includes(sq) ||
          p.institution?.name_en?.toLowerCase().includes(sq) ||
          p.institution?.name_ko?.toLowerCase().includes(sq)
        );
      }
      if (filters.semester) {
        results = results.filter(p => p.admission_period?.semester === filters.semester);
      }
      if (filters.admissionStatus === 'open') {
        results = results.filter(p => p.deadline?.status === 'closing-soon' || p.deadline?.status === 'open');
      } else if (filters.admissionStatus === 'upcoming') {
        results = results.filter(p => p.deadline?.status === 'upcoming');
      } else if (filters.admissionStatus === 'closed') {
        results = results.filter(p => p.deadline?.status === 'closed');
      }

      // 6) Sort by deadline
      results.sort((a, b) => {
        const aScore = deadlineSortScore(a.deadline);
        const bScore = deadlineSortScore(b.deadline);
        return aScore - bScore;
      });

      return results;
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

function deadlineSortScore(d: DeadlineInfo | null): number {
  if (!d) return 99999;
  if (d.status === 'closed') return 90000 + (d.daysLeft ?? 0);
  if (d.status === 'closing-soon') return 1000 + (d.daysLeft ?? 0);
  if (d.status === 'open') return 2000 + (d.daysLeft ?? 0);
  if (d.status === 'upcoming') return 3000 + (d.daysLeft ?? 0);
  return 50000;
}

function useRegions() {
  return useQuery({
    queryKey: ['crm-regions'],
    queryFn: async () => {
      const { data } = await supabase.from('institutions').select('city_ko').not('city_ko', 'is', null);
      return [...new Set((data || []).map(d => d.city_ko).filter(Boolean) as string[])].sort();
    },
    staleTime: 60_000,
  });
}

function useFaculties() {
  return useQuery({
    queryKey: ['crm-faculties'],
    queryFn: async () => {
      const { data } = await supabase.from('university_programs').select('faculty_name').eq('is_available_for_international', true).not('faculty_name', 'is', null);
      return [...new Set((data || []).map(d => d.faculty_name).filter(Boolean) as string[])].sort();
    },
    staleTime: 60_000,
  });
}

// ── Filter Bar ─────────────────────────────────────────────────────

function FilterBar({ filters, onChange }: { filters: ProgramFilters; onChange: (f: ProgramFilters) => void }) {
  const { t } = useTranslation();
  const { data: regions } = useRegions();
  const { data: faculties } = useFaculties();

  const [localSearch, setLocalSearch] = useState(filters.searchQuery);

  const update = (partial: Partial<ProgramFilters>) => onChange({ ...filters, ...partial });

  // Debounced search
  const handleSearch = (val: string) => {
    setLocalSearch(val);
    const timer = setTimeout(() => update({ searchQuery: val }), 300);
    return () => clearTimeout(timer);
  };

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(defaultFilters);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Universitet yoki dastur qidirish..."
          value={localSearch}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filters.programLevel || 'all'} onValueChange={(v) => update({ programLevel: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Daraja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            <SelectItem value="bachelor">Bakalavr</SelectItem>
            <SelectItem value="master">Magistr</SelectItem>
            <SelectItem value="phd">PhD</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.languageTrack || 'all'} onValueChange={(v) => update({ languageTrack: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Til" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            <SelectItem value="english">English</SelectItem>
            <SelectItem value="korean">Korean</SelectItem>
            <SelectItem value="both">Ikkalasi</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.semester || 'all'} onValueChange={(v) => update({ semester: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Semestr" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            <SelectItem value="spring">Bahor (Spring)</SelectItem>
            <SelectItem value="fall">Kuz (Fall)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.admissionStatus || 'all'} onValueChange={(v) => update({ admissionStatus: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="Qabul holati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            <SelectItem value="open">Ochiq</SelectItem>
            <SelectItem value="upcoming">Tez orada</SelectItem>
            <SelectItem value="closed">Yopilgan</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.faculty || 'all'} onValueChange={(v) => update({ faculty: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <SelectValue placeholder="Fakultet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            {(faculties || []).map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.region || 'all'} onValueChange={(v) => update({ region: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Shahar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            {(regions || []).map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.maxTopik?.toString() || 'all'} onValueChange={(v) => update({ maxTopik: v === 'all' ? null : Number(v) })}>
          <SelectTrigger className="w-[120px] h-9 text-xs">
            <SelectValue placeholder="TOPIK" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            {[1, 2, 3, 4, 5, 6].map(level => (
              <SelectItem key={level} value={level.toString()}>TOPIK ≤ {level}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 min-w-[180px]">
          <Label className="text-xs whitespace-nowrap">Narx</Label>
          <Slider
            value={[filters.maxTuition || 10000000]}
            onValueChange={([v]) => update({ maxTuition: v >= 10000000 ? null : v })}
            min={1000000}
            max={10000000}
            step={500000}
            className="w-[80px]"
          />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {filters.maxTuition ? `≤ ${(filters.maxTuition / 1000000).toFixed(1)}M ₩` : 'Barchasi'}
          </span>
        </div>

        <div className="flex items-center gap-2 px-2">
          <Switch id="crm-partner" checked={filters.partnerOnly} onCheckedChange={(v) => update({ partnerOnly: v })} />
          <Label htmlFor="crm-partner" className="text-xs cursor-pointer">Hamkor</Label>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { onChange(defaultFilters); setLocalSearch(''); }}>
            <RotateCcw className="h-3 w-3 mr-1" /> Tozalash
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Program Card ───────────────────────────────────────────────────

function CrmProgramCard({ program }: { program: EnrichedProgram }) {
  const inst = program.institution;

  const trackLabel = program.language_track === 'english' ? 'English'
    : program.language_track === 'korean' ? '한국어' : 'Both';

  const trackColor = program.language_track === 'english'
    ? 'bg-info/10 text-info'
    : program.language_track === 'korean'
    ? 'bg-success/10 text-success'
    : 'bg-primary/10 text-primary';

  const fmtKRW = (n: number | null) => n ? `₩${n.toLocaleString()}` : '—';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {inst?.logo_url ? (
            <img src={inst.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-muted flex-shrink-0" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{inst?.name_ko || 'Unknown'}</h3>
              {inst?.is_partner && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">Hamkor</Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {inst?.city_ko || '—'}
              {inst?.tier && <span className="ml-2">#{inst.tier}</span>}
            </div>
          </div>
          {program.deadline && <DeadlineBadge info={program.deadline} />}
        </div>

        <div>
          <p className="font-medium text-sm">{program.program_name}</p>
          {program.faculty_name && (
            <p className="text-xs text-muted-foreground">{program.faculty_name}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px]">{program.program_level}</Badge>
          <Badge className={`text-[10px] border-0 ${trackColor}`}>{trackLabel}</Badge>
          {program.topik_requirement && (
            <Badge variant="outline" className="text-[10px]">TOPIK {program.topik_requirement}</Badge>
          )}
          {program.ielts_requirement && (
            <Badge variant="outline" className="text-[10px]">IELTS {program.ielts_requirement}</Badge>
          )}
        </div>

        {program.admission_period && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {program.admission_period.application_start?.slice(0, 10) || '?'} → {program.admission_period.application_end?.slice(0, 10) || '?'}
            {program.admission_period.semester && (
              <Badge variant="outline" className="text-[10px] ml-1">{program.admission_period.semester === 'spring' ? 'Bahor' : 'Kuz'} {program.admission_period.year}</Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t">
          <div className="text-xs">
            <span className="text-muted-foreground">Narx:</span>{' '}
            <span className="font-medium">{fmtKRW(program.tuition_per_semester)}<span className="text-muted-foreground">/sem</span></span>
          </div>
          {inst?.primary_admissions_url_ko && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <a href={inst.primary_admissions_url_ko} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" /> Sayt
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function ProgramFinderContent() {
  const [filters, setFilters] = useState<ProgramFilters>(defaultFilters);
  const { data: results, isLoading } = useCrmProgramSearch(filters);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Dastur Qidiruv
          </h2>
          <p className="text-sm text-muted-foreground">
            Universitetlar va dasturlarni filterlab qidiring. Eng yaqin deadline tepada.
          </p>
        </div>
        {results && (
          <Badge variant="secondary" className="text-sm">
            {results.length} ta natija
          </Badge>
        )}
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : results && results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map((prog) => (
            <CrmProgramCard key={prog.id} program={prog} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Natija topilmadi. Filterlarni o'zgartiring.</p>
        </div>
      )}
    </div>
  );
}
