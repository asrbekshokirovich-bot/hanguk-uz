import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Shield,
  Building2,
} from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DeadlineBadge, getDeadlineInfo, type DeadlineInfo } from './DeadlineBadge';
import { UniversityAdmissionsSheet } from './UniversityAdmissionsSheet';
import { UniversityQuickSearch, pushRecentUniversity, type QuickInstitution } from './UniversityQuickSearch';
import { Command as CommandIcon } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────

interface Filters {
  searchQuery: string;
  semester: string;
  admissionStatus: string;
  programLevel: string;
  languageTrack: string;
  region: string;
  partnerOnly: boolean;
  ieqasOnly: boolean;
  maxTopik: number | null;
  cycleTrack: string;
  dataStatus: string;
}

const defaultFilters: Filters = {
  searchQuery: '',
  semester: '',
  admissionStatus: '',
  programLevel: '',
  languageTrack: '',
  region: '',
  partnerOnly: false,
  ieqasOnly: false,
  maxTopik: null,
  cycleTrack: '',
  dataStatus: '',
};

type Completeness = 'empty' | 'partial' | 'complete';

function getCompleteness(reqCount: number, periodCount: number): Completeness {
  if (reqCount === 0 && periodCount === 0) return 'empty';
  if (reqCount > 0 && periodCount > 0) return 'complete';
  return 'partial';
}

interface Institution {
  id: string;
  name_ko: string;
  name_en: string | null;
  city_ko: string | null;
  region_code: string | null;
  is_partner: boolean | null;
  tier: number | null;
  logo_url: string | null;
  primary_domain: string | null;
  primary_admissions_url_ko: string | null;
  institution_type: string | null;
  ieqas_status: string | null;
  is_women_only: boolean | null;
}

interface AdmissionPeriod {
  id: string;
  institution_id: string;
  semester: string | null;
  year: number | null;
  application_start: string | null;
  application_end: string | null;
  document_deadline: string | null;
  result_announcement: string | null;
  program_level: string | null;
  language_track: string | null;
}

interface RequirementInfo {
  institution_id: string;
  topik_min_level: number | null;
  english_test: Record<string, unknown> | null;
  applicant_category: string | null;
  cycle_track: string | null;
  intake_term: string | null;
  intake_year: number | null;
}

interface EnrichedInstitution {
  institution: Institution;
  nearestPeriod: AdmissionPeriod | null;
  deadline: DeadlineInfo | null;
  requirements: RequirementInfo[];
  minTopik: number | null;
  allPeriods: AdmissionPeriod[];
}

// ── Data hook ─────────────────────────────────────────────────────

function useCrmInstitutionSearch(filters: Filters) {
  return useQuery({
    queryKey: ['crm-institution-search', filters],
    queryFn: async (): Promise<EnrichedInstitution[]> => {
      const [instRes, periodRes, reqRes] = await Promise.all([
        supabase.from('institutions').select('id, name_ko, name_en, city_ko, region_code, is_partner, tier, logo_url, primary_domain, primary_admissions_url_ko, institution_type, ieqas_status, is_women_only'),
        supabase.from('university_admission_periods').select('id, institution_id, semester, year, application_start, application_end, document_deadline, result_announcement, program_level, language_track'),
        supabase.from('requirements').select('topik_min_level, english_test, applicant_category, cycle_id').then(async (res) => {
          if (!res.data || res.data.length === 0) return { data: [], error: null };
          const cycleIds = [...new Set(res.data.map(r => r.cycle_id).filter(Boolean))];
          const { data: cycles } = await supabase.from('admission_cycles').select('id, institution_id, cycle_track, intake_term, intake_year').in('id', cycleIds);
          const cycleMap = new Map((cycles || []).map(c => [c.id, c]));
          return {
            data: res.data.map(r => {
              const c = cycleMap.get(r.cycle_id!);
              return {
                institution_id: c?.institution_id || '',
                topik_min_level: r.topik_min_level,
                english_test: r.english_test as Record<string, unknown> | null,
                applicant_category: r.applicant_category,
                cycle_track: c?.cycle_track || null,
                intake_term: c?.intake_term || null,
                intake_year: c?.intake_year || null,
              } as RequirementInfo;
            }),
            error: null,
          };
        }),
      ]);

      if (instRes.error) throw instRes.error;
      const institutions = (instRes.data || []) as Institution[];
      const periods = (periodRes.data || []) as AdmissionPeriod[];
      const requirements = (reqRes.data || []) as RequirementInfo[];

      const periodsByInst = new Map<string, AdmissionPeriod[]>();
      periods.forEach(p => {
        const arr = periodsByInst.get(p.institution_id) || [];
        arr.push(p);
        periodsByInst.set(p.institution_id, arr);
      });

      const reqsByInst = new Map<string, RequirementInfo[]>();
      requirements.forEach(r => {
        if (!r.institution_id) return;
        const arr = reqsByInst.get(r.institution_id) || [];
        arr.push(r);
        reqsByInst.set(r.institution_id, arr);
      });

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      let results: EnrichedInstitution[] = institutions.map(inst => {
        const instPeriods = periodsByInst.get(inst.id) || [];
        const instReqs = reqsByInst.get(inst.id) || [];

        // Find nearest open/upcoming period
        const sorted = [...instPeriods].sort((a, b) => {
          const aEnd = a.application_end ? new Date(a.application_end).getTime() : Infinity;
          const bEnd = b.application_end ? new Date(b.application_end).getTime() : Infinity;
          return aEnd - bEnd;
        });

        const nearestPeriod = sorted.find(p => {
          if (!p.application_end) return false;
          return new Date(p.application_end) >= now;
        }) || sorted[sorted.length - 1] || null;

        const deadline = nearestPeriod
          ? getDeadlineInfo(nearestPeriod.application_start, nearestPeriod.application_end)
          : null;

        const topikLevels = instReqs.map(r => r.topik_min_level).filter((v): v is number => v != null);
        const minTopik = topikLevels.length > 0 ? Math.min(...topikLevels) : null;

        return { institution: inst, nearestPeriod, deadline, requirements: instReqs, minTopik, allPeriods: instPeriods };
      });

      // Client-side filters
      if (filters.partnerOnly) {
        results = results.filter(r => r.institution.is_partner === true);
      }
      if (filters.ieqasOnly) {
        results = results.filter(r => r.institution.ieqas_status === 'certified');
      }
      if (filters.region) {
        const reg = filters.region.toLowerCase();
        results = results.filter(r => r.institution.city_ko?.toLowerCase().includes(reg) || r.institution.region_code?.toLowerCase() === reg);
      }
      if (filters.maxTopik) {
        results = results.filter(r => r.minTopik != null && r.minTopik <= filters.maxTopik!);
      }
      if (filters.programLevel) {
        results = results.filter(r => r.allPeriods.some(p => p.program_level === filters.programLevel));
      }
      if (filters.languageTrack) {
        results = results.filter(r => r.allPeriods.some(p => p.language_track === filters.languageTrack));
      }
      if (filters.semester) {
        results = results.filter(r => r.allPeriods.some(p => p.semester === filters.semester));
      }
      if (filters.cycleTrack) {
        results = results.filter(r => r.requirements.some(req => req.cycle_track === filters.cycleTrack));
      }
      if (filters.dataStatus) {
        results = results.filter(r => getCompleteness(r.requirements.length, r.allPeriods.length) === filters.dataStatus);
      }
      if (filters.admissionStatus === 'open') {
        results = results.filter(r => r.deadline?.status === 'closing-soon' || r.deadline?.status === 'open');
      } else if (filters.admissionStatus === 'upcoming') {
        results = results.filter(r => r.deadline?.status === 'upcoming');
      } else if (filters.admissionStatus === 'closed') {
        results = results.filter(r => r.deadline?.status === 'closed');
      }
      if (filters.searchQuery) {
        const sq = filters.searchQuery.toLowerCase();
        results = results.filter(r => {
          const inst = r.institution;
          if (inst.name_ko?.toLowerCase().includes(sq)) return true;
          if (inst.name_en?.toLowerCase().includes(sq)) return true;
          if (inst.city_ko?.toLowerCase().includes(sq)) return true;
          if (r.requirements.some(req => req.applicant_category?.toLowerCase().includes(sq))) return true;
          return false;
        });
      }

      // Sort: open/closing-soon first, then by days left
      results.sort((a, b) => deadlineSortScore(a.deadline) - deadlineSortScore(b.deadline));

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

// ── Filter Bar ─────────────────────────────────────────────────────

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const { data: regions } = useRegions();
  const [localSearch, setLocalSearch] = useState(filters.searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.searchQuery) {
        onChange({ ...filters, searchQuery: localSearch });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  useEffect(() => {
    setLocalSearch(filters.searchQuery);
  }, [filters.searchQuery]);

  const update = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(defaultFilters);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Universitet, yo'nalish, fakultet nomi bilan qidirish..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filters.dataStatus || 'all'} onValueChange={(v) => update({ dataStatus: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Ma'lumot holati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            <SelectItem value="empty">🔴 To'ldirilmagan</SelectItem>
            <SelectItem value="partial">🟡 Qisman</SelectItem>
            <SelectItem value="complete">🟢 To'liq</SelectItem>
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

        <Select value={filters.programLevel || 'all'} onValueChange={(v) => update({ programLevel: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Daraja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            <SelectItem value="undergraduate">Bakalavr</SelectItem>
            <SelectItem value="graduate">Magistr</SelectItem>
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
          </SelectContent>
        </Select>

        <Select value={filters.cycleTrack || 'all'} onValueChange={(v) => update({ cycleTrack: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="Qabul turi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            <SelectItem value="foreign">Xorijiy (Foreign)</SelectItem>
            <SelectItem value="overseas_korean_full">Koreys diaspora</SelectItem>
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

        <div className="flex items-center gap-2 px-2">
          <Switch id="crm-partner" checked={filters.partnerOnly} onCheckedChange={(v) => update({ partnerOnly: v })} />
          <Label htmlFor="crm-partner" className="text-xs cursor-pointer">Hamkor</Label>
        </div>

        <div className="flex items-center gap-2 px-2">
          <Switch id="crm-ieqas" checked={filters.ieqasOnly} onCheckedChange={(v) => update({ ieqasOnly: v })} />
          <Label htmlFor="crm-ieqas" className="text-xs cursor-pointer">IEQAS</Label>
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

// ── Institution Card ──────────────────────────────────────────────

function CompletenessBadge({ status }: { status: Completeness }) {
  if (status === 'empty') {
    return <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-600 bg-red-500/5">🔴 To'ldirilmagan</Badge>;
  }
  if (status === 'partial') {
    return <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 bg-amber-500/5">🟡 Qisman</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600 bg-emerald-500/5">🟢 To'liq</Badge>;
}

function InstitutionCard({ item, onClick }: { item: EnrichedInstitution; onClick: () => void }) {
  const inst = item.institution;
  const period = item.nearestPeriod;
  const completeness = getCompleteness(item.requirements.length, item.allPeriods.length);

  const typeLabel = inst.institution_type === 'private' ? 'Xususiy' : inst.institution_type === 'national' ? 'Davlat' : inst.institution_type || '';

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {inst.logo_url ? (
            <img src={inst.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-muted flex-shrink-0" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{inst.name_ko}</h3>
              {inst.is_partner && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">Hamkor</Badge>
              )}
              {inst.ieqas_status === 'certified' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/50 text-emerald-600">
                  <Shield className="h-2.5 w-2.5 mr-0.5" />IEQAS
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {inst.city_ko || '—'}
              {inst.tier && <span className="ml-2">#{inst.tier}</span>}
              {typeLabel && (
                <Badge variant="outline" className="text-[9px] ml-1 py-0">{typeLabel}</Badge>
              )}
            </div>
          </div>
          {item.deadline && <DeadlineBadge info={item.deadline} />}
        </div>

        {inst.name_en && (
          <p className="text-xs text-muted-foreground">{inst.name_en}</p>
        )}

        {/* Requirements summary */}
        <div className="flex flex-wrap gap-1.5">
          <CompletenessBadge status={completeness} />
          {item.minTopik != null && (
            <Badge variant="outline" className="text-[10px]">TOPIK ≥ {item.minTopik}</Badge>
          )}
          {item.requirements.some(r => r.english_test) && (
            <Badge variant="outline" className="text-[10px]">English test</Badge>
          )}
          {item.requirements.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {item.requirements.length} ta talab
            </Badge>
          )}
          {item.allPeriods.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {item.allPeriods.length} ta qabul davri
            </Badge>
          )}
        </div>

        {/* Nearest admission period */}
        {period && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {period.application_start?.slice(0, 10) || '?'} → {period.application_end?.slice(0, 10) || '?'}
            {period.semester && (
              <Badge variant="outline" className="text-[10px] ml-1">
                {period.semester === 'spring' ? 'Bahor' : 'Kuz'} {period.year}
              </Badge>
            )}
            {period.program_level && (
              <Badge variant="outline" className="text-[10px]">
                {period.program_level === 'undergraduate' ? 'Bakalavr' : period.program_level === 'graduate' ? 'Magistr' : period.program_level}
              </Badge>
            )}
            {period.language_track && (
              <Badge className={`text-[10px] border-0 ${period.language_track === 'english' ? 'bg-info/10 text-info' : 'bg-success/10 text-success'}`}>
                {period.language_track === 'english' ? 'English' : '한국어'}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {inst.institution_type || '—'}
            {inst.is_women_only && <Badge variant="outline" className="text-[9px] ml-1 py-0">Women only</Badge>}
          </div>
          {inst.primary_admissions_url_ko && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const { data: results, isLoading } = useCrmInstitutionSearch(filters);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const openInstitutionById = (inst: QuickInstitution) => {
    // Build a minimal institution object for the sheet (it only needs id + names for the header).
    setSelectedInstitution({ id: inst.id, name_ko: inst.name_ko, name_en: inst.name_en, city_ko: inst.city_ko } as unknown as Institution);
    setSheetOpen(true);
  };

  const stats = useMemo(() => {
    if (!results) return null;
    const open = results.filter(r => r.deadline?.status === 'open' || r.deadline?.status === 'closing-soon').length;
    const upcoming = results.filter(r => r.deadline?.status === 'upcoming').length;
    const empty = results.filter(r => getCompleteness(r.requirements.length, r.allPeriods.length) === 'empty').length;
    return { total: results.length, open, upcoming, empty };
  }, [results]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Universitet Qidiruv
          </h2>
          <p className="text-sm text-muted-foreground">
            Universitetlarni nomi, yo'nalishi, sertifikatlari bo'yicha qidiring. Eng yaqin deadline tepada.
          </p>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 mt-2" onClick={() => setQuickOpen(true)}>
            <CommandIcon className="h-3 w-3" /> Tez qidiruv
            <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-muted rounded border">⌘K</kbd>
          </Button>
        </div>
        {stats && (
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-sm">{stats.total} ta universitet</Badge>
            {stats.empty > 0 && (
              <Badge variant="outline" className="text-sm border-red-500/50 text-red-600 cursor-pointer" onClick={() => setFilters(f => ({ ...f, dataStatus: 'empty' }))}>
                {stats.empty} ta to'ldirilmagan
              </Badge>
            )}
            {stats.open > 0 && <Badge variant="default" className="text-sm bg-emerald-600">{stats.open} ta ochiq</Badge>}
            {stats.upcoming > 0 && <Badge variant="outline" className="text-sm">{stats.upcoming} ta kutilmoqda</Badge>}
          </div>
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
          {results.map((item) => (
            <InstitutionCard key={item.institution.id} item={item} onClick={() => { pushRecentUniversity(item.institution.id); setSelectedInstitution(item.institution); setSheetOpen(true); }} />
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

      <UniversityQuickSearch
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onSelect={openInstitutionById}
      />

      <UniversityAdmissionsSheet
        institution={selectedInstitution as any}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
